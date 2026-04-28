# Launchpad Sort

Sorts the first page of macOS Launchpad alphabetically.

Folders are moved after apps.

## Status

Experimental.

This tool touches the private Launchpad SQLite database. It must preview first, back up the database before writes, and only apply changes after confirmation.

## Usage

```bash
./launchpad-sort.sh
```

## Dependencies

- macOS
- `sqlite3`
- access to the Launchpad database

This tool owns its own dependency checks.