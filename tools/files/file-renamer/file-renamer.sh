#!/usr/bin/env bash
set -euo pipefail

echo "File Renamer"
echo "Dry run only. No files will be changed."
echo

printf "Folder: "
read -r folder

if [ -z "$folder" ]; then
  echo "No folder provided."
  exit 1
fi

if [ ! -d "$folder" ]; then
  echo "Not a folder: $folder"
  exit 1
fi

echo
echo "Files:"
find "$folder" -maxdepth 1 -type f -print | sort
echo
echo "No changes were made."
