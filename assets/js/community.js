const NETWORK_LABELS = {
  instagram: "Instagram",
  tiktok: "TikTok",
  youtube: "YouTube",
  facebook: "Facebook",
  pinterest: "Pinterest",
  etsy: "Etsy",
  otra: "Otra",
};

let allLinks = [];
let activeNetwork = null;

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}

async function loadLinks() {
  const { data, error } = await supabaseClient
    .from("community_links")
    .select("id, display_name, network, url, description")
    .eq("status", "approved")
    .order("created_at", { ascending: false });
  if (error) {
    console.error(error);
    return;
  }
  allLinks = data;
  renderNetworkFilters();
  renderLinks();
}

function renderNetworkFilters() {
  const container = document.getElementById("network-filters");
  const networksPresent = [...new Set(allLinks.map((l) => l.network))];
  container.innerHTML = "";
  networksPresent.forEach((net) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "chip-toggle";
    btn.textContent = NETWORK_LABELS[net] ?? net;
    btn.addEventListener("click", () => {
      activeNetwork = activeNetwork === net ? null : net;
      document.querySelectorAll("#network-filters .chip-toggle").forEach((b) => b.classList.remove("active"));
      if (activeNetwork) btn.classList.add("active");
      renderLinks();
    });
    container.appendChild(btn);
  });
}

function renderLinks() {
  const grid = document.getElementById("links-grid");
  const empty = document.getElementById("links-empty");
  const filtered = activeNetwork ? allLinks.filter((l) => l.network === activeNetwork) : allLinks;
  grid.innerHTML = "";
  empty.hidden = filtered.length > 0;
  filtered.forEach((link) => {
    const card = document.createElement("a");
    card.href = link.url;
    card.target = "_blank";
    card.rel = "noopener";
    card.className = "card pattern-card";
    card.innerHTML = `
      <div class="body">
        <span class="tag-chip">${escapeHtml(NETWORK_LABELS[link.network] ?? link.network)}</span>
        <h3>${escapeHtml(link.display_name)}</h3>
        ${link.description ? `<p class="meta">${escapeHtml(link.description)}</p>` : ""}
      </div>
    `;
    grid.appendChild(card);
  });
}

document.getElementById("community-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const messageEl = document.getElementById("community-message");
  try {
    await callFunction("submit-community-link", {
      displayName: document.getElementById("display-name").value.trim(),
      network: document.getElementById("network").value,
      url: document.getElementById("url").value.trim(),
      description: document.getElementById("description").value.trim() || undefined,
      submitterEmail: document.getElementById("submitter-email").value.trim() || undefined,
    });
    messageEl.innerHTML = `<div class="notice success">¡Gracias! Tu red se ha enviado a revisión.</div>`;
    e.target.reset();
  } catch (err) {
    messageEl.innerHTML = `<div class="notice danger">Error: ${err.message}</div>`;
  }
});

loadLinks();
