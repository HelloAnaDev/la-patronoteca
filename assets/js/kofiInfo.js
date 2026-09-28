// Botón flotante "¿Qué es esto?" justo encima del widget de Ko-fi, con un
// pop-up que explica qué es Ko-fi y por qué está aquí.
(function () {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "no-print";
  btn.textContent = "¿Qué es esto? ⌄";
  btn.setAttribute("aria-label", "Qué es el botón de apoyo");
  btn.style.cssText = `
    position: fixed;
    left: 20px;
    bottom: 88px;
    z-index: 99;
    background: #ff5f5f;
    color: #fff;
    border: none;
    border-radius: 999px;
    padding: 8px 14px;
    font-size: 0.82rem;
    font-weight: 700;
    cursor: pointer;
    box-shadow: 0 4px 12px rgba(0,0,0,0.2);
  `;

  const overlay = document.createElement("div");
  overlay.className = "modal-overlay no-print";
  overlay.hidden = true;
  overlay.innerHTML = `
    <div class="modal-box">
      <button type="button" class="modal-close" aria-label="Cerrar">×</button>
      <h3 style="margin-top:0;">Sobre el botón "Apóyame"</h3>
      <p>Ese botón lleva a <strong>Ko-fi</strong>, una plataforma para recibir pequeñas donaciones voluntarias de quien quiera apoyar este proyecto.</p>
      <p>La Patronoteca es y seguirá siendo gratis para todo el mundo: subir y descargar patrones nunca costará nada. Ko-fi es solo una forma opcional de decir "gracias" y ayudar a cubrir los gastos de mantener la web.</p>
      <p>No hace falta registrarse en Ko-fi para donar, y puedes elegir la cantidad que quieras (o no donar nada — la web sigue funcionando igual).</p>
    </div>
  `;
  document.body.appendChild(overlay);

  btn.addEventListener("click", () => {
    overlay.hidden = false;
  });
  overlay.querySelector(".modal-close").addEventListener("click", () => {
    overlay.hidden = true;
  });
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) overlay.hidden = true;
  });

  document.body.appendChild(btn);
})();
