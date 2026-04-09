using System.Collections.Concurrent;
using System.Diagnostics;
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
    private readonly ILogger<NetworkScannerService> _logger;

    public NetworkScannerService(ILogger<NetworkScannerService> logger)
    {
        _logger = logger;
    }

    public async Task<List<NetworkDevice>> ScanNetworkAsync(string baseIp, bool doPortScan)
    {
        var foundHostsBag = new ConcurrentBag<NetworkDevice>();
        var mdnsTask = DiscoverMdnsHostsAsync();

        var scanTasks = new List<Task>();
        for (int i = 1; i < 255; i++)
        {
            string ip = $"{baseIp}{i}";
            scanTasks.Add(Task.Run(() => PingDeviceAsync(ip, foundHostsBag, doPortScan)));
        }

        await Task.WhenAll(scanTasks);
        var mdnsNames = await mdnsTask;

        var arpTable = await GetArpTableAsync();

        var sortedHosts = foundHostsBag
            .OrderBy(h => int.Parse(h.IPAddress.Split('.').Last()))
            .ToList();

        foreach (var host in sortedHosts)
        {
            if (arpTable.TryGetValue(host.IPAddress, out var mac))
            {
                host.MacAddress = mac;
            }

            if (mdnsNames.ContainsKey(host.IPAddress))
            {
                host.HostName = $"{mdnsNames[host.IPAddress]} (mDNS)";
            }
        }

        return sortedHosts;
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

                if (doPortScan && (hostName == "Unknown" || string.IsNullOrWhiteSpace(hostName)))
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
            var entry = await Dns.GetHostEntryAsync(ipAddress);
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
                output = await RunProcessAsync("arp", "-a");
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
                     output = await RunProcessAsync("arp", "-a");
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

    private async Task<string> RunProcessAsync(string filename, string arguments)
    {
        var psi = new ProcessStartInfo
        {
            FileName = filename,
            Arguments = arguments,
            RedirectStandardOutput = true,
            UseShellExecute = false,
            CreateNoWindow = true
        };

        using var process = Process.Start(psi);
        if (process == null) return string.Empty;

        var output = await process.StandardOutput.ReadToEndAsync();
        await process.WaitForExitAsync();
        return output;
    }
}
