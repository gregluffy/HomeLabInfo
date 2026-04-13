using System.Diagnostics;
using System.Runtime.InteropServices;
using HomeLabInfo.Agent.DTOs;

namespace HomeLabInfo.Agent.Services;

public class MetricsService
{
    private ulong _prevIdleTime;
    private ulong _prevTotalTime;

    public HostMetricsDto GetMetrics()
    {
        double cpu = GetCpuPercentage();
        var (memTotal, memUsed) = GetMemory();
        var (diskTotal, diskUsed) = GetDisk();

        return new HostMetricsDto(cpu, memTotal, memUsed, diskTotal, diskUsed);
    }

    private double GetCpuPercentage()
    {
        if (RuntimeInformation.IsOSPlatform(OSPlatform.Linux))
        {
            try
            {
                var procStat = File.Exists("/host/proc/stat") ? "/host/proc/stat" : "/proc/stat";
                var lines = File.ReadAllLines(procStat);
                var cpuLine = lines.FirstOrDefault(l => l.StartsWith("cpu "));
                if (cpuLine != null)
                {
                    var parts = cpuLine.Split(' ', StringSplitOptions.RemoveEmptyEntries);
                    ulong user = ulong.Parse(parts[1]);
                    ulong nice = ulong.Parse(parts[2]);
                    ulong system = ulong.Parse(parts[3]);
                    ulong idle = ulong.Parse(parts[4]);
                    ulong iowait = ulong.Parse(parts[5]);
                    ulong irq = ulong.Parse(parts[6]);
                    ulong softirq = ulong.Parse(parts[7]);

                    ulong totalTime = user + nice + system + idle + iowait + irq + softirq;
                    ulong idleTime = idle + iowait;

                    if (_prevTotalTime != 0)
                    {
                        ulong totalDelta = totalTime - _prevTotalTime;
                        ulong idleDelta = idleTime - _prevIdleTime;
                        _prevTotalTime = totalTime;
                        _prevIdleTime = idleTime;
                        if (totalDelta == 0) return 0; // Readings too close together — avoid divide-by-zero (NaN/Infinity)
                        double raw = 100.0 * (1.0 - ((double)idleDelta / totalDelta));
                        return Math.Clamp(raw, 0.0, 100.0); // Guard against any remaining edge cases
                    }
                    else
                    {
                        _prevTotalTime = totalTime;
                        _prevIdleTime = idleTime;
                        return 0; // Wait for next tick
                    }
                }
            }
            catch {} 
        }

        return 0;
    }

    private (double total, double used) GetMemory()
    {
        if (RuntimeInformation.IsOSPlatform(OSPlatform.Linux))
        {
            try
            {
                var procMem = File.Exists("/host/proc/meminfo") ? "/host/proc/meminfo" : "/proc/meminfo";
                var lines = File.ReadAllLines(procMem);
                double total = 0, free = 0, buffers = 0, cached = 0;
                foreach (var line in lines)
                {
                    if (line.StartsWith("MemTotal:")) total = ParseMemStr(line);
                    else if (line.StartsWith("MemFree:")) free = ParseMemStr(line);
                    else if (line.StartsWith("Buffers:")) buffers = ParseMemStr(line);
                    else if (line.StartsWith("Cached:")) cached = ParseMemStr(line);
                }
                
                double used = total - free - buffers - cached;
                return (total / 1024.0, used / 1024.0); // Convert KB to MB
            }
            catch {}
        }
        return (0, 0);
    }
    
    private double ParseMemStr(string line)
    {
        var parts = line.Split(new[] { ' ' }, StringSplitOptions.RemoveEmptyEntries);
        if (parts.Length > 1 && double.TryParse(parts[1], out double val)) return val;
        return 0;
    }

    private (double total, double used) GetDisk()
    {
        try
        {
            DriveInfo[] drives = DriveInfo.GetDrives();
            var hostDrive = drives.FirstOrDefault(d => d.RootDirectory.FullName == "/host/") 
                            ?? drives.FirstOrDefault(d => d.Name == "/");
            
            if (hostDrive != null && hostDrive.IsReady)
            {
                double totalGb = hostDrive.TotalSize / 1024.0 / 1024.0 / 1024.0;
                double usedGb = (hostDrive.TotalSize - hostDrive.AvailableFreeSpace) / 1024.0 / 1024.0 / 1024.0;
                return (totalGb, usedGb);
            }
        }
        catch {}
        return (0, 0);
    }
}
