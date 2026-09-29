const ADMIN_EMAIL = window.PATRONOTECA_CONFIG.ADMIN_EMAIL.toLowerCase();
let currentData = { patterns: [], communityLinks: [], allTags: [], comments: [] };

// La sesión de moderación caduca sola a los 7 días (Supabase solo deja fijar
// esto en su plan de pago, así que lo controlamos aquí guardando cuándo
// entraste por última vez).
const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const LOGIN_TIMESTAMP_KEY = "patronoteca_admin_login_at";

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}

// Sube una imagen nueva a un patrón ya publicado (admin-upload-image usa
// multipart/form-data, así que no reutiliza callFunction, que manda JSON).
async function uploadAdminImage(file, patternId) {
  const { data } = await supabaseClient.auth.getSession();
  const token = data.session?.access_token;
  const formData = new FormData();
  formData.append("file", file);
  formData.append("patternId", patternId);
  const res = await fetch(`${window.PATRONOTECA_CONFIG.FUNCTIONS_URL}/admin-upload-image`, {
    method: "POST",
    headers: {
      apikey: window.PATRONOTECA_CONFIG.SUPABASE_ANON_KEY,
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });
  const json = await res.json().catch(() => ({ ok: false, error: "Respuesta inválida del servidor." }));
  if (!res.ok || !json.ok) throw new Error(json.error || "Error al subir la imagen");
  return json.path;
}

// ---------- Ver fotos en grande (lightbox) ----------

const adminLightboxOverlay = document.createElement("div");
adminLightboxOverlay.className = "modal-overlay";
adminLightboxOverlay.hidden = true;
adminLightboxOverlay.innerHTML = `
  <div class="modal-box" style="max-width:90vw; padding:16px; text-align:center;">
    <button type="button" class="modal-close" aria-label="Cerrar">×</button>
    <img id="admin-lightbox-img" style="max-width:100%; max-height:75vh; display:block; margin:0 auto; border-radius:8px;">
  </div>
`;
document.body.appendChild(adminLightboxOverlay);
adminLightboxOverlay.querySelector(".modal-close").addEventListener("click", () => {
  adminLightboxOverlay.hidden = true;
});
adminLightboxOverlay.addEventListener("click", (e) => {
  if (e.target === adminLightboxOverlay) adminLightboxOverlay.hidden = true;
});

function openAdminLightbox(url) {
  document.getElementById("admin-lightbox-img").src = url;
  adminLightboxOverlay.hidden = false;
}

function makeImageZoomable(img) {
  img.style.cursor = "zoom-in";
  img.addEventListener("click", () => openAdminLightbox(img.src));
}

async function checkSession() {
  const { data } = await supabaseClient.auth.getSession();
  const session = data.session;

  if (session && session.user.email?.toLowerCase() === ADMIN_EMAIL) {
    let loginAt = Number(localStorage.getItem(LOGIN_TIMESTAMP_KEY));
    if (!loginAt) {
      loginAt = Date.now();
      localStorage.setItem(LOGIN_TIMESTAMP_KEY, String(loginAt));
    }
    if (Date.now() - loginAt > SESSION_MAX_AGE_MS) {
      await supabaseClient.auth.signOut();
      localStorage.removeItem(LOGIN_TIMESTAMP_KEY);
      showLogin();
      return;
    }
    showDashboard();
  } else {
    localStorage.removeItem(LOGIN_TIMESTAMP_KEY);
    showLogin();
  }
}

function showLogin() {
  document.getElementById("login-section").hidden = false;
  document.getElementById("dashboard-section").hidden = true;
}

function showDashboard() {
  document.getElementById("login-section").hidden = true;
  document.getElementById("dashboard-section").hidden = false;
  loadPending();
}

document.getElementById("login-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const messageEl = document.getElementById("login-message");
  const email = document.getElementById("login-email").value.trim();
  const submitBtn = e.target.querySelector("button[type=submit]");
  submitBtn.disabled = true;

  const { error } = await supabaseClient.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: window.location.origin + window.location.pathname },
  });

  submitBtn.disabled = false;
  if (error) {
    messageEl.innerHTML = `<div class="notice danger">${error.message}</div>`;
    return;
  }
  messageEl.innerHTML = `<div class="notice success">Si ese email tiene acceso, te hemos enviado un enlace. Revisa tu bandeja de entrada (y spam).</div>`;

  // En modo demo no hay email real: entra directamente para poder probar.
  if (window.PATRONOTECA_DEMO) {
    localStorage.setItem(LOGIN_TIMESTAMP_KEY, String(Date.now()));
    await checkSession();
  }
});

document.getElementById("logout-btn").addEventListener("click", async () => {
  await supabaseClient.auth.signOut();
  localStorage.removeItem(LOGIN_TIMESTAMP_KEY);
  showLogin();
});

async function loadPending() {
  try {
    const result = await callFunction("list-pending", {}, true);
    currentData = result;
    renderPatterns();
    renderCommunityLinks();
    renderComments();
  } catch (err) {
    console.error(err);
    alert("No se pudo cargar la cola de moderación: " + err.message);
  }
}

