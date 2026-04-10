FROM mcr.microsoft.com/dotnet/sdk:10.0-alpine AS build
WORKDIR /src

COPY ["HomeLabInfo.Agent.csproj", "./"]
RUN dotnet restore "HomeLabInfo.Agent.csproj"

COPY . .
RUN dotnet publish "HomeLabInfo.Agent.csproj" -c Release -o /app/publish /p:UseAppHost=false

FROM mcr.microsoft.com/dotnet/aspnet:10.0-alpine AS final
WORKDIR /app
COPY --from=build /app/publish .

# Expose port and configure ASP.NET Core URL
ENV ASPNETCORE_URLS=http://+:8080
EXPOSE 8080

ENTRYPOINT ["dotnet", "HomeLabInfo.Agent.dll"]
