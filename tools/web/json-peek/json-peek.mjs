#!/usr/bin/env node

import { readFile } from "node:fs/promises";

const file = process.argv[2];

if (!file) {
  console.error("Usage: node json-peek.mjs path/to/file.json");
  process.exit(1);
}

let parsed;

try {
  parsed = JSON.parse(await readFile(file, "utf8"));
} catch (error) {
  console.error(`Could not read JSON: ${error.message}`);
  process.exit(1);
}

if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
  console.log("Top-level value is not an object.");
  process.exit(0);
}

const keys = Object.keys(parsed);

if (keys.length === 0) {
  console.log("No top-level keys.");
} else {
  keys.forEach((key) => console.log(key));
}
