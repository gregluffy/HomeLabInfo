using System.Security.Cryptography;

namespace HomeLabInfo.Api.Services;

public class CryptographyService
{
    // Generates a new RSA Key Pair for an Agent
    public (string PublicKey, string PrivateKey) GenerateKeyPair()
    {
        using var rsa = RSA.Create(2048);
        string publicKey = Convert.ToBase64String(rsa.ExportSubjectPublicKeyInfo());
        string privateKey = Convert.ToBase64String(rsa.ExportPkcs8PrivateKey());
        return (publicKey, privateKey);
    }

    // Signs the timestamp using the private key
    public string SignTimestamp(string privateKeyBase64, string timestamp)
    {
        using var rsa = RSA.Create();
        rsa.ImportPkcs8PrivateKey(Convert.FromBase64String(privateKeyBase64), out _);
        
        var payloadBytes = System.Text.Encoding.UTF8.GetBytes(timestamp);
        var signatureBytes = rsa.SignData(payloadBytes, HashAlgorithmName.SHA256, RSASignaturePadding.Pkcs1);
        
        return Convert.ToBase64String(signatureBytes);
    }
}
