# Release v1.0.0.2 — The Foundation Update 🚀

This release marks the first stable foundation of **HomeLabInfo**, a modern, .NET-powered dashboard designed to give you complete visibility over your homelab's network and infrastructure.

## ✨ What’s New
This update consolidates our core services into a unified, containerized stack, making it easier than ever to deploy and monitor your servers.

*   **Unified Dashboard**: A sleek, React/Vite-powered interface to visualize your network topology and container health in real-time.
*   **Persistent Network Discovery**: Integrated network scanner that maps your local devices and tracks their online/offline status, with persistence powered by SQLite.
*   **Remote Agent System**: A lightweight .NET 10 agent that can be deployed on any machine to report container stats, CPU, RAM, and Disk metrics back to your central hub.
*   **Docker Integration**: Native monitoring of local and remote Docker containers with status indicators and performance metrics.
*   **Host Networking Mode**: Optimized scanning capabilities that leverage the host's network interfaces for accurate ARP and discovery.
*   **Full Documentation**: Complete setup guides added for both GitHub and Docker Hub, including visual screenshots of the interface.

## 🛠 Deployment
You can spin up the full stack today using our updated `docker-compose.yml`. 

```bash
# Pull and start the hub and local agent
docker compose up -d
```
*Note: Ensure you set your `API_URL` to your host's local IP to enable cross-origin communication between the frontend and backend.*

## 📄 License & Open Source
This project is now officially released under the **GNU General Public License v3.0**, ensuring that HomeLabInfo remains free and open-source for the entire community.
