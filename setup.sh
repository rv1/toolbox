#!/usr/bin/env bash
set -euo pipefail

ROOT=$(cd "$(dirname "$0")" && pwd)
STATE_DIR="$ROOT/.toolbox"
SETUP_DONE="$STATE_DIR/setup.done"

has() {
  command -v "$1" >/dev/null 2>&1
}

prompt_yes() {
  label=$1
  printf "%s [y/N]: " "$label"
  read -r answer

  case "$answer" in
    y|Y) return 0 ;;
    *) return 1 ;;
  esac
}

echo "toolbox setup"
echo "============="
echo
echo "Repo-level setup only."
echo "Individual tools handle their own dependencies."
echo

if has gum; then
  echo "ok: gum"
else
  echo "missing: gum"
  echo
  echo "gum is used for nicer interactive menus."
  echo "Without it, start.sh will use a simple numbered menu."
  echo

  if has brew; then
    if prompt_yes "Install gum with Homebrew?"; then
      brew install gum
    else
      echo "Skipping gum."
    fi
  else
    echo "Homebrew is not installed."
    echo "Skipping gum install."
  fi
fi

mkdir -p "$STATE_DIR"

{
  echo "setup completed at $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
  echo "gum: $(command -v gum 2>/dev/null || true)"
} > "$SETUP_DONE"

echo
echo "Setup complete."
echo
echo "Run:"
echo "  ./start.sh"