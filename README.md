# toolbox

Small personal tools, scripts, and notes.

## Setup (repo only)

Installs optional UI helpers (for example `gum` via Homebrew if you choose). Does **not** install Node for tools or per-tool dependencies.

```bash
./setup.sh
```

## Start

Interactive menu (uses `gum` when available, otherwise numbered prompts):

```bash
./start.sh
```

Options: list tools, run a tool (pick by menu; no need to type slugs), create a new tool scaffold, exit.

## Tool layout

```text
tools/<intent>/<slug>/
```

Each tool has:

- `README.md`
- `manifest.json`
- an entry script, unless the tool is readme-only (`runtime: "readme"`)

Starter intents: `macos`, `files`, `dev`, `web`, `notes`, plus `custom` when needed.

## Website (local)

The static UI lives under `docs/`. Generated data is written to `docs/tools.json` (ignored by git). Node is only for this generator and local preview—not part of `./setup.sh`.

```bash
node scripts/build-site.mjs
node scripts/serve-site.mjs
```

Then open the URL printed by the server (default `http://127.0.0.1:4173/`).

Set `TOOLBOX_REPO_URL` if you want GitHub source links to point at your fork when building locally (otherwise a placeholder base URL is used). In GitHub Actions, `GITHUB_REPOSITORY` is set automatically.

## Website (hosted)

On push to `main`, GitHub Actions runs `node scripts/build-site.mjs` and deploys the `docs/` folder to GitHub Pages (no `npm install`).

## Tools in this repo

Includes samples under `tools/files/`, `tools/dev/`, `tools/web/`, `tools/notes/`, and other intents such as `tools/macos/launchpad-sort/`.

## Notes

Root setup is for repo-level helpers only. Individual tools document or check their own dependencies.
