using HomeLabInfo.Api.Middleware;
using HomeLabInfo.Api.Services;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;

namespace HomeLabInfo.Api.Tests.Middleware;

public class AuthMiddlewareTests
{
    private const string TestSecret = "test-secret-exactly-32-bytes-ok!";

    private JwtService CreateJwtService() =>
        new(new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?> { ["JWT_SECRET"] = TestSecret })
            .Build(), NullLogger<JwtService>.Instance);

    private AuthMiddleware CreateMiddleware(bool authEnabled, RequestDelegate? next = null) =>
        new(next ?? (_ => Task.CompletedTask),
            new ConfigurationBuilder()
                .AddInMemoryCollection(new Dictionary<string, string?> { ["AUTH_ENABLED"] = authEnabled ? "true" : "false" })
                .Build());

    private static DefaultHttpContext MakeContext(string path, string? authHeader = null)
    {
        var ctx = new DefaultHttpContext();
        ctx.Response.Body = new MemoryStream();
        ctx.Request.Path = path;
        if (authHeader != null)
            ctx.Request.Headers.Authorization = authHeader;
        return ctx;
    }

    [Fact]
    public async Task AuthDisabled_AlwaysPassesThrough()
    {
        var nextCalled = false;
        var middleware = CreateMiddleware(false, _ => { nextCalled = true; return Task.CompletedTask; });

        await middleware.InvokeAsync(MakeContext("/api/agents"), CreateJwtService());

        Assert.True(nextCalled);
    }

    [Fact]
    public async Task AuthEnabled_AuthPath_PassesThrough()
    {
        var nextCalled = false;
        var middleware = CreateMiddleware(true, _ => { nextCalled = true; return Task.CompletedTask; });

        await middleware.InvokeAsync(MakeContext("/api/auth/login"), CreateJwtService());

        Assert.True(nextCalled);
    }

    [Fact]
    public async Task AuthEnabled_NoToken_Returns401()
    {
        var middleware = CreateMiddleware(true);
        var ctx = MakeContext("/api/agents");

        await middleware.InvokeAsync(ctx, CreateJwtService());

        Assert.Equal(401, ctx.Response.StatusCode);
    }

    [Fact]
    public async Task AuthEnabled_InvalidToken_Returns401()
    {
        var middleware = CreateMiddleware(true);
        var ctx = MakeContext("/api/agents", "Bearer this.is.invalid");

        await middleware.InvokeAsync(ctx, CreateJwtService());

        Assert.Equal(401, ctx.Response.StatusCode);
    }

    [Fact]
    public async Task AuthEnabled_ValidToken_PassesThrough()
    {
        var jwtService = CreateJwtService();
        var nextCalled = false;
        var middleware = CreateMiddleware(true, _ => { nextCalled = true; return Task.CompletedTask; });
        var token = jwtService.GenerateToken(1, "alice");
        var ctx = MakeContext("/api/agents", $"Bearer {token}");

        await middleware.InvokeAsync(ctx, jwtService);

        Assert.True(nextCalled);
    }

    [Fact]
    public async Task AuthEnabled_MissingBearerPrefix_Returns401()
    {
        var jwtService = CreateJwtService();
        var middleware = CreateMiddleware(true);
        var token = jwtService.GenerateToken(1, "alice");
        var ctx = MakeContext("/api/agents", token); // no "Bearer " prefix

        await middleware.InvokeAsync(ctx, jwtService);

        Assert.Equal(401, ctx.Response.StatusCode);
    }
}
