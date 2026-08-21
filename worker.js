// SLR live-data Worker — reads Notion data AND writes new sessions
// NOTION_TOKEN stored as encrypted Cloudflare secret

const DS = {
  strains:  "90289161-102c-4070-9fcf-1805edcd28c1",
  batches:  "eab15a0d-95a3-4695-b106-62a1e52e312b",
  sessions: "1fa2f04b-41fe-4de5-bc28-9f3c432d1234",
  invites:  "ea3be0a8-c8f9-4857-bc1f-3c0ae6399cfb",
  terpenes: "84f1093f-2e26-4aae-8aa1-315896716d2d",
  legacyRatings: "fe8f9aea-1a95-4aff-8579-cb1a4d53c89a",
};

const NOTION_VERSION = "2025-09-03";

// In-memory cache — re-checks Notion at most once every 60s regardless of traffic.
// Each active code maps to the member named in its Given To field.
let _memberCache = { members: null, ts: 0 };

async function activeMembers(token) {
  const FRESH_MS = 60_000;
  if (_memberCache.members && (Date.now() - _memberCache.ts) < FRESH_MS) return _memberCache.members;

  const pages = await queryAll(DS.invites, token);
  const members = new Map();
  for (const page of pages) {
    if (page.properties?.Status?.select?.name !== "Active") continue;
    const code = title(page, "Code").trim().toUpperCase();
    const name = richText(page, "Given To").trim();
    if (code && name) members.set(code, { name });
  }

  _memberCache = { members, ts: Date.now() };
  return members;
}

async function memberForCode(code, token) {
  if (!code) return null;
  return (await activeMembers(token)).get(String(code).trim().toUpperCase()) || null;
}

function codeRejected(cors) {
  return new Response(
    JSON.stringify({ error: "Invalid or revoked invite code.", needsCode: true }),
    { status: 401, headers: { ...cors, "Content-Type": "application/json" } }
  );
}

