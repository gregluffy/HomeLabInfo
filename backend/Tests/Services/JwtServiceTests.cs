using System.Text.Json;
using HomeLabInfo.Api.Services;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;

namespace HomeLabInfo.Api.Tests.Services;

public class JwtServiceTests
{
    private const string TestSecret = "test-secret-exactly-32-bytes-ok!";

    private JwtService CreateService(string secret = TestSecret)
    {
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?> { ["JWT_SECRET"] = secret })
            .Build();
        return new JwtService(config, NullLogger<JwtService>.Instance);
    }

    [Fact]
    public void GenerateToken_ReturnsThreePartToken()
    {
        var token = CreateService().GenerateToken(1, "alice");
        Assert.Equal(3, token.Split('.').Length);
    }

    [Fact]
    public void TryValidate_ValidToken_ReturnsTrueWithUsername()
    {
        var svc = CreateService();
        var token = svc.GenerateToken(1, "alice");

        var result = svc.TryValidate(token, out var username);

        Assert.True(result);
        Assert.Equal("alice", username);
    }

    [Fact]
    public void TryValidate_TamperedSignature_ReturnsFalse()
    {
        var svc = CreateService();
        var token = svc.GenerateToken(1, "alice");
        var parts = token.Split('.');
        parts[2] = Convert.ToBase64String(new byte[32]).TrimEnd('=').Replace('+', '-').Replace('/', '_');

        Assert.False(svc.TryValidate(string.Join('.', parts), out _));
    }

    [Fact]
    public void TryValidate_TokenFromDifferentSecret_ReturnsFalse()
    {
        var token = CreateService("secret-one-exactly-32-chars-long").GenerateToken(1, "alice");

        Assert.False(CreateService("secret-two-exactly-32-chars-long").TryValidate(token, out _));
    }

    [Theory]
    [InlineData("not.a.valid.jwt.here")]
    [InlineData("bad")]
    [InlineData("")]
    [InlineData("a.b")]
    public void TryValidate_MalformedToken_ReturnsFalse(string badToken)
    {
        Assert.False(CreateService().TryValidate(badToken, out _));
    }

    [Fact]
    public void TryValidate_UsernameWithSpecialChars_RoundTrips()
    {
        var svc = CreateService();
        var token = svc.GenerateToken(42, "user@example.com");

        var result = svc.TryValidate(token, out var username);

        Assert.True(result);
        Assert.Equal("user@example.com", username);
    }

    [Fact]
    public void HashPassword_VerifyPassword_RoundTrip()
    {
        var hash = JwtService.HashPassword("MySecurePassword123");
        Assert.True(JwtService.VerifyPassword("MySecurePassword123", hash));
    }

    [Fact]
    public void VerifyPassword_WrongPassword_ReturnsFalse()
    {
        var hash = JwtService.HashPassword("correctpassword");
        Assert.False(JwtService.VerifyPassword("wrongpassword", hash));
    }

    [Theory]
    [InlineData("not-valid-format")]
    [InlineData("")]
    [InlineData("wrong:format")]
    public void VerifyPassword_InvalidHash_ReturnsFalse(string badHash)
    {
        Assert.False(JwtService.VerifyPassword("password", badHash));
    }

    [Fact]
    public void HashPassword_SameInput_ProducesDifferentHashesEachTime()
    {
        var hash1 = JwtService.HashPassword("samepassword");
        var hash2 = JwtService.HashPassword("samepassword");

        Assert.NotEqual(hash1, hash2);
        Assert.True(JwtService.VerifyPassword("samepassword", hash1));
        Assert.True(JwtService.VerifyPassword("samepassword", hash2));
    }

    [Fact]
    public void HashPassword_Format_IsPbkdf2Prefixed()
    {
        var hash = JwtService.HashPassword("anypassword");
        Assert.StartsWith("pbkdf2:", hash);
        Assert.Equal(3, hash.Split(':').Length);
    }
}
