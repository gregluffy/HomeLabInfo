using HomeLabInfo.Api.Data;
using HomeLabInfo.Api.Models;
using HomeLabInfo.Api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HomeLabInfo.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AgentsController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly CryptographyService _crypto;

    public AgentsController(AppDbContext context, CryptographyService crypto)
    {
        _context = context;
        _crypto = crypto;
    }

    [HttpGet]
    public async Task<IActionResult> GetAgents()
    {
        var agents = await _context.VmAgents
            .Select(a => new { a.Id, a.Name, a.EndpointUrl, a.CreatedAt, a.PositionX, a.PositionY })
            .ToListAsync();
        return Ok(agents);
    }
    
    [HttpGet("{id}")]
    public async Task<IActionResult> GetAgent(int id)
    {
        var agent = await _context.VmAgents.FindAsync(id);
        if (agent == null) return NotFound();
        
        return Ok(new { agent.Id, agent.Name, agent.EndpointUrl, agent.PublicKeyBase64, agent.CreatedAt });
    }

    [HttpPost]
    public async Task<IActionResult> RegisterAgent([FromBody] RegisterAgentDto dto)
    {
        var (pubKey, privKey) = _crypto.GenerateKeyPair();

        var agent = new VmAgent
        {
            Name = dto.Name,
            EndpointUrl = dto.EndpointUrl.TrimEnd('/'),
            PublicKeyBase64 = pubKey,
            PrivateKeyBase64 = privKey
        };

        _context.VmAgents.Add(agent);
        await _context.SaveChangesAsync();

        return CreatedAtAction(nameof(GetAgent), new { id = agent.Id }, new 
        { 
            agent.Id, 
            agent.Name, 
            agent.EndpointUrl, 
            agent.PublicKeyBase64 
        });
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteAgent(int id)
    {
        var agent = await _context.VmAgents.FindAsync(id);
        if (agent == null) return NotFound();

        _context.VmAgents.Remove(agent);
        await _context.SaveChangesAsync();
        return NoContent();
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> UpdateAgent(int id, [FromBody] UpdateAgentDto dto)
    {
        var agent = await _context.VmAgents.FindAsync(id);
        if (agent == null) return NotFound();

        if (dto.Name != null) agent.Name = dto.Name;
        if (dto.EndpointUrl != null) agent.EndpointUrl = dto.EndpointUrl.TrimEnd('/');
        if (dto.PositionX.HasValue) agent.PositionX = dto.PositionX.Value;
        if (dto.PositionY.HasValue) agent.PositionY = dto.PositionY.Value;

        await _context.SaveChangesAsync();
        return NoContent();
    }
    
    [HttpGet("{id}/stats")]
    public async Task<IActionResult> GetAgentStats(int id)
    {
        var agent = await _context.VmAgents.FindAsync(id);
        if (agent == null) return NotFound("Agent not found");
        
        string timestamp = DateTimeOffset.UtcNow.ToUnixTimeSeconds().ToString();
        string signature = _crypto.SignTimestamp(agent.PrivateKeyBase64, timestamp);
        
        using var client = new HttpClient();
        client.DefaultRequestHeaders.Add("X-Hub-Signature", signature);
        client.DefaultRequestHeaders.Add("X-Hub-Timestamp", timestamp);
        
        try
        {
            var response = await client.GetAsync($"{agent.EndpointUrl}/api/stats");
            response.EnsureSuccessStatusCode();
            var jsonStr = await response.Content.ReadAsStringAsync();
            return Content(jsonStr, "application/json");
        }
        catch (Exception ex)
        {
            return StatusCode(502, new { error = "Failed to communicate with Agent", details = ex.Message });
        }
    }

    [HttpGet("{id}/version")]
    public async Task<IActionResult> GetAgentVersion(int id)
    {
        var agent = await _context.VmAgents.FindAsync(id);
        if (agent == null) return NotFound("Agent not found");

        using var client = new HttpClient();
        client.Timeout = TimeSpan.FromSeconds(5);

        try
        {
            // /api/version is unauthenticated on the agent — no signed headers needed.
            var response = await client.GetAsync($"{agent.EndpointUrl}/api/version");
            response.EnsureSuccessStatusCode();
            var jsonStr = await response.Content.ReadAsStringAsync();
            return Content(jsonStr, "application/json");
        }
        catch (Exception ex)
        {
            return StatusCode(502, new { error = "Failed to retrieve agent version", details = ex.Message });
        }
    }
}

public record RegisterAgentDto(string Name, string EndpointUrl);
public class UpdateAgentDto
{
    [System.Text.Json.Serialization.JsonPropertyName("name")]
    public string? Name { get; set; }
    [System.Text.Json.Serialization.JsonPropertyName("endpointUrl")]
    public string? EndpointUrl { get; set; }
    [System.Text.Json.Serialization.JsonPropertyName("positionX")]
    public float? PositionX { get; set; }
    [System.Text.Json.Serialization.JsonPropertyName("positionY")]
    public float? PositionY { get; set; }
}
