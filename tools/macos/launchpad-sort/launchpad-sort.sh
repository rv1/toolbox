#!/usr/bin/env bash
set -euo pipefail

echo "Launchpad Sort"
echo
echo "Experimental. Preview-only starter."
echo

if ! command -v sqlite3 >/dev/null 2>&1; then
  echo "Missing dependency: sqlite3"
  echo "This tool requires sqlite3."
  exit 1
fi

DB_PATH="${DB_PATH:-}"

if [ -z "$DB_PATH" ]; then
  DB_PATH=$(lsof -c Dock 2>/dev/null | awk '/com.apple.dock.launchpad\/db\/db$/ { print $9; exit }' || true)
fi

if [ -z "$DB_PATH" ] || [ ! -f "$DB_PATH" ]; then
  echo "Could not find Launchpad database."
  echo
  echo "Try:"
  echo "  DB_PATH=/path/to/db ./launchpad-sort.sh"
  exit 1
fi

echo "Database:"
echo "$DB_PATH"
echo

echo "Page 1 preview:"
echo

sqlite3 "$DB_PATH" <<'SQL'
.headers on
.mode column

WITH names AS (
  SELECT
    items.rowid AS item_rowid,
    items.ordering,
    COALESCE(apps.title, groups.title, '—') AS name,
    CASE
      WHEN groups.item_id IS NOT NULL THEN 'folder'
      WHEN apps.item_id IS NOT NULL THEN 'app'
      ELSE 'other'
    END AS kind
  FROM items
  LEFT JOIN apps ON apps.item_id = items.rowid
  LEFT JOIN groups ON groups.item_id = items.rowid
  WHERE items.parent_id = 1
)
SELECT ordering, kind, name
FROM names
WHERE ordering < 35
ORDER BY ordering;
SQL

echo
echo "No changes were made."
echo "TODO: Add backup and confirmed apply mode for page 1 only."