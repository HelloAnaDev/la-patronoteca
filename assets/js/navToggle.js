// Menú hamburguesa para móvil: en pantallas estrechas el menú se oculta y
// se abre/cierra con un botón, en vez de amontonarse en varias líneas.
(function () {
  const nav = document.querySelector(".main-nav");
  const container = document.querySelector(".site-header .container");
  if (!nav || !container) return;

  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "nav-toggle";
  btn.setAttribute("aria-label", "Abrir menú");
  btn.setAttribute("aria-expanded", "false");
  btn.textContent = "☰";

  btn.addEventListener("click", () => {
    const open = nav.classList.toggle("open");
    btn.textContent = open ? "✕" : "☰";
    btn.setAttribute("aria-expanded", open ? "true" : "false");
  });

  // Delegado (no por enlace): así también cierra el menú al pulsar enlaces
  // que añaden otros scripts más tarde, como "Mi cuenta" o "Administración".
  nav.addEventListener("click", (e) => {
    if (e.target.closest("a")) {
      nav.classList.remove("open");
      btn.textContent = "☰";
      btn.setAttribute("aria-expanded", "false");
    }
  });

  container.insertBefore(btn, nav);
})();