function renderPatterns() {
  const list = document.getElementById("patterns-list");
  document.getElementById("patterns-count").textContent = currentData.patterns.length;
  list.innerHTML = "";

  if (currentData.patterns.length === 0) {
    list.innerHTML = `<p class="empty-state">No hay patrones pendientes.</p>`;
    return;
  }

  const tecnicaTags = currentData.allTags.filter((t) => t.category === "tecnica" && t.status === "approved");
  const productoTags = currentData.allTags.filter((t) => t.category === "producto" && t.status === "approved");

  currentData.patterns.forEach((pattern) => {
    const linkedTags = (pattern.pattern_tags || []).map((pt) => pt.tags).filter(Boolean);
    const linkedIds = new Set(linkedTags.map((t) => t.id));
    const pendingSuggested = linkedTags.filter((t) => t.status === "pending");

    const card = document.createElement("div");
    card.className = "card moderation-card";
    card.dataset.patternId = pattern.id;

    card.innerHTML = `
      <div class="meta">
        Enviado el ${new Date(pattern.created_at).toLocaleString("es-ES")} · IP: ${escapeHtml(pattern.ip_address || "?")}
      </div>
      <h3>${escapeHtml(pattern.short_description)}</h3>
      <div class="meta">Autor/a: ${escapeHtml(pattern.author_name)} - ${escapeHtml(pattern.author_email)}</div>
      ${pattern.long_description ? `<p>${escapeHtml(pattern.long_description)}</p>` : ""}
      ${pattern.original_source ? `<div class="meta"><strong>Fuente original:</strong> ${escapeHtml(pattern.original_source)}</div>` : ""}

      ${
        pattern.ai_flag_detected
          ? `<div class="notice warning"><strong>Aviso automático:</strong> se detectó una posible señal de IA en una imagen (${escapeHtml(
              pattern.ai_flag_signature || "sin detalle"
            )}). Revisa las imágenes antes de decidir.</div>`
          : ""
      }

      <div class="images-preview" style="display:flex; gap:8px; flex-wrap:wrap; margin-top:8px;"></div>

      <div style="margin-top:14px;">
        <span class="badge ${badgeClass(pattern.virustotal_status)}">VirusTotal: ${vtLabel(pattern.virustotal_status)}</span>
        · <span class="meta" style="display:inline;">${pattern.pattern_paths.length} archivo${pattern.pattern_paths.length === 1 ? "" : "s"} en el patrón</span>
      </div>
      ${renderVirusTotalDetail(pattern.virustotal_result)}
      <div class="actions">
        <button class="btn btn-secondary" data-action="analyze">Analizar patrón</button>
      </div>
      <div class="actions pattern-files-actions" style="margin-top:6px;"></div>
      <div class="pdf-preview-container"></div>

      <div style="margin-top:16px;">
        <div class="meta"><strong>Técnica</strong></div>
        <div class="tag-editor tecnica-editor"></div>
        <div class="meta" style="margin-top:10px;"><strong>Producto</strong></div>
        <div class="tag-editor producto-editor"></div>
        ${
          pendingSuggested.length
            ? `<div class="meta" style="margin-top:10px;"><strong>Etiquetas sugeridas nuevas</strong></div>` +
              pendingSuggested
                .map(
                  (t) => `
              <label style="display:block; margin:4px 0;">
                <input type="checkbox" class="approve-new-tag" data-category="${t.category}" value="${t.id}" checked>
                Convertir "${escapeHtml(t.display_name)}" en etiqueta oficial de ${t.category === "tecnica" ? "técnica" : "producto"}
              </label>`
                )
                .join("")
            : ""
        }
      </div>

      <label style="display:block; margin-top:14px;" ${pattern.ai_flag_detected ? "" : "hidden"}>
        <input type="checkbox" class="ai-disclose-checkbox">
        Marcar como "posible contenido IA" (se mostrará un aviso público en la ficha)
      </label>

      <div class="reason-box" hidden style="margin-top:10px;">
        <textarea class="reason-input" placeholder="Motivo (opcional para denegar, recomendado para bloquear)"></textarea>
      </div>

      <div class="actions" style="margin-top:14px;">
        <button class="btn btn-success" data-action="accept">Aceptar</button>
        <button class="btn btn-danger" data-action="reject">Denegar</button>
        <button class="btn btn-danger" data-action="reject_and_block">Denegar y bloquear</button>
      </div>
    `;

    renderTagCheckboxes(card.querySelector(".tecnica-editor"), tecnicaTags, linkedIds);
    renderTagCheckboxes(card.querySelector(".producto-editor"), productoTags, linkedIds);
    loadImagePreviews(card, pattern);
    wireCardActions(card, pattern);

    list.appendChild(card);
  });
}

function badgeClass(status) {
  if (status === "clean") return "clean";
  if (status === "flagged") return "flagged";
  return "pending";
}
function vtLabel(status) {
  return { not_analyzed: "sin analizar", analyzing: "analizando...", clean: "limpio", flagged: "sospechoso" }[status] || status;
}

