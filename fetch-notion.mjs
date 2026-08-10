// Pulls Strains + Batches from Notion, downloads strain photos,
// and updates RAW_STRAINS / RAW_BATCHES directly inside index.html.
// Requires: NOTION_TOKEN env var (GitHub Actions secret)

import { readFileSync, writeFileSync, mkdirSync, existsSync, unlinkSync, readdirSync } from "node:fs";

const TOKEN   = process.env.NOTION_TOKEN;
const VERSION = "2022-06-28";

const DB_STRAINS = "b2f9f3414d3e46928cfd3cac81576559";
const DB_BATCHES = "adccf52ca8404582bab240cca2a7d12b";

if (!TOKEN) { console.error("Missing NOTION_TOKEN"); process.exit(1); }

// --- Clean up any leftover .tmp files from failed previous runs ---
mkdirSync("images", { recursive: true });
try {
  readdirSync("images")
    .filter(f => f.endsWith(".tmp"))
    .forEach(f => { unlinkSync(`images/${f}`); console.log(`Cleaned up: ${f}`); });
} catch {}

// --- Load heic-convert (installed by workflow before this script runs) ---
const { default: heicConvert } = await import("heic-convert");

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

const txt      = (p) => (p?.title || p?.rich_text || []).map(t => t.plain_text).join("").trim();
const sel      = (p) => p?.select?.name ?? null;
const num      = (p) => p?.number ?? null;
const date     = (p) => p?.date?.start ?? null;
const ms       = (p) => (p?.multi_select || []).map(o => o.name);
const rel      = (p) => (p?.relation || []).map(r => `https://app.notion.com/${r.id.replace(/-/g,"")}`);
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

// --- Download and convert photos ---
console.log("Downloading photos...");
const RAW_STRAINS = [];

for (const p of strainPages) {
  if (!txt(p.properties["Name"])) continue;
  const id      = p.id.replace(/-/g, "");
  const name    = txt(p.properties["Name"]);
  const jpgPath = `images/${id}.jpg`;
  let   has_image = existsSync(jpgPath); // keep cached image if already downloaded

  if (!has_image) {
    const imgUrl = photoUrl(p.properties["Photo"]);
    if (imgUrl) {
      try {
        const imgRes = await fetch(imgUrl);
        if (imgRes.ok) {
          const buf = Buffer.from(await imgRes.arrayBuffer());
          let jpgBuf;
          try {
            // Try HEIC conversion first
            jpgBuf = Buffer.from(await heicConvert({ buffer: buf, format: "JPEG", quality: 0.85 }));
          } catch {
            // Already JPEG or PNG — use as-is
            jpgBuf = buf;
          }
          writeFileSync(jpgPath, jpgBuf);
          has_image = true;
          console.log(`  ✓ ${name}`);
        }
      } catch (e) {
        console.log(`  ⚠ ${name}: ${e.message.slice(0, 100)}`);
      }
    } else {
      console.log(`  — ${name} (no photo in Notion)`);
    }
  } else {
    console.log(`  — ${name} (cached)`);
  }

  RAW_STRAINS.push({
    url:       `https://app.notion.com/${id}`,
    Name:      name,
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
const syncDate = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
html = html.replace(
  /setUpdated\('[^']+'\);/,
  "setUpdated('" + syncDate + "');"
);
html = html.replace(
  /specimens logged \xB7 updated [A-Za-z]+ \d+/,
  "specimens logged \xB7 updated " + syncDate
);
);
writeFileSync("index.html", html, "utf8");
console.log(`Done. ${RAW_STRAINS.filter(s=>s.has_image).length} photos, ${RAW_STRAINS.length} strains total.`);
