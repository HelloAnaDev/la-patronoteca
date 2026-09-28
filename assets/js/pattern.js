function heartIconSvg(filled) {
  return `<svg width="16" height="16" viewBox="0 0 24 24" style="vertical-align:-3px;" fill="${
    filled ? "#c1502e" : "none"
  }" stroke="#c1502e" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"><path d="M12 20.5s-7.5-4.6-10-9.1C.5 8.2 1.8 4.5 5.4 3.6c2.1-.5 4 .4 5 2 .9-1.6 2.9-2.5 5-2 3.6.9 4.9 4.6 3.4 7.8-2.5 4.5-10 9.1-10 9.1z"/></svg>`;
}

let lightboxImages = [];
let lightboxIndex = 0;

function showLightbox(index) {
  lightboxIndex = (index + lightboxImages.length) % lightboxImages.length;
  document.getElementById("lightbox-image").src = lightboxImages[lightboxIndex];
  document.getElementById("lightbox-count").textContent = `${lightboxIndex + 1} / ${lightboxImages.length}`;
  const multiple = lightboxImages.length > 1;
  document.getElementById("lightbox-prev").hidden = !multiple;
  document.getElementById("lightbox-next").hidden = !multiple;
  document.getElementById("lightbox-overlay").hidden = false;
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}

function getPatternId() {
  return new URLSearchParams(window.location.search).get("id");
}

async function refreshHeartState(patternId) {
  const user = await getCurrentUser();
  if (!user) return;
  try {
    const { patterns } = await callFunction("list-favorites", {}, true);
    const favorited = (patterns || []).some((p) => p.id === patternId);
    if (!favorited) return;
    const countEl = document.getElementById("hearts-count");
    const count = parseInt(countEl?.textContent, 10) || 0;
    const btn = document.getElementById("heart-btn");
    if (btn) btn.innerHTML = `${heartIconSvg(true)} <span id="heart-label">Guardado</span> (<span id="hearts-count">${count}</span>)`;
  } catch {
    /* sin sesión válida: se queda como "no guardado" */
  }
}

