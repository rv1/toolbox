#!/usr/bin/env bash
set -u

# Sample: lists files in a folder (non-destructive). Part of toolbox demo.

printf 'Folder path (absolute or relative): '
read -r dir

if [ -z "$dir" ]; then
  echo "No path given."
  exit 1
fi

if [ ! -d "$dir" ]; then
  echo "Not a directory: $dir"
  exit 1
fi

echo "Files in $dir:"
find "$dir" -maxdepth 1 -mindepth 1 -print | sort
