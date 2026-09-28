// Añade a la barra de navegación el acceso a "Mi cuenta" (email + contraseña),
// usada solo para guardar favoritos. Funciona en cualquier página.
(function () {
  const nav = document.querySelector(".main-nav");
  if (!nav || window.PATRONOTECA_DEMO) return;

  const link = document.createElement("a");
  link.href = "#";
  link.dataset.accountLink = "1";
  link.textContent = "Mi cuenta";
  nav.appendChild(link);

  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.hidden = true;
  overlay.innerHTML = `
    <div class="modal-box">
      <button type="button" class="modal-close" aria-label="Cerrar">×</button>
      <div id="account-logged-out">
        <h3 style="margin-top:0;">Mi cuenta</h3>
        <p class="hint">Con una cuenta puedes guardar patrones en tus favoritos y verlos cuando quieras, aunque si solo quieres imprimir los pdf puedes hacerlo sin registrarte.<br>No mandamos publicidad.</p>
        <form id="account-form" class="stack">
          <div class="field">
            <label for="account-email">Email</label>
            <input type="email" id="account-email" required>
          </div>
          <div class="field">
            <label for="account-password">Contraseña</label>
            <input type="password" id="account-password" required minlength="6">
          </div>
          <div id="account-message"></div>
          <div style="display:flex; gap:10px; flex-wrap:wrap;">
            <button type="submit" class="btn btn-primary" data-mode="signin">Iniciar sesión</button>
            <button type="submit" class="btn btn-outline" data-mode="signup">Crear cuenta</button>
          </div>
        </form>
      </div>
      <div id="account-logged-in" hidden>
        <h3 style="margin-top:0;">Mi cuenta</h3>
        <p id="account-current-email"></p>
        <a href="guardados.html" class="btn btn-outline">Ver mis favoritos</a>
        <button type="button" id="account-logout" class="btn btn-outline" style="margin-top:10px;">Cerrar sesión</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  const form = overlay.querySelector("#account-form");
  const messageEl = overlay.querySelector("#account-message");
  let pendingMode = "signin";

  function showMessage(text, type = "info") {
    messageEl.innerHTML = text ? `<div class="notice ${type}">${text}</div>` : "";
  }

  async function refreshState() {
    const user = await getCurrentUser();
    const loggedOut = overlay.querySelector("#account-logged-out");
    const loggedIn = overlay.querySelector("#account-logged-in");
    if (user) {
      loggedOut.hidden = true;
      loggedIn.hidden = false;
      overlay.querySelector("#account-current-email").textContent = "Sesión iniciada como " + user.email;
      link.textContent = "Mi cuenta";
    } else {
      loggedOut.hidden = false;
      loggedIn.hidden = true;
    }
    document.dispatchEvent(new CustomEvent("patronoteca:account-changed", { detail: { user } }));
  }

  function openModal() {
    showMessage("");
    overlay.hidden = false;
  }
  function closeModal() {
    overlay.hidden = true;
  }

  link.addEventListener("click", (e) => {
    e.preventDefault();
    refreshState();
    openModal();
  });
  overlay.querySelector(".modal-close").addEventListener("click", closeModal);
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) closeModal();
  });

  form.querySelectorAll("button[type=submit]").forEach((btn) => {
    btn.addEventListener("click", () => {
      pendingMode = btn.dataset.mode;
    });
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("account-email").value.trim();
    const password = document.getElementById("account-password").value;
    showMessage("Un momento...", "info");
    try {
      if (pendingMode === "signup") {
        await signUp(email, password);
        showMessage("¡Cuenta creada! Sesión iniciada.", "success");
      } else {
        await signIn(email, password);
        showMessage("Sesión iniciada.", "success");
      }
      form.reset();
      await refreshState();
      setTimeout(closeModal, 700);
    } catch (err) {
      showMessage(err.message, "danger");
    }
  });

  overlay.querySelector("#account-logout").addEventListener("click", async () => {
    await signOutUser();
    await refreshState();
    closeModal();
  });

  window.patronotecaOpenAccountModal = openModal;

  refreshState();
})();
