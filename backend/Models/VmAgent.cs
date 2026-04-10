namespace HomeLabInfo.Api.Models;

public class VmAgent
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string EndpointUrl { get; set; } = string.Empty; // e.g., http://192.168.1.50:8080
    
    // Security: Hub signs requests with the private key, Agent verifies with the public key.
    public string PublicKeyBase64 { get; set; } = string.Empty;
    public string PrivateKeyBase64 { get; set; } = string.Empty;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public float? PositionX { get; set; }
    public float? PositionY { get; set; }
}
