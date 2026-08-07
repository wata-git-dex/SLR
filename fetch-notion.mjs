// Pulls the 🧬 Strains database from Notion and writes data.json.
// Runs in GitHub Actions on Node 20+ (built-in fetch) — no npm install needed.
// Requires env var NOTION_TOKEN (stored as a repo secret; never hard-code it).

import { writeFileSync } from "node:fs";

const NOTION_TOKEN = process.env.NOTION_TOKEN;
const DATABASE_ID = "b2f9f3414d3e46928cfd3cac81576559"; // 🧬 Strains
const NOTION_VERSION = "2022-06-28";

if (!NOTION_TOKEN) {
  console.error("Missing NOTION_TOKEN. Add it under repo Settings → Secrets → Actions.");
  process.exit(1);
}

async function queryAll() {
  const rows = [];
  let cursor;
  do {
    const res = await fetch(`https://api.notion.com/v1/databases/${DATABASE_ID}/query`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${NOTION_TOKEN}`,
        "Notion-Version": NOTION_VERSION,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(cursor ? { start_cursor: cursor, page_size: 100 } : { page_size: 100 }),
    });
    if (!res.ok) throw new Error(`Notion API ${res.status}: ${await res.text()}`);
    const data = await res.json();
    rows.push(...data.results);
    cursor = data.has_more ? data.next_cursor : undefined;
  } while (cursor);
  return rows;
}

// --- safe readers for Notion property values ---
const txt = (p) => (p?.title || p?.rich_text || []).map((t) => t.plain_text).join("").trim();
const rollupNumber = (p) => (p?.rollup?.type === "number" ? p.rollup.number : null);
const rollupSelectUnique = (p) => {
  const arr = p?.rollup?.array || [];
  return [...new Set(arr.map((i) => i?.select?.name).filter(Boolean))];
};

function mapStrain(page) {
  const props = page.properties || {};
  return {
    id: page.id,
    name: txt(props["Name"]),
    type: rollupSelectUnique(props["Type"]),   // e.g. ["Hybrid"]
    brand: rollupSelectUnique(props["Brand"]), // e.g. ["CON"]
    thc: rollupNumber(props["THC %"]),
    avgScore: rollupNumber(props["Avg Session Score %"]),
    totalBatches: rollupNumber(props["Total Batches"]),
    totalSessions: rollupNumber(props["Total Sessions"]),
    url: page.url,
  };
}

const pages = await queryAll();
const strains = pages.map(mapStrain).sort((a, b) => a.name.localeCompare(b.name));
writeFileSync("data.json", JSON.stringify({ updated: new Date().toISOString(), count: strains.length, strains }, null, 2));
console.log(`Wrote data.json with ${strains.length} strains.`);