export default {
  async fetch(request, env) {
    const origin = env.ALLOWED_ORIGIN || "*";
    const cors = {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    if (request.method === "OPTIONS") return new Response(null, { headers: cors });

    // POST = create a new session in Notion
    if (request.method === "POST") {
      try {
        if (!env.NOTION_TOKEN) throw new Error("NOTION_TOKEN secret is not set");
        const data = await request.json();
        const member = await memberForCode(data.code, env.NOTION_TOKEN);
        if (!member) {
          return codeRejected(cors);
        }
        const clean = s => String(s ?? "").trim().slice(0, 120);

        // honeypot — bots fill this hidden field, humans never see it
        if (data.website) {
          return new Response(JSON.stringify({ ok: true }), {
            headers: { ...cors, "Content-Type": "application/json" },
          });
        }

        if (data.kind === "strain") {
          const made = await createStrainAndBatch(data, env.NOTION_TOKEN, clean, member.name);
          return new Response(JSON.stringify({ ok: true, viewer: member.name, ...made }), {
            headers: { ...cors, "Content-Type": "application/json" },
          });
        }

        await createSession(data, env.NOTION_TOKEN, member.name);
        return new Response(JSON.stringify({ ok: true, viewer: member.name }), {
          headers: { ...cors, "Content-Type": "application/json" },
        });
      } catch (err) {
        return new Response(JSON.stringify({ error: String(err.message || err) }), {
          status: 500,
          headers: { ...cors, "Content-Type": "application/json" },
        });
      }
    }

    // GET = read all data
    try {
      if (!env.NOTION_TOKEN) throw new Error("NOTION_TOKEN secret is not set");

      const url = new URL(request.url);
      const code = url.searchParams.get("code");
      const member = await memberForCode(code, env.NOTION_TOKEN);
      if (!member) {
        return codeRejected(cors);
      }

      const [strainPages, batchPages, sessionPages, terpenePages, legacyRatingPages] = await Promise.all([
        queryAll(DS.strains, env.NOTION_TOKEN),
        queryAll(DS.batches, env.NOTION_TOKEN),
        queryAll(DS.sessions, env.NOTION_TOKEN),
        queryAll(DS.terpenes, env.NOTION_TOKEN),
        queryAll(DS.legacyRatings, env.NOTION_TOKEN),
      ]);

      const terpeneNames = new Map(terpenePages.map(p => [idToUrl(p.id), title(p, "Name")]));

      const payload = {
        updated: new Date().toISOString(),
        viewer: member.name,
        strains: strainPages.map(p => ({
          url:       idToUrl(p.id),
          Name:      title(p, "Name"),
          Batches:   relation(p, "Batches"),
          has_image: (p.properties["Photo"]?.files?.length > 0),
        })),
        batches: batchPages.map(p => ({
          url:    idToUrl(p.id),
          Batch:  title(p, "Batch"),
          Brand:  select(p, "Brand"),
          Type:   select(p, "Type"),
          THC:    number(p, "THC %"),
          Terps:  relation(p, "Terpenes").map(url => terpeneNames.get(url)).filter(Boolean).length
            ? relation(p, "Terpenes").map(url => terpeneNames.get(url)).filter(Boolean)
            : multiSelect(p, "Terpenes (ms)"),
          Strain: relation(p, "Strains")[0] || null,
          Date:   dateStart(p, "Purchase Date"),
        })),
        sessions: sessionPages.map(p => ({
          Batch:     relation(p, "\uD83C\uDF3E Batches"),
          Blazers:   multiSelect(p, "Blazers"),
          OverallRating: number(p, "Overall Rating"),
          Euphoric:   select(p, "Euphoric"),
          Creative:  select(p, "Creative"),
          Focused:   select(p, "Focused"),
          Social:    select(p, "Social"),
          Giggly:    select(p, "Giggly"),
          Energized: select(p, "Energized"),
          Relaxed:   select(p, "Relaxed"),
          CouchLocked: select(p, "Couch-Locked"),
          Sleepy:    select(p, "Sleepy"),
          Hungry:    select(p, "Hungry"),
          Anxious:   select(p, "Anxious"),
          Paranoid:  select(p, "Paranoid"),
          Washed:    select(p, "Washed"),
          KnockedOut: select(p, "KO'd"),
          Dizzy:     select(p, "Dizzy"),
          Headache:  select(p, "Headache"),
        })),
        legacyRatings: legacyRatingPages
          .filter(p => p.properties["Enabled"]?.checkbox === true)
          .map(p => ({
            Strain: relation(p, "Strain")[0] || null,
            Blazer: select(p, "Blazer"),
            PreV1Score: number(p, "Pre-v1.0 Score"),
            LegacyRating: number(p, "Legacy Rating"),
            SourceSessions: number(p, "Source Sessions"),
          }))
          .filter(r => r.Strain && r.Blazer && Number.isInteger(r.LegacyRating) && r.LegacyRating >= 1 && r.LegacyRating <= 5),
        terpenes: terpenePages.map(p => ({ url: idToUrl(p.id), Name: title(p, "Name") })).filter(t => t.Name),
      };

      return new Response(JSON.stringify(payload), {
        headers: { ...cors, "Content-Type": "application/json" },
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: String(err.message || err) }), {
        status: 500,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }
  },
};

// ---- Write a new session to Notion ----
async function createSession(data, token, memberName) {
  function urlToId(url) {
    const hex = url.split('/').pop();
    return hex.slice(0,8)+'-'+hex.slice(8,12)+'-'+hex.slice(12,16)+'-'+hex.slice(16,20)+'-'+hex.slice(20);
  }

  const effect = value => ["-", "🟢", "🟢🟢"].includes(value) ? value : "-";
  const sideEffect = value => ["-", "🔴", "🔴🔴"].includes(value) ? value : "-";
  const overall = data.OverallRating == null || data.OverallRating === "" ? null : Number(data.OverallRating);
  if (overall != null && (!Number.isInteger(overall) || overall < 1 || overall > 5)) {
    throw new Error("Overall Rating must be a whole number from 1 to 5");
  }

  const properties = {
    "🌾 Batches": { relation: [{ id: urlToId(data.batchUrl) }] },
    "Blazers": { multi_select: [{ name: memberName }] },
    "Euphoric":   { select: { name: effect(data.Euphoric) } },
    "Focused":    { select: { name: effect(data.Focused) } },
    "Creative":   { select: { name: effect(data.Creative) } },
    "Social":     { select: { name: effect(data.Social) } },
    "Giggly":     { select: { name: effect(data.Giggly) } },
    "Energized":  { select: { name: effect(data.Energized) } },
    "Relaxed":    { select: { name: effect(data.Relaxed) } },
    "Couch-Locked": { select: { name: effect(data.CouchLocked) } },
    "Sleepy":     { select: { name: effect(data.Sleepy) } },
    "Hungry":     { select: { name: effect(data.Hungry) } },
    "Anxious":    { select: { name: sideEffect(data.Anxious) } },
    "Paranoid":   { select: { name: sideEffect(data.Paranoid) } },
    "Washed":     { select: { name: sideEffect(data.Washed) } },
    "KO'd":       { select: { name: sideEffect(data.KnockedOut) } },
    "Dizzy":      { select: { name: sideEffect(data.Dizzy) } },
    "Headache":   { select: { name: sideEffect(data.Headache) } },
  };
  if (overall != null) properties["Overall Rating"] = { number: overall };

  const r = await fetch("https://api.notion.com/v1/pages", {
    method: "POST",
    headers: {
      "Authorization": "Bearer " + token,
      "Notion-Version": "2025-09-03",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      parent: { type: "data_source_id", data_source_id: DS.sessions },
      properties,
    }),
  });

  if (!r.ok) throw new Error("Notion write " + r.status + ": " + (await r.text()).slice(0, 200));
  return await r.json();
}

// ---- Notion query with pagination ----
async function queryAll(dataSourceId, token) {
  const out = [];
  let cursor;
  do {
    const body = { page_size: 100 };
    if (cursor) body.start_cursor = cursor;
    const r = await fetch("https://api.notion.com/v1/data_sources/" + dataSourceId + "/query", {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + token,
        "Notion-Version": NOTION_VERSION,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if (!r.ok) throw new Error("Notion " + r.status + " on " + dataSourceId + ": " + (await r.text()).slice(0, 300));
    const j = await r.json();
    out.push(...(j.results || []));
    cursor = j.has_more ? j.next_cursor : undefined;
  } while (cursor);
  return out;
}

function idToUrl(id)   { return "https://app.notion.com/" + String(id).replace(/-/g, ""); }
function prop(p, name) { return (p.properties && p.properties[name]) || null; }
function title(p, n)       { const v = prop(p,n); return v?.title?.map(t=>t.plain_text).join("") ?? ""; }
function richText(p, n)    { const v = prop(p,n); return v?.rich_text?.map(t=>t.plain_text).join("") ?? ""; }
function select(p, n)      { const v = prop(p,n); return v?.select?.name ?? null; }
function multiSelect(p, n) { const v = prop(p,n); return v?.multi_select?.map(o=>o.name) ?? []; }
function number(p, n)      { const v = prop(p,n); return v?.number ?? null; }
function dateStart(p, n)   { const v = prop(p,n); return v?.date?.start ?? null; }
function relation(p, n)    { const v = prop(p,n); return v?.relation?.map(r=>idToUrl(r.id)) ?? []; }

// ============================================================
//  ADD STRAIN  —  paste this into worker.js
//  Creates a Strain (if new) + a Batch, and links them.
//  Verified against the live Notion schema on 2026-08-14.
// ============================================================

// Brand -> short code used in batch names ("Orange Bellini | MAV | 29")
const BRAND_CODE = {
  "Maven": "MAV",
  "Oakfruitland": "OFL",
  "Traditional": "TRAD",
  "CAM": "CAM",
  "Pure Beauty": "PB",
  "Humbolt Farms": "HUM",
  "Jet Set": "JS",
  "KHYRS": "KHRY",
  "Delighted": "DEL",
  "Connected": "CON",
  "Claybourne": "CLB",
  "Zombi": "ZOM",
  "Fig Farms": "FF",
  "UpNorth": "UN",
  "Alien Labs": "AL",
  "Revelry": "REV",
  "Broccoli": "BRO",
  "Sluggers": "SLG",
  "LOLO": "LOLO",
  "CDB": "CDB",
};

function brandCode(brand) {
  if (BRAND_CODE[brand]) return BRAND_CODE[brand];
  // new brand: first 3 letters, uppercase, letters only
  return brand.replace(/[^a-z]/gi, "").slice(0, 3).toUpperCase() || "NEW";
}

// Look for an existing strain by name (case-insensitive, trimmed)
async function findStrainByName(name, token) {
  const r = await fetch(
    `https://api.notion.com/v1/data_sources/${DS.strains}/query`,
    {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + token,
        "Notion-Version": "2025-09-03",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ page_size: 100 }),
    }
  );
  if (!r.ok) throw new Error(`Notion read ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const j = await r.json();
  const want = name.trim().toLowerCase();
  const hit = (j.results || []).find(p => {
    const t = p.properties?.Name?.title?.map(x => x.plain_text).join("") || "";
    return t.trim().toLowerCase() === want;
  });
  return hit ? hit.id : null;
}

// Find an existing brand option, case-insensitively, so "oakfruitland"
// doesn't create a twin of "Oakfruitland".
async function normalizeBrand(brand, token) {
  const r = await fetch(
    `https://api.notion.com/v1/data_sources/${DS.batches}/query`,
    {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + token,
        "Notion-Version": "2025-09-03",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ page_size: 100 }),
    }
  );
  if (!r.ok) return brand.trim();
  const j = await r.json();
  const want = brand.trim().toLowerCase();
  for (const p of j.results || []) {
    const b = p.properties?.Brand?.select?.name;
    if (b && b.trim().toLowerCase() === want) return b; // reuse exact existing casing
  }
  return brand.trim();
}

