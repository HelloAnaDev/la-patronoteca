// Botón flotante "¿Qué es esto?" justo encima del widget de Ko-fi, con un
// pop-up que explica qué es Ko-fi, qué significa "comprar un café" y por qué
// está aquí.
(function () {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "no-print kofi-info-btn";
  btn.innerHTML = `¿Qué es esto? <span class="kofi-info-arrow">⌄</span>`;
  btn.setAttribute("aria-label", "Qué es el botón de apoyo");
  btn.style.cssText = `
    position: fixed;
    left: 20px;
    bottom: 66px;
    z-index: 99;
    background: #ff5f5f;
    color: #fff;
    border: none;
    border-radius: 999px;
    padding: 4px 10px;
    font-size: 0.68rem;
    font-weight: 700;
    cursor: pointer;
    box-shadow: 0 4px 12px rgba(0,0,0,0.2);
    text-align: center;
  `;

  const overlay = document.createElement("div");
  overlay.className = "modal-overlay no-print";
  overlay.hidden = true;
  overlay.innerHTML = `
    <div class="modal-box">
      <button type="button" class="modal-close" aria-label="Cerrar">×</button>
      <h3 style="margin-top:0;">Sobre el botón "Apóyame"</h3>
      <p>Ese botón lleva a <strong>Ko-fi</strong>, una web para hacer pequeñas donaciones voluntarias a quien crea algo online, como esta comunidad.</p>
      <p>Ko-fi organiza las donaciones en forma de "cafés": cada "café" vale <strong>2€ each</strong> (2€ cada uno), y puedes elegir cuántos quieres dar (1 café, 2 cafés...) o directamente escribir la cantidad que quieras. Es solo una forma simpática de decir "te invito a un café", no un café de verdad ni ningún producto.</p>
      <p>Arriba del todo verás dos pestañas: <strong>"One time"</strong> es una donación única, de una sola vez, y <strong>"Monthly"</strong> es mensual (se repite cada mes hasta que la canceles cuando quieras).</p>
      <p><strong>La Patronoteca es y seguirá siendo gratis para todo el mundo:</strong> subir y descargar patrones nunca costará nada. Donar es totalmente opcional y ayuda a compensar las horas de trabajo y mantenimiento que lleva mantener la web funcionando y creciendo.</p>
      <p>No hace falta registrarse en Ko-fi para donar. Si no donas nada, la web sigue funcionando exactamente igual para ti.</p>
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
