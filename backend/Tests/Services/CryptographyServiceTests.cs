using System.Security.Cryptography;
using HomeLabInfo.Api.Services;

namespace HomeLabInfo.Api.Tests.Services;

public class CryptographyServiceTests
{
    private readonly CryptographyService _svc = new();

    [Fact]
    public void GenerateKeyPair_ReturnsTwoValidBase64Strings()
    {
        var (pubKey, privKey) = _svc.GenerateKeyPair();

        Assert.False(string.IsNullOrWhiteSpace(pubKey));
        Assert.False(string.IsNullOrWhiteSpace(privKey));
        _ = Convert.FromBase64String(pubKey);
        _ = Convert.FromBase64String(privKey);
    }

    [Fact]
    public void GenerateKeyPair_EachCallProducesUniqueKeys()
    {
        var (pub1, _) = _svc.GenerateKeyPair();
        var (pub2, _) = _svc.GenerateKeyPair();

        Assert.NotEqual(pub1, pub2);
    }

    [Fact]
    public void SignTimestamp_ProducesSignatureVerifiableWithPublicKey()
    {
        var (pubKey, privKey) = _svc.GenerateKeyPair();
        const string timestamp = "1720000000";

        var signature = _svc.SignTimestamp(privKey, timestamp);

        using var rsa = RSA.Create();
        rsa.ImportSubjectPublicKeyInfo(Convert.FromBase64String(pubKey), out _);
        var isValid = rsa.VerifyData(
            System.Text.Encoding.UTF8.GetBytes(timestamp),
            Convert.FromBase64String(signature),
            HashAlgorithmName.SHA256,
            RSASignaturePadding.Pkcs1);
        Assert.True(isValid);
    }

    [Fact]
    public void SignTimestamp_DifferentKeyPair_FailsVerification()
    {
        var (_, privKey) = _svc.GenerateKeyPair();
        var (differentPubKey, _) = _svc.GenerateKeyPair();
        const string timestamp = "1720000000";

        var signature = _svc.SignTimestamp(privKey, timestamp);

        using var rsa = RSA.Create();
        rsa.ImportSubjectPublicKeyInfo(Convert.FromBase64String(differentPubKey), out _);
        var isValid = rsa.VerifyData(
            System.Text.Encoding.UTF8.GetBytes(timestamp),
            Convert.FromBase64String(signature),
            HashAlgorithmName.SHA256,
            RSASignaturePadding.Pkcs1);
        Assert.False(isValid);
    }

    [Fact]
    public void SignTimestamp_ReturnsValidBase64()
    {
        var (_, privKey) = _svc.GenerateKeyPair();
        var sig = _svc.SignTimestamp(privKey, "any-timestamp");

        Assert.False(string.IsNullOrWhiteSpace(sig));
        _ = Convert.FromBase64String(sig);
    }
}
