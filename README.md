# HomeLabInfo

[![GitHub Repository](https://img.shields.io/badge/GitHub-Repository-blue?logo=github)](https://github.com/gregluffy/HomeLabInfo)


HomeLabInfo is a self-hosted, cross-platform network scanner and visualization dashboard designed to help you manage and map your homelab infrastructure.

![Homepage View](assets/homepage-view.png)

It provides an intuitive interface to seamlessly discover devices on your local network, track their online/offline statuses, and persist a visual map of your network topology. Originally inspired by traditional Windows Forms network scanners, this modernized web-based solution brings homelab management into the browser.

### Visualizing Your Network
Discovering and managing your devices is easier than ever with our interactive topology and container management views.

| Network Topology | Container Management |
| :---: | :---: |
| ![Network Topology](assets/network-topology-view.png) | ![Containers View](assets/containers-view.png) |


## The Approach

As a developer primarily focused on **.NET**, this project is built from the ground up leveraging the power and cross-platform capabilities of **.NET 10**. Through containerization using Docker, HomeLabInfo can be easily deployed across various operating systems and architectures without worrying about environment-specific dependencies.

### Technologies Used

* **Backend**: .NET 10 (ASP.NET Core / Worker Services)
* **Frontend**: React / Vite (Modern Web Dashboard)
* **Agent System**: .NET 10 (For remote telemetry gathering)
* **Containerization**: Docker & Docker Compose
* **Database**: SQLite / PostgreSQL (For persistence)

## Why `network_mode: host` is Required

If you've looked at the `docker-compose.yml` file, you'll notice that the deployment relies on `network_mode: host` (or `network: host` depending on the syntax). 

This is a critical requirement for the network scanning functionality to operate correctly.

By default, Docker isolates containers inside their own virtual bridge network (e.g., `172.17.0.x`). If HomeLabInfo runs on this bridge network, any ARP requests, Ping sweeps, or broadcast packets will be limited to this virtual Docker network, returning no meaningful results about your actual physical (or primary virtual) network.

By setting `network_mode: host`, the Docker container skips the isolated bridge and directly uses the network interfaces of your host machine. This allows the .NET network scanner to:
1. Discover the true subnet range of your network.
2. Send ARP requests and receive replies from physical devices on your LAN.
3. Hear UDP broadcasts (like mDNS/Bonjour) properly.

Without host networking, the scanner simply won't see your homelab.

## Deployment

HomeLabInfo is designed to be deployed using Docker Compose. Depending on your setup, you can run everything on one machine or distribute agents across multiple servers.

### 1. Unified Deployment (Hub + Agent)
Use this if you want to run the dashboard and a local agent on the same machine.

1.  Download [docker-compose.yml](docker-compose.yml).
2.  Edit the environment variables:
    *   `API_URL`: Set this to `http://<your-server-ip>:9622/api`.
    *   `HUB_PUBLIC_KEY`: Keep this as `CHANGE_ME` initially, then update it with the key provided by the dashboard after the first run.
3.  Run the stack:
    ```bash
    docker compose up -d
    ```

### 2. Hub Only (Dashboard & Database)
Use this on your main server to manage multiple remote agents.

1.  Download [docker-compose.hub.yml](docker-compose.hub.yml).
2.  Update the `API_URL` variable.
3.  Run the hub:
    ```bash
    docker compose -f docker-compose.hub.yml up -d
    ```

### 3. Remote Agent Only
Use this on any machine or VM you want to monitor.

1.  Download [docker-compose.agent.yml](docker-compose.agent.yml).
2.  Go to your HomeLabInfo dashboard, add a new agent, and copy the **Public Key**.
3.  Paste the key into the `HUB_PUBLIC_KEY` environment variable.
4.  Run the agent:
    ```bash
    docker compose -f docker-compose.agent.yml up -d
    ```


## Contributing

Contributions are welcome! As this project is licensed under the GNU GPLv3, any modifications or improvements you contribute must also be released under the same license, ensuring the project remains free and open-source for everyone.

## License

This project is licensed under the **GNU General Public License v3.0**. See the [LICENSE](LICENSE) file for the full text.

