using HomeLabInfo.Api.Data;
using HomeLabInfo.Api.Models;
using HomeLabInfo.Api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HomeLabInfo.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class ScannerController : ControllerBase
{
    private readonly NetworkScannerService _scannerService;
    private readonly AppDbContext _context;

    public ScannerController(NetworkScannerService scannerService, AppDbContext context)
    {
        _scannerService = scannerService;
        _context = context;
    }

    [HttpGet("devices")]
    public async Task<IActionResult> GetDevices()
    {
        var devices = await _context.Devices.OrderBy(d => d.Id).ToListAsync();
        return Ok(devices);
    }

    [HttpPost("scan")]
    public async Task<IActionResult> ScanNetwork([FromQuery] string baseIp = "192.168.2.", [FromQuery] bool doPortScan = true)
    {
        var interfaceSetting = await _context.Settings.FindAsync("ScanInterface");
        string? scanInterface = interfaceSetting?.Value;

        var prefixes = baseIp.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries).ToList();
        
        // For simplicity, we block and scan. In a production scenario, we'd run this via a BackgroundService.
        var scannedDevices = await _scannerService.ScanNetworkAsync(prefixes, doPortScan, scanInterface);

        // Update DB
        foreach(var device in scannedDevices)
        {
            var existing = await _context.Devices.FirstOrDefaultAsync(d => d.IPAddress == device.IPAddress);
            if (existing != null)
            {
                existing.HostName = device.HostName != "Unknown" ? device.HostName : existing.HostName;
                existing.MacAddress = !string.IsNullOrEmpty(device.MacAddress) ? device.MacAddress : existing.MacAddress;
                existing.Status = "Online";
                existing.LastSeen = DateTime.UtcNow;
            }
            else
            {
                _context.Devices.Add(device);
            }
        }

        // Mark previously seen devices that are no longer online as Offline
        // ONLY if they belong to one of the subnets we just scanned!
        var scannedIPs = scannedDevices.Select(d => d.IPAddress).ToHashSet();
        var allDevices = await _context.Devices.ToListAsync();
        
        foreach (var dbDevice in allDevices)
        {
            if (!scannedIPs.Contains(dbDevice.IPAddress))
            {
                // Check if this device belongs to one of the prefixes we scanned
                bool inScannedSubnet = prefixes.Any(p => dbDevice.IPAddress.StartsWith(p));
                if (inScannedSubnet)
                {
                    dbDevice.Status = "Offline";
                }
            }
        }

        await _context.SaveChangesAsync();

        return Ok(await _context.Devices.OrderBy(d => d.Id).ToListAsync());
    }

    [HttpPut("devices/{id}")]
    public async Task<IActionResult> UpdateDevice(int id, [FromBody] UpdateDeviceDto dto)
    {
        var device = await _context.Devices.FindAsync(id);
        if (device == null) return NotFound();

        if (dto.HostName != null) device.HostName = dto.HostName;
        if (dto.PositionX.HasValue) device.PositionX = dto.PositionX.Value;
        if (dto.PositionY.HasValue) device.PositionY = dto.PositionY.Value;

        await _context.SaveChangesAsync();
        return NoContent();
    }

    [HttpDelete("devices/{id}")]
    public async Task<IActionResult> DeleteDevice(int id)
    {
        var device = await _context.Devices.FindAsync(id);
        if (device == null) return NotFound();
        
        _context.Devices.Remove(device);
        await _context.SaveChangesAsync();
        return NoContent();
    }

    [HttpDelete("devices/all")]
    public async Task<IActionResult> ClearAllDevices()
    {
        var devices = await _context.Devices.ToListAsync();
        _context.Devices.RemoveRange(devices);
        await _context.SaveChangesAsync();
        return NoContent();
    }
}

public class UpdateDeviceDto
{
    [System.Text.Json.Serialization.JsonPropertyName("hostName")]
    public string? HostName { get; set; }
    [System.Text.Json.Serialization.JsonPropertyName("positionX")]
    public float? PositionX { get; set; }
    [System.Text.Json.Serialization.JsonPropertyName("positionY")]
    public float? PositionY { get; set; }
}
