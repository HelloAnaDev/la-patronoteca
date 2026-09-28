function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}

async function loadSaved() {
  const grid = document.getElementById("saved-grid");
  const empty = document.getElementById("saved-empty");
  const loggedOutNotice = document.getElementById("saved-logged-out");
  const countEl = document.getElementById("saved-count");

  const user = await getCurrentUser();
  if (!user) {
    loggedOutNotice.hidden = false;
    empty.hidden = true;
    grid.innerHTML = "";
    countEl.textContent = "";
    return;
  }
  loggedOutNotice.hidden = true;

  let patterns = [];
  try {
    const res = await callFunction("list-favorites", {}, true);
    patterns = res.patterns || [];
  } catch (err) {
    console.error(err);
  }

  if (patterns.length === 0) {
    countEl.textContent = "0 patrones guardados";
    empty.hidden = false;
    grid.innerHTML = "";
    return;
  }

  countEl.textContent = `${patterns.length} patrón${patterns.length === 1 ? "" : "es"} guardado${patterns.length === 1 ? "" : "s"}`;
  empty.hidden = true;
  grid.innerHTML = "";

  patterns.forEach((pattern) => {
    const card = document.createElement("div");
    card.className = "card pattern-card";

    const coverUrl = pattern.cover_image_path ? publicFileUrl(pattern.cover_image_path) : "assets/img/placeholder-cover.svg";

    card.innerHTML = `
      <a href="patron.html?id=${pattern.id}" style="display:block;">
        <div class="cover"><img src="${coverUrl}" alt="${escapeHtml(pattern.short_description)}"></div>
      </a>
      <div class="body">
        <h3><a href="patron.html?id=${pattern.id}" style="color:inherit;">${escapeHtml(pattern.short_description)}</a></h3>
        <div class="author">Por ${escapeHtml(pattern.author_name)}</div>
        <div class="actions" style="margin-top:8px;">
          <button class="btn btn-outline" data-action="unsave">Quitar de favoritos</button>
        </div>
      </div>
    `;

    card.querySelector('[data-action="unsave"]').addEventListener("click", async () => {
      await toggleHeart(pattern.id);
      loadSaved();
    });

    grid.appendChild(card);
  });
}

document.getElementById("saved-open-account").addEventListener("click", (e) => {
  e.preventDefault();
  if (window.patronotecaOpenAccountModal) window.patronotecaOpenAccountModal();
});

document.addEventListener("patronoteca:account-changed", loadSaved);
loadSaved();
