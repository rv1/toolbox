#!/usr/bin/env bash
set -euo pipefail

echo "Git Sweep"
echo

if ! command -v git >/dev/null 2>&1; then
  echo "Missing dependency: git"
  exit 1
fi

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "Current directory is not a Git repository."
  exit 1
fi

echo "Local branches:"
git branch --list
echo
echo "No changes were made."
