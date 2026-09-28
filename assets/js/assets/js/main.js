// Lógica de la página de inicio: buscador + filtros de etiquetas.

const state = {
  patterns: [],
  tagsByCategory: { tecnica: [], producto: [] },
  selectedTags: new Set(),
  coverFilter: null, // "con" | "sin" | null
  searchTerm: "",
  sortBy: "recent", // "recent" | "popular" | "rated"
};

async function loadTags() {
  const { data, error } = await supabaseClient
    .from("tags")
    .select("id, category, display_name")
    .eq("status", "approved")
    .order("display_name");
  if (error) {
    console.error(error);
    return;
  }
  state.tagsByCategory.tecnica = data.filter((t) => t.category === "tecnica");
  state.tagsByCategory.producto = data.filter((t) => t.category === "producto");
  renderFilterChips("filters-tecnica", state.tagsByCategory.tecnica);
  renderFilterChips("filters-producto", state.tagsByCategory.producto);
}

function renderFilterChips(containerId, tags) {
  const container = document.getElementById(containerId);
  container.innerHTML = "";
  tags.forEach((tag) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "chip-toggle";
    btn.textContent = tag.display_name;
    btn.dataset.tagId = tag.id;
    btn.addEventListener("click", () => {
      if (state.selectedTags.has(tag.id)) {
        state.selectedTags.delete(tag.id);
        btn.classList.remove("active");
      } else {
        state.selectedTags.add(tag.id);
        btn.classList.add("active");
      }
      renderResults();
    });
    container.appendChild(btn);
  });
}

async function loadPatterns() {
  const { data, error } = await supabaseClient
    .from("patterns")
    .select(
      "id, short_description, author_name, cover_image_path, created_at, moderated_at, hearts_count, good_experience_count, bad_experience_count, comments_count, pattern_tags(tags(id, category, display_name))"
    )
    .eq("status", "approved")
    .order("created_at", { ascending: false });

  if (error) {
    console.error(error);
    return;
  }
  state.patterns = data.map((p) => ({
    ...p,
    tags: (p.pattern_tags || []).map((pt) => pt.tags).filter(Boolean),
  }));
  renderResults();
}

function patternMatchesFilters(pattern) {
  if (state.searchTerm) {
    const haystack = (pattern.short_description + " " + pattern.author_name + " " + pattern.tags.map((t) => t.display_name).join(" ")).toLowerCase();
    if (!haystack.includes(state.searchTerm.toLowerCase())) return false;
  }
  if (state.selectedTags.size > 0) {
    const patternTagIds = new Set(pattern.tags.map((t) => t.id));
    const matchesAny = [...state.selectedTags].some((tagId) => patternTagIds.has(tagId));
    if (!matchesAny) return false;
  }
  if (state.coverFilter === "con" && !pattern.cover_image_path) return false;
  if (state.coverFilter === "sin" && pattern.cover_image_path) return false;
  return true;
}

function sortPatterns(list) {
  const sorted = [...list];
  if (state.sortBy === "popular") {
    sorted.sort((a, b) => (b.hearts_count || 0) - (a.hearts_count || 0));
  } else if (state.sortBy === "rated") {
    sorted.sort((a, b) => (b.good_experience_count || 0) - (a.good_experience_count || 0));
  } else {
    sorted.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }
  return sorted;
}

function renderResults() {
  const grid = document.getElementById("pattern-grid");
  const emptyState = document.getElementById("empty-state");
  const countEl = document.getElementById("results-count");
  const filtered = sortPatterns(state.patterns.filter(patternMatchesFilters));

  countEl.textContent = `${filtered.length} patrón${filtered.length === 1 ? "" : "es"} encontrados`;
  grid.innerHTML = "";
  emptyState.hidden = filtered.length > 0;

  filtered.forEach((pattern) => {
    const card = document.createElement("a");
    card.href = `patron.html?id=${pattern.id}`;
    card.className = "card pattern-card";
    card.style.position = "relative";

    const cover = document.createElement("div");
    cover.className = "cover";
    const img = document.createElement("img");
    img.src = pattern.cover_image_path ? publicFileUrl(pattern.cover_image_path) : "assets/img/placeholder-cover.svg";
    img.alt = pattern.short_description;
    cover.appendChild(img);
    if (isRecentPattern(pattern)) {
      const badge = document.createElement("span");
      badge.className = "badge clean";
      badge.style.cssText = "position:absolute; top:8px; left:8px;";
      badge.textContent = "🆕 Nuevo";
      cover.appendChild(badge);
    }

    const body = document.createElement("div");
    body.className = "body";
    body.innerHTML = `
      <h3>${escapeHtml(pattern.short_description)}</h3>
      <div class="author">Por ${escapeHtml(pattern.author_name)}</div>
      <div class="tags">${pattern.tags
        .map((t) => `<span class="tag-chip ${t.category === "tecnica" ? "tecnica" : ""}">${escapeHtml(t.display_name)}</span>`)
        .join("")}</div>
      <div class="card-stats">
        <span title="Favoritos">${heartIconSmall()} ${pattern.hearts_count || 0}</span>
        ${pattern.good_experience_count ? `<span title="Buena experiencia">😊 ${pattern.good_experience_count}</span>` : ""}
        ${pattern.bad_experience_count ? `<span title="No tan buena experiencia">😞 ${pattern.bad_experience_count}</span>` : ""}
        <span title="Comentarios">${commentIconSmall()} ${pattern.comments_count || 0}</span>
        <button type="button" class="card-stats-help" data-legend-trigger>¿Qué significa?</button>
      </div>
    `;

    card.appendChild(cover);
    card.appendChild(body);
    grid.appendChild(card);
  });
}

