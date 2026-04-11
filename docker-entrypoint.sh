#!/bin/bash
set -e

# -------------------------------------------------------
#  HomeLab Info — Container Entrypoint
#  Injects runtime API_URL into the pre-built frontend JS
#  and starts both backend + frontend processes.
# -------------------------------------------------------

BACKEND_PORT="${BACKEND_PORT:-9622}"
FRONTEND_PORT="${FRONTEND_PORT:-3000}"

# Build the API URL from user-provided env, or fall back to a sensible default
if [ -z "$API_URL" ]; then
  API_URL="http://localhost:${BACKEND_PORT}/api"
  echo "⚠️  API_URL not set — defaulting to ${API_URL}"
  echo "   Set API_URL to your server's reachable address for remote access."
fi

echo "🔧 Configuring frontend with API_URL=${API_URL}"

# Replace the build-time placeholder in all frontend JS files with the runtime value.
# This is safe because the placeholder is a unique string that won't appear elsewhere.
find /app/frontend -type f -name "*.js" -exec sed -i "s|__HOMELABINFO_API_URL_PLACEHOLDER__|${API_URL}|g" {} +

# Configure ASP.NET Core to listen on the chosen backend port
export ASPNETCORE_URLS="http://+:${BACKEND_PORT}"

# Start the .NET backend in the background
cd /app/backend
echo "🚀 Starting backend on port ${BACKEND_PORT}..."
dotnet HomeLabInfo.Api.dll &
BACKEND_PID=$!

# Start the Next.js frontend in the background
cd /app/frontend
export PORT="${FRONTEND_PORT}"
export HOSTNAME="0.0.0.0"
echo "🚀 Starting frontend on port ${FRONTEND_PORT}..."
node server.js &
FRONTEND_PID=$!

echo ""
echo "✅ HomeLab Info is running"
echo "   Frontend → http://localhost:${FRONTEND_PORT}"
echo "   Backend  → http://localhost:${BACKEND_PORT}"
echo ""

# Wait for either process to exit — if one dies, stop the other
wait -n $BACKEND_PID $FRONTEND_PID
EXIT_CODE=$?

echo "⚠️  A process exited (code ${EXIT_CODE}) — shutting down..."
kill $BACKEND_PID $FRONTEND_PID 2>/dev/null || true
exit $EXIT_CODE
