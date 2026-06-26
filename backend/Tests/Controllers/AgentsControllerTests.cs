using System.Text.Json;
using HomeLabInfo.Api.Controllers;
using HomeLabInfo.Api.Data;
using HomeLabInfo.Api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HomeLabInfo.Api.Tests.Controllers;

public class AgentsControllerTests : IDisposable
{
    private readonly AppDbContext _db;
    private readonly CryptographyService _crypto = new();

    public AgentsControllerTests()
    {
        _db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options);
    }

    public void Dispose() => _db.Dispose();

    private AgentsController Ctrl() => new(_db, _crypto);

    private static JsonElement ToJson(object? value) =>
        JsonDocument.Parse(JsonSerializer.Serialize(value)).RootElement;

    [Fact]
    public async Task GetAgents_Empty_ReturnsEmptyArray()
    {
        var result = Assert.IsType<OkObjectResult>(await Ctrl().GetAgents());
        Assert.Equal(0, ToJson(result.Value).GetArrayLength());
    }

    [Fact]
    public async Task RegisterAgent_ValidInput_Returns201WithId()
    {
        var result = Assert.IsType<CreatedAtActionResult>(
            await Ctrl().RegisterAgent(new RegisterAgentDto("Test VM", "http://192.168.1.10:5000")));

        Assert.Equal(201, result.StatusCode);
        Assert.True(ToJson(result.Value).GetProperty("Id").GetInt32() > 0);
    }

    [Fact]
    public async Task RegisterAgent_TrimsTrailingSlashFromUrl()
    {
        await Ctrl().RegisterAgent(new RegisterAgentDto("VM", "http://192.168.1.10/"));
        Assert.Equal("http://192.168.1.10", _db.VmAgents.First().EndpointUrl);
    }

    [Fact]
    public async Task RegisterAgent_GeneratesPublicKey()
    {
        var result = Assert.IsType<CreatedAtActionResult>(
            await Ctrl().RegisterAgent(new RegisterAgentDto("VM", "http://192.168.1.10:5000")));

        var pubKey = ToJson(result.Value).GetProperty("PublicKeyBase64").GetString();
        Assert.False(string.IsNullOrWhiteSpace(pubKey));
    }

    [Fact]
    public async Task GetAgent_NotFound_Returns404()
    {
        Assert.IsType<NotFoundResult>(await Ctrl().GetAgent(999));
    }

    [Fact]
    public async Task GetAgent_Existing_ReturnsAgent()
    {
        await Ctrl().RegisterAgent(new RegisterAgentDto("My VM", "http://192.168.1.10:5000"));
        var id = _db.VmAgents.First().Id;

        var result = Assert.IsType<OkObjectResult>(await Ctrl().GetAgent(id));
        Assert.Equal(id, ToJson(result.Value).GetProperty("Id").GetInt32());
    }

    [Fact]
    public async Task DeleteAgent_Existing_Returns204AndRemoves()
    {
        await Ctrl().RegisterAgent(new RegisterAgentDto("VM", "http://192.168.1.10:5000"));
        var id = _db.VmAgents.First().Id;

        Assert.IsType<NoContentResult>(await Ctrl().DeleteAgent(id));
        Assert.False(_db.VmAgents.Any());
    }

    [Fact]
    public async Task DeleteAgent_NotFound_Returns404()
    {
        Assert.IsType<NotFoundResult>(await Ctrl().DeleteAgent(999));
    }

    [Fact]
    public async Task UpdateAgent_UpdatesNameAndUrl()
    {
        await Ctrl().RegisterAgent(new RegisterAgentDto("OldName", "http://old.local:5000"));
        var agent = _db.VmAgents.First();

        Assert.IsType<NoContentResult>(
            await Ctrl().UpdateAgent(agent.Id, new UpdateAgentDto { Name = "NewName", EndpointUrl = "http://new.local/" }));

        Assert.Equal("NewName", agent.Name);
        Assert.Equal("http://new.local", agent.EndpointUrl);
    }

    [Fact]
    public async Task UpdateAgent_NullFields_LeavesExistingValues()
    {
        await Ctrl().RegisterAgent(new RegisterAgentDto("OriginalName", "http://original.local:5000"));
        var agent = _db.VmAgents.First();

        await Ctrl().UpdateAgent(agent.Id, new UpdateAgentDto { Name = null });

        Assert.Equal("OriginalName", agent.Name);
    }

    [Fact]
    public async Task UpdateAgent_NotFound_Returns404()
    {
        Assert.IsType<NotFoundResult>(await Ctrl().UpdateAgent(999, new UpdateAgentDto { Name = "Test" }));
    }

    [Fact]
    public async Task GetAgents_AfterRegister_ReturnsOneAgent()
    {
        await Ctrl().RegisterAgent(new RegisterAgentDto("VM", "http://192.168.1.10:5000"));

        var result = Assert.IsType<OkObjectResult>(await Ctrl().GetAgents());
        Assert.Equal(1, ToJson(result.Value).GetArrayLength());
    }
}
