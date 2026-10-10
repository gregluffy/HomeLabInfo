using System.Collections.Concurrent;
using System.Diagnostics;
using System.Globalization;
using System.Net;
using System.Net.NetworkInformation;
using System.Net.Sockets;
using System.Runtime.InteropServices;
using System.Text.RegularExpressions;
using HomeLabInfo.Api.Models;
using Zeroconf;

namespace HomeLabInfo.Api.Services;

public class NetworkScannerService
{
    private static readonly TimeSpan DnsLookupTimeout = TimeSpan.FromSeconds(2);
    private static readonly TimeSpan ProcessTimeout = TimeSpan.FromSeconds(60);

    // Linux interface names: max 15 chars, no leading '-' so it can't be read as an arp-scan option.
    private static readonly Regex InterfaceNameRegex = new(@"^[A-Za-z0-9][A-Za-z0-9_.:@-]{0,14}$");

    private readonly ILogger<NetworkScannerService> _logger;

    public NetworkScannerService(ILogger<NetworkScannerService> logger)
    {
        _logger = logger;
    }

    public async Task<List<NetworkDevice>> ScanNetworkAsync(List<string> baseIps, bool doPortScan, string? scanInterface = null)
    {
        var foundHostsBag = new ConcurrentBag<NetworkDevice>();
        var mdnsTask = DiscoverMdnsHostsAsync();
        var scanTasks = new List<Task>();

        var prefixes = NormalizePrefixes(baseIps);

        // Prefixes arp-scan actually found hosts in. Anything else falls back to a ping sweep:
        // a run on the wrong interface "succeeds" with zero replies.
        var arpScannedPrefixes = new HashSet<string>();
        var arpScanResults = new Dictionary<string, string>(); // IP -> MAC

        if (RuntimeInformation.IsOSPlatform(OSPlatform.Linux))
        {
            bool useInterface = !string.IsNullOrWhiteSpace(scanInterface);
            if (useInterface && !InterfaceNameRegex.IsMatch(scanInterface!))
            {
                _logger.LogWarning("Ignoring invalid ScanInterface setting {Interface}", scanInterface);
                useInterface = false;
            }

            foreach (var prefix in prefixes)
            {
                // Without -I, arp-scan uses the first interface that is up, which on hosts with
                // bridges or several NICs is often not the one on this subnet.
                string? iface = useInterface ? scanInterface : FindInterfaceForPrefix(prefix);
                if (iface == null)
                {
                    // No local interface on this subnet (e.g. a routed VLAN): ARP can't cross a
                    // router, so leave it to the ping sweep.
                    continue;
                }
                var args = new List<string>();
                args.AddRange(["-I", iface]);
                args.AddRange([$"{prefix}0/24", "-q"]);

                try
                {
                    string output = await RunProcessAsync("arp-scan", args);
                    if (!string.IsNullOrWhiteSpace(output) && output.Contains("Starting arp-scan"))
                    {
                        var matches = Regex.Matches(output, @"(?<ip>\d{1,3}(\.\d{1,3}){3})\s+(?<mac>([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2}))");
                        foreach (Match match in matches)
                        {
                            var ip = match.Groups["ip"].Value;
                            var mac = match.Groups["mac"].Value.Replace('-', ':').ToUpperInvariant();
                            arpScanResults[ip] = mac;
                            if (ip.StartsWith(prefix)) arpScannedPrefixes.Add(prefix);
                        }
                        if (!arpScannedPrefixes.Contains(prefix))
                        {
                            _logger.LogWarning("arp-scan found no hosts in {Prefix}0/24 on interface {Interface}; falling back to ping sweep.",
                                prefix, iface);
                        }
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Failed to run arp-scan");
                }
            }
        }

        foreach (var prefix in prefixes)
        {
            if (arpScannedPrefixes.Contains(prefix))
            {
                // Process IPs discovered by arp-scan
                foreach (var ip in arpScanResults.Keys.Where(k => k.StartsWith(prefix)))
                {
                    scanTasks.Add(Task.Run(() => ProcessDiscoveredDeviceAsync(ip, arpScanResults[ip], foundHostsBag, doPortScan)));
                }
            }
            else
            {
                // Fallback to ping sweep
                for (int i = 1; i < 255; i++)
                {
                    string ip = $"{prefix}{i}";
                    scanTasks.Add(Task.Run(() => PingDeviceAsync(ip, foundHostsBag, doPortScan)));
                }
            }
        }

        await Task.WhenAll(scanTasks);

        // The ping sweep itself refreshes the OS ARP cache, so this is read afterwards:
        // hosts that dropped our ICMP echo still answered the underlying ARP request.
        var arpTable = await GetArpTableAsync();

        var pingSweptPrefixes = prefixes.Where(p => !arpScannedPrefixes.Contains(p)).ToList();
        if (pingSweptPrefixes.Count > 0)
        {
            var foundIps = foundHostsBag.Select(h => h.IPAddress).ToHashSet();
            var arpOnlyTasks = arpTable
                .Where(e => !foundIps.Contains(e.Key)
                            && pingSweptPrefixes.Any(p => e.Key.StartsWith(p))
                            && IsUsableArpEntry(e.Key, e.Value))
                .Select(e => Task.Run(() => ProcessDiscoveredDeviceAsync(e.Key, e.Value, foundHostsBag, doPortScan)))
                .ToList();
            await Task.WhenAll(arpOnlyTasks);
        }

        var mdnsNames = await mdnsTask;

        var sortedHosts = foundHostsBag
            .OrderBy(h => IpSortKey(h.IPAddress))
            .ToList();

        foreach (var host in sortedHosts)
        {
            if (string.IsNullOrEmpty(host.MacAddress) && arpTable.TryGetValue(host.IPAddress, out var mac))
            {
                host.MacAddress = mac;
            }

            if (mdnsNames.TryGetValue(host.IPAddress, out var mdnsName))
            {
                host.HostName = $"{mdnsName} (mDNS)";
            }
            else if (IsUnknownName(host.HostName) && !string.IsNullOrEmpty(host.MacAddress) && !IsRandomizedMac(host.MacAddress))
            {
                var vendor = OuiVendorLookup.Find(host.MacAddress);
                if (vendor != null) host.HostName = $"Unknown ({vendor})";
            }
        }

        return sortedHosts;
    }

    /// <summary>
    /// Normalizes user input ("192.168.1.", "192.168.1.0/24", "192.168.1.42") to "a.b.c." /24
    /// prefixes, dropping anything that isn't three valid IPv4 octets.
    /// </summary>
    public static List<string> NormalizePrefixes(IEnumerable<string> baseIps)
    {
        var prefixes = new List<string>();
        foreach (var baseIp in baseIps)
        {
            var raw = baseIp.Trim();
            if (string.IsNullOrWhiteSpace(raw)) continue;

            // Normalize CIDR and full IPs to a "a.b.c." prefix
            if (raw.Contains('/')) raw = raw.Split('/')[0];
            var parts = raw.Split('.');
            if (parts.Length < 3 || !parts.Take(3).All(o => byte.TryParse(o, NumberStyles.None, CultureInfo.InvariantCulture, out _)))
            {
                continue;
            }
            string prefix = $"{byte.Parse(parts[0])}.{byte.Parse(parts[1])}.{byte.Parse(parts[2])}.";

            if (!prefixes.Contains(prefix)) prefixes.Add(prefix);
        }
        return prefixes;
    }

    /// <summary>Returns the name of the (not down) interface holding an IPv4 address in the given "a.b.c." prefix.</summary>
    private static string? FindInterfaceForPrefix(string prefix)
    {
        try
        {
            return NetworkInterface.GetAllNetworkInterfaces()
                .Where(n => n.OperationalStatus != OperationalStatus.Down && n.NetworkInterfaceType != NetworkInterfaceType.Loopback)
                .FirstOrDefault(n => n.GetIPProperties().UnicastAddresses.Any(a =>
                    a.Address.AddressFamily == AddressFamily.InterNetwork && a.Address.ToString().StartsWith(prefix)))
                ?.Name;
        }
        catch
        {
            return null;
        }
    }

    private static bool IsUnknownName(string name) =>
        string.IsNullOrWhiteSpace(name) || name == "Unknown";

    // The locally-administered bit marks randomized/private MACs, whose OUI is meaningless.
    private static bool IsRandomizedMac(string mac) =>
        mac.Length >= 2 && Uri.IsHexDigit(mac[0]) && Uri.IsHexDigit(mac[1])
        && (Convert.ToInt32(mac[..2], 16) & 0x02) != 0;

    private static bool IsUsableArpEntry(string ip, string mac)
    {
        // Network/broadcast addresses and multicast/incomplete entries are ARP-cache
        // noise, not devices.
        if (ip.EndsWith(".0") || ip.EndsWith(".255")) return false;
        if (mac is "00:00:00:00:00:00" or "FF:FF:FF:FF:FF:FF") return false;
        if (mac.Length < 2 || !Uri.IsHexDigit(mac[0]) || !Uri.IsHexDigit(mac[1])) return false;
        return (Convert.ToInt32(mac[..2], 16) & 0x01) == 0; // multicast bit
    }

    private static uint IpSortKey(string ip)
    {
        if (!IPAddress.TryParse(ip, out var addr) || addr.AddressFamily != AddressFamily.InterNetwork)
        {
            return uint.MaxValue;
        }
        var b = addr.GetAddressBytes();
        return ((uint)b[0] << 24) | ((uint)b[1] << 16) | ((uint)b[2] << 8) | b[3];
    }

    private async Task ProcessDiscoveredDeviceAsync(string ipAddress, string macAddress, ConcurrentBag<NetworkDevice> listToAdd, bool doPortScan)
    {
        try
        {
            string hostName = await GetHostNameAsync(ipAddress);

            if (doPortScan && IsUnknownName(hostName))
            {
                hostName = await TryIdentifyViaPortsAsync(ipAddress);
            }

            listToAdd.Add(new NetworkDevice
            {
                HostName = hostName,
                IPAddress = ipAddress,
                MacAddress = macAddress,
                Status = "Online",
                LastSeen = DateTime.UtcNow
            });
        }
        catch (Exception ex)
        {
            _logger.LogDebug(ex, $"Failed to process discovered device {ipAddress}");
        }
    }

    private async Task PingDeviceAsync(string ipAddress, ConcurrentBag<NetworkDevice> listToAdd, bool doPortScan)
    {
        try
        {
            using var ping = new Ping();
            var reply = await ping.SendPingAsync(ipAddress, 1000);

            if (reply.Status == IPStatus.Success)
            {
                string hostName = await GetHostNameAsync(ipAddress);

                if (doPortScan && IsUnknownName(hostName))
                {
                    hostName = await TryIdentifyViaPortsAsync(ipAddress);
                }

                listToAdd.Add(new NetworkDevice
                {
                    HostName = hostName,
                    IPAddress = ipAddress,
                    Status = "Online",
                    LastSeen = DateTime.UtcNow
                });
            }
        }
        catch (Exception ex)
        {
            _logger.LogDebug(ex, $"Failed to ping {ipAddress}");
        }
    }

    private async Task<string> TryIdentifyViaPortsAsync(string ipAddress)
    {
        try
        {
            using var tcpClient = new TcpClient();
            var connectTask = tcpClient.ConnectAsync(ipAddress, 22);
            if (await Task.WhenAny(connectTask, Task.Delay(1000)) == connectTask)
            {
                await connectTask;
                using var stream = tcpClient.GetStream();
                using var reader = new System.IO.StreamReader(stream);

                var readTask = reader.ReadLineAsync();
                if (await Task.WhenAny(readTask, Task.Delay(1000)) == readTask)
                {
                    string? banner = await readTask;
                    if (!string.IsNullOrEmpty(banner))
                    {
                        if (banner.Contains("Ubuntu", StringComparison.OrdinalIgnoreCase)) return "Ubuntu Server (SSH)";
                        if (banner.Contains("Debian", StringComparison.OrdinalIgnoreCase)) return "Debian Server (SSH)";
                        return $"Linux/Unix ({banner.Trim()})";
                    }
                }
            }
        }
        catch { }

        try
        {
            using var handler = new HttpClientHandler
            {
                ServerCertificateCustomValidationCallback = (sender, cert, chain, sslPolicyErrors) => true
            };
            using var client = new HttpClient(handler);
            client.Timeout = TimeSpan.FromSeconds(1.5);

            var response = await client.GetAsync($"http://{ipAddress}");
            if (response.Headers.TryGetValues("Server", out var serverValues))
            {
                string? serverHeader = serverValues.FirstOrDefault();
                if (!string.IsNullOrWhiteSpace(serverHeader))
                {
                    return $"Web Device ({serverHeader})";
                }
            }
        }
        catch { }

        return "Unknown";
    }

    private async Task<string> GetHostNameAsync(string ipAddress)
    {
        try
        {
            // Without a timeout, one unresponsive resolver stalls the whole host's result.
            using var cts = new CancellationTokenSource(DnsLookupTimeout);
            var entry = await Dns.GetHostEntryAsync(ipAddress, cts.Token);
            return entry.HostName;
        }
        catch
        {
            return "Unknown";
        }
    }

    private async Task<Dictionary<string, string>> DiscoverMdnsHostsAsync()
    {
        var mdnsDict = new Dictionary<string, string>();
        try
        {
            var domains = await ZeroconfResolver.BrowseDomainsAsync();
            if (!domains.Any()) return mdnsDict;

            var responses = await ZeroconfResolver.ResolveAsync(domains.Select(g => g.Key));
            foreach (var resp in responses)
            {
                if (!mdnsDict.ContainsKey(resp.IPAddress))
                {
                    string deviceName = !string.IsNullOrWhiteSpace(resp.DisplayName) ? resp.DisplayName : resp.Id;
                    mdnsDict[resp.IPAddress] = deviceName;
                }
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to discover mDNS hosts.");
        }
        return mdnsDict;
    }

    private async Task<Dictionary<string, string>> GetArpTableAsync()
    {
        var arpTable = new Dictionary<string, string>();
        try
        {
            string output = string.Empty;
            if (RuntimeInformation.IsOSPlatform(OSPlatform.Windows))
            {
                output = await RunProcessAsync("arp", ["-a"]);
                // Regex for Windows format: 192.168.1.1       00-14-22-01-23-45
                var matches = Regex.Matches(output, @"(?<ip>\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\s+(?<mac>([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2}))");
                foreach (Match match in matches)
                {
                    var ip = match.Groups["ip"].Value;
                    var mac = match.Groups["mac"].Value.Replace('-', ':').ToUpperInvariant();
                    arpTable[ip] = mac;
                }
            }
            else if (RuntimeInformation.IsOSPlatform(OSPlatform.Linux) || RuntimeInformation.IsOSPlatform(OSPlatform.OSX))
            {
                if (System.IO.File.Exists("/proc/net/arp"))
                {
                     output = await System.IO.File.ReadAllTextAsync("/proc/net/arp");
                     // Format: 192.168.1.1   0x1  0x2  00:14:22:01:23:45  *  eth0
                     var matches = Regex.Matches(output, @"(?<ip>\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\s+0x\d+\s+0x\d+\s+(?<mac>([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2}))");
                     foreach (Match match in matches)
                     {
                         var ip = match.Groups["ip"].Value;
                         var mac = match.Groups["mac"].Value.ToUpperInvariant();
                         arpTable[ip] = mac;
                     }
                }
                else
                {
                     output = await RunProcessAsync("arp", ["-a"]);
                     var matches = Regex.Matches(output, @"(?<ip>\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}).*?(?<mac>([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2}))");
                     foreach (Match match in matches)
                     {
                         var ip = match.Groups["ip"].Value;
                         var mac = match.Groups["mac"].Value.ToUpperInvariant();
                         arpTable[ip] = mac;
                     }
                }
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to read ARP table.");
        }

        return arpTable;
    }

    private async Task<string> RunProcessAsync(string filename, IEnumerable<string> arguments)
    {
        // ArgumentList passes each value as a single argv entry, so user-supplied
        // values can't be split into extra arguments.
        var psi = new ProcessStartInfo
        {
            FileName = filename,
            RedirectStandardOutput = true,
            UseShellExecute = false,
            CreateNoWindow = true
        };
        foreach (var arg in arguments) psi.ArgumentList.Add(arg);

        using var process = Process.Start(psi);
        if (process == null) return string.Empty;

        using var cts = new CancellationTokenSource(ProcessTimeout);
        try
        {
            var output = await process.StandardOutput.ReadToEndAsync(cts.Token);
            await process.WaitForExitAsync(cts.Token);
            return output;
        }
        catch (OperationCanceledException)
        {
            _logger.LogWarning("{Process} timed out after {Timeout}; killing it.", filename, ProcessTimeout);
            process.Kill(entireProcessTree: true);
            return string.Empty;
        }
    }
}
