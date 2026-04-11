using HomeLabInfo.Api.Data;
using HomeLabInfo.Api.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HomeLabInfo.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class SettingsController : ControllerBase
{
    private readonly AppDbContext _context;

    public SettingsController(AppDbContext context)
    {
        _context = context;
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
}

public record SetSettingDto(string Value);
