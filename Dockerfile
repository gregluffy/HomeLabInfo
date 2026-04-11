# =============================================================================
# HomeLab Info — Combined Frontend + Backend Image
# =============================================================================
# Build context: repo root (.)
# Usage:
#   docker build -t homelabinfo -f Dockerfile .
# =============================================================================

# ---------- Stage 1: Build the .NET Backend ----------
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS backend-build
WORKDIR /src/backend
COPY backend/HomeLabInfo.Api.csproj ./
RUN dotnet restore "HomeLabInfo.Api.csproj"
COPY backend/ .
RUN dotnet publish "HomeLabInfo.Api.csproj" -c Release -o /app/backend/publish

# ---------- Stage 2: Build the Next.js Frontend ----------
FROM node:20-alpine AS frontend-build
RUN apk add --no-cache libc6-compat
WORKDIR /src/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

COPY frontend/ .

ENV NEXT_TELEMETRY_DISABLED=1

# Use a distinctive placeholder that will be replaced at container startup
# with the actual API_URL provided by the user via environment variable.
ENV NEXT_PUBLIC_API_URL=__HOMELABINFO_API_URL_PLACEHOLDER__

RUN npm run build

# ---------- Stage 3: Final Runtime Image ----------
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS final

# Install Node.js (for Next.js standalone server) + network tools (for backend ARP/ping)
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
      curl net-tools iputils-ping && \
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y --no-install-recommends nodejs && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy backend
COPY --from=backend-build /app/backend/publish ./backend/

# Copy frontend standalone build
COPY --from=frontend-build /src/frontend/public ./frontend/public
COPY --from=frontend-build /src/frontend/.next/standalone ./frontend/
COPY --from=frontend-build /src/frontend/.next/static ./frontend/.next/static

# Copy startup script
COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

# Default environment variables (all overridable at runtime)
ENV ASPNETCORE_ENVIRONMENT=Production
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Sensible defaults — users override these via docker-compose / docker run
ENV BACKEND_PORT=9622
ENV FRONTEND_PORT=3000

ENTRYPOINT ["./docker-entrypoint.sh"]
