# HomeLabInfo User Manual

Welcome to **HomeLabInfo**, a premium monitoring and management suite for your home lab infrastructure. This guide covers everything from basic network scanning to advanced topology management.

---

## 1. Dashboard Overview
The main dashboard provides a high-level view of your entire infrastructure.
- **VM Cards**: Real-time monitoring of your virtual machines.
- **Resource Metrics**: Visual indicators for CPU, RAM, and Disk usage (requires Agent installation).
- **Status Indicators**: Quickly identify which systems are online or experiencing high load.

---

## 2. Network Scanner
The Network Scanner is the core discovery engine of the application.

### 2.1 Basic Scanning
Enter your network prefix (e.g., `192.168.1.`) and click **Scan**. The app will ping every IP in the range (`.1` to `.254`) and perform a port scan if **Deep Scan** is enabled.

### 2.2 Multi-Subnet Scanning
The scanner supports scanning multiple subnets simultaneously.
- **Format**: Enter comma-separated prefixes: `192.168.1., 192.168.20., 10.0.0.`
- **Persistence**: Your scan ranges are automatically saved to the database. The next time you open the app, your subnets will be pre-filled.

### 2.3 Device Status Logic
- **Online**: Devices that respond to ping or have open ports.
- **Offline**: If a device was previously found but fails to respond during a scan *within its subnet*, it is marked as Offline.
- **Selective Tracking**: Scanning one subnet (e.g., `192.168.1.`) will **not** mark devices in other subnets (e.g., `192.168.20.`) as offline.

---

## 3. Instant DHCP Discovery
HomeLabInfo includes a specialized listener that monitors your network for DHCP requests (the signal sent by a device when it first connects).

### 3.1 Real-Time Discovery
When a new device joins your network:
1.  The app captures the DHCP broadcast.
2.  It immediately identifies the device's MAC address and hostname.
3.  The device is added to your dashboard instantly, even before a full network scan is performed.

### 3.2 Webhook Notifications
You can configure a Webhook URL in the settings to receive instant alerts (e.g., via Discord, Slack, or Gotify) whenever a new client is discovered via DHCP. This is perfect for monitoring for unauthorized devices or seeing exactly when your servers reboot.

---

## 4. Network Topology
The Topology View provides a visual "map" of your home lab.

### 4.1 The Main Router
The top-most node represents your network's gateway.
- **Configuration**: By default, the app assumes `192.168.1.1`. To change this, **double-click** the Router node in the Topology View and enter your actual gateway IP.
- **Auto-Discovery**: When you set a Router IP, the app ensures that device is tracked in your database so it never disappears from the map.

### 4.2 Interacting with Nodes
- **Dragging**: You can move any node to organize your map. Positions are **saved automatically** to the database.
- **Double-Click**: 
    - **Devices/Agents**: Rename the device or change its display icon.
    - **Router**: Update the gateway IP address.
- **Visual Cues**: 
    - **Emerald Lines**: Online connections.
    - **Rose Lines/Dashed**: Offline or disconnected devices.
    - **Animations**: Active data flow (animated edges).

### 4.3 Exporting
Click **Export as PNG** in the top-right of the topology view to save a high-resolution snapshot of your network map.

---

## 5. Agents & Containers
To get the most out of HomeLabInfo, you should install the **HomeLabInfo Agent** on your Linux VMs or Servers.

### 5.1 Agent Features
- **Host Metrics**: Detailed RAM and Disk usage reporting.
- **Docker Integration**: The agent automatically discovers running Docker containers and links them to the host VM in the Topology view.
- **Status Monitoring**: Real-time heartbeat to ensure your servers are healthy.

### 5.2 Topology Representation
When an agent is detected:
1. The VM appears as a specialized **Agent Node**.
2. All Docker containers are rendered as child nodes connected to the host VM.
3. Container states (Running/Stopped) are updated in real-time.

---

## 6. Technical Settings
- **API URL**: Ensure your frontend is pointed to the correct backend API in your `.env` file (`NEXT_PUBLIC_API_URL`).
- **Persistence**: Most settings (Scan ranges, Router IP, Node positions) are stored in the backend SQL database for cross-device consistency.

---

*Manual Version: 1.0.0.10*  
*Last Updated: May 2026*
