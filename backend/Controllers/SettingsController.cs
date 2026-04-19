using HomeLabInfo.Api.Data;
using HomeLabInfo.Api.Models;
using HomeLabInfo.Api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HomeLabInfo.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class SettingsController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly WebhookNotificationService _notificationService;

    public SettingsController(AppDbContext context, WebhookNotificationService notificationService)
    {
        _context = context;
        _notificationService = notificationService;
    }

    [HttpGet("{key}")]
    public async Task<IActionResult> GetSetting(string key)
    {
        var setting = await _context.Settings.FindAsync(key);
        if (setting == null) return NotFound();
        return Ok(new { setting.Key, setting.Value });
    }

    [HttpPut("{key}")]
    public async Task<IActionResult> SetSetting(string key, [FromBody] SetSettingDto dto)
    {
        var setting = await _context.Settings.FindAsync(key);
        if (setting == null)
        {
            setting = new AppSetting { Key = key, Value = dto.Value };
            _context.Settings.Add(setting);
        }
        else
        {
            setting.Value = dto.Value;
        }

        await _context.SaveChangesAsync();
        return Ok(new { setting.Key, setting.Value });
    }

    [HttpPost("test")]
    public async Task<IActionResult> TestWebhook([FromBody] TestWebhookDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Url)) return BadRequest("URL is required");
        
        var success = await _notificationService.SendTestNotificationAsync(dto.Url, dto.Provider);
        if (success) return Ok();
        return StatusCode(500, "Failed to send test notification");
    }
}

public record SetSettingDto(string Value);
public record TestWebhookDto(string Url, string Provider);
