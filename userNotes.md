* i want to create an .net full stack application which will be intented to run as docker image, so we need to make it cross platform, the first goal is to create an functionality of scanning the network and find and show in the dashboard all the clients on the network

* i have created a similar winforms app where u should look for the first file to understand the logic and the functionality of the app, then create the new app with the same functionality but with a modern UI and with the ability to run as docker image:

look at this code:
using OpenNetworkScanner.Models;
using System.Configuration;
using System.Net;
using System.Net.Http.Headers;
using System.Runtime.InteropServices;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Threading.Tasks;
using System.Windows.Forms;
using System;
using System.Linq;
using Zeroconf;
using System.Net.Sockets; // ADDED FOR PORT SCANNING
using System.Net.Http;    // ADDED FOR PORT SCANNING

namespace OpenNetworkScanner
{
    public partial class Form1 : Form
    {
        string baseIp = "192.168.2.";
        int endIpSuffix = 255;

        [DllImport("iphlpapi.dll", ExactSpelling = true)]
        public static extern int SendARP(int DestIP, int SrcIP, byte[] pMacAddr, ref uint PhyAddrLen);

        public Form1()
        {
            InitializeComponent();
        }

        // --- THE NEW PORT INTERROGATOR METHOD ---
        private async Task<string> TryIdentifyViaPortsAsync(string ipAddress)
        {
            // 1. Try knocking on SSH (Port 22) - Great for Linux servers like Ubuntu
            try
            {
                using TcpClient tcpClient = new TcpClient();
                // We use Task.WhenAny to enforce a strict 1-second timeout
                var connectTask = tcpClient.ConnectAsync(ipAddress, 22);
                if (await Task.WhenAny(connectTask, Task.Delay(1000)) == connectTask)
                {
                    await connectTask; // Ensure it actually connected
                    using var stream = tcpClient.GetStream();
                    using var reader = new System.IO.StreamReader(stream);

                    var readTask = reader.ReadLineAsync();
                    if (await Task.WhenAny(readTask, Task.Delay(1000)) == readTask)
                    {
                        string banner = await readTask;
                        if (!string.IsNullOrEmpty(banner))
                        {
                            if (banner.Contains("Ubuntu", StringComparison.OrdinalIgnoreCase)) return "Ubuntu Server (SSH)";
                            if (banner.Contains("Debian", StringComparison.OrdinalIgnoreCase)) return "Debian Server (SSH)";
                            return $"Linux/Unix ({banner.Trim()})";
                        }
                    }
                }
            }
            catch { /* Port 22 is closed or unreachable */ }

            // 2. Try knocking on HTTP (Port 80) - Great for Routers, Switches, and NAS
            try
            {
                using var handler = new HttpClientHandler()
                {
                    // Ignore certificate errors for local IP addresses
                    ServerCertificateCustomValidationCallback = (sender, cert, chain, sslPolicyErrors) => true
                };
                using var client = new HttpClient(handler);
                client.Timeout = TimeSpan.FromSeconds(1.5); // Fast timeout

                var response = await client.GetAsync($"http://{ipAddress}");

                // Read the "Server" header from the HTTP response
                if (response.Headers.TryGetValues("Server", out var serverValues))
                {
                    string serverHeader = serverValues.FirstOrDefault();
                    if (!string.IsNullOrWhiteSpace(serverHeader))
                    {
                        return $"Web Device ({serverHeader})";
                    }
                }
            }
            catch { /* Port 80 is closed or unreachable */ }

            return "Unknown";
        }

        // Note the new boolean parameter
        private async Task StartScanning(bool doPortScan)
        {
            var foundHostsBag = new ConcurrentBag<NetworkDevice>();
            Task<Dictionary<string, string>> mdnsTask = DiscoverMdnsHostsAsync();

            List<Task> scanTasks = new List<Task>();
            for (int i = 1; i < endIpSuffix; i++)
            {
                string ip = $"{baseIp}{i}";
                // Pass the checkbox state into the worker thread
                scanTasks.Add(Task.Run(() => ScanDeviceArp(ip, foundHostsBag, doPortScan)));
            }

            await Task.WhenAll(scanTasks);
            Dictionary<string, string> mdnsNames = await mdnsTask;

            var sortedHosts = foundHostsBag
                .OrderBy(h => int.Parse(h.IPAddress.Split('.').Last()))
                .ToList();

            foreach (var host in sortedHosts)
            {
                // Let mDNS overwrite "Unknown" or generic Port Scan results, as mDNS is usually a friendlier name
                if (mdnsNames.ContainsKey(host.IPAddress))
                {
                    host.HostName = $"{mdnsNames[host.IPAddress]} (mDNS)";
                }

                host.Number = (sortedHosts.IndexOf(host) + 1).ToString();
                var entry = new UserControls.HostEntry(host);

                if (flowLayoutPanel1.InvokeRequired)
                    flowLayoutPanel1.Invoke(new Action(() => flowLayoutPanel1.Controls.Add(entry)));
                else
                    flowLayoutPanel1.Controls.Add(entry);
            }
        }

