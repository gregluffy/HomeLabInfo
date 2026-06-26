using System.Text.Json;
using HomeLabInfo.Api.Controllers;
using HomeLabInfo.Api.Data;
using HomeLabInfo.Api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;

namespace HomeLabInfo.Api.Tests.Controllers;

public class AuthControllerTests : IDisposable
{
    private readonly AppDbContext _db;
    private readonly JwtService _jwtService;

    public AuthControllerTests()
    {
        _db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options);

        _jwtService = new JwtService(
            new ConfigurationBuilder()
                .AddInMemoryCollection(new Dictionary<string, string?> { ["JWT_SECRET"] = "test-secret-exactly-32-bytes-ok!" })
                .Build(),
            NullLogger<JwtService>.Instance);
    }

    public void Dispose() => _db.Dispose();

    private AuthController CreateController(bool authEnabled) =>
        new(_db, _jwtService, new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["AUTH_ENABLED"] = authEnabled ? "true" : "false",
                ["JWT_SECRET"] = "test-secret-exactly-32-bytes-ok!"
            })
            .Build());

    private static T Prop<T>(object obj, string name) =>
        (T)obj.GetType().GetProperty(name)!.GetValue(obj)!;

    [Fact]
    public async Task GetStatus_NoUsers_ReturnsCorrectFlags()
    {
        var result = Assert.IsType<OkObjectResult>(await CreateController(true).GetStatus());
        Assert.True(Prop<bool>(result.Value!, "authEnabled"));
        Assert.False(Prop<bool>(result.Value!, "hasUsers"));
    }

    [Fact]
    public async Task GetStatus_AuthDisabled_ReflectsThat()
    {
        var result = Assert.IsType<OkObjectResult>(await CreateController(false).GetStatus());
        Assert.False(Prop<bool>(result.Value!, "authEnabled"));
    }

    [Fact]
    public async Task Setup_AuthDisabled_ReturnsBadRequest()
    {
        var result = await CreateController(false).Setup(new AuthRequest("alice", "password123"));
        Assert.IsType<BadRequestObjectResult>(result);
    }

    [Fact]
    public async Task Setup_FirstUser_ReturnsTokenAndUsername()
    {
        var result = Assert.IsType<OkObjectResult>(
            await CreateController(true).Setup(new AuthRequest("alice", "password123")));

        Assert.NotNull(Prop<string>(result.Value!, "token"));
        Assert.Equal("alice", Prop<string>(result.Value!, "username"));
    }

    [Fact]
    public async Task Setup_SecondUser_ReturnsConflict()
    {
        var ctrl = CreateController(true);
        await ctrl.Setup(new AuthRequest("alice", "password123"));

        Assert.IsType<ConflictObjectResult>(
            await ctrl.Setup(new AuthRequest("bob", "password456")));
    }

    [Theory]
    [InlineData("ab", "password123")]    // username too short
    [InlineData("alice", "short")]       // password too short
    [InlineData("  ", "password123")]    // whitespace username
    public async Task Setup_InvalidInput_ReturnsBadRequest(string username, string password)
    {
        var result = await CreateController(true).Setup(new AuthRequest(username, password));
        Assert.IsType<BadRequestObjectResult>(result);
    }

    [Fact]
    public async Task Login_ValidCredentials_ReturnsToken()
    {
        var ctrl = CreateController(true);
        await ctrl.Setup(new AuthRequest("alice", "correctpassword"));

        var result = Assert.IsType<OkObjectResult>(
            await ctrl.Login(new AuthRequest("alice", "correctpassword")));

        Assert.NotNull(Prop<string>(result.Value!, "token"));
    }

    [Fact]
    public async Task Login_WrongPassword_ReturnsUnauthorized()
    {
        var ctrl = CreateController(true);
        await ctrl.Setup(new AuthRequest("alice", "correctpassword"));

        Assert.IsType<UnauthorizedObjectResult>(
            await ctrl.Login(new AuthRequest("alice", "wrongpassword")));
    }

    [Fact]
    public async Task Login_UnknownUser_ReturnsUnauthorized()
    {
        Assert.IsType<UnauthorizedObjectResult>(
            await CreateController(true).Login(new AuthRequest("nobody", "password123")));
    }

    [Fact]
    public async Task Login_AuthDisabled_ReturnsBadRequest()
    {
        Assert.IsType<BadRequestObjectResult>(
            await CreateController(false).Login(new AuthRequest("alice", "password123")));
    }

    [Fact]
    public async Task Setup_TokenIsValidJwt()
    {
        var ctrl = CreateController(true);
        var result = Assert.IsType<OkObjectResult>(
            await ctrl.Setup(new AuthRequest("alice", "password123")));

        var token = Prop<string>(result.Value!, "token");
        Assert.True(_jwtService.TryValidate(token, out var username));
        Assert.Equal("alice", username);
    }
}
