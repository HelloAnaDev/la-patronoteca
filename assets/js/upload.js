const selectedTechniqueTags = new Set();
const selectedProductTags = new Set();

// Galería: array ordenado de { id, file, previewUrl }. El orden del array ES
// el orden final de las fotos.
let galleryItems = [];

// ---------- Entrada de etiquetas nuevas en forma de "chips" ----------
// Al escribir y pulsar coma o Enter, la palabra se convierte en un recuadro
// con una X para poder borrarla. Devuelve { getTags() }.
function setupTagChipInput(inputId, chipsContainerId, maxTags) {
  const input = document.getElementById(inputId);
  const chipsContainer = document.getElementById(chipsContainerId);
  let tags = [];

  function render() {
    chipsContainer.innerHTML = "";
    tags.forEach((tag, i) => {
      const chip = document.createElement("span");
      chip.className = "tag-chip-editable";
      const label = document.createElement("span");
      label.textContent = tag;
      const removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.textContent = "×";
      removeBtn.setAttribute("aria-label", "Quitar etiqueta");
      removeBtn.addEventListener("click", () => {
        tags.splice(i, 1);
        render();
      });
      chip.appendChild(label);
      chip.appendChild(removeBtn);
      chipsContainer.appendChild(chip);
    });
    const full = tags.length >= maxTags;
    input.style.display = full ? "none" : "";
  }

  function addTag(value) {
    const clean = value.trim();
    if (clean && tags.length < maxTags) tags.push(clean);
  }

  // Usamos el evento "input" (en vez de solo keydown) para detectar la coma:
  // así funciona sin importar cómo se escriba (teclado, pegar, móvil...).
  input.addEventListener("input", () => {
    if (input.value.includes(",")) {
      const parts = input.value.split(",");
      const last = parts.pop();
      parts.forEach(addTag);
      input.value = last;
      render();
    }
  });

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addTag(input.value);
      input.value = "";
      render();
    }
  });
  input.addEventListener("blur", () => {
    if (input.value.trim()) {
      addTag(input.value);
      input.value = "";
      render();
    }
  });

  return {
    getTags: () => tags,
    reset: () => {
      tags = [];
      render();
    },
  };
}

const newTechniqueChipInput = setupTagChipInput("new-technique-input", "new-technique-chips", 1);
const newProductChipInput = setupTagChipInput("new-tag-input", "new-product-chips", 3);

async function loadTagOptions() {
  const { data, error } = await supabaseClient
    .from("tags")
    .select("id, category, display_name")
    .eq("status", "approved")
    .order("display_name");
  if (error) {
    console.error(error);
    return;
  }
  renderTagOptions("tecnica-options", data.filter((t) => t.category === "tecnica"), selectedTechniqueTags, { singleSelect: true });
  renderTagOptions("producto-options", data.filter((t) => t.category === "producto"), selectedProductTags, { singleSelect: false });
}

// Técnica: solo se puede elegir una (un patrón usa una técnica principal).
// Producto: se pueden marcar varias.
function renderTagOptions(containerId, tags, selectedSet, { singleSelect = false } = {}) {
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
        if (singleSelect) {
          selectedSet.clear();
          container.querySelectorAll(".chip-toggle.active").forEach((b) => b.classList.remove("active"));
        }
        selectedSet.add(tag.id);
        btn.classList.add("active");
      }
    });
    container.appendChild(btn);
  });
}

function showMessage(text, type = "info") {
  const el = document.getElementById("form-message");
  el.innerHTML = `<div class="notice ${type}">${text}</div>`;
}

async function uploadToPending(file, prefix) {
  const path = `${prefix}/${randomFileName(file.name)}`;
  const { error } = await supabaseClient.storage.from("pending-uploads").upload(path, file);
  if (error) throw error;
  return path;
}

// ---------- Widget de galería (cuadrado con "+", previsualización y orden) ----------

function renderGalleryWidget() {
  const widget = document.getElementById("gallery-widget");
  widget.innerHTML = "";

  galleryItems.forEach((item, index) => {
    const cell = document.createElement("div");
    cell.className = "gallery-item";
    cell.draggable = true;
    cell.dataset.id = item.id;

    const img = document.createElement("img");
    img.src = item.previewUrl;
    cell.appendChild(img);

    const orderInput = document.createElement("input");
    orderInput.type = "number";
    orderInput.className = "order-input";
    orderInput.min = "1";
    orderInput.max = String(galleryItems.length);
    orderInput.value = String(index + 1);
    orderInput.addEventListener("change", () => {
      const newPos = Math.min(Math.max(parseInt(orderInput.value, 10) || 1, 1), galleryItems.length) - 1;
      moveGalleryItem(item.id, newPos);
    });
    cell.appendChild(orderInput);

    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "remove-btn";
    removeBtn.textContent = "×";
    removeBtn.addEventListener("click", () => removeGalleryItem(item.id));
    cell.appendChild(removeBtn);

    cell.addEventListener("dragstart", () => {
      cell.classList.add("dragging");
      cell.dataset.dragging = "1";
    });
    cell.addEventListener("dragend", () => cell.classList.remove("dragging"));
    cell.addEventListener("dragover", (e) => e.preventDefault());
    cell.addEventListener("drop", (e) => {
      e.preventDefault();
      const draggedId = document.querySelector(".gallery-item.dragging")?.dataset.id;
      if (draggedId && draggedId !== item.id) {
        moveGalleryItem(draggedId, index);
      }
    });

    widget.appendChild(cell);
  });

  const addCell = document.createElement("div");
  addCell.className = "gallery-add";
  addCell.textContent = "+";
  addCell.title = "Añadir fotos";
  addCell.addEventListener("click", () => document.getElementById("gallery-file-input").click());
  widget.appendChild(addCell);
}

