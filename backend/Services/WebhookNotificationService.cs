using System.Text.Json;
using System.Net.Http.Json;

namespace HomeLabInfo.Api.Services;

public class WebhookNotificationService
{
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly ILogger<WebhookNotificationService> _logger;

    public WebhookNotificationService(IHttpClientFactory httpClientFactory, ILogger<WebhookNotificationService> logger)
    {
        _httpClientFactory = httpClientFactory;
        _logger = logger;
    }

    public async Task SendNotificationAsync(string url, string provider, string title, string message)
    {
        if (string.IsNullOrWhiteSpace(url)) return;

        string fullMessage = $"**[{title}]**\n{message}";

        object payload = provider.ToLower() switch
        {
            "discord" => new { content = fullMessage },
            "teams" => new { text = fullMessage },
            "generic" => new { 
                title = title,
                message = message, 
                timestamp = DateTime.UtcNow.ToString("O") 
            },
            _ => new { content = fullMessage }
        };

        try
        {
            var client = _httpClientFactory.CreateClient();
            var response = await client.PostAsJsonAsync(url, payload);
            
            if (!response.IsSuccessStatusCode)
            {
                var error = await response.Content.ReadAsStringAsync();
                _logger.LogWarning($"Failed to send webhook to {provider}. Status: {response.StatusCode}. Error: {error}");
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, $"Error sending webhook to {provider}");
        }
    }

    public async Task<bool> SendTestNotificationAsync(string url, string provider)
    {
        try
        {
            await SendNotificationAsync(url, provider, "Test Notification", "This is a test notification from HomeLabInfo. If you're seeing this, your webhook is configured correctly!");
            return true;
        }
        catch
        {
            return false;
        }
    }
}
