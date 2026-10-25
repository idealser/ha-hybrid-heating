#!/usr/bin/env sh
# Run pytest in Linux. Home Assistant's test harness needs Unix (fcntl), so on Windows the
# integration tests run in a container; plain unit tests also run natively with `-p no:homeassistant`.
# Usage: scripts/ha-pytest.sh [pytest args]      e.g. scripts/ha-pytest.sh tests/integration -q
set -e
cd "$(dirname "$0")/.."
SRC=$(pwd -W 2>/dev/null || pwd)
MSYS_NO_PATHCONV=1 docker run --rm \
  -v "$SRC:/work" -w /work \
  -e UV_PROJECT_ENVIRONMENT=/venv -e UV_LINK_MODE=copy -e UV_CACHE_DIR=/uvcache \
  -v hh-venv:/venv -v hh-uvcache:/uvcache \
  ghcr.io/astral-sh/uv:python3.14-bookworm-slim \
  sh -c "uv sync --locked -q && uv run pytest $*"