async function loadPattern() {
  const container = document.getElementById("pattern-container");
  const id = getPatternId();
  if (!id) {
    container.innerHTML = `<p class="notice danger">No se ha indicado ningún patrón.</p>`;
    return;
  }

  const { data: pattern, error } = await supabaseClient
    .from("patterns")
    .select("*, pattern_tags(tags(id, category, display_name))")
    .eq("id", id)
    .eq("status", "approved")
    .maybeSingle();

  if (error || !pattern) {
    container.innerHTML = `<p class="notice danger">Este patrón no existe o todavía no está publicado.</p>`;
    return;
  }

  const tags = (pattern.pattern_tags || []).map((pt) => pt.tags).filter(Boolean);
  const coverUrl = pattern.cover_image_path ? publicFileUrl(pattern.cover_image_path) : "assets/img/placeholder-cover.svg";
  const patternFilesHtml = pattern.pattern_paths
    .map((path, i) => {
      const url = publicFileUrl(path);
      const isImage = /\.(png|jpe?g|webp|gif)$/i.test(path);
      return isImage
        ? `<a href="${url}" target="_blank" rel="noopener" class="card" style="display:inline-block; width:110px; margin:0 8px 8px 0;"><img src="${url}" alt="Página ${i + 1} del patrón" style="aspect-ratio:1; object-fit:cover; border-radius:8px;"></a>`
        : `<a href="${url}" target="_blank" rel="noopener" class="btn btn-primary" style="margin:0 8px 8px 0;">Descargar archivo ${i + 1} (PDF)</a>`;
    })
    .join("");

  const pageUrl = window.location.href;
  const waText = encodeURIComponent(`Mira este patrón gratis en La Patronoteca: "${pattern.short_description}" ${pageUrl}`);

  container.innerHTML = `
    <a href="#" id="back-link" class="btn btn-outline no-print" style="margin-bottom:16px;">Volver</a>
    <div class="detail-layout">
      <div class="no-print">
        <div class="cover card" style="aspect-ratio:4/3; overflow:hidden; cursor:zoom-in;" data-lightbox-index="0">
          <img src="${coverUrl}" alt="${escapeHtml(pattern.short_description)}" style="width:100%;height:100%;object-fit:cover;">
        </div>
        ${
          pattern.gallery_paths && pattern.gallery_paths.length
            ? `<div class="gallery-grid">${pattern.gallery_paths
                .map((p, i) => `<img src="${publicFileUrl(p)}" alt="Foto del patrón" style="cursor:zoom-in;" data-lightbox-index="${i + 1}">`)
                .join("")}</div>`
            : ""
        }
      </div>

      <div id="lightbox-overlay" class="modal-overlay" hidden>
        <div class="modal-box" style="max-width:90vw; padding:16px; text-align:center;">
          <button type="button" id="lightbox-close" class="modal-close" aria-label="Cerrar">×</button>
          <img id="lightbox-image" src="" alt="" style="max-width:100%; max-height:75vh; border-radius:8px; margin:0 auto;">
          <div class="actions" style="justify-content:center; margin-top:12px;">
            <button type="button" class="btn btn-outline" id="lightbox-prev">← Anterior</button>
            <span id="lightbox-count" class="meta" style="align-self:center;"></span>
            <button type="button" class="btn btn-outline" id="lightbox-next">Siguiente →</button>
          </div>
        </div>
      </div>
      <div>
        <h1>${escapeHtml(pattern.short_description)}</h1>
        <p class="author">Compartido por ${escapeHtml(pattern.author_name)}</p>
        <div class="tags">${tags
          .map((t) => `<span class="tag-chip ${t.category === "tecnica" ? "tecnica" : ""}">${escapeHtml(t.display_name)}</span>`)
          .join("")}</div>
        ${pattern.long_description ? `<p>${escapeHtml(pattern.long_description).replace(/\n/g, "<br>")}</p>` : ""}
        ${
          pattern.original_source
            ? `<p style="font-size:0.8rem; color:var(--color-text-soft);"><strong>Fuente original:</strong> ${escapeHtml(pattern.original_source)}</p>`
            : ""
        }

        <div class="actions no-print" style="margin:14px 0;">
          <button class="btn btn-outline" id="heart-btn" aria-label="Guardar y marcar como favorito">${heartIconSvg(false)} <span id="heart-label">Guardar</span> (<span id="hearts-count">${pattern.hearts_count || 0}</span>)</button>
        </div>

        <div class="no-print" style="margin-bottom:18px;">
          <div style="font-size:0.78rem; font-weight:700; text-transform:uppercase; letter-spacing:0.04em; color:var(--color-text-soft); margin-bottom:6px;">Compartir</div>
          <div style="display:flex; gap:18px; flex-wrap:wrap; font-size:0.92rem;">
            <a href="https://wa.me/?text=${waText}" target="_blank" rel="noopener" style="text-decoration:underline;">WhatsApp</a>
            <button type="button" id="copy-link-btn" style="background:none; border:none; padding:0; color:var(--color-primary); text-decoration:underline; cursor:pointer; font-size:inherit; font-family:inherit;">Copiar enlace</button>
          </div>
          <div id="copy-link-result"></div>
        </div>

        <h3 style="margin-top:20px;">Aquí debajo tienes los archivos del patrón</h3>
        <div style="display:flex; flex-wrap:wrap;">${patternFilesHtml}</div>

        ${pattern.ai_disclosed ? renderAiDisclosure(pattern.id) : ""}

        <div class="card no-print" style="margin-top:20px; padding:16px;">
          <p style="margin:0 0 8px;"><strong>¿Has hecho este patrón?</strong> Cuéntanos qué tal fue si ya realizaste este proyecto.</p>
          <div class="actions">
            <button class="btn btn-outline" id="rate-good-btn">😊 Buena experiencia (<span id="good-count">${pattern.good_experience_count || 0}</span>)</button>
            <button class="btn btn-outline" id="rate-bad-btn">😞 No tan buena (<span id="bad-count">${pattern.bad_experience_count || 0}</span>)</button>
          </div>
          <div id="rate-result"></div>
        </div>
      </div>
    </div>

    <section class="no-print" style="margin-top:32px;">
      <h2>Comentarios</h2>
      <div id="comments-list"></div>
      <form id="comment-form" class="stack" style="max-width:480px; margin-top:14px;">
        <div class="field">
          <label for="comment-alias">Tu nombre o apodo</label>
          <input type="text" id="comment-alias" required maxlength="60">
        </div>
        <div class="field">
          <label for="comment-message">Comentario</label>
          <textarea id="comment-message" required maxlength="1000"></textarea>
        </div>
        <div class="field">
          <label for="comment-image">Foto (opcional)</label>
          <input type="file" id="comment-image" accept="image/*">
        </div>
        <div id="comment-message-result"></div>
        <button type="submit" class="btn btn-primary" style="width:fit-content;">Enviar comentario</button>
        <span class="hint">Tu comentario se revisará antes de publicarse.</span>
      </form>
    </section>
  `;

  document.getElementById("back-link").addEventListener("click", (e) => {
    e.preventDefault();
    if (document.referrer && document.referrer.includes(window.location.origin)) {
      history.back();
    } else {
      window.location.href = "index.html";
    }
  });

  document.getElementById("heart-btn").addEventListener("click", async () => {
    const user = await getCurrentUser();
    if (!user) {
      if (window.patronotecaOpenAccountModal) window.patronotecaOpenAccountModal();
      return;
    }
    try {
      const nowFavorite = await toggleHeart(pattern.id);
      const countEl = document.getElementById("hearts-count");
      let count = parseInt(countEl.textContent, 10) || 0;
      count += nowFavorite ? 1 : -1;
      count = Math.max(0, count);
      const btn = document.getElementById("heart-btn");
      btn.innerHTML = `${heartIconSvg(nowFavorite)} <span id="heart-label">${nowFavorite ? "Guardado" : "Guardar"}</span> (<span id="hearts-count">${count}</span>)`;
    } catch (err) {
      if (window.patronotecaOpenAccountModal) window.patronotecaOpenAccountModal();
    }
  });

  refreshHeartState(pattern.id);

  document.getElementById("copy-link-btn").addEventListener("click", async () => {
    const resultEl = document.getElementById("copy-link-result");
    try {
      await navigator.clipboard.writeText(pageUrl);
      resultEl.innerHTML = `<div class="notice success" style="margin-top:6px;">Enlace copiado. Puedes pegarlo donde quieras (Instagram, etc.).</div>`;
    } catch {
      resultEl.innerHTML = `<div class="notice info" style="margin-top:6px;">Copia este enlace: ${pageUrl}</div>`;
    }
  });

  // ---------- Ver fotos en grande, de una en una ----------
  lightboxImages = [coverUrl, ...(pattern.gallery_paths || []).map(publicFileUrl)];

  document.querySelectorAll("[data-lightbox-index]").forEach((el) => {
    el.addEventListener("click", () => {
      lightboxImages = [coverUrl, ...(pattern.gallery_paths || []).map(publicFileUrl)];
      showLightbox(Number(el.dataset.lightboxIndex));
    });
  });
  document.getElementById("lightbox-close").addEventListener("click", () => {
    document.getElementById("lightbox-overlay").hidden = true;
  });
  document.getElementById("lightbox-overlay").addEventListener("click", (e) => {
    if (e.target.id === "lightbox-overlay") e.target.hidden = true;
  });
  document.getElementById("lightbox-prev").addEventListener("click", () => showLightbox(lightboxIndex - 1));
  document.getElementById("lightbox-next").addEventListener("click", () => showLightbox(lightboxIndex + 1));

  document.getElementById("rate-good-btn").addEventListener("click", () => submitExperience(pattern.id, "good"));
  document.getElementById("rate-bad-btn").addEventListener("click", () => submitExperience(pattern.id, "bad"));

  document.getElementById("comment-form").addEventListener("submit", onCommentSubmit);
  loadComments(pattern.id);

  if (pattern.ai_disclosed) {
    document.getElementById("open-report-modal").addEventListener("click", (e) => {
      e.preventDefault();
      document.getElementById("report-modal-overlay").hidden = false;
    });
    document.getElementById("close-report-modal").addEventListener("click", () => {
      document.getElementById("report-modal-overlay").hidden = true;
    });
    document.getElementById("report-modal-overlay").addEventListener("click", (e) => {
      if (e.target.id === "report-modal-overlay") e.target.hidden = true;
    });
    document.getElementById("report-form").addEventListener("submit", onReportSubmit);
  }
}

