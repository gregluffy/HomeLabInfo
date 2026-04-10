using System.Net.Sockets;
using System.Text.Json;
using HomeLabInfo.Agent.DTOs;

namespace HomeLabInfo.Agent.Services;

public class DockerService
{
    private readonly HttpClient _client;

    public DockerService()
    {
        string socketPath = "/var/run/docker.sock";
        if (File.Exists(socketPath))
        {
            var handler = new SocketsHttpHandler
            {
                ConnectCallback = async (context, cancellationToken) =>
                {
                    var socket = new Socket(AddressFamily.Unix, SocketType.Stream, ProtocolType.Unspecified);
                    try
                    {
                        await socket.ConnectAsync(new UnixDomainSocketEndPoint(socketPath), cancellationToken);
                        return new NetworkStream(socket, ownsSocket: true);
                    }
                    catch
                    {
                        socket.Dispose();
                        throw;
                    }
                }
            };
            _client = new HttpClient(handler)
            {
                BaseAddress = new Uri("http://localhost/") 
            };
        }
        else
        {
            _client = new HttpClient(); // Fallback that will fail without config, just for mock testing
            _client.BaseAddress = new Uri("http://localhost:2375/"); 
        }
    }

    public async Task<List<DockerContainerDto>> GetContainersAsync()
    {
        try
        {
            var response = await _client.GetAsync("containers/json?all=true");
            response.EnsureSuccessStatusCode();

            var jsonStream = await response.Content.ReadAsStreamAsync();
            var doc = await JsonDocument.ParseAsync(jsonStream);

            var containers = new List<DockerContainerDto>();
            foreach (var container in doc.RootElement.EnumerateArray())
            {
                string id = container.GetProperty("Id").GetString() ?? "";
                var names = container.GetProperty("Names").EnumerateArray()
                                     .Select(n => n.GetString()?.TrimStart('/'))
                                     .ToList();
                string name = names.FirstOrDefault() ?? "unknown";
                string image = container.GetProperty("Image").GetString() ?? "";
                string state = container.GetProperty("State").GetString() ?? "";
                string status = container.GetProperty("Status").GetString() ?? "";

                containers.Add(new DockerContainerDto(id, name, image, state, status));
            }
            return containers;
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Error fetching containers: {ex.Message}");
            return new List<DockerContainerDto>();
        }
    }
}
