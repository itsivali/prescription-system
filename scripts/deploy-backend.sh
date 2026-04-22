#!/usr/bin/env bash
# Deploy the backend Docker image to Docker Hub.
#
# Usage:
#   ./scripts/deploy-backend.sh                  # uses "latest" tag
#   ./scripts/deploy-backend.sh v1.2.3           # uses "v1.2.3" tag
#
# Prerequisites:
#   1. Docker installed and running
#   2. Docker Hub account — sign up at https://hub.docker.com
#   3. Run `docker login` once before using this script

set -euo pipefail

# ── Configuration ──────────────────────────────────────────────────────────
IMAGE_NAME="prescription-api"
TAG="${1:-latest}"
# ───────────────────────────────────────────────────────────────────────────

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
CONTEXT_DIR="${PROJECT_ROOT}/services/core-api"

# Log in to Docker Hub (opens browser-based login if available, otherwise prompts in terminal)
echo "==> Logging in to Docker Hub..."
docker login

DOCKER_USERNAME="itsivali"
FULL_IMAGE="${DOCKER_USERNAME}/${IMAGE_NAME}:${TAG}"

echo "==> Building image: ${FULL_IMAGE}"
docker build -t "${FULL_IMAGE}" "${CONTEXT_DIR}"

echo "==> Pushing image: ${FULL_IMAGE}"
docker push "${FULL_IMAGE}"

# Also tag as latest if a version tag was given
if [ "${TAG}" != "latest" ]; then
  LATEST="${DOCKER_USERNAME}/${IMAGE_NAME}:latest"
  docker tag "${FULL_IMAGE}" "${LATEST}"
  docker push "${LATEST}"
  echo "==> Also pushed: ${LATEST}"
fi

echo ""
echo "Done! Image available at: docker.io/${FULL_IMAGE}"
echo ""
echo "Run it with:"
echo "  docker run -p 8080:8080 \\"
echo "    -e DATABASE_URL=\"postgresql://user:pass@host:5432/db\" \\"
echo "    -e REDIS_URL=\"redis://host:6379\" \\"
echo "    ${FULL_IMAGE}"