function heartIconSmall() {
  return `<svg width="14" height="14" viewBox="0 0 24 24" style="vertical-align:-2px;" fill="#c1502e" stroke="#c1502e" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"><path d="M12 20.5s-7.5-4.6-10-9.1C.5 8.2 1.8 4.5 5.4 3.6c2.1-.5 4 .4 5 2 .9-1.6 2.9-2.5 5-2 3.6.9 4.9 4.6 3.4 7.8-2.5 4.5-10 9.1-10 9.1z"/></svg>`;
}
function commentIconSmall() {
  return `<svg width="14" height="14" viewBox="0 0 24 24" style="vertical-align:-2px;" fill="none" stroke="var(--color-text-soft)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"><path d="M21 12c0 4.4-4 8-9 8-1.1 0-2.2-.2-3.2-.5L3 21l1.6-4.4C3.6 15.2 3 13.7 3 12c0-4.4 4-8 9-8s9 3.6 9 8z"/></svg>`;
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}

document.getElementById("search-input").addEventListener("input", (e) => {
  state.searchTerm = e.target.value;
  renderResults();
});

document.querySelectorAll("[data-cover-filter]").forEach((btn) => {
  btn.addEventListener("click", () => {
    const value = btn.dataset.coverFilter;
    if (state.coverFilter === value) {
      state.coverFilter = null;
      btn.classList.remove("active");
    } else {
      state.coverFilter = value;
      document.querySelectorAll("[data-cover-filter]").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
    }
    renderResults();
  });
});

const sortSelect = document.getElementById("sort-select");
if (sortSelect) {
  sortSelect.addEventListener("change", (e) => {
    state.sortBy = e.target.value;
    renderResults();
  });
}

// ---------- Leyenda de los símbolos de las tarjetas ----------

const statsLegendOverlay = document.createElement("div");
statsLegendOverlay.className = "modal-overlay";
statsLegendOverlay.hidden = true;
statsLegendOverlay.innerHTML = `
  <div class="modal-box">
    <button type="button" class="modal-close" aria-label="Cerrar">×</button>
    <h3 style="margin-top:0;">Qué significa cada símbolo</h3>
    <ul style="padding-left:18px; display:grid; gap:10px;">
      <li>${heartIconSmall()} <strong>Corazón:</strong> cuántas personas tienen este patrón guardado en favoritos.</li>
      <li>😊 <strong>Cara sonriente:</strong> cuántas personas dicen que les fue bien haciendo este patrón.</li>
      <li>😞 <strong>Cara triste:</strong> cuántas personas dicen que no les fue tan bien.</li>
      <li>${commentIconSmall()} <strong>Bocadillo de texto:</strong> cuántos comentarios tiene el patrón.</li>
    </ul>
  </div>
`;
document.body.appendChild(statsLegendOverlay);
statsLegendOverlay.querySelector(".modal-close").addEventListener("click", () => {
  statsLegendOverlay.hidden = true;
});
statsLegendOverlay.addEventListener("click", (e) => {
  if (e.target === statsLegendOverlay) statsLegendOverlay.hidden = true;
});
document.getElementById("pattern-grid").addEventListener("click", (e) => {
  if (e.target.closest("[data-legend-trigger]")) {
    e.preventDefault();
    e.stopPropagation();
    statsLegendOverlay.hidden = false;
  }
});

loadTags();
loadPatterns();
