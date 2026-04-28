#!/usr/bin/env bash
set -u

# Sample: lists local git branches only. Does not delete or change branches.

root=$(git rev-parse --show-toplevel 2>/dev/null) || {
  echo "Not a git repository (no .git found from this directory)."
  exit 1
}

echo "Repository: $root"
echo "Local branches:"
git -C "$root" branch --list --format '%(refname:short)'
