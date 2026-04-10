using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HomeLabInfo.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddVmAgents : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "VmAgents",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    Name = table.Column<string>(type: "TEXT", nullable: false),
                    EndpointUrl = table.Column<string>(type: "TEXT", nullable: false),
                    PublicKeyBase64 = table.Column<string>(type: "TEXT", nullable: false),
                    PrivateKeyBase64 = table.Column<string>(type: "TEXT", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_VmAgents", x => x.Id);
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "VmAgents");
        }
    }
}
