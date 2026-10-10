using HomeLabInfo.Api.Services;

namespace HomeLabInfo.Api.Tests.Services;

public class NetworkScannerServiceTests
{
    [Theory]
    [InlineData("192.168.1.", "192.168.1.")]
    [InlineData("192.168.1", "192.168.1.")]
    [InlineData("192.168.1.0/24", "192.168.1.")]
    [InlineData("192.168.1.42", "192.168.1.")]
    [InlineData(" 10.0.5. ", "10.0.5.")]
    public void NormalizePrefixes_ValidInput_ReturnsSlash24Prefix(string input, string expected)
    {
        Assert.Equal([expected], NetworkScannerService.NormalizePrefixes([input]));
    }

    [Theory]
    [InlineData("10.")]
    [InlineData("192.168.256.")]
    [InlineData("192.168.1 --outfile=/etc/x.")]
    [InlineData("-I eth0.1.2.")]
    [InlineData("a.b.c.")]
    [InlineData("")]
    public void NormalizePrefixes_InvalidInput_IsDropped(string input)
    {
        Assert.Empty(NetworkScannerService.NormalizePrefixes([input]));
    }

    [Fact]
    public void NormalizePrefixes_Duplicates_AreRemoved()
    {
        Assert.Equal(["192.168.1."], NetworkScannerService.NormalizePrefixes(["192.168.1.", "192.168.1.0/24"]));
    }
}
