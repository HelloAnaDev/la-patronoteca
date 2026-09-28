// Si hay una sesión de moderación activa, añade un enlace "Administración"
// al menú de arriba en cualquier página, para volver rápido al panel.
(async function () {
  try {
    const { data } = await supabaseClient.auth.getSession();
    const session = data.session;
    const adminEmail = (window.PATRONOTECA_CONFIG.ADMIN_EMAIL || "").toLowerCase();
    if (session && session.user.email?.toLowerCase() === adminEmail) {
      const nav = document.querySelector(".main-nav");
      if (nav && !nav.querySelector("[data-admin-link]")) {
        const link = document.createElement("a");
        link.href = "moderacion.html";
        link.textContent = "Administración";
        link.dataset.adminLink = "1";
        if (window.location.pathname.endsWith("moderacion.html")) {
          link.classList.add("active");
        }
        nav.appendChild(link);
      }
    }
  } catch {
    /* sin sesión o error de red: no mostramos el enlace, sin más */
  }
})();
