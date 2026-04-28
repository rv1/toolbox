#!/usr/bin/env node
/**
 * Sample: print top-level keys of a JSON file. Zero dependencies.
 */
import fs from "node:fs";
import readline from "node:readline";

function peek(filePath) {
  let raw;
  try {
    raw = fs.readFileSync(filePath, "utf8");
  } catch {
    console.error("Cannot read file:", filePath);
    process.exit(1);
  }

  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    console.error("Invalid JSON:", filePath);
    process.exit(1);
  }

  if (data === null || typeof data !== "object" || Array.isArray(data)) {
    console.log("(root is not a JSON object; type:", typeof data, ")");
    return;
  }

  console.log(Object.keys(data).sort().join("\n"));
}

function main() {
  const arg = process.argv[2];
  if (arg) {
    peek(arg);
    return;
  }

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  rl.question("Path to JSON file: ", (p) => {
    rl.close();
    const path = (p || "").trim();
    if (!path) {
      console.error("No path given.");
      process.exit(1);
    }
    peek(path);
  });
}

main();