        private async Task<Dictionary<string, string>> DiscoverMdnsHostsAsync()
        {
            var mdnsDict = new Dictionary<string, string>();
            try
            {
                ILookup<string, string> domains = await ZeroconfResolver.BrowseDomainsAsync();
                if (!domains.Any()) return mdnsDict;

                IReadOnlyList<IZeroconfHost> responses = await ZeroconfResolver.ResolveAsync(domains.Select(g => g.Key));
                foreach (var resp in responses)
                {
                    if (!mdnsDict.ContainsKey(resp.IPAddress))
                    {
                        string deviceName = !string.IsNullOrWhiteSpace(resp.DisplayName) ? resp.DisplayName : resp.Id;
                        mdnsDict[resp.IPAddress] = deviceName;
                    }
                }
            }
            catch { }
            return mdnsDict;
        }

        // Note the new boolean parameter
        private async Task ScanDeviceArp(string ipAddress, ConcurrentBag<NetworkDevice> listToAdd, bool doPortScan)
        {
            try
            {
                IPAddress ip = IPAddress.Parse(ipAddress);
                byte[] macAddr = new byte[6];
                uint macAddrLen = (uint)macAddr.Length;

                int arpResult = SendARP(BitConverter.ToInt32(ip.GetAddressBytes(), 0), 0, macAddr, ref macAddrLen);

                if (arpResult == 0)
                {
                    string[] str = new string[(int)macAddrLen];
                    for (int i = 0; i < macAddrLen; i++)
                        str[i] = macAddr[i].ToString("X2");
                    string macAddressString = string.Join("-", str);

                    // 1. Try standard DNS
                    string hostName = await GetHostNameAsync(ipAddress);

                    // 2. If DNS fails, and the user checked the box, try the Port Scanner
                    if (doPortScan && (hostName == "Unknown" || string.IsNullOrWhiteSpace(hostName)))
                    {
                        hostName = await TryIdentifyViaPortsAsync(ipAddress);
                    }

                    listToAdd.Add(new NetworkDevice
                    {
                        HostName = hostName,
                        IPAddress = ipAddress,
                        MacAddress = macAddressString
                    });
                }
            }
            catch { }
        }

        private async Task<string> GetHostNameAsync(string ipAddress)
        {
            try
            {
                IPHostEntry entry = await Dns.GetHostEntryAsync(ipAddress);
                return entry.HostName;
            }
            catch
            {
                return "Unknown";
            }
        }

        private void btnScan_Click(object sender, EventArgs e)
        {
            btnScan.Enabled = false;

            // Read the checkbox state from the UI thread BEFORE starting background tasks
            bool doPortScan = chkPortScan.Checked;

            flowLayoutPanel1.Controls.Clear();
            var header = new UserControls.HostEntry(new NetworkDevice
            {
                Number = "#",
                HostName = "Hostname",
                IPAddress = "IP Address",
                MacAddress = "MAC Address"
            });
            flowLayoutPanel1.Controls.Add(header);

            Task.Run(async () =>
            {
                // Pass the state in
                await StartScanning(doPortScan);

                if (btnScan.InvokeRequired)
                    btnScan.Invoke(new Action(() => btnScan.Enabled = true));
            });
        }
    }
}

* as you can see it has an bare metal scan functionality but it have some code only for windows which cannot be used,

* later on we will add an functionality to where we will have agents which we could add on vm where some docker apps are running and this app will get the selected infos.

* The final goal is to have an application for homelabers which with the least effort will show with modern UI the topography/infos of the homelab.