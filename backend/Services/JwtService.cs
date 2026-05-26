using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace HomeLabInfo.Api.Services;

public class JwtService
{
    private readonly byte[] _keyBytes;
    private const int ExpiryHours = 24;

    public JwtService(IConfiguration config, ILogger<JwtService> logger)
    {
        var secret = config["JWT_SECRET"];
        if (string.IsNullOrEmpty(secret))
        {
            secret = Convert.ToBase64String(RandomNumberGenerator.GetBytes(32));
            logger.LogWarning("JWT_SECRET not set — using an ephemeral secret. Tokens will be invalidated on restart. Set JWT_SECRET in your environment for persistence.");
        }
        _keyBytes = Encoding.UTF8.GetBytes(secret);
    }

    public string GenerateToken(int userId, string username)
    {
        var header = B64U("{\"alg\":\"HS256\",\"typ\":\"JWT\"}");
        var exp = DateTimeOffset.UtcNow.AddHours(ExpiryHours).ToUnixTimeSeconds();
        var payload = B64U($"{{\"sub\":\"{userId}\",\"username\":\"{EscapeJson(username)}\",\"exp\":{exp}}}");
        var sig = B64U(HMACSHA256.HashData(_keyBytes, Encoding.UTF8.GetBytes($"{header}.{payload}")));
        return $"{header}.{payload}.{sig}";
    }

    public bool TryValidate(string token, out string? username)
    {
        username = null;
        try
        {
            var parts = token.Split('.');
            if (parts.Length != 3) return false;

            var expectedSig = B64U(HMACSHA256.HashData(_keyBytes, Encoding.UTF8.GetBytes($"{parts[0]}.{parts[1]}")));
            if (!CryptographicOperations.FixedTimeEquals(
                Encoding.UTF8.GetBytes(expectedSig),
                Encoding.UTF8.GetBytes(parts[2]))) return false;

            var payloadBytes = FromB64U(parts[1]);
            using var doc = JsonDocument.Parse(payloadBytes);

            var exp = doc.RootElement.GetProperty("exp").GetInt64();
            if (DateTimeOffset.UtcNow.ToUnixTimeSeconds() > exp) return false;

            username = doc.RootElement.GetProperty("username").GetString();
            return username != null;
        }
        catch
        {
            return false;
        }
    }

    public static string HashPassword(string password)
    {
        var salt = RandomNumberGenerator.GetBytes(16);
        var hash = Rfc2898DeriveBytes.Pbkdf2(password, salt, 100_000, HashAlgorithmName.SHA256, 32);
        return $"pbkdf2:{Convert.ToBase64String(salt)}:{Convert.ToBase64String(hash)}";
    }

    public static bool VerifyPassword(string password, string storedHash)
    {
        try
        {
            var parts = storedHash.Split(':');
            if (parts.Length != 3 || parts[0] != "pbkdf2") return false;
            var salt = Convert.FromBase64String(parts[1]);
            var expectedHash = Convert.FromBase64String(parts[2]);
            var actualHash = Rfc2898DeriveBytes.Pbkdf2(password, salt, 100_000, HashAlgorithmName.SHA256, 32);
            return CryptographicOperations.FixedTimeEquals(actualHash, expectedHash);
        }
        catch
        {
            return false;
        }
    }

    private static string B64U(string s) => B64U(Encoding.UTF8.GetBytes(s));
    private static string B64U(byte[] b) => Convert.ToBase64String(b).TrimEnd('=').Replace('+', '-').Replace('/', '_');
    private static byte[] FromB64U(string s)
    {
        s = s.Replace('-', '+').Replace('_', '/');
        s = (s.Length % 4) switch { 2 => s + "==", 3 => s + "=", _ => s };
        return Convert.FromBase64String(s);
    }

    private static string EscapeJson(string s) => s.Replace("\\", "\\\\").Replace("\"", "\\\"");
}
