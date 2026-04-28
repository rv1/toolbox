#!/usr/bin/env node
// Scan tools/<intent>/<slug>/manifest.json and README.md → docs/tools.json
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mdToHtmlAndToc } from "./md-lite.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const DOCS = path.join(ROOT, "docs");
const OUT_JSON = path.join(DOCS, "tools.json");

function repoBaseUrl() {
  const r = process.env.GITHUB_REPOSITORY;
  if (r && /^[\w.-]+\/[\w.-]+$/.test(r)) {
    return `https://github.com/${r}`;
  }
  const u = process.env.TOOLBOX_REPO_URL;
  if (u) return u.replace(/\/$/, "");
  return "https://github.com/OWNER/toolbox";
}

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function collectManifests() {
  const toolsDir = path.join(ROOT, "tools");
  if (!fs.existsSync(toolsDir)) return [];
  const intents = fs.readdirSync(toolsDir, { withFileTypes: true }).filter((d) => d.isDirectory());
  const out = [];
  for (const id of intents) {
    const idir = path.join(toolsDir, id.name);
    const slugs = fs.readdirSync(idir, { withFileTypes: true }).filter((d) => d.isDirectory());
    for (const sd of slugs) {
      const mf = path.join(idir, sd.name, "manifest.json");
      if (fs.existsSync(mf)) out.push(mf);
    }
  }
  return out.sort();
}

function main() {
  const base = repoBaseUrl();
  const tools = [];

  for (const mf of collectManifests()) {
    const dir = path.dirname(mf);
    const intent = path.basename(path.dirname(dir));
    const slug = path.basename(dir);
    let manifest;
    try {
      manifest = readJson(mf);
    } catch {
      console.warn("skip invalid manifest:", mf);
      continue;
    }

    const readmePath = path.join(dir, "README.md");
    let readmeRaw = "";
    if (fs.existsSync(readmePath)) {
      readmeRaw = fs.readFileSync(readmePath, "utf8");
    }
    const { html: readmeHtml, toc } = mdToHtmlAndToc(readmeRaw);

    const rel = `tools/${intent}/${slug}`;
    const sourceDirUrl = `${base}/tree/main/${rel}`;
    const sourceFiles = [{ name: "README.md", url: `${base}/blob/main/${rel}/README.md` }];
    if (manifest.entry) {
      sourceFiles.push({
        name: manifest.entry,
        url: `${base}/blob/main/${rel}/${manifest.entry}`,
      });
    }

    tools.push({
      name: manifest.name || slug,
      slug: manifest.slug || slug,
      intent: manifest.intent || intent,
      description: manifest.description || "",
      runtime: manifest.runtime || "bash",
      status: manifest.status || "experimental",
      tags: Array.isArray(manifest.tags) ? manifest.tags : [],
      entry: manifest.entry || null,
      readmeHtml,
      toc,
      sourceDirUrl,
      sourceFiles,
    });
  }

  tools.sort((a, b) => {
    const ia = a.intent.localeCompare(b.intent);
    if (ia !== 0) return ia;
    return a.slug.localeCompare(b.slug);
  });

  if (!fs.existsSync(DOCS)) {
    fs.mkdirSync(DOCS, { recursive: true });
  }

  const rootReadme = path.join(ROOT, "README.md");
  let home = { readmeHtml: "", toc: [] };
  if (fs.existsSync(rootReadme)) {
    const raw = fs.readFileSync(rootReadme, "utf8");
    const parsed = mdToHtmlAndToc(raw);
    home = { readmeHtml: parsed.html, toc: parsed.toc };
  }

  const payload = {
    repoBaseUrl: base,
    generatedAt: new Date().toISOString(),
    tools,
    home,
  };
  fs.writeFileSync(OUT_JSON, JSON.stringify(payload, null, 2), "utf8");
  console.log("Wrote", OUT_JSON, `(${tools.length} tools + home readme)`);
}

main();