function renderVirusTotalDetail(results) {
  if (!results || !results.length) return "";
  return `
    <div class="meta" style="margin-top:6px; display:grid; gap:4px;">
      ${results
        .map((r) => {
          if (r.pending || !r.stats) {
            return `<div>${escapeHtml(r.path.split("/").pop())}: VirusTotal tardó demasiado en responder. Dale otra vez a "Analizar patrón" para volver a intentarlo.</div>`;
          }
          const malicious = r.stats.malicious ?? 0;
          const suspicious = r.stats.suspicious ?? 0;
          const total = Object.values(r.stats).reduce((a, b) => a + b, 0);
          const detectados = malicious + suspicious;
          const link = `https://www.virustotal.com/gui/url-analysis/${r.analysisId}`;
          return `<div>${escapeHtml(r.path.split("/").pop())}: ${detectados}/${total} motores lo marcan ${detectados ? "sospechoso" : "limpio"} - <a href="${link}" target="_blank" rel="noopener">ver informe completo en VirusTotal</a></div>`;
        })
        .join("")}
    </div>
  `;
}

function renderTagCheckboxes(container, tags, linkedIds) {
  container.innerHTML = tags
    .map(
      (t) => `
    <label style="display:inline-flex; align-items:center; gap:4px; margin:2px 8px 2px 0;">
      <input type="checkbox" value="${t.id}" ${linkedIds.has(t.id) ? "checked" : ""}> ${escapeHtml(t.display_name)}
    </label>`
    )
    .join("");
}

async function loadImagePreviews(card, pattern) {
  const container = card.querySelector(".images-preview");
  const paths = [pattern.cover_image_path, ...(pattern.gallery_paths || [])].filter(Boolean);
  for (const path of paths) {
    try {
      const { url } = await callFunction("moderate-pattern", { action: "preview_url", patternId: pattern.id, path }, true);
      const img = document.createElement("img");
      img.src = url;
      img.style.width = "90px";
      img.style.height = "90px";
      img.style.objectFit = "cover";
      img.style.borderRadius = "8px";
      makeImageZoomable(img);
      container.appendChild(img);
    } catch (err) {
      console.error("No se pudo cargar preview de imagen", err);
    }
  }
}

function renderPatternFileButtons(card, pattern) {
  const container = card.querySelector(".pattern-files-actions");
  container.innerHTML = "";
  pattern.pattern_paths.forEach((path, i) => {
    const btn = document.createElement("button");
    btn.className = "btn btn-outline";
    btn.textContent = `Ver archivo ${i + 1}`;
    btn.addEventListener("click", async () => {
      try {
        const { url } = await callFunction("moderate-pattern", { action: "preview_url", patternId: pattern.id, path }, true);
        const previewContainer = card.querySelector(".pdf-preview-container");
        const isImage = /\.(png|jpe?g|webp|gif)$/i.test(path);
        previewContainer.innerHTML = isImage
          ? `<img src="${url}" style="max-width:100%; border-radius:8px; margin-top:10px;">`
          : `<iframe class="pdf-preview" src="${url}"></iframe>`;
      } catch (err) {
        alert("Error al abrir el archivo: " + err.message);
      }
    });
    container.appendChild(btn);
  });
}

function wireCardActions(card, pattern) {
  if (pattern.virustotal_status !== "not_analyzed") {
    renderPatternFileButtons(card, pattern);
  }

  card.querySelector('[data-action="analyze"]').addEventListener("click", async (e) => {
    e.target.disabled = true;
    e.target.textContent = "Analizando...";
    try {
      await callFunction("moderate-pattern", { action: "analyze", patternId: pattern.id }, true);
      await loadPending();
    } catch (err) {
      alert("Error al analizar: " + err.message);
      e.target.disabled = false;
      e.target.textContent = "Analizar patrón";
    }
  });

  card.querySelector('[data-action="accept"]').addEventListener("click", async () => {
    const finalTechniqueTagIds = Array.from(card.querySelectorAll(".tecnica-editor input:checked")).map((el) => el.value);
    const finalProductTagIds = Array.from(card.querySelectorAll(".producto-editor input:checked")).map((el) => el.value);
    const approveTagCheckboxes = Array.from(card.querySelectorAll(".approve-new-tag:checked"));
    const approveTagIds = approveTagCheckboxes.map((el) => el.value);
    approveTagCheckboxes.forEach((el) => {
      if (el.dataset.category === "tecnica") finalTechniqueTagIds.push(el.value);
      else finalProductTagIds.push(el.value);
    });
    const aiDisclosed = card.querySelector(".ai-disclose-checkbox").checked;

    try {
      await callFunction(
        "moderate-pattern",
        { action: "accept", patternId: pattern.id, finalTechniqueTagIds, finalProductTagIds, approveTagIds, aiDisclosed },
        true
      );
      await loadPending();
    } catch (err) {
      alert("Error al aceptar: " + err.message);
    }
  });

  card.querySelector('[data-action="reject"]').addEventListener("click", async () => {
    const reason = prompt("Motivo (opcional):") || undefined;
    try {
      await callFunction("moderate-pattern", { action: "reject", patternId: pattern.id, reason }, true);
      await loadPending();
    } catch (err) {
      alert("Error al denegar: " + err.message);
    }
  });

  card.querySelector('[data-action="reject_and_block"]').addEventListener("click", async () => {
    if (!confirm("Esto bloqueará el email y la IP de quien envió este patrón. ¿Continuar?")) return;
    const reason = prompt("Motivo del bloqueo:") || undefined;
    try {
      await callFunction("moderate-pattern", { action: "reject_and_block", patternId: pattern.id, reason }, true);
      await loadPending();
    } catch (err) {
      alert("Error al bloquear: " + err.message);
    }
  });
}

function renderCommunityLinks() {
  const list = document.getElementById("links-list");
  document.getElementById("links-count").textContent = currentData.communityLinks.length;
  list.innerHTML = "";

  if (currentData.communityLinks.length === 0) {
    list.innerHTML = `<p class="empty-state">No hay redes pendientes.</p>`;
    return;
  }

  currentData.communityLinks.forEach((link) => {
    const card = document.createElement("div");
    card.className = "card moderation-card";
    card.innerHTML = `
      <div class="meta">Enviado el ${new Date(link.created_at).toLocaleString("es-ES")}</div>
      <h3>${escapeHtml(link.display_name)} - ${NETWORK_LABELS[link.network] || escapeHtml(link.network)}</h3>
      <p><a href="${link.url}" target="_blank" rel="noopener">${escapeHtml(link.url)}</a></p>
      ${link.description ? `<p>${escapeHtml(link.description)}</p>` : ""}
      ${link.submitter_email ? `<div class="meta">Email: ${escapeHtml(link.submitter_email)}</div>` : ""}
      <div class="actions">
        <button class="btn btn-success" data-action="accept">Aceptar</button>
        <button class="btn btn-danger" data-action="reject">Denegar</button>
        <button class="btn btn-danger" data-action="reject_and_block">Denegar y bloquear</button>
      </div>
    `;

    card.querySelector('[data-action="accept"]').addEventListener("click", async () => {
      await callFunction("moderate-community-link", { action: "accept", linkId: link.id }, true);
      await loadPending();
    });
    card.querySelector('[data-action="reject"]').addEventListener("click", async () => {
      const reason = prompt("Motivo (opcional):") || undefined;
      await callFunction("moderate-community-link", { action: "reject", linkId: link.id, reason }, true);
      await loadPending();
    });
    card.querySelector('[data-action="reject_and_block"]').addEventListener("click", async () => {
      if (!confirm("Esto bloqueará la IP (y el email si lo dio) de quien envió esto. ¿Continuar?")) return;
      const reason = prompt("Motivo del bloqueo:") || undefined;
      await callFunction("moderate-community-link", { action: "reject_and_block", linkId: link.id, reason }, true);
      await loadPending();
    });

    list.appendChild(card);
  });
}

function renderComments() {
  const list = document.getElementById("comments-list-moderation");
  document.getElementById("comments-count").textContent = currentData.comments.length;
  list.innerHTML = "";

  if (currentData.comments.length === 0) {
    list.innerHTML = `<p class="empty-state">No hay comentarios pendientes.</p>`;
    return;
  }

  currentData.comments.forEach((comment) => {
    const card = document.createElement("div");
    card.className = "card moderation-card";
    card.innerHTML = `
      <div class="meta">Enviado el ${new Date(comment.created_at).toLocaleString("es-ES")} · en "${escapeHtml(comment.patterns?.short_description || "")}"</div>
      <h3>${escapeHtml(comment.alias)}</h3>
      <p>${escapeHtml(comment.message)}</p>
      <div class="comment-image-preview"></div>
      <div class="actions">
        ${comment.image_path ? '<button class="btn btn-outline" data-action="view-image">Ver foto</button>' : ""}
        <button class="btn btn-success" data-action="accept">Aceptar</button>
        <button class="btn btn-danger" data-action="reject">Denegar</button>
        <button class="btn btn-danger" data-action="reject_and_block">Denegar y bloquear</button>
      </div>
    `;

    if (comment.image_path) {
      card.querySelector('[data-action="view-image"]').addEventListener("click", async () => {
        try {
          const { url } = await callFunction("moderate-comment", { action: "preview_url", commentId: comment.id }, true);
          card.querySelector(".comment-image-preview").innerHTML = `<img src="${url}" style="max-width:220px; border-radius:8px; margin-top:8px;">`;
          makeImageZoomable(card.querySelector(".comment-image-preview img"));
        } catch (err) {
          alert("Error al ver la foto: " + err.message);
        }
      });
    }

    card.querySelector('[data-action="accept"]').addEventListener("click", async () => {
      await callFunction("moderate-comment", { action: "accept", commentId: comment.id }, true);
      await loadPending();
    });
    card.querySelector('[data-action="reject"]').addEventListener("click", async () => {
      await callFunction("moderate-comment", { action: "reject", commentId: comment.id }, true);
      await loadPending();
    });
    card.querySelector('[data-action="reject_and_block"]').addEventListener("click", async () => {
      if (!confirm("Esto bloqueará la IP de quien envió esto. ¿Continuar?")) return;
      const reason = prompt("Motivo del bloqueo:") || undefined;
      await callFunction("moderate-comment", { action: "reject_and_block", commentId: comment.id, reason }, true);
      await loadPending();
    });

    list.appendChild(card);
  });
}

// ---------- Pestañas y gestión de patrones publicados (buscar/editar/borrar) ----------

const publishedState = {
  patterns: [],
  allTags: [],
  selectedTechnique: new Set(),
  selectedProduct: new Set(),
  searchTerm: "",
  loaded: false,
};

document.querySelectorAll("[data-tab-btn]").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll("[data-tab-btn]").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    const tab = btn.dataset.tabBtn;
    document.getElementById("tab-pending").hidden = tab !== "pending";
    document.getElementById("tab-published").hidden = tab !== "published";
    if (tab === "published" && !publishedState.loaded) {
      loadPublished();
    }
  });
});

document.querySelectorAll("[data-pending-sub]").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll("[data-pending-sub]").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    const sub = btn.dataset.pendingSub;
    document.getElementById("pending-sub-patterns").hidden = sub !== "patterns";
    document.getElementById("pending-sub-comments").hidden = sub !== "comments";
    document.getElementById("pending-sub-links").hidden = sub !== "links";
  });
});

document.querySelectorAll("[data-published-sub]").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll("[data-published-sub]").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    const sub = btn.dataset.publishedSub;
    document.getElementById("published-sub-patterns").hidden = sub !== "patterns";
    document.getElementById("published-sub-comments").hidden = sub !== "comments";
    document.getElementById("published-sub-links").hidden = sub !== "links";
  });
});

async function loadPublished() {
  const [{ data: patterns }, { data: tags }, { data: links }, { data: comments }] = await Promise.all([
    supabaseClient
      .from("patterns")
      .select("id, short_description, long_description, cover_image_path, gallery_paths, author_name, pattern_tags(tags(id, category, display_name))")
      .eq("status", "approved")
      .order("created_at", { ascending: false }),
    supabaseClient.from("tags").select("id, category, display_name").eq("status", "approved").order("display_name"),
    supabaseClient
      .from("community_links")
      .select("id, created_at, moderated_at, display_name, network, url, description, status")
      .eq("status", "approved")
      .order("created_at", { ascending: false }),
    supabaseClient
      .from("comments")
      .select("id, created_at, moderated_at, pattern_id, alias, message, image_path, status, patterns(short_description)")
      .eq("status", "approved")
      .order("created_at", { ascending: false }),
  ]);

  publishedState.patterns = (patterns || []).map((p) => ({ ...p, tags: (p.pattern_tags || []).map((pt) => pt.tags).filter(Boolean) }));
  publishedState.allTags = tags || [];
  publishedState.loaded = true;

  renderPublishedFilterChips("published-filters-tecnica", publishedState.allTags.filter((t) => t.category === "tecnica"), publishedState.selectedTechnique);
  renderPublishedFilterChips("published-filters-producto", publishedState.allTags.filter((t) => t.category === "producto"), publishedState.selectedProduct);
  renderPublishedResults();
  renderPublishedLinks(links || []);
  renderPublishedComments(comments || []);
}

const NETWORK_LABELS = {
  instagram: "Instagram",
  tiktok: "TikTok",
  youtube: "YouTube",
  facebook: "Facebook",
  pinterest: "Pinterest",
  etsy: "Etsy",
  otra: "Otra",
};
const NETWORK_OPTIONS = Object.keys(NETWORK_LABELS);

function renderPublishedLinks(links) {
  const list = document.getElementById("published-links-list");
  list.innerHTML = "";

  if (links.length === 0) {
    list.innerHTML = `<p class="empty-state">No hay redes sociales publicadas.</p>`;
    return;
  }

  links.forEach((link) => {
    const card = document.createElement("div");
    card.className = "card moderation-card";
    card.innerHTML = `
      <h3>${escapeHtml(link.display_name)} - ${NETWORK_LABELS[link.network] || escapeHtml(link.network)}</h3>
      <p><a href="${link.url}" target="_blank" rel="noopener">${escapeHtml(link.url)}</a></p>
      ${link.description ? `<p>${escapeHtml(link.description)}</p>` : ""}
      <div class="edit-panel" hidden style="margin-top:10px;">
        <div class="field">
          <label>Nombre</label>
          <input type="text" class="edit-name" value="${escapeHtml(link.display_name)}">
        </div>
        <div class="field">
          <label>Red</label>
          <select class="edit-network">
            ${NETWORK_OPTIONS.map((n) => `<option value="${n}" ${n === link.network ? "selected" : ""}>${NETWORK_LABELS[n]}</option>`).join("")}
          </select>
        </div>
        <div class="field">
          <label>Enlace</label>
          <input type="text" class="edit-url" value="${escapeHtml(link.url)}">
        </div>
        <div class="field">
          <label>Descripción</label>
          <input type="text" class="edit-description" maxlength="200" value="${escapeHtml(link.description || "")}">
        </div>
      </div>
      <div class="actions">
        <button class="btn btn-secondary" data-action="toggle-edit">Editar</button>
        <button class="btn btn-danger" data-action="delete">Borrar</button>
      </div>
    `;

    const editPanel = card.querySelector(".edit-panel");
    card.querySelector('[data-action="toggle-edit"]').addEventListener("click", () => {
      if (editPanel.hidden) {
        editPanel.hidden = false;
        card.querySelector('[data-action="toggle-edit"]').insertAdjacentHTML("afterend", '<button class="btn btn-success" data-action="save">Guardar</button>');
        card.querySelector('[data-action="save"]').addEventListener("click", async () => {
          try {
            await callFunction(
              "moderate-community-link",
              {
                action: "update",
                linkId: link.id,
                displayName: card.querySelector(".edit-name").value.trim(),
                network: card.querySelector(".edit-network").value,
                url: card.querySelector(".edit-url").value.trim(),
                description: card.querySelector(".edit-description").value.trim(),
              },
              true
            );
            publishedState.loaded = false;
            await loadPublished();
          } catch (err) {
            alert("Error al guardar: " + err.message);
          }
        });
      } else {
        editPanel.hidden = true;
      }
    });

    card.querySelector('[data-action="delete"]').addEventListener("click", async () => {
      if (!confirm(`¿Borrar definitivamente el enlace de "${link.display_name}"?`)) return;
      try {
        await callFunction("moderate-community-link", { action: "delete", linkId: link.id }, true);
        publishedState.loaded = false;
        await loadPublished();
      } catch (err) {
        alert("Error al borrar: " + err.message);
      }
    });

    list.appendChild(card);
  });
}

function renderPublishedComments(comments) {
  const list = document.getElementById("published-comments-list");
  list.innerHTML = "";

  if (comments.length === 0) {
    list.innerHTML = `<p class="empty-state">No hay comentarios publicados.</p>`;
    return;
  }

  comments.forEach((comment) => {
    const card = document.createElement("div");
    card.className = "card moderation-card";
    card.innerHTML = `
      <div class="meta">en "${escapeHtml(comment.patterns?.short_description || "")}"</div>
      <h3>${escapeHtml(comment.alias)}</h3>
      <p>${escapeHtml(comment.message)}</p>
      <div class="comment-image-preview"></div>
      <div class="actions">
        ${comment.image_path ? '<button class="btn btn-outline" data-action="view-image">Ver foto</button>' : ""}
        <button class="btn btn-danger" data-action="delete">Borrar comentario</button>
      </div>
    `;

    if (comment.image_path) {
      card.querySelector('[data-action="view-image"]').addEventListener("click", async () => {
        try {
          const { url } = await callFunction("moderate-comment", { action: "preview_published_url", commentId: comment.id }, true);
          card.querySelector(".comment-image-preview").innerHTML = `<img src="${url}" style="max-width:220px; border-radius:8px; margin-top:8px;">`;
          makeImageZoomable(card.querySelector(".comment-image-preview img"));
        } catch (err) {
          alert("Error al ver la foto: " + err.message);
        }
      });
    }

    card.querySelector('[data-action="delete"]').addEventListener("click", async () => {
      if (!confirm("¿Borrar definitivamente este comentario?")) return;
      try {
        await callFunction("moderate-comment", { action: "delete", commentId: comment.id }, true);
        publishedState.loaded = false;
        await loadPublished();
      } catch (err) {
        alert("Error al borrar: " + err.message);
      }
    });

    list.appendChild(card);
  });
}

function renderPublishedFilterChips(containerId, tags, selectedSet) {
  const container = document.getElementById(containerId);
  container.innerHTML = "";
  tags.forEach((tag) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "chip-toggle";
    btn.textContent = tag.display_name;
    btn.addEventListener("click", () => {
      if (selectedSet.has(tag.id)) {
        selectedSet.delete(tag.id);
        btn.classList.remove("active");
      } else {
        selectedSet.add(tag.id);
        btn.classList.add("active");
      }
      renderPublishedResults();
    });
    container.appendChild(btn);
  });
}

document.getElementById("published-search-input").addEventListener("input", (e) => {
  publishedState.searchTerm = e.target.value;
  renderPublishedResults();
});

function publishedMatchesFilters(pattern) {
  if (publishedState.searchTerm) {
    const haystack = (pattern.short_description + " " + pattern.author_name + " " + pattern.tags.map((t) => t.display_name).join(" ")).toLowerCase();
    if (!haystack.includes(publishedState.searchTerm.toLowerCase())) return false;
  }
  const selected = [...publishedState.selectedTechnique, ...publishedState.selectedProduct];
  if (selected.length > 0) {
    const patternTagIds = new Set(pattern.tags.map((t) => t.id));
    const matchesAny = selected.some((tagId) => patternTagIds.has(tagId));
    if (!matchesAny) return false;
  }
  return true;
}

function renderPublishedResults() {
  const list = document.getElementById("published-list");
  const countEl = document.getElementById("published-count");
  const filtered = publishedState.patterns.filter(publishedMatchesFilters);
  countEl.textContent = `${filtered.length} patrón${filtered.length === 1 ? "" : "es"}`;
  list.innerHTML = "";

  if (filtered.length === 0) {
    list.innerHTML = `<p class="empty-state">No hay patrones publicados con esos filtros.</p>`;
    return;
  }

  const tecnicaTags = publishedState.allTags.filter((t) => t.category === "tecnica");
  const productoTags = publishedState.allTags.filter((t) => t.category === "producto");

  filtered.forEach((pattern) => {
    const card = document.createElement("div");
    card.className = "card moderation-card";
    const coverUrl = pattern.cover_image_path ? publicFileUrl(pattern.cover_image_path) : "assets/img/placeholder-cover.svg";

    card.innerHTML = `
      <div style="display:flex; gap:14px;">
        <img class="published-cover-thumb" src="${coverUrl}" alt="" style="width:80px; height:80px; object-fit:cover; border-radius:8px; flex-shrink:0;">
        <div style="flex:1;">
          <h3 style="margin:0 0 4px;">${escapeHtml(pattern.short_description)}</h3>
          <div class="meta">Por ${escapeHtml(pattern.author_name)}</div>
          <div class="tags">${pattern.tags.map((t) => `<span class="tag-chip ${t.category === "tecnica" ? "tecnica" : ""}">${escapeHtml(t.display_name)}</span>`).join("")}</div>
        </div>
      </div>
      <div class="edit-panel" hidden style="margin-top:14px;">
        <div class="field">
          <label>Descripción breve</label>
          <input type="text" class="edit-short">
        </div>
        <div class="field">
          <label>Descripción larga</label>
          <textarea class="edit-long"></textarea>
        </div>
        <div class="meta"><strong>Técnica</strong></div>
        <div class="tag-editor edit-tecnica"></div>
        <div style="display:flex; gap:6px; margin-top:6px;">
          <input type="text" class="new-tecnica-input" placeholder="Crear técnica nueva..." style="flex:1;">
          <button type="button" class="btn btn-outline new-tecnica-add">Añadir</button>
        </div>
        <div class="meta" style="margin-top:8px;"><strong>Producto</strong></div>
        <div class="tag-editor edit-producto"></div>
        <div style="display:flex; gap:6px; margin-top:6px;">
          <input type="text" class="new-producto-input" placeholder="Crear producto nuevo..." style="flex:1;">
          <button type="button" class="btn btn-outline new-producto-add">Añadir</button>
        </div>

        <div class="meta" style="margin-top:14px;"><strong>Portada</strong></div>
        <div class="edit-cover-current" style="display:flex; gap:8px; align-items:center; margin:6px 0;"></div>
        <input type="file" class="edit-cover-file" accept="image/*">

        <div class="meta" style="margin-top:14px;"><strong>Galería</strong></div>
        <div class="edit-gallery-current" style="display:flex; gap:8px; flex-wrap:wrap; margin:6px 0;"></div>
        <input type="file" class="edit-gallery-files" accept="image/*" multiple>
      </div>
      <div class="actions">
        <a class="btn btn-outline" href="patron.html?id=${pattern.id}" target="_blank" rel="noopener">Ver ficha</a>
        <button class="btn btn-secondary" data-action="toggle-edit">Editar</button>
        <button class="btn btn-danger" data-action="delete">Borrar</button>
      </div>
    `;

    makeImageZoomable(card.querySelector(".published-cover-thumb"));

    const editPanel = card.querySelector(".edit-panel");
    const linkedIds = new Set(pattern.tags.map((t) => t.id));
    renderTagCheckboxes(card.querySelector(".edit-tecnica"), tecnicaTags, linkedIds);
    renderTagCheckboxes(card.querySelector(".edit-producto"), productoTags, linkedIds);

    async function addNewTag(category, input, tagList, container) {
      const displayName = input.value.trim();
      if (!displayName) return;
      try {
        const { id, displayName: cleanName } = await callFunction(
          "moderate-pattern",
          { action: "create_tag", patternId: pattern.id, category, displayName },
          true
        );
        if (!tagList.some((t) => t.id === id)) {
          tagList.push({ id, category, display_name: cleanName });
          tagList.sort((a, b) => a.display_name.localeCompare(b.display_name));
        }
        linkedIds.add(id);
        renderTagCheckboxes(container, tagList, linkedIds);
        input.value = "";
      } catch (err) {
        alert("Error al crear la etiqueta: " + err.message);
      }
    }

    card.querySelector(".new-tecnica-add").addEventListener("click", () =>
      addNewTag("tecnica", card.querySelector(".new-tecnica-input"), tecnicaTags, card.querySelector(".edit-tecnica"))
    );
    card.querySelector(".new-producto-add").addEventListener("click", () =>
      addNewTag("producto", card.querySelector(".new-producto-input"), productoTags, card.querySelector(".edit-producto"))
    );

    let removeCoverImage = false;
    let removeGalleryPaths = [];

    function renderEditCover() {
      const container = card.querySelector(".edit-cover-current");
      container.innerHTML = "";
      if (!pattern.cover_image_path || removeCoverImage) return;
      const img = document.createElement("img");
      img.src = publicFileUrl(pattern.cover_image_path);
      img.style.cssText = "width:70px; height:70px; object-fit:cover; border-radius:8px;";
      makeImageZoomable(img);
      const removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.className = "btn btn-outline";
      removeBtn.textContent = "Quitar portada";
      removeBtn.addEventListener("click", () => {
        removeCoverImage = true;
        renderEditCover();
      });
      container.appendChild(img);
      container.appendChild(removeBtn);
    }

    function renderEditGallery() {
      const container = card.querySelector(".edit-gallery-current");
      container.innerHTML = "";
      (pattern.gallery_paths || [])
        .filter((p) => !removeGalleryPaths.includes(p))
        .forEach((path) => {
          const wrap = document.createElement("div");
          wrap.style.cssText = "position:relative;";
          const img = document.createElement("img");
          img.src = publicFileUrl(path);
          img.style.cssText = "width:70px; height:70px; object-fit:cover; border-radius:8px;";
          makeImageZoomable(img);
          const removeBtn = document.createElement("button");
          removeBtn.type = "button";
          removeBtn.textContent = "×";
          removeBtn.setAttribute("aria-label", "Quitar foto");
          removeBtn.style.cssText =
            "position:absolute; top:-6px; right:-6px; background:var(--color-danger); color:#fff; border:none; border-radius:50%; width:22px; height:22px; cursor:pointer;";
          removeBtn.addEventListener("click", () => {
            removeGalleryPaths.push(path);
            renderEditGallery();
          });
          wrap.appendChild(img);
          wrap.appendChild(removeBtn);
          container.appendChild(wrap);
        });
    }

    card.querySelector('[data-action="toggle-edit"]').addEventListener("click", () => {
      if (editPanel.hidden) {
        card.querySelector(".edit-short").value = pattern.short_description;
        card.querySelector(".edit-long").value = pattern.long_description || "";
        removeCoverImage = false;
        removeGalleryPaths = [];
        renderEditCover();
        renderEditGallery();
        editPanel.hidden = false;
        card.querySelector('[data-action="toggle-edit"]').insertAdjacentHTML("afterend", '<button class="btn btn-success" data-action="save">Guardar</button>');
        card.querySelector('[data-action="save"]').addEventListener("click", async (e) => {
          const saveBtn = e.target;
          saveBtn.disabled = true;
          saveBtn.textContent = "Guardando...";
          try {
            const finalTechniqueTagIds = Array.from(card.querySelectorAll(".edit-tecnica input:checked")).map((el) => el.value);
            const finalProductTagIds = Array.from(card.querySelectorAll(".edit-producto input:checked")).map((el) => el.value);

            const coverFile = card.querySelector(".edit-cover-file").files[0];
            let newCoverPath = null;
            if (coverFile) {
              const webp = await convertImageToWebp(coverFile);
              newCoverPath = await uploadAdminImage(webp, pattern.id);
            }

            const galleryFiles = Array.from(card.querySelector(".edit-gallery-files").files);
            const newGalleryPaths = [];
            for (const file of galleryFiles) {
              const webp = await convertImageToWebp(file);
              newGalleryPaths.push(await uploadAdminImage(webp, pattern.id));
            }

            await callFunction(
              "moderate-pattern",
              {
                action: "update",
                patternId: pattern.id,
                shortDescription: card.querySelector(".edit-short").value.trim(),
                longDescription: card.querySelector(".edit-long").value.trim(),
                finalTechniqueTagIds,
                finalProductTagIds,
                removeCoverImage,
                newCoverPath,
                removeGalleryPaths,
                newGalleryPaths,
              },
              true
            );
            publishedState.loaded = false;
            await loadPublished();
          } catch (err) {
            alert("Error al guardar: " + err.message);
            saveBtn.disabled = false;
            saveBtn.textContent = "Guardar";
          }
        });
      } else {
        editPanel.hidden = true;
      }
    });

    card.querySelector('[data-action="delete"]').addEventListener("click", async () => {
      if (!confirm(`¿Borrar definitivamente "${pattern.short_description}"? Esto no se puede deshacer.`)) return;
      try {
        await callFunction("moderate-pattern", { action: "delete", patternId: pattern.id }, true);
        publishedState.loaded = false;
        await loadPublished();
      } catch (err) {
        alert("Error al borrar: " + err.message);
      }
    });

    list.appendChild(card);
  });
}

checkSession();
