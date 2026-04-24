using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.Mvc;
using HomeLabInfo.Agent.Services;
using HomeLabInfo.Agent.DTOs;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddSingleton<MetricsService>();
builder.Services.AddSingleton<DockerService>();

var app = builder.Build();

app.Use(async (context, next) =>
{
    if (context.Request.Path == "/api/stats")
    {
        string? pubKeyBase64 = app.Configuration["HUB_PUBLIC_KEY"];
        if (string.IsNullOrEmpty(pubKeyBase64))
        {
            if (app.Environment.IsDevelopment()) 
            {
                await next();
                return;
            }
            context.Response.StatusCode = 401;
            await context.Response.WriteAsync("Missing HUB_PUBLIC_KEY configuration in Agent.");
            return;
        }

        if (!context.Request.Headers.TryGetValue("X-Hub-Signature", out var signatureHeader) || 
            !context.Request.Headers.TryGetValue("X-Hub-Timestamp", out var timestampHeader))
        {
            context.Response.StatusCode = 401;
            await context.Response.WriteAsync("Missing cryptographic headers.");
            return;
        }

        if (long.TryParse(timestampHeader, out long timestamp))
        {
            var requestTime = DateTimeOffset.FromUnixTimeSeconds(timestamp);
            if (Math.Abs((DateTimeOffset.UtcNow - requestTime).TotalMinutes) > 5)
            {
                context.Response.StatusCode = 401;
                await context.Response.WriteAsync("Request expired.");
                return;
            }
        }
        else
        {
            context.Response.StatusCode = 400;
            return;
        }

        try
        {
            using var rsa = RSA.Create();
            rsa.ImportSubjectPublicKeyInfo(Convert.FromBase64String(pubKeyBase64), out _);
            
            var payloadToVerify = Encoding.UTF8.GetBytes(timestampHeader.ToString());
            var signatureBytes = Convert.FromBase64String(signatureHeader.ToString());
            
            bool isValid = rsa.VerifyData(payloadToVerify, signatureBytes, HashAlgorithmName.SHA256, RSASignaturePadding.Pkcs1);
            if (!isValid)
            {
                context.Response.StatusCode = 401;
                await context.Response.WriteAsync("Invalid signature.");
                return;
            }
        }
        catch (Exception)
        {
            context.Response.StatusCode = 401;
            await context.Response.WriteAsync("Signature validation error.");
            return;
        }
    }
    
    await next();
});

app.MapGet("/api/stats", async ([FromServices] MetricsService metricsService, [FromServices] DockerService dockerService) =>
{
    var metrics = metricsService.GetMetrics();
    var containers = await dockerService.GetContainersAsync();
    
    return Results.Ok(new AgentPayloadDto(metrics, containers));
});

// Public endpoint — version is not sensitive, no auth required.
app.MapGet("/api/version", () =>
{
    var version = typeof(Program).Assembly.GetName().Version;
    var versionString = version is not null
        ? $"{version.Major}.{version.Minor}.{version.Build}.{version.Revision}"
        : "unknown";
    return Results.Ok(new { version = versionString });
});

app.Run();
