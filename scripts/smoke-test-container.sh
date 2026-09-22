#!/bin/bash
# Smoke test for the kid-friendly-ai container application image
#
# This script performs a focused end-to-end test of the OCI image by:
# 1. Starting the application in a container with port 3000 exposed
# 2. Waiting for the application to be ready via health polling
# 3. Testing the /api/health endpoint for expected response structure
# 4. Testing an AI-independent route (/) for successful HTTP response
# 5. Cleaning up the container on success or failure
#
# REQUIREMENT: This script must be run on Apple-silicon macOS 26.
# It is designed to test the containerized application image in isolation
# without Redis, Nginx, Docker Compose, or host bind mounts.
#
# Usage: scripts/smoke-test-container.sh <image-tag>
# Example: scripts/smoke-test-container.sh kid-friendly-ai:latest

set -euo pipefail

# ============================================================================
# Configuration
# ============================================================================

IMAGE_TAG="${1:-}"
CONTAINER_NAME="kid-friendly-ai-smoke-test-$$"
PORT=3000
HOST=127.0.0.1
HEALTH_ENDPOINT="http://${HOST}:${PORT}/api/health"
ROUTE_ENDPOINT="http://${HOST}:${PORT}/"
HEALTH_CHECK_TIMEOUT=120  # seconds
HEALTH_CHECK_INTERVAL=1   # seconds
STARTUP_TIMEOUT=10        # seconds for initial container startup

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# ============================================================================
# Validation
# ============================================================================

if [ -z "$IMAGE_TAG" ]; then
  echo "Error: Image tag is required"
  echo "Usage: $0 <image-tag>"
  echo "Example: $0 kid-friendly-ai:latest"
  exit 1
fi

if ! command -v docker &> /dev/null; then
  echo -e "${RED}Error: docker is not installed${NC}"
  exit 1
fi

# ============================================================================
# Cleanup function - runs on exit
# ============================================================================

cleanup() {
  local exit_code=$?

  if [ -n "${CONTAINER_ID:-}" ]; then
    echo -e "${YELLOW}Cleaning up container ${CONTAINER_ID}...${NC}"
    docker rm -f "${CONTAINER_ID}" 2>/dev/null || true
  fi

  if [ $exit_code -eq 0 ]; then
    echo -e "${GREEN}Smoke test passed${NC}"
  else
    echo -e "${RED}Smoke test failed with exit code $exit_code${NC}"
  fi

  exit $exit_code
}

trap cleanup EXIT

# ============================================================================
# Start container
# ============================================================================

echo -e "${YELLOW}Starting container from image: ${IMAGE_TAG}${NC}"

# Non-secret environment variables from docker-compose.yml app service
CONTAINER_ID=$(docker run \
  -d \
  --name="${CONTAINER_NAME}" \
  -p "${PORT}:3000" \
  -e NODE_ENV=production \
  -e PORT=3000 \
  -e HOSTNAME=0.0.0.0 \
  -e "NEXT_PUBLIC_SITE_URL=http://localhost:3000" \
  -e "NEXT_PUBLIC_VERCEL_URL=http://localhost:3000" \
  -e "NEXT_PUBLIC_ENABLE_VOICE_INPUT=true" \
  -e "NEXT_PUBLIC_ENABLE_PARENTAL_CONTROLS=true" \
  -e "NEXT_PUBLIC_ENABLE_SOUND_EFFECTS=true" \
  -e "NEXT_PUBLIC_ENABLE_PATTERN_PUZZLE=true" \
  -e "NEXT_PUBLIC_ENABLE_ANIMAL_QUIZ=true" \
  -e "DEFAULT_AI_MODEL=google/gemini-2.5-flash-lite" \
  -e "MAX_TOKENS=500" \
  -e "AI_TEMPERATURE=0.8" \
  "${IMAGE_TAG}" 2>&1) || {
  echo -e "${RED}Error: Failed to start container${NC}"
  exit 1
}

echo -e "${GREEN}Container started: ${CONTAINER_ID:0:12}${NC}"

# ============================================================================
# Wait for container to start
# ============================================================================

echo -e "${YELLOW}Waiting for container to become ready...${NC}"

start_time=$(date +%s)
while true; do
  current_time=$(date +%s)
  elapsed=$((current_time - start_time))

  if [ $elapsed -gt $STARTUP_TIMEOUT ]; then
    # Give it a moment for the process to be ready
    echo -e "${YELLOW}Container process started, polling for readiness...${NC}"
    break
  fi

  # Check if container is still running
  if ! docker inspect "${CONTAINER_ID}" --format='{{.State.Running}}' 2>/dev/null | grep -q "true"; then
    echo -e "${RED}Error: Container exited unexpectedly${NC}"
    docker logs "${CONTAINER_ID}" 2>&1 | tail -20
    exit 1
  fi

  sleep 0.5
