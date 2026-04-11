HomeLabInfo is a self-hosted, cross-platform network scanner and visualization dashboard designed to help you manage and map your homelab infrastructure.

**GitHub Repository:** [https://github.com/gregluffy/HomeLabInfo](https://github.com/gregluffy/HomeLabInfo)

![Homepage View](assets/homepage-view.png)


---

## 1. HomeLab Info (Hub / Unified Stack)
**Image:** `gfountopoulos/homelabinfo:latest`

This image includes both the **Frontend dashboard** and the **Backend API**. It is the central nerve center of your homelab monitoring.

### Deployment (Docker Compose)
Save this as `docker-compose.yml` and run `docker compose up -d`.

```yaml
services:
  homelabinfo:
    image: gfountopoulos/homelabinfo:latest
    container_name: homelabinfo
    restart: unless-stopped
    environment:
      # Set this to your host's IP address so your browser can reach the API
      - API_URL=http://YOUR_SERVER_IP:9622/api
    volumes:
      - ./database:/app/backend/Database
    cap_add:
      - NET_ADMIN
      - NET_RAW
    # Required for network scanning (ARP/Ping) to work correctly
    network_mode: "host"

![Network Topology](assets/network-topology-view.png)

```

### Why `network_mode: host`?
To perform network-wide ARP scanning and device discovery, the container must access the host's network interfaces directly. Without this, the scanner would be isolated inside a private Docker bridge network and unable to see your other local devices.

---

## 2. HomeLab Info Agent
**Image:** `gfountopoulos/homelabinfo-agent:latest`

The agent is a lightweight .NET 10 service that reports host metrics (CPU, RAM, Disk) and Docker container statuses back to the Hub.

### Deployment (Docker Compose)
Save this as `docker-compose.agent.yml` and run `docker compose up -d`.

```yaml
services:
  homelab-agent:
    image: gfountopoulos/homelabinfo-agent:latest
    container_name: homelab-agent
    restart: unless-stopped
    ports:
      - "9624:8080"
    volumes:
      # Required to read container stats
      - /var/run/docker.sock:/var/run/docker.sock:ro
      # Required to read accurate host Disk metrics
      - /:/host:ro
      # Required for CPU/RAM monitoring
      - /proc:/host/proc:ro
    environment:
      - ASPNETCORE_ENVIRONMENT=Production
      # Obtain this key from your HomeLab Info dashboard
      - HUB_PUBLIC_KEY=YOUR_AGENT_PUBLIC_KEY

![Containers View](assets/containers-view.png)

```

---

## Technical Core
*   **Built with:** .NET 10 (ASP.NET Core), Next.js, Docker.
*   **Architecture:** Optimized for low-resource environments (RPi, Home Servers).
*   **License:** GNU GPLv3.

For the full source code, contribution guidelines, and advanced configurations, visit the **[GitHub Repository](https://github.com/gregluffy/HomeLabInfo)**.

