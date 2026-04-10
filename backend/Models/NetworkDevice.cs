using System.ComponentModel.DataAnnotations;

namespace HomeLabInfo.Api.Models;

public class NetworkDevice
{
    [Key]
    public int Id { get; set; }
    public string IPAddress { get; set; } = string.Empty;
    public string HostName { get; set; } = "Unknown";
    public string MacAddress { get; set; } = string.Empty;
    public string Status { get; set; } = "Online";
    public DateTime LastSeen { get; set; } = DateTime.UtcNow;
    public float? PositionX { get; set; }
    public float? PositionY { get; set; }
}