async function submitExperience(patternId, rating) {
  const resultEl = document.getElementById("rate-result");
  const goodEl = document.getElementById("good-count");
  const badEl = document.getElementById("bad-count");
  try {
    const { result } = await callFunction("rate-pattern-experience", { patternId, rating });
    let good = parseInt(goodEl.textContent, 10) || 0;
    let bad = parseInt(badEl.textContent, 10) || 0;

    if (result === "added") {
      if (rating === "good") good += 1;
      else bad += 1;
      resultEl.innerHTML = `<div class="notice success" style="margin-top:8px;">¡Gracias por contarnos tu experiencia!</div>`;
    } else if (result === "removed") {
      if (rating === "good") good = Math.max(0, good - 1);
      else bad = Math.max(0, bad - 1);
      resultEl.innerHTML = `<div class="notice info" style="margin-top:8px;">Se ha quitado tu valoración.</div>`;
    } else if (result === "changed") {
      if (rating === "good") {
        good += 1;
        bad = Math.max(0, bad - 1);
      } else {
        bad += 1;
        good = Math.max(0, good - 1);
      }
      resultEl.innerHTML = `<div class="notice success" style="margin-top:8px;">Valoración actualizada.</div>`;
    }

    goodEl.textContent = good;
    badEl.textContent = bad;
  } catch (err) {
    resultEl.innerHTML = `<div class="notice danger" style="margin-top:8px;">Error: ${err.message}</div>`;
  }
}

