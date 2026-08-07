// Pulls Strains + Batches from Notion and updates RAW_STRAINS / RAW_BATCHES
// directly inside index.html. No external data.json needed.
// Requires: NOTION_TOKEN env var (GitHub Actions secret)

import { readFileSync, writeFileSync } from "node:fs";

const TOKEN   = process.env.NOTION_TOKEN;
const VERSION = "2022-06-28";

const DB_STRAINS = "b2f9f3414d3e46928cfd3cac81576559";
const DB_BATCHES = "adccf52ca8404582bab240cca2a7d12b";

if (!TOKEN) { console.error("Missing NOTION_TOKEN"); process.exit(1); }

// --- Notion helpers ---
async function queryAll(dbId) {
  const rows = [];
  let cursor;
  do {
    const res = await fetch(`https://api.notion.com/v1/databases/${dbId}/query`, {
      method: "POST",
      headers: { Authorization: `Bearer ${TOKEN}`, "Notion-Version": VERSION, "Content-Type": "application/json" },
      body: JSON.stringify(cursor ? { start_cursor: cursor, page_size: 100 } : { page_size: 100 }),
    });
    if (!res.ok) throw new Error(`Notion ${res.status}: ${await res.text()}`);
    const d = await res.json();
    rows.push(...d.results);
    cursor = d.has_more ? d.next_cursor : undefined;
  } while (cursor);
  return rows;
}

const txt  = (p) => (p?.title || p?.rich_text || []).map(t => t.plain_text).join("").trim();
const sel  = (p) => p?.select?.name ?? null;
const num  = (p) => p?.number ?? null;
const date = (p) => p?.date?.start ?? null;
const ms   = (p) => (p?.multi_select || []).map(o => o.name);
const rel  = (p) => (p?.relation || []).map(r => `https://app.notion.com/${r.id.replace(/-/g,"")}`);

// --- Fetch both databases ---
console.log("Fetching Strains...");
const strainPages = await queryAll(DB_STRAINS);
console.log(`  ${strainPages.length} strains`);

console.log("Fetching Batches...");
const batchPages = await queryAll(DB_BATCHES);
console.log(`  ${batchPages.length} batches`);

// --- Map to the exact format the app expects ---
const RAW_STRAINS = strainPages
  .filter(p => txt(p.properties["Name"]))
  .map(p => ({
    url: `https://app.notion.com/${p.id.replace(/-/g,"")}`,
    Name: txt(p.properties["Name"]),
    Batches: rel(p.properties["Batches"]),
  }));

const RAW_BATCHES = batchPages
  .filter(p => txt(p.properties["Batch"]))
  .map(p => ({
    url:    `https://app.notion.com/${p.id.replace(/-/g,"")}`,
    Batch:  txt(p.properties["Batch"]),
    Brand:  sel(p.properties["Brand"]),
    Type:   sel(p.properties["Type"]),
    THC:    num(p.properties["THC %"]),
    Terps:  ms(p.properties["Terpenes (ms)"]),
    Strain: (rel(p.properties["Strains"])[0]) ?? null,
    Date:   date(p.properties["Purchase Date"]),
  }));

// --- Update index.html in-place ---
let html = readFileSync("index.html", "utf8");

// Replace RAW_STRAINS block
html = html.replace(
  /let RAW_STRAINS = \[[\s\S]*?\];/,
  `let RAW_STRAINS = ${JSON.stringify(RAW_STRAINS, null, 1)};`
);

// Replace RAW_BATCHES block
html = html.replace(
  /let RAW_BATCHES = \[[\s\S]*?\];/,
  `let RAW_BATCHES = ${JSON.stringify(RAW_BATCHES, null, 1)};`
);

// Stamp the sync time so you can verify it ran
html = html.replace(
  /\/\/ last-sync:.*$/m,
  `// last-sync: ${new Date().toISOString()}`
);

writeFileSync("index.html", html, "utf8");
console.log(`Done. ${RAW_STRAINS.length} strains, ${RAW_BATCHES.length} batches written to index.html`);
