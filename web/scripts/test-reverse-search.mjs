#!/usr/bin/env node
import { basename, resolve, dirname } from "node:path";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const endpoint =
  process.argv[2] ?? "http://localhost:3000/api/reverse-search";
const samplePath = resolve(
  process.argv[3] ?? resolve(__dirname, "../../base.png"),
);

console.log(`→ Posting ${samplePath} to ${endpoint}`);

const imageBuffer = await readFile(samplePath);
const formData = new FormData();
formData.append(
  "image",
  new Blob([Uint8Array.from(imageBuffer)]),
  basename(samplePath),
);

const response = await fetch(endpoint, {
  method: "POST",
  body: formData,
});

console.log(`← Response status: ${response.status} ${response.statusText}`);
const bodyText = await response.text();

try {
  const json = JSON.parse(bodyText);
  console.log("← JSON response:", JSON.stringify(json, null, 2));
} catch {
  console.log("← Raw response:", bodyText.slice(0, 500));
}