done
# ============================================================================
# Wait for container and poll health endpoint
# ============================================================================

echo -e "${YELLOW}Waiting for container and polling health endpoint...${NC}"

start_time=$(date +%s)
health_ready=false
while true; do
  current_time=$(date +%s)
  elapsed=$((current_time - start_time))

  if [ $elapsed -gt $HEALTH_CHECK_TIMEOUT ]; then
    echo -e "${RED}Error: Health check timeout after ${HEALTH_CHECK_TIMEOUT} seconds${NC}"
    echo -e "${YELLOW}Container logs:${NC}"
    docker logs "${CONTAINER_ID}" 2>&1 | tail -30
    exit 1
  fi

  # Check if container is still running
  if ! docker inspect "${CONTAINER_ID}" --format='{{.State.Running}}' 2>/dev/null | grep -q "true"; then
    echo -e "${RED}Error: Container exited during health polling${NC}"
    docker logs "${CONTAINER_ID}" 2>&1 | tail -20
    exit 1
  fi

  # Try to reach the health endpoint
  health_response=$(curl -s -w "\n%{http_code}" "${HEALTH_ENDPOINT}" 2>/dev/null || echo -e "\n000")
  http_code=$(echo "$health_response" | tail -1)
  body=$(echo "$health_response" | head -1)

  # Accept HTTP 200 (healthy) or HTTP 503 (unhealthy but responding)
  if [ "$http_code" = "200" ] || [ "$http_code" = "503" ]; then
    # Verify the response contains expected health structure
    if echo "$body" | grep -q "status"; then
      health_ready=true
      break
    fi
  fi

  if [ $((elapsed % 5)) -eq 0 ]; then
    echo -e "${YELLOW}  Still waiting... (${elapsed}s elapsed)${NC}"
  fi

  sleep "${HEALTH_CHECK_INTERVAL}"
done

# ============================================================================
# Test /api/health endpoint
# ============================================================================

echo -e "${YELLOW}Testing /api/health endpoint...${NC}"

health_response=$(curl -s -w "\n%{http_code}" "${HEALTH_ENDPOINT}")
http_code=$(echo "$health_response" | tail -1)
body=$(echo "$health_response" | head -1)

if [ "$http_code" != "200" ]; then
  if [ "$http_code" = "503" ]; then
    echo -e "${YELLOW}Warning: /api/health returned HTTP 503 (service may be unhealthy due to missing external dependencies like API keys)${NC}"
    echo -e "${YELLOW}Response: ${body}${NC}"
    echo -e "${YELLOW}Continuing with other tests...${NC}"
  else
    echo -e "${RED}Error: /api/health returned HTTP ${http_code}${NC}"
    echo -e "${YELLOW}Response: ${body}${NC}"
    exit 1
  fi
else
  echo -e "${GREEN}/api/health returned HTTP 200${NC}"
fi

if ! echo "$body" | grep -q "status"; then
  echo -e "${RED}Error: /api/health response missing 'status' field${NC}"
  echo -e "${YELLOW}Response: ${body}${NC}"
  exit 1
fi

# Log the health status
if echo "$body" | grep -q '"status":"healthy"' || echo "$body" | grep -q "'status': 'healthy'"; then
  echo -e "${GREEN}/api/health reports healthy status${NC}"
else
  echo -e "${YELLOW}Note: /api/health reports unhealthy status (may be expected if running without API keys)${NC}"
fi

echo -e "${GREEN}/api/health returned expected response${NC}"

# ============================================================================
# Test AI-independent route (home page)
# ============================================================================

echo -e "${YELLOW}Testing AI-independent route (/) ...${NC}"

route_response=$(curl -s -w "\n%{http_code}" "${ROUTE_ENDPOINT}")
http_code=$(echo "$route_response" | tail -1)
body=$(echo "$route_response" | head -1)

if [ "$http_code" != "200" ]; then
  echo -e "${RED}Error: / returned HTTP ${http_code}${NC}"
  echo "Full response:"
  echo "$route_response"
  exit 1
fi

if [ -z "$body" ]; then
  echo -e "${RED}Error: / returned empty response${NC}"
  exit 1
fi

echo -e "${GREEN}/ returned successful HTTP response${NC}"

# ============================================================================
# All tests passed
# ============================================================================

echo -e "${GREEN}All smoke tests passed!${NC}"
exit 0
