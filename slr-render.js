// Minimal loader: fetch data.json and render strain cards.
// 1. Put an empty container somewhere in your HTML:  <div id="strains"></div>
// 2. Include this file, or paste its body into your app. Style .strain-card to taste.

async function loadStrains() {
  const host = document.getElementById("strains");
  if (!host) return;
  try {
    const res = await fetch("./data.json", { cache: "no-store" });
    const data = await res.json();
    host.innerHTML = data.strains.map(cardHtml).join("");
  } catch (e) {
    host.innerHTML = `<p>Couldn't load data. ${e.message}</p>`;
  }
}

function cardHtml(s) {
  const type = (s.type || []).join(", ") || "—";
  const brand = (s.brand || []).join(", ") || "—";
  const thc = s.thc != null ? `${s.thc}% THC` : "—";
  const score = s.avgScore != null ? `${Math.round(s.avgScore)}%` : "—";
  return `
    <article class="strain-card">
      <h3>${s.name}</h3>
      <p>${type} · ${brand}</p>
      <p>${thc} · score ${score}</p>
      <p>${s.totalBatches ?? 0} batches · ${s.totalSessions ?? 0} sessions</p>
    </article>`;
}

loadStrains();
