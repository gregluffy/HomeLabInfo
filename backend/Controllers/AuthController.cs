using HomeLabInfo.Api.Data;
using HomeLabInfo.Api.Models;
using HomeLabInfo.Api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HomeLabInfo.Api.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController(AppDbContext db, JwtService jwtService, IConfiguration config) : ControllerBase
{
    private bool AuthEnabled => config["AUTH_ENABLED"]?.Equals("true", StringComparison.OrdinalIgnoreCase) == true;

    [HttpGet("status")]
    public async Task<IActionResult> GetStatus()
    {
        var hasUsers = await db.Users.AnyAsync();
        return Ok(new { authEnabled = AuthEnabled, hasUsers });
    }

    [HttpPost("setup")]
    public async Task<IActionResult> Setup([FromBody] AuthRequest req)
    {
        if (!AuthEnabled)
            return BadRequest(new { error = "Authentication is not enabled." });

        if (await db.Users.AnyAsync())
            return Conflict(new { error = "An account already exists. Please log in." });

        if (string.IsNullOrWhiteSpace(req.Username) || req.Username.Length < 3)
            return BadRequest(new { error = "Username must be at least 3 characters." });

        if (string.IsNullOrWhiteSpace(req.Password) || req.Password.Length < 8)
            return BadRequest(new { error = "Password must be at least 8 characters." });

        var user = new User
        {
            Username = req.Username.Trim(),
            PasswordHash = JwtService.HashPassword(req.Password),
            CreatedAt = DateTime.UtcNow
        };

        db.Users.Add(user);
        await db.SaveChangesAsync();

        var token = jwtService.GenerateToken(user.Id, user.Username);
        return Ok(new { token, username = user.Username });
    }

    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] AuthRequest req)
    {
        if (!AuthEnabled)
            return BadRequest(new { error = "Authentication is not enabled." });

        var user = await db.Users.FirstOrDefaultAsync(u => u.Username == req.Username.Trim());
        if (user == null || !JwtService.VerifyPassword(req.Password, user.PasswordHash))
            return Unauthorized(new { error = "Invalid username or password." });

        var token = jwtService.GenerateToken(user.Id, user.Username);
        return Ok(new { token, username = user.Username });
    }
}

public record AuthRequest(string Username, string Password);
