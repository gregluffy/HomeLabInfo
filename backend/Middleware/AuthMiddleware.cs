using HomeLabInfo.Api.Services;

namespace HomeLabInfo.Api.Middleware;

public class AuthMiddleware(RequestDelegate next, IConfiguration config)
{
    private readonly bool _authEnabled = config["AUTH_ENABLED"]?.Equals("true", StringComparison.OrdinalIgnoreCase) == true;

    public async Task InvokeAsync(HttpContext context, JwtService jwtService)
    {
        if (!_authEnabled || context.Request.Path.StartsWithSegments("/api/auth"))
        {
            await next(context);
            return;
        }

        var authHeader = context.Request.Headers.Authorization.FirstOrDefault();
        var token = authHeader?.StartsWith("Bearer ") == true ? authHeader[7..] : null;

        if (token == null || !jwtService.TryValidate(token, out _))
        {
            context.Response.StatusCode = 401;
            context.Response.ContentType = "application/json";
            await context.Response.WriteAsync("{\"error\":\"Unauthorized\"}");
            return;
        }

        await next(context);
    }
}
