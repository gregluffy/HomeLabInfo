FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY ["HomeLabInfo.Api.csproj", "./"]
RUN dotnet restore "HomeLabInfo.Api.csproj"
COPY . .
WORKDIR "/src"
RUN dotnet build "HomeLabInfo.Api.csproj" -c Release -o /app/build

FROM build AS publish
RUN dotnet publish "HomeLabInfo.Api.csproj" -c Release -o /app/publish

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS final
WORKDIR /app
EXPOSE 8080
COPY --from=publish /app/publish .

# Important: ensure ARP can be run, maybe need to install net-tools if needed for arp command
RUN apt-get update && apt-get install -y net-tools iputils-ping arp-scan && rm -rf /var/lib/apt/lists/*

ENTRYPOINT ["dotnet", "HomeLabInfo.Api.dll"]