async function createStrainAndBatch(data, token, clean, memberName) {
  const strainName = clean(data.strainName);
  const typeIn     = String(data.type || "").trim();
  const whoIn      = clean(memberName);

  if (!strainName) throw new Error("Strain name is required");
  if (!["Sativa", "Hybrid", "Indica"].includes(typeIn)) {
    throw new Error("Type must be Sativa, Hybrid or Indica");
  }

  // THC: user types 29 (meaning 29%). Notion stores it as a DECIMAL (0.29).
  const thcNum = Number(data.thc);
  if (!isFinite(thcNum) || thcNum <= 0 || thcNum > 100) {
    throw new Error("THC % must be a number between 0 and 100");
  }
  const thcDecimal = Math.round(thcNum * 100) / 10000; // 29 -> 0.29
  const thcLabel   = Math.round(thcNum);              // 29 -> "29" for the name

  const brand = await normalizeBrand(clean(data.brand), token);
  if (!brand) throw new Error("Brand is required");

  // 1. Reuse the strain if it already exists, otherwise create it.
  let strainId = await findStrainByName(strainName, token);
  if (!strainId) {
    const rs = await fetch("https://api.notion.com/v1/pages", {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + token,
        "Notion-Version": "2025-09-03",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        parent: { type: "data_source_id", data_source_id: DS.strains },
        properties: {
          "Name": { title: [{ text: { content: strainName } }] },
        },
      }),
    });
    if (!rs.ok) throw new Error(`Strain write ${rs.status}: ${(await rs.text()).slice(0, 300)}`);
    strainId = (await rs.json()).id;
  }

  // 2. Create the batch and link it to the strain.
  const batchName = `${strainName} | ${brandCode(brand)} | ${thcLabel}`;
  const today     = new Date().toISOString().slice(0, 10);

  const batchProps = {
    "Batch":  { title: [{ text: { content: batchName } }] },
    "Brand":  { select: { name: brand } },   // Notion auto-creates unknown options
    "Type":   { select: { name: typeIn } },
    "THC %":  { number: thcDecimal },
    "Strains": { relation: [{ id: strainId }] },
    "Purchase Date": { date: { start: today } },
  };

  const terpUrls = Array.isArray(data.terpUrls) ? data.terpUrls.slice(0, 12) : [];
  if (terpUrls.length) {
    batchProps["Terpenes"] = { relation: terpUrls.map(url => ({ id: urlToPageId(url) })) };
  }

  const rb = await fetch("https://api.notion.com/v1/pages", {
    method: "POST",
    headers: {
      "Authorization": "Bearer " + token,
      "Notion-Version": "2025-09-03",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      parent: { type: "data_source_id", data_source_id: DS.batches },
      properties: batchProps,
    }),
  });
  if (!rb.ok) throw new Error(`Batch write ${rb.status}: ${(await rb.text()).slice(0, 300)}`);
  const batch = await rb.json();

  return { strainId, batchId: batch.id, batchName, addedBy: whoIn };
}

function urlToPageId(url) {
  const hex = String(url || "").split('/').pop().replace(/-/g, "");
  if (!/^[0-9a-f]{32}$/i.test(hex)) throw new Error("Invalid terpene reference");
  return hex.slice(0,8)+'-'+hex.slice(8,12)+'-'+hex.slice(12,16)+'-'+hex.slice(16,20)+'-'+hex.slice(20);
}
