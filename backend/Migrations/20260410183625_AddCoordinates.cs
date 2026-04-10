using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HomeLabInfo.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddCoordinates : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<float>(
                name: "PositionX",
                table: "VmAgents",
                type: "REAL",
                nullable: true);

            migrationBuilder.AddColumn<float>(
                name: "PositionY",
                table: "VmAgents",
                type: "REAL",
                nullable: true);

            migrationBuilder.AddColumn<float>(
                name: "PositionX",
                table: "Devices",
                type: "REAL",
                nullable: true);

            migrationBuilder.AddColumn<float>(
                name: "PositionY",
                table: "Devices",
                type: "REAL",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "PositionX",
                table: "VmAgents");

            migrationBuilder.DropColumn(
                name: "PositionY",
                table: "VmAgents");

            migrationBuilder.DropColumn(
                name: "PositionX",
                table: "Devices");

            migrationBuilder.DropColumn(
                name: "PositionY",
                table: "Devices");
        }
    }
}
