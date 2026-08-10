// Pulls Strains + Batches from Notion, downloads strain photos,
// and updates RAW_STRAINS / RAW_BATCHES directly inside index.html.
// Requires: NOTION_TOKEN env var (GitHub Actions secret)

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { execSync } from "node:child_process";

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

const txt     = (p) => (p?.title || p?.rich_text || []).map(t => t.plain_text).join("").trim();
const sel     = (p) => p?.select?.name ?? null;
const num     = (p) => p?.number ?? null;
const date    = (p) => p?.date?.start ?? null;
const ms      = (p) => (p?.multi_select || []).map(o => o.name);
const rel     = (p) => (p?.relation || []).map(r => `https://app.notion.com/${r.id.replace(/-/g,"")}`);
const photoUrl = (p) => {
  const files = p?.files || [];
  if (!files.length) return null;
  const f = files[0];
  return f.type === "file" ? f.file?.url : f.external?.url ?? null;
};

// --- Fetch both databases ---
console.log("Fetching Strains...");
const strainPages = await queryAll(DB_STRAINS);
console.log(`  ${strainPages.length} strains`);

console.log("Fetching Batches...");
const batchPages = await queryAll(DB_BATCHES);
console.log(`  ${batchPages.length} batches`);

// --- Download photos ---
mkdirSync("images", { recursive: true });
console.log("Downloading photos...");

const RAW_STRAINS = [];
for (const p of strainPages) {
  if (!txt(p.properties["Name"])) continue;
  const id       = p.id.replace(/-/g, "");
  const jpgPath  = `images/${id}.jpg`;
  let   has_image = existsSync(jpgPath); // keep existing image if already downloaded

  if (!has_image) {
    const imgUrl = photoUrl(p.properties["Photo"]);
    if (imgUrl) {
      try {
        const imgRes = await fetch(imgUrl);
        if (imgRes.ok) {
          const buf     = Buffer.from(await imgRes.arrayBuffer());
          const tmpPath = `images/${id}.tmp`;
          writeFileSync(tmpPath, buf);
          // ImageMagick converts HEIC, PNG, JPEG — whatever Notion stored
          execSync(`convert "${tmpPath}" "${jpgPath}"`, { stdio: "pipe" });
          execSync(`rm -f "${tmpPath}"`);
          has_image = true;
          console.log(`  ✓ ${txt(p.properties["Name"])}`);
        }
      } catch (e) {
        console.log(`  ⚠ ${txt(p.properties["Name"])}: ${e.message.slice(0, 80)}`);
      }
    }
  } else {
    console.log(`  — ${txt(p.properties["Name"])} (cached)`);
  }

  RAW_STRAINS.push({
    url:       `https://app.notion.com/${id}`,
    Name:      txt(p.properties["Name"]),
    Batches:   rel(p.properties["Batches"]),
    has_image,
  });
}

// --- Map Batches ---
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

html = html.replace(
  /let RAW_STRAINS = \[[\s\S]*?\];/,
  `let RAW_STRAINS = ${JSON.stringify(RAW_STRAINS, null, 1)};`
);
html = html.replace(
  /let RAW_BATCHES = \[[\s\S]*?\];/,
  `let RAW_BATCHES = ${JSON.stringify(RAW_BATCHES, null, 1)};`
);
html = html.replace(
  /\/\/ last-sync:.*$/m,
  `// last-sync: ${new Date().toISOString()}`
);

writeFileSync("index.html", html, "utf8");
console.log(`Done. ${RAW_STRAINS.length} strains, ${RAW_BATCHES.length} batches. Images in /images/`);
