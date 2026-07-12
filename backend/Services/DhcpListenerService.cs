using System.Net;
using System.Net.Sockets;
using System.Text;
using HomeLabInfo.Api.Data;
using HomeLabInfo.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace HomeLabInfo.Api.Services;

public class DhcpListenerService : BackgroundService
{
    private const int DhcpServerPort = 67;
    private static readonly TimeSpan SettingsRefreshInterval = TimeSpan.FromSeconds(10);
    private static readonly TimeSpan BindRetryInterval = TimeSpan.FromMinutes(1);

    // Hostnames too generic to safely identify a single device (used for the randomized-MAC fallback match).
    private static readonly HashSet<string> GenericHostNames = new(StringComparer.OrdinalIgnoreCase)
    {
        "unknown", "localhost", "android", "iphone", "ipad", "macbook", "pc", "laptop", "desktop"
    };

    private readonly IServiceScopeFactory _scopeFactory;
    private readonly WebhookNotificationService _notificationService;
    private readonly ILogger<DhcpListenerService> _logger;

    private DhcpSettings _settings = new(false, null, "discord");
    private DateTime _settingsFetchedAt = DateTime.MinValue;

    private record DhcpSettings(bool Enabled, string? WebhookUrl, string WebhookProvider);

    public DhcpListenerService(
        IServiceScopeFactory scopeFactory,
        WebhookNotificationService notificationService,
        ILogger<DhcpListenerService> logger)
    {
        _scopeFactory = scopeFactory;
        _notificationService = notificationService;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("DHCP Listener Service is starting...");

        UdpClient? client = null;
        try
        {
            while (!stoppingToken.IsCancellationRequested)
            {
                try
                {
                    var settings = await GetSettingsAsync(stoppingToken);

                    if (!settings.Enabled)
                    {
                        if (client != null)
                        {
                            client.Dispose();
                            client = null;
                            _logger.LogInformation("DHCP Listening disabled. Released port 67.");
                        }
                        await Task.Delay(SettingsRefreshInterval, stoppingToken);
                        continue;
                    }

                    if (client == null)
                    {
                        client = TryBind();
                        if (client == null)
                        {
                            await Task.Delay(BindRetryInterval, stoppingToken);
                            continue;
                        }
                        _logger.LogInformation("DHCP Listening enabled. Listening on port 67.");
                    }

                    // Wait for a packet, waking periodically so a settings change takes effect
                    // even when the network is quiet.
                    using var receiveCts = CancellationTokenSource.CreateLinkedTokenSource(stoppingToken);
                    receiveCts.CancelAfter(SettingsRefreshInterval);

                    UdpReceiveResult result;
                    try
                    {
                        result = await client.ReceiveAsync(receiveCts.Token);
                    }
                    catch (OperationCanceledException) when (!stoppingToken.IsCancellationRequested)
                    {
                        continue;
                    }

                    if (!DhcpPacket.TryParse(result.Buffer, out var packet)) continue;
                    if (!packet.IndicatesActiveClient) continue;

                    await ProcessPacketAsync(packet, result.RemoteEndPoint, settings, stoppingToken);
                }
                catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
                {
                    break;
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Error processing DHCP packet");
                    await Task.Delay(1000, stoppingToken);
                }
            }
        }
        finally
        {
            client?.Dispose();
        }
    }

    private UdpClient? TryBind()
    {
        var client = new UdpClient();
        try
        {
            client.Client.SetSocketOption(SocketOptionLevel.Socket, SocketOptionName.ReuseAddress, true);
            client.Client.Bind(new IPEndPoint(IPAddress.Any, DhcpServerPort));
            return client;
        }
        catch (Exception ex)
        {
            client.Dispose();
            _logger.LogError(ex, "Failed to bind to DHCP port 67. Will retry in {Interval}.", BindRetryInterval);
            return null;
        }
    }

    private async Task<DhcpSettings> GetSettingsAsync(CancellationToken ct)
    {
        if (DateTime.UtcNow - _settingsFetchedAt < SettingsRefreshInterval) return _settings;

        var keys = new[] { "EnableDhcpListening", "WebhookUrl", "WebhookProvider" };
        using var scope = _scopeFactory.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var values = await context.Settings.AsNoTracking()
            .Where(s => keys.Contains(s.Key))
            .ToDictionaryAsync(s => s.Key, s => s.Value, ct);

        _settings = new DhcpSettings(
            values.TryGetValue("EnableDhcpListening", out var enabled) && enabled.Equals("true", StringComparison.OrdinalIgnoreCase),
            values.GetValueOrDefault("WebhookUrl"),
            string.IsNullOrWhiteSpace(values.GetValueOrDefault("WebhookProvider")) ? "discord" : values["WebhookProvider"]);
        _settingsFetchedAt = DateTime.UtcNow;
        return _settings;
    }

    private async Task ProcessPacketAsync(DhcpPacket packet, IPEndPoint remote, DhcpSettings settings, CancellationToken ct)
    {
        // Fall back to the packet's source address; broadcasts from unconfigured clients
        // come from 0.0.0.0, which carries no information.
        string? ip = packet.IpAddress;
        if (ip == null && !remote.Address.Equals(IPAddress.Any))
        {
            ip = remote.Address.ToString();
        }

        string hostName = string.IsNullOrWhiteSpace(packet.HostName) ? "Unknown" : packet.HostName;

        _logger.LogDebug("DHCP packet detected: MAC={Mac}, Host={Host}, IP={Ip}, Type={Type}",
            packet.Mac, hostName, ip ?? "n/a", packet.MessageType);

        using var scope = _scopeFactory.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        var existing = await context.Devices.FirstOrDefaultAsync(d => d.MacAddress == packet.Mac, ct);

        // Fallback for devices with randomized MACs: match by hostname, but only when the
        // name is specific enough to identify exactly one known device.
        if (existing == null && hostName.Length >= 3 && !GenericHostNames.Contains(hostName))
        {
            var byName = await context.Devices.Where(d => d.HostName == hostName).Take(2).ToListAsync(ct);
            if (byName.Count == 1) existing = byName[0];
        }

        if (existing == null)
        {
            _logger.LogInformation("[DHCP] NEW DEVICE DISCOVERED: {Host} ({Mac})", hostName, packet.Mac);

            context.Devices.Add(new NetworkDevice
            {
                IPAddress = ip ?? string.Empty,
                MacAddress = packet.Mac,
                HostName = hostName,
                Status = "Online",
                LastSeen = DateTime.UtcNow
            });
            await context.SaveChangesAsync(ct);

            if (!string.IsNullOrWhiteSpace(settings.WebhookUrl))
            {
                // Fire-and-forget: a slow webhook endpoint must not stall packet processing.
                // SendNotificationAsync handles its own errors.
                _ = _notificationService.SendNotificationAsync(
                    settings.WebhookUrl,
                    settings.WebhookProvider,
                    "New Device Accessing Network",
                    BuildWebhookMessage(packet, hostName, ip));
            }
        }
        else
        {
            if (existing.MacAddress != packet.Mac) existing.MacAddress = packet.Mac;
            if (ip != null && existing.IPAddress != ip) existing.IPAddress = ip;
            if (hostName != "Unknown" && (existing.HostName == "Unknown" || string.IsNullOrWhiteSpace(existing.HostName)))
            {
                existing.HostName = hostName;
            }
            existing.Status = "Online";
            existing.LastSeen = DateTime.UtcNow;
            await context.SaveChangesAsync(ct);
        }
    }

