using System.Reflection;

namespace HomeLabInfo.Api.Services;

/// <summary>
/// Resolves a MAC address to its manufacturer via the IEEE OUI registry,
/// embedded at Resources/oui.tsv (lines of "6-hex-digit prefix TAB vendor name").
/// </summary>
public static class OuiVendorLookup
{
    private static readonly Lazy<Dictionary<string, string>> Vendors = new(Load);

    public static string? Find(string macAddress)
    {
        var hex = new string(macAddress.Where(Uri.IsHexDigit).ToArray()).ToUpperInvariant();
        if (hex.Length < 6) return null;
        return Vendors.Value.TryGetValue(hex[..6], out var vendor) ? vendor : null;
    }

    private static Dictionary<string, string> Load()
    {
        var vendors = new Dictionary<string, string>();
        try
        {
            var assembly = Assembly.GetExecutingAssembly();
            var resourceName = assembly.GetManifestResourceNames()
                .FirstOrDefault(n => n.EndsWith("oui.tsv", StringComparison.OrdinalIgnoreCase));
            if (resourceName == null) return vendors;

            using var stream = assembly.GetManifestResourceStream(resourceName)!;
            using var reader = new StreamReader(stream);
            string? line;
            while ((line = reader.ReadLine()) != null)
            {
                int tab = line.IndexOf('\t');
                if (tab <= 0 || tab == line.Length - 1) continue;
                vendors[line[..tab]] = line[(tab + 1)..];
            }
        }
        catch
        {
            // Vendor names are a best-effort enrichment; never fail discovery over them.
        }
        return vendors;
    }
}
