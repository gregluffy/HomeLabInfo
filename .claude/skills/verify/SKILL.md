---
name: verify
description: Build, run, and drive the HomeLabInfo backend to verify changes at its real surfaces (REST API, UDP DHCP listener, outgoing webhooks).
---

# Verifying HomeLabInfo

## Build & run the backend

```bash
cd backend && dotnet build
# Run from an EMPTY scratch dir — the SQLite DB is created at ./Database/homelab.db
# relative to the CWD, so this isolates you from any real dev database.
cd <scratch-dir> && ASPNETCORE_URLS=http://127.0.0.1:5177 dotnet <repo>/backend/bin/Debug/net10.0/HomeLabInfo.Api.dll
```

- Auth is OFF unless `AUTH_ENABLED=true` env var is set, so the API is directly curl-able.
- Migrations apply automatically on startup.

## Drive the API

```bash
curl http://127.0.0.1:5177/api/scanner/devices
curl -X PUT http://127.0.0.1:5177/api/settings/<Key> -H "Content-Type: application/json" -d '{"value":"..."}'
```

Settings keys: `EnableDhcpListening`, `WebhookUrl`, `WebhookProvider`, `ScanInterface`, `DefaultRouterIp`.

## DHCP listener specifics

- The listener binds UDP 0.0.0.0:67 only while `EnableDhcpListening=true`; it re-reads
  settings every ~10s, so **wait ~12s after toggling** before asserting.
- Craft and send DHCP packets to 127.0.0.1:67 with a small Python script (build the
  RFC 2131 layout: header, ciaddr @12, chaddr @28, 192 zero bytes, magic cookie
  63 82 53 63, then options 53/12/50/60, terminator 255).
- Check binding with `netstat -ano -p UDP | grep ":67 "`.

## Capturing webhooks

Point `WebhookUrl` at a local Python HTTP server. **Gotcha:** .NET's `PostAsJsonAsync`
sends `Transfer-Encoding: chunked` with no `Content-Length` — a naive
`rfile.read(content-length)` captures an empty body; decode chunked framing.
