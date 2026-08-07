async function loadStrains() {
  const host = document.getElementById("strains");
  if (!host) return;
  try {
    const res = await fetch("./data.json", { cache: "no-store" });
    const data = await res.json();
    const valid = data.strains.filter(s => s.name.trim() !== "");
    host.innerHTML = `<p class="updated">Last synced: ${new Date(data.updated).toLocaleString()}</p>`
      + valid.map(cardHtml).join("");
  } catch (e) {
    host.innerHTML = `<p>Couldn't load data. ${e.message}</p>`;
  }
}

function cardHtml(s) {
  const type  = (s.type  || []).join(", ") || "—";
  const brand = (s.brand || []).join(", ") || "—";
  const thc   = s.thc   != null ? `${(s.thc * 100).toFixed(1)}% THC` : "—";
  const score = s.avgScore != null ? `${(s.avgScore * 100).toFixed(0)}% avg score` : "no score yet";
  return `
    <article class="strain-card">
      <h3>${s.name}</h3>
      <p class="meta">${type} · ${brand}</p>
      <p class="stats">${thc} · ${score}</p>
      <p class="counts">${s.totalBatches ?? 0} batches · ${s.totalSessions ?? 0} sessions</p>
    </article>`;
}

loadStrains();
