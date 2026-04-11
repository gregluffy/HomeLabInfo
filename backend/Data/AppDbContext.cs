using HomeLabInfo.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace HomeLabInfo.Api.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options)
    {
    }

    public DbSet<NetworkDevice> Devices { get; set; }
    public DbSet<VmAgent> VmAgents { get; set; }
    public DbSet<AppSetting> Settings { get; set; }
}
