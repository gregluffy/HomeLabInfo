namespace HomeLabInfo.Agent.DTOs;

public record HostMetricsDto(
    double CpuPercentage,
    double MemoryTotalMB,
    double MemoryUsedMB,
    double DiskTotalGB,
    double DiskUsedGB
);

public record DockerContainerDto(
    string Id,
    string Name,
    string Image,
    string State,
    string Status
);

public record AgentPayloadDto(
    HostMetricsDto Host,
    List<DockerContainerDto> Containers
);
