# Agent Notes

This repo is a personal toolbox for small scripts, utilities, and documented workflows.

## Rules

- Prefer KISS and YAGNI.
- Keep tools small and self-contained.
- Do not add frameworks unless asked.
- Do not add dependencies unless asked.
- Do not add files "just in case."
- Put repo-level future ideas in `ROADMAP.md`.
- Put code-level future ideas as `TODO` comments near relevant code.
- Prefer readable code over clever code.
- Keep READMEs short and skimmable.

## Entrypoints

- `./setup.sh` handles repo-level setup only.
- `./start.sh` is the main repo entrypoint.
- Root setup must not install dependencies for individual tools.
- Individual tools must check or document their own dependencies.

## Tool structure

Tools live here:

```text
tools/<intent>/<slug>/
```

Allowed starter intents:

- `macos`
- `files`
- `dev`
- `web`
- `notes`
- `custom` (when nothing else fits)

Each tool needs:

- `README.md`
- `manifest.json`
- an entry file unless the tool is readme-only (`runtime: "readme"` — no `entry` key)

## Manifest

Typical fields:

```json
{
  "name": "Tool Name",
  "slug": "tool-slug",
  "intent": "macos",
  "description": "Short description.",
  "entry": "tool-slug.sh",
  "runtime": "bash",
  "tags": ["macos", "ai-generated"],
  "status": "experimental"
}
```

For readme-only tools, omit `entry` and set `"runtime": "readme"`.

Rules:

- Keep metadata minimal.
- `tags` must be an array.
- If an AI agent creates or substantially rewrites a tool, add `ai-generated` to tags.
- If a tool is an example or demo, add `sample` to tags.
- Do not add authorship fields.
- Do not add generated/manual fields.

## Website

The website must be generated from manifests and READMEs.

Do **not** commit generated `docs/tools.json` unless there is a strong reason (it is gitignored and produced by `scripts/build-site.mjs` locally and in CI).

GitHub Actions should generate the data during deploy.

Local preview should be possible, but keep it lightweight.

Latest local preview: run `node scripts/build-site.mjs` then `node scripts/serve-site.mjs`.

## UI direction

Create a clean, minimal, Chirpy-inspired site.

Useful ideas:

- Responsive layout.
- Minimalist Design.
- Light/Dark/auto mode.
- Left navigation.
- Collapsible tool sections by intent.
- Search or filter.
- Tags.
- Tool detail page.
- Right-side table of contents from README headings on desktop when needed.
- Right side section for tags under content.
- Mobile-friendly layout.

Do not use Jekyll unless explicitly asked.

Investigate Chirpy source code and dev documentation for HTML styling inspiration

- https://github.com/cotes2020/chirpy-static-assets
- https://github.com/cotes2020/jekyll-theme-chirpy
