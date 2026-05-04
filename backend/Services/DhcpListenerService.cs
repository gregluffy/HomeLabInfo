using System.Net;
using System.Net.Sockets;
using HomeLabInfo.Api.Data;
using HomeLabInfo.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace HomeLabInfo.Api.Services;

public class DhcpListenerService : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly WebhookNotificationService _notificationService;
    private readonly ILogger<DhcpListenerService> _logger;

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

        // Port 67 is standard DHCP server port. We listen for client broadcasts (DISCOVER/REQUEST).
        using var client = new UdpClient();
        
        try 
        {
            client.Client.SetSocketOption(SocketOptionLevel.Socket, SocketOptionName.ReuseAddress, true);
            client.Client.Bind(new IPEndPoint(IPAddress.Any, 67));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to bind to DHCP port 67. DHCP Listening will be disabled.");
            return;
        }

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                // check if enabled
                using (var scope = _scopeFactory.CreateScope())
                {
                    var context = scope.ServiceProvider.GetRequiredService<AppDbContext>();
                    var enabledSetting = await context.Settings.AsNoTracking().FirstOrDefaultAsync(s => s.Key == "EnableDhcpListening");
                    if (enabledSetting == null || enabledSetting.Value.ToLower() != "true")
                    {
                        await Task.Delay(10000, stoppingToken);
                        continue;
                    }
                }

                // Wait for a packet
                var receiveTask = client.ReceiveAsync(stoppingToken);
                var result = await receiveTask;
                var data = result.Buffer;

                if (data.Length < 240) continue;

                // DHCP Packet Parsing (Simplified RFC 2131)
                // HW Length at offset 2
                int hlen = data[2];
                if (hlen > 16) hlen = 6; // Safety fallback for standard MAC

                // MAC Address at offset 28
                string mac = "";
                for (int i = 0; i < hlen; i++)
                {
                    mac += data[28 + i].ToString("X2") + (i < hlen - 1 ? ":" : "");
                }

                // Options start at offset 240
                string hostName = "Unknown";
                string requestedIp = null;
                int offset = 240;
                while (offset < data.Length - 1)
                {
                    byte option = data[offset++];
                    if (option == 255) break; 
                    if (option == 0) continue;
                    
                    byte len = data[offset++];
                    if (offset + len > data.Length) break;

                    if (option == 12) // Host Name
                    {
                        hostName = System.Text.Encoding.ASCII.GetString(data, offset, len).Replace("\0", "").Trim();
                    }
                    else if (option == 50 && len == 4) // Requested IP Address
                    {
                        requestedIp = new System.Net.IPAddress(new byte[] { data[offset], data[offset+1], data[offset+2], data[offset+3] }).ToString();
                    }
                    offset += len;
                }

                string ipToRecord = requestedIp ?? result.RemoteEndPoint.Address.ToString();

                _logger.LogDebug($"DHCP Packet detected: MAC={mac}, Host={hostName}, IP={ipToRecord}");

                // Process discovery
                using (var scope = _scopeFactory.CreateScope())
                {
                    var context = scope.ServiceProvider.GetRequiredService<AppDbContext>();
                    
                    // Check if we ALREADY know this MAC
                    var existing = await context.Devices.FirstOrDefaultAsync(d => d.MacAddress == mac);
                    
                    // Fallback: If MAC is not found, check by HostName (useful for devices with randomized MACs)
                    if (existing == null && hostName != "Unknown" && !string.IsNullOrWhiteSpace(hostName))
                    {
                        existing = await context.Devices.FirstOrDefaultAsync(d => d.HostName == hostName);
                    }
                    
                    if (existing == null)
                    {
                        _logger.LogInformation($"[DHCP] NEW DEVICE DISCOVERED: {hostName} ({mac})");

                        var newDevice = new NetworkDevice
                        {
                            IPAddress = ipToRecord,
                            MacAddress = mac,
                            HostName = hostName,
                            Status = "Online",
                            LastSeen = DateTime.UtcNow
                        };

                        context.Devices.Add(newDevice);
                        await context.SaveChangesAsync();

                        // Send Webhook
                        var urlSetting = await context.Settings.AsNoTracking().FirstOrDefaultAsync(s => s.Key == "WebhookUrl");
                        var providerSetting = await context.Settings.AsNoTracking().FirstOrDefaultAsync(s => s.Key == "WebhookProvider");

                        if (urlSetting != null && !string.IsNullOrWhiteSpace(urlSetting.Value))
                        {
                            string ipDisplay = (ipToRecord != "0.0.0.0" && !string.IsNullOrWhiteSpace(ipToRecord)) ? $"\n**IP:** {ipToRecord}" : "";
                            
                            await _notificationService.SendNotificationAsync(
                                urlSetting.Value,
                                providerSetting?.Value ?? "discord",
                                "New Device Accessing Network",
                                $"A new device has been detected via DHCP broadcast.\n\n**Host:** {hostName}\n**MAC:** {mac}{ipDisplay}");
                        }
                    }
                    else
                    {
                        // Update existing device info
                        bool updated = false;
                        if (existing.Status != "Online") { existing.Status = "Online"; updated = true; }
                        
                        // If the device changed its MAC (found by hostname) or IP, update them
                        if (existing.MacAddress != mac)
                        {
                            existing.MacAddress = mac;
                            updated = true;
                        }
                        
                        if (!string.IsNullOrEmpty(ipToRecord) && existing.IPAddress != ipToRecord)
                        {
                            existing.IPAddress = ipToRecord;
                            updated = true;
                        }

                        existing.LastSeen = DateTime.UtcNow;
                        
                        if (hostName != "Unknown" && (existing.HostName == "Unknown" || string.IsNullOrWhiteSpace(existing.HostName)))
                        {
                            existing.HostName = hostName;
                            updated = true;
                        }
                        
                        if (updated) await context.SaveChangesAsync();
                    }
                }
            }
            catch (OperationCanceledException) { }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error processing DHCP packet");
                await Task.Delay(1000, stoppingToken);
            }
        }
    }
}