async function loadComments(patternId) {
  const list = document.getElementById("comments-list");
  const { data, error } = await supabaseClient
    .from("comments")
    .select("*")
    .eq("pattern_id", patternId)
    .eq("status", "approved")
    .order("created_at", { ascending: false });

  if (error || !data || data.length === 0) {
    list.innerHTML = `<p class="meta">Todavía no hay comentarios. ¡Sé la primera persona!</p>`;
    return;
  }

  const commentImageUrls = data.filter((c) => c.image_path).map((c) => publicFileUrl(c.image_path));
  let imageIndex = 0;

  list.innerHTML = data
    .map((c) => {
      let imageHtml = "";
      if (c.image_path) {
        imageHtml = `<img src="${publicFileUrl(c.image_path)}" alt="Foto del comentario" style="max-width:200px; border-radius:8px; margin-top:8px; cursor:zoom-in;" data-comment-image-index="${imageIndex}">`;
        imageIndex += 1;
      }
      return `
    <div class="card" style="padding:12px 16px; margin-bottom:10px;">
      <div class="meta"><strong>${escapeHtml(c.alias)}</strong> · ${new Date(c.created_at).toLocaleDateString("es-ES")}</div>
      <p style="margin:6px 0 0;">${escapeHtml(c.message)}</p>
      ${imageHtml}
    </div>
  `;
    })
    .join("");

  list.querySelectorAll("[data-comment-image-index]").forEach((img) => {
    img.addEventListener("click", () => {
      lightboxImages = commentImageUrls;
      showLightbox(Number(img.dataset.commentImageIndex));
    });
  });
}

async function onCommentSubmit(e) {
  e.preventDefault();
  const resultEl = document.getElementById("comment-message-result");
  const submitBtn = e.target.querySelector("button[type=submit]");
  submitBtn.disabled = true;

  try {
    const alias = document.getElementById("comment-alias").value.trim();
    const message = document.getElementById("comment-message").value.trim();
    const imageFile = document.getElementById("comment-image").files[0];

    let imagePath = null;
    if (imageFile) {
      const webp = await convertImageToWebp(imageFile);
      imagePath = `comments/${randomFileName(webp.name)}`;
      const { error: uploadError } = await supabaseClient.storage.from("pending-uploads").upload(imagePath, webp);
      if (uploadError) throw uploadError;
    }

    await callFunction("submit-comment", { patternId: getPatternId(), alias, message, imagePath });
    resultEl.innerHTML = `<div class="notice success">¡Gracias! Tu comentario está pendiente de revisión.</div>`;
    e.target.reset();
  } catch (err) {
    resultEl.innerHTML = `<div class="notice danger">No se pudo enviar: ${err.message}</div>`;
  } finally {
    submitBtn.disabled = false;
  }
}

function renderAiDisclosure(patternId) {
  return `
    <p style="margin-top:18px; font-size:0.8rem; color:var(--color-text-soft); line-height:1.5;">
      <strong>Aviso de IA:</strong> este contenido podría tener contenido generado por IA, sin embargo la cuenta de moderación ha considerado que no es engañosa y puede ser constructivo mantenerla. Si no crees que sea así por algún motivo, escríbenos por qué
      <a href="#" id="open-report-modal" style="text-decoration:underline; color:inherit;">aquí</a>.
    </p>

    <div id="report-modal-overlay" class="modal-overlay" hidden>
      <div class="modal-box">
        <button type="button" id="close-report-modal" class="modal-close" aria-label="Cerrar">×</button>
        <h3>Cuéntanos por qué</h3>
        <form id="report-form" style="display:grid; gap:8px; margin-top:8px;">
          <input type="hidden" value="${patternId}">
          <textarea id="report-message" placeholder="Cuéntanos por qué" required></textarea>
          <button type="submit" class="btn btn-secondary">Enviar aviso</button>
          <div id="report-result"></div>
        </form>
      </div>
    </div>
  `;
}

async function onReportSubmit(e) {
  e.preventDefault();
  const resultEl = document.getElementById("report-result");
  const message = document.getElementById("report-message").value.trim();
  try {
    await callFunction("report-content", { patternId: getPatternId(), message });
    resultEl.innerHTML = `<div class="notice success">Gracias, hemos recibido tu aviso.</div>`;
    e.target.reset();
  } catch (err) {
    resultEl.innerHTML = `<div class="notice danger">No se pudo enviar: ${err.message}</div>`;
  }
}

loadPattern();
