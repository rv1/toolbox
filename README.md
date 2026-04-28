# toolbox

Small personal tools, scripts, and notes.

Run:

```bash
./start.sh
```

Setup:

```bash
./setup.sh
```

Tools live in:

```text
tools/<intent>/<slug>/
```

Each tool has:

- `README.md`
- `manifest.json`
- an entry file, unless it is notes-only

The website is generated from tool manifests and READMEs by GitHub Actions.

## Current tool

- `tools/macos/launchpad-sort/`

## Notes

Root setup is for repo-level helpers only.

Individual tools handle their own dependency checks and setup notes.