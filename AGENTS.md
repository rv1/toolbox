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

Each tool needs:

- `README.md`
- `manifest.json`
- an entry file unless the tool is notes-only

## Manifest

Required fields:

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

Rules:

- Keep metadata minimal.
- `tags` must be an array.
- If an AI agent creates or substantially rewrites a tool, add `ai-generated` to tags.
- If a tool is an example/demo, add `sample` to tags.
- Do not add authorship fields.
- Do not add generated/manual fields.

## Website

The website must be generated from manifests and READMEs.

Do not require generated site data to be committed.

GitHub Actions should generate the data during deploy.

Local preview should be possible, but keep it lightweight.

`docs/tools.json` is generated site data. Do not commit it unless there is a strong reason.

## UI direction

Create a clean, minimal, Chirpy-inspired site.

Useful ideas:

- Left navigation.
- Collapsible tool sections by intent.
- Search or filter.
- Tags.
- Tool detail page.
- Right-side table of contents from README headings on desktop.
- Mobile-friendly layout.

Do not use Jekyll unless explicitly asked.