    private static string BuildWebhookMessage(DhcpPacket packet, string hostName, string? ip)
    {
        var vendor = packet.IsRandomizedMac ? null : OuiVendorLookup.Find(packet.Mac);

        var sb = new StringBuilder("A new device has been detected via DHCP broadcast.\n\n");
        sb.Append("**Host:** ").Append(hostName).Append('\n');
        sb.Append("**MAC:** ").Append(packet.Mac);
        if (packet.IsRandomizedMac) sb.Append(" (randomized/private)");
        sb.Append('\n');
        if (vendor != null) sb.Append("**Vendor:** ").Append(vendor).Append('\n');
        if (ip != null) sb.Append("**IP:** ").Append(ip).Append('\n');
        if (!string.IsNullOrWhiteSpace(packet.VendorClass)) sb.Append("**Device class:** ").Append(packet.VendorClass).Append('\n');

        return sb.ToString().TrimEnd('\n');
    }

    /// <summary>Minimal DHCP (RFC 2131) client-request parser.</summary>
    private sealed class DhcpPacket
    {
        // Option 53 message types
        private const byte Discover = 1;
        private const byte Request = 3;
        private const byte Inform = 8;

        public string Mac { get; private set; } = string.Empty;
        public bool IsRandomizedMac { get; private set; }
        public string? HostName { get; private set; }
        public string? VendorClass { get; private set; }
        public byte MessageType { get; private set; } // 0 = option absent (plain BOOTP)
        public string? IpAddress { get; private set; } // ciaddr, or option 50 as fallback

        /// <summary>
        /// True for messages that signal a client joining or renewing (DISCOVER/REQUEST/INFORM,
        /// or plain BOOTP). RELEASE/DECLINE mean the opposite and must not mark a device online.
        /// </summary>
        public bool IndicatesActiveClient => MessageType is 0 or Discover or Request or Inform;

        public static bool TryParse(byte[] data, out DhcpPacket packet)
        {
            packet = new DhcpPacket();

            // BOOTP header (236 bytes) + DHCP magic cookie (4 bytes)
            if (data.Length < 240) return false;
            // op 1 = BOOTREQUEST (client -> server); htype 1 / hlen 6 = Ethernet MAC
            if (data[0] != 1 || data[1] != 1 || data[2] != 6) return false;
            // Magic cookie 99.130.83.99 distinguishes DHCP from random UDP traffic on port 67
            if (data[236] != 99 || data[237] != 130 || data[238] != 83 || data[239] != 99) return false;

            packet.Mac = string.Join(":", data.Skip(28).Take(6).Select(b => b.ToString("X2")));
            if (packet.Mac == "00:00:00:00:00:00") return false;
            // The locally-administered bit marks randomized/private MACs (phones, containers)
            packet.IsRandomizedMac = (data[28] & 0x02) != 0;

            // ciaddr: the client's current IP, set while renewing/rebinding an active lease
            if (data[12] != 0 || data[13] != 0 || data[14] != 0 || data[15] != 0)
            {
                packet.IpAddress = new IPAddress(data.AsSpan(12, 4)).ToString();
            }

            string? requestedIp = null;
            int offset = 240;
            while (offset < data.Length)
            {
                byte option = data[offset++];
                if (option == 255) break;
                if (option == 0) continue;
                if (offset >= data.Length) break;

                byte len = data[offset++];
                if (offset + len > data.Length) break;

                switch (option)
                {
                    case 12: // Host Name
                        packet.HostName = Encoding.UTF8.GetString(data, offset, len).Replace("\0", "").Trim();
                        break;
                    case 50 when len == 4: // Requested IP Address
                        requestedIp = new IPAddress(data.AsSpan(offset, 4)).ToString();
                        break;
                    case 53 when len == 1: // DHCP Message Type
                        packet.MessageType = data[offset];
                        break;
                    case 60: // Vendor Class Identifier (e.g. "android-dhcp-13", "MSFT 5.0")
                        packet.VendorClass = Encoding.UTF8.GetString(data, offset, len).Replace("\0", "").Trim();
                        break;
                }
                offset += len;
            }

            packet.IpAddress ??= requestedIp;
            if (packet.IpAddress == "0.0.0.0") packet.IpAddress = null;
            return true;
        }
    }
}
