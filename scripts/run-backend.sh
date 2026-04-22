#!/usr/bin/env bash
# Run the backend Docker container with all required environment variables.
#
# Usage:
#   ./scripts/run-backend.sh
#
# The script prompts for each variable. Press Enter to accept the default.
# It writes a .env file and starts the container.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
ENV_FILE="${PROJECT_ROOT}/.env"
IMAGE="itsivali/prescription-api:latest"

echo "============================================"
echo "  Prescription API — Environment Setup"
echo "============================================"
echo ""

prompt() {
  local var_name="$1"
  local description="$2"
  local default="${3:-}"
  local secret="${4:-false}"

  if [ -n "$default" ]; then
    printf "  %s (%s)\n  [default: %s]: " "$var_name" "$description" "$default"
  else
    printf "  %s (%s)\n  [required]: " "$var_name" "$description"
  fi

  if [ "$secret" = "true" ]; then
    read -rs value
    echo ""
  else
    read -r value
  fi

  value="${value:-$default}"

  if [ -z "$value" ]; then
    echo "  ERROR: $var_name is required." >&2
    exit 1
  fi

  echo "${var_name}=${value}" >> "$ENV_FILE"
}

# Start fresh
> "$ENV_FILE"

echo "-- Required --"
echo ""
prompt "DATABASE_URL"    "PostgreSQL connection string"        ""          false
prompt "REDIS_URL"       "Redis connection string"             ""          false
echo ""

echo "-- Application --"
echo ""
prompt "NODE_ENV"        "Environment"                         "production"
prompt "PORT"            "Server port"                         "8080"
echo ""

echo "-- Auth & Security --"
echo ""
prompt "SESSION_SECRET"  "Session secret (32+ chars)"          "$(openssl rand -hex 32)"
prompt "CSRF_SECRET"     "CSRF secret (32+ chars)"             "$(openssl rand -hex 32)"
echo ""

echo "-- Cookies & CORS --"
echo ""
prompt "COOKIE_DOMAIN"   "Cookie domain (your deploy domain)"  "localhost"
prompt "COOKIE_SECURE"   "Secure cookies (true/false)"         "true"
prompt "CORS_ORIGINS"    "Allowed origins (comma-separated)"   "*"
prompt "FRONTEND_URL"    "Frontend URL"                        "http://localhost:3000"
echo ""

echo "-- Token TTLs --"
echo ""
prompt "ACCESS_TOKEN_TTL_SEC"  "Access token TTL in seconds"   "900"
prompt "REFRESH_TOKEN_TTL_SEC" "Refresh token TTL in seconds"  "2592000"
echo ""

echo "============================================"
echo "  .env written to: ${ENV_FILE}"
echo "============================================"
echo ""

# Check if image exists locally
if ! docker image inspect "$IMAGE" &>/dev/null; then
  echo "Image not found locally. Pulling ${IMAGE}..."
  docker pull "$IMAGE"
fi

echo "Starting container..."
echo ""

docker run -d \
  --name prescription-api \
  --env-file "$ENV_FILE" \
  -p "${PORT:-8080}:8080" \
  --restart unless-stopped \
  "$IMAGE"

echo ""
echo "Container started! API is running at http://localhost:${PORT:-8080}"
echo ""
echo "Useful commands:"
echo "  docker logs -f prescription-api    # follow logs"
echo "  docker stop prescription-api       # stop"
echo "  docker rm prescription-api         # remove"