function moveGalleryItem(id, newIndex) {
  const currentIndex = galleryItems.findIndex((it) => it.id === id);
  if (currentIndex === -1) return;
  const [item] = galleryItems.splice(currentIndex, 1);
  galleryItems.splice(newIndex, 0, item);
  renderGalleryWidget();
}

function removeGalleryItem(id) {
  const item = galleryItems.find((it) => it.id === id);
  if (item) URL.revokeObjectURL(item.previewUrl);
  galleryItems = galleryItems.filter((it) => it.id !== id);
  renderGalleryWidget();
}

document.getElementById("gallery-file-input").addEventListener("change", async (e) => {
  const files = Array.from(e.target.files);
  for (const file of files) {
    const webp = await convertImageToWebp(file);
    galleryItems.push({ id: crypto.randomUUID(), file: webp, previewUrl: URL.createObjectURL(webp) });
  }
  e.target.value = "";
  renderGalleryWidget();
});

// Si la primera foto que sube en "Patrón" es una imagen, se enseña como
// referencia junto al campo de portada (por si le sirve tal cual).
document.getElementById("pattern-files").addEventListener("change", (e) => {
  const firstImage = Array.from(e.target.files).find((f) => f.type.startsWith("image/"));
  const suggestion = document.getElementById("cover-suggestion");
  if (!firstImage) {
    suggestion.hidden = true;
    return;
  }
  document.getElementById("cover-suggestion-img").src = URL.createObjectURL(firstImage);
  suggestion.hidden = false;
});

renderGalleryWidget();

// ---------- Envío del formulario ----------

// Además de desactivar el botón, guardamos si ya hay un envío en marcha:
// así, aunque el "submit" se dispare más de una vez seguida (doble clic,
// tecla Enter repetida...), solo se procesa una vez.
let isSubmitting = false;

document.getElementById("upload-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (isSubmitting) return;
  isSubmitting = true;
  const submitBtn = document.getElementById("submit-btn");
  submitBtn.disabled = true;
  showMessage("Subiendo tu patrón, un momento...", "info");

  try {
    const authorName = document.getElementById("author-name").value.trim();
    const authorEmail = document.getElementById("author-email").value.trim();
    const notifyOnComment = document.getElementById("notify-on-comment").checked;
    const shortDescription = document.getElementById("short-description").value.trim();
    const longDescription = document.getElementById("long-description").value.trim();
    const originalSource = document.getElementById("original-source").value.trim();
    const patternFiles = Array.from(document.getElementById("pattern-files").files);
    const coverFile = document.getElementById("cover-file").files[0];
    const newTagNames = newProductChipInput.getTags();
    const newTechniqueTagName = newTechniqueChipInput.getTags()[0];

    if (!patternFiles.length) throw new Error("Falta el patrón (PDF o imágenes).");

    const totalTags = selectedTechniqueTags.size + selectedProductTags.size + newTagNames.length + (newTechniqueTagName ? 1 : 0);
    if (totalTags === 0) throw new Error("Elige o sugiere al menos una etiqueta (técnica o producto).");

    const sessionId = crypto.randomUUID();

    // Subimos todos los archivos a la vez (en paralelo) en vez de uno a uno,
    // para que el tiempo total sea el del archivo más lento, no la suma de todos.
    const [patternPaths, coverPath, galleryPaths] = await Promise.all([
      Promise.all(
        patternFiles.map(async (file) => {
          const toUpload = file.type.startsWith("image/") ? await convertImageToWebp(file) : file;
          return uploadToPending(toUpload, sessionId);
        })
      ),
      coverFile
        ? convertImageToWebp(coverFile).then((webpCover) => uploadToPending(webpCover, sessionId))
        : Promise.resolve(null),
      Promise.all(galleryItems.map((item) => uploadToPending(item.file, sessionId))),
    ]);

    await callFunction("submit-pattern", {
      authorName,
      authorEmail,
      notifyOnComment,
      shortDescription,
      longDescription,
      originalSource: originalSource || undefined,
      patternPaths,
      coverImagePath: coverPath,
      galleryPaths,
      techniqueTagIds: Array.from(selectedTechniqueTags),
      productTagIds: Array.from(selectedProductTags),
      newProductTagNames: newTagNames.length ? newTagNames : undefined,
      newTechniqueTagName: newTechniqueTagName || undefined,
    });

    showMessage("¡Gracias! Tu patrón se ha enviado y está pendiente de revisión. Te avisaremos por email en cuanto se publique.", "success");
    document.getElementById("upload-form").reset();
    selectedTechniqueTags.clear();
    selectedProductTags.clear();
    newProductChipInput.reset();
    newTechniqueChipInput.reset();
    galleryItems = [];
    renderGalleryWidget();
    document.querySelectorAll(".chip-toggle.active").forEach((b) => b.classList.remove("active"));
  } catch (err) {
    console.error(err);
    showMessage("Ha ocurrido un error al enviar tu patrón: " + err.message, "danger");
  } finally {
    submitBtn.disabled = false;
    isSubmitting = false;
  }
});

loadTagOptions();
