#!/usr/bin/env bash
set -u

ROOT=$(cd "$(dirname "$0")" && pwd)
SETUP_DONE="$ROOT/.toolbox/setup.done"

has() {
  command -v "$1" >/dev/null 2>&1
}

pause() {
  printf "\nPress Enter to continue..."
  read -r _ || true
}

json_value() {
  file=$1
  key=$2

  sed -nE 's/.*"'"$key"'"[[:space:]]*:[[:space:]]*"([^"]+)".*/\1/p' "$file" | head -1
}

list_tools() {
  found=0

  find "$ROOT/tools" -mindepth 3 -maxdepth 3 -name manifest.json 2>/dev/null | sort | while read -r manifest; do
    found=1
    dir=$(dirname "$manifest")
    intent=$(basename "$(dirname "$dir")")
    slug=$(basename "$dir")
    name=$(json_value "$manifest" "name")
    desc=$(json_value "$manifest" "description")

    printf "%-10s %-22s %s\n" "$intent" "$slug" "${name:-$desc}"
  done

  if [ "$found" -eq 0 ]; then
    echo "No tools found."
  fi
}

run_menu_numbered() {
  while true; do
    clear 2>/dev/null || true

    echo "toolbox"
    echo "======="
    echo
    echo "1. List tools"
    echo "2. Exit"
    echo
    printf "Choose: "
    read -r choice

    case "$choice" in
      1)
        echo
        list_tools
        pause
        ;;
      2)
        exit 0
        ;;
      *)
        echo "Unknown choice."
        pause
        ;;
    esac
  done
}

run_menu_gum() {
  while true; do
    clear 2>/dev/null || true

    choice=$(gum choose --header "toolbox" "List tools" "Exit") || exit 0

    case "$choice" in
      "List tools")
        echo
        list_tools
        pause
        ;;
      "Exit")
        exit 0
        ;;
    esac
  done
}

if [ ! -f "$SETUP_DONE" ]; then
  echo "Setup has not been run."
  printf "Run setup now? [Y/n]: "
  read -r answer

  case "$answer" in
    n|N) ;;
    *) "$ROOT/setup.sh" || exit $? ;;
  esac
fi

if has gum; then
  run_menu_gum
else
  run_menu_numbered
fi