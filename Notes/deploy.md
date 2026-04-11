# Docker Hub Build & Push Guide

This guide explains how to build the two primary HomeLabInfo images and push them to Docker Hub.

> [!TIP]
> Your specific Docker Hub username is `gfountopoulos`.

## 1. Prepare for Build
Ensure you are logged into Docker Hub:
```bash
docker login
```

### Setup Multi-Platform Builder (Required Once)
If you get an error about the "docker driver" not supporting multi-platforms, run these commands to create a container-based builder:
```bash
docker buildx create --name homelab-builder --use
docker buildx inspect --bootstrap
```

---

## 2. Build the Hub Image (Frontend + Backend)
The Hub image is a combined build that includes both the .NET Backend and the Next.js Frontend.

**Standard Build:**
```bash
docker build -t gfountopoulos/homelabinfo:1.0.0.2 -t gfountopoulos/homelabinfo:latest -f Dockerfile .
```

**Multi-Platform Build (AMD64 + ARM64):**
```bash
docker buildx build --platform linux/amd64,linux/arm64 -t gfountopoulos/homelabinfo:1.0.0.2 -t gfountopoulos/homelabinfo:latest -f Dockerfile --push .
```

---

## 3. Build the Agent Image
The Agent is a lightweight .NET app that runs on secondary machines.

**Standard Build:**
```bash
docker build -t gfountopoulos/homelabinfo-agent:1.0.0.2 -t gfountopoulos/homelabinfo-agent:latest -f agent/Dockerfile agent/
```

**Multi-Platform Build (AMD64 + ARM64):**
```bash
docker buildx build --platform linux/amd64,linux/arm64 -t gfountopoulos/homelabinfo-agent:1.0.0.2 -t gfountopoulos/homelabinfo-agent:latest -f agent/Dockerfile --push agent/
```

---

## 4. Push to Docker Hub
(Skip this if using the `--push` flag in the `buildx` command above)

**Hub Image:**
```bash
docker push gfountopoulos/homelabinfo:1.0.0.2
docker push gfountopoulos/homelabinfo:latest
```

**Agent Image:**
```bash
docker push gfountopoulos/homelabinfo-agent:1.0.0.2
docker push gfountopoulos/homelabinfo-agent:latest
```

---

## Summary of Tags
| Image | Version Tag | Latest Tag | Description |
| :--- | :--- | :--- | :--- |
| **Hub** | `1.0.0.2` | `latest` | Combined UI & API |
| **Agent** | `1.0.0.2` | `latest` | Node monitoring agent |
