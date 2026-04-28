#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const toolsDir = path.join(root, "tools");
const docsDir = path.join(root, "docs");
const outputFile = path.join(docsDir, "tools.json");

function repoUrl() {
  try {
    const remote = execFileSync("git", ["config", "--get", "remote.origin.url"], {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();

    if (remote.startsWith("git@github.com:")) {
      return `https://github.com/${remote.replace("git@github.com:", "").replace(/\.git$/, "")}`;
    }

    if (remote.startsWith("https://github.com/")) {
      return remote.replace(/\.git$/, "");
    }
  } catch {
    return "";
  }

  return "";
}

function readmeHeadings(markdown) {
  return markdown
    .split("\n")
    .map((line) => {
      const match = /^(#{2,3})\s+(.+)$/.exec(line);
      if (!match) return null;
      const text = match[2].trim();
      const id = text
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
      return { level: match[1].length, text, id };
    })
    .filter(Boolean);
}

async function exists(file) {
  try {
    await stat(file);
    return true;
  } catch {
    return false;
  }
}

async function collectTools() {
  const tools = [];
  const intents = await readdir(toolsDir, { withFileTypes: true }).catch(() => []);
  const baseRepoUrl = repoUrl();

  for (const intentDir of intents) {
    if (!intentDir.isDirectory()) continue;

    const intent = intentDir.name;
    const intentPath = path.join(toolsDir, intent);
    const slugs = await readdir(intentPath, { withFileTypes: true });

    for (const slugDir of slugs) {
      if (!slugDir.isDirectory()) continue;

      const slug = slugDir.name;
      const toolPath = path.join(intentPath, slug);
      const manifestPath = path.join(toolPath, "manifest.json");
      const readmePath = path.join(toolPath, "README.md");

      if (!(await exists(manifestPath)) || !(await exists(readmePath))) continue;

      const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
      const readme = await readFile(readmePath, "utf8");
      const relativeDir = `tools/${intent}/${slug}`;
      const sourceFiles = ["README.md", "manifest.json"];

      if (manifest.entry) {
        sourceFiles.push(manifest.entry);
      }

      tools.push({
        ...manifest,
        readme,
        path: relativeDir,
        headings: readmeHeadings(readme),
        sourceUrl: baseRepoUrl ? `${baseRepoUrl}/tree/main/${relativeDir}` : "",
        sourceFiles: sourceFiles.map((file) => ({
          name: file,
          path: `${relativeDir}/${file}`,
          url: baseRepoUrl ? `${baseRepoUrl}/blob/main/${relativeDir}/${file}` : "",
        })),
      });
    }
  }

  return tools.sort((a, b) => {
    const intentCompare = a.intent.localeCompare(b.intent);
    if (intentCompare !== 0) return intentCompare;
    return a.slug.localeCompare(b.slug);
  });
}

const tools = await collectTools();
const data = {
  generatedAt: new Date().toISOString(),
  tools,
};

await mkdir(docsDir, { recursive: true });
await writeFile(outputFile, `${JSON.stringify(data, null, 2)}\n`);

console.log(`Generated ${path.relative(root, outputFile)} with ${tools.length} tools.`);
