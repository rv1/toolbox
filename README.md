# toolbox

Small personal tools, scripts, and notes.

## Setup

Repo-level setup checks for optional helpers only.

```bash
./setup.sh
```

If `gum` is missing and Homebrew exists, setup can install it. Individual tool dependencies are handled by each tool.

## Start

```bash
./start.sh
```

Use the menu to list tools, run tools, or create a new tool.

## Tool structure

Tools live in:

```text
tools/<intent>/<slug>/
```

Each tool has:

- `README.md`
- `manifest.json`
- an entry file unless it is readme-only

Starter intents:

- `macos`
- `files`
- `dev`
- `web`
- `notes`

## Website

The static website is generated from tool manifests and READMEs. Generated `docs/tools.json` is not committed.

Local preview:

```bash
node scripts/build-site.mjs
node scripts/serve-site.mjs
```

Then open:

```text
http://localhost:4173
```

Node is local site tooling, not a root setup dependency.

GitHub Actions builds `docs/tools.json` during deploy and publishes `docs/` to GitHub Pages.

## Current tools

- `tools/dev/git-sweep/`
- `tools/files/file-renamer/`
- `tools/macos/launchpad-sort/`
- `tools/notes/home-network/`
- `tools/web/json-peek/`

## Notes

Root setup is for repo-level helpers only.

Individual tools handle their own dependency checks and setup notes.
