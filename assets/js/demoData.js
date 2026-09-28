// Modo demostración: mientras assets/js/config.js siga teniendo la URL de
// ejemplo "TU-PROYECTO", toda la web funciona contra datos de prueba
// guardados en tu propio navegador (localStorage), sin necesitar Supabase
// todavía. En cuanto pongas tus claves reales de Supabase en config.js, este
// modo se desactiva solo y la web empieza a usar la base de datos de verdad.
const DEMO_MODE = (window.PATRONOTECA_CONFIG.SUPABASE_URL || "").includes("TU-PROYECTO");

(function () {
  if (!DEMO_MODE) return;

  const ADMIN_EMAIL = window.PATRONOTECA_CONFIG.ADMIN_EMAIL;
  const STORAGE_KEY = "patronoteca_demo_state_v1";

  function svgCover(bg, fg, label) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300">
      <rect width="400" height="300" fill="${bg}"/>
      <circle cx="200" cy="115" r="68" fill="${fg}" opacity="0.9"/>
      <rect x="125" y="165" width="150" height="95" rx="20" fill="${fg}" opacity="0.9"/>
      <text x="200" y="285" text-anchor="middle" font-family="Segoe UI, sans-serif" font-size="19" fill="#ffffff" font-weight="bold">${label}</text>
    </svg>`;
    return "data:image/svg+xml," + encodeURIComponent(svg);
  }

  const DEMO_PDF =
    "data:application/pdf;base64,JVBERi0xLjEKMSAwIG9iajw8L1R5cGUvQ2F0YWxvZy9QYWdlcyAyIDAgUj4+ZW5kb2JqCjIgMCBvYmo8PC9UeXBlL1BhZ2VzL0tpZHNbMyAwIFJdL0NvdW50IDE+PmVuZG9iagozIDAgb2JqPDwvVHlwZS9QYWdlL1BhcmVudCAyIDAgUi9NZWRpYUJveFswIDAgMzAwIDMwMF0vUmVzb3VyY2VzPDwvRm9udDw8L0YxIDQgMCBSPj4+Pi9Db250ZW50cyA1IDAgUj4+ZW5kb2JqCjQgMCBvYmo8PC9UeXBlL0ZvbnQvU3VidHlwZS9UeXBlMS9CYXNlRm9udC9IZWx2ZXRpY2E+PmVuZG9iago1IDAgb2JqPDwvTGVuZ3RoIDkwPj4Kc3RyZWFtCkJUIC9GMSAxNCBUZiAzMCAyNjAgVGQgKFBhdHJvbiBkZSBlamVtcGxvIC0gTGEgUGF0cm9ub3RlY2EpIFRqIEVUCkJUIC9GMSAxMCBUZiAzMCAyNDAgVGQgKEFyY2hpdm8gZGUgcHJ1ZWJhLCBzaW4gaW5zdHJ1Y2Npb25lcyByZWFsZXMuKSBUaiBFVAplbmRzdHJlYW0KZW5kb2JqCnhyZWYKMCA2CjAwMDAwMDAwMDAgNjU1MzUgZiAKdHJhaWxlcjw8L1NpemUgNi9Sb290IDEgMCBSPj4Kc3RhcnR4cmVmCjAKJSVFT0YK";

  function tag(id, category, display_name, status = "approved") {
    return { id, category, name: display_name.toUpperCase(), display_name, status };
  }

  function buildSeedState() {
    const tags = [
      tag("t-maquina", "tecnica", "Costura a máquina"),
      tag("t-crochet", "tecnica", "Crochet"),
      tag("t-punto", "tecnica", "Punto (dos agujas)"),
      tag("t-mano", "tecnica", "Costura a mano"),
      tag("t-otros", "tecnica", "Otros"),
      tag("p-chaqueta", "producto", "Chaqueta"),
      tag("p-bolso", "producto", "Bolso"),
      tag("p-bebe", "producto", "Bebé"),
      tag("p-mujer", "producto", "Mujer"),
      tag("p-falda", "producto", "Falda"),
      tag("p-gorro", "producto", "Gorro"),
      tag("p-bufanda", "producto", "Bufanda"),
      tag("p-vestido", "producto", "Vestido"),
      tag("p-otros", "producto", "Otros"),
      tag("p-pelele", "producto", "Pelele", "pending"),
    ];
    const byId = Object.fromEntries(tags.map((t) => [t.id, t]));
    const pt = (...ids) => ids.map((id) => ({ tags: byId[id] }));

    const patterns = [
      {
        id: "demo-1",
        created_at: "2026-09-10T10:00:00Z",
        moderated_at: "2026-09-10T18:00:00Z",
        author_name: "Marta L.",
        author_email: "marta.demo@example.com",
        short_description: "Chaqueta cruzada de punto para bebé",
        long_description: "Chaqueta sencilla de punto, tallas 0-12 meses, con cierre cruzado y botón lateral. Nivel principiante.",
        status: "approved",
        pattern_paths: [DEMO_PDF],
        cover_image_path: svgCover("#d9a441", "#8a5a17", "Chaqueta bebé"),
        gallery_paths: [svgCover("#f3e3c3", "#c1502e", "Detalle 1"), svgCover("#f3e3c3", "#c1502e", "Detalle 2")],
        ai_flag_detected: false,
        ai_disclosed: false,
        virustotal_status: "clean",
        pattern_tags: pt("t-punto", "p-chaqueta", "p-bebe"),
      },
      {
        id: "demo-2",
        created_at: "2026-09-12T09:30:00Z",
        moderated_at: "2026-09-12T20:00:00Z",
        author_name: "CosturasDeAna",
        author_email: "ana.demo@example.com",
        short_description: "Bolso tote de tela reciclada",
        long_description: "Patrón de bolso tote grande, ideal para restos de tela. Incluye bolsillo interior.",
        status: "approved",
        pattern_paths: [svgCover("#4b7d54", "#254a2c", "Hoja patrón")],
        cover_image_path: svgCover("#c8dcc4", "#4b7d54", "Bolso tote"),
        gallery_paths: [],
        ai_flag_detected: false,
        ai_disclosed: false,
        virustotal_status: "clean",
        pattern_tags: pt("t-maquina", "p-bolso"),
      },
      {
        id: "demo-3",
        created_at: "2026-09-14T12:00:00Z",
        moderated_at: "2026-09-14T21:00:00Z",
        author_name: "Rocío P.",
        author_email: "rocio.demo@example.com",
        short_description: "Falda midi plisada",
        long_description: "Falda midi con vuelo, cintura elástica. Tallas 36 a 48.",
        status: "approved",
        pattern_paths: [DEMO_PDF],
        cover_image_path: null,
        gallery_paths: [],
        ai_flag_detected: false,
        ai_disclosed: false,
        virustotal_status: "clean",
        pattern_tags: pt("t-maquina", "p-falda", "p-mujer"),
      },
      {
        id: "demo-4",
        created_at: "2026-09-16T08:00:00Z",
        moderated_at: "2026-09-16T19:00:00Z",
        author_name: "GanchilloConLola",
        author_email: "lola.demo@example.com",
        short_description: "Gorro de lana con pompón a crochet",
        long_description: "Gorro abrigado a crochet, patrón adulto talla única, con pompón desmontable.",
        status: "approved",
        pattern_paths: [DEMO_PDF, svgCover("#8f5fb3", "#4a2c66", "Esquema")],
        cover_image_path: svgCover("#e7d9f0", "#8f5fb3", "Gorro crochet"),
        gallery_paths: [svgCover("#8f5fb3", "#4a2c66", "Foto 1")],
        ai_flag_detected: false,
        ai_disclosed: false,
        virustotal_status: "clean",
        pattern_tags: pt("t-crochet", "p-gorro"),
      },
      {
        id: "demo-5",
        created_at: "2026-09-18T15:00:00Z",
        moderated_at: "2026-09-18T22:00:00Z",
        author_name: "PuntoYLana",
        author_email: "puntoylana.demo@example.com",
        short_description: "Bufanda infinita a punto",
        long_description: "Bufanda circular de punto grueso, patrón muy sencillo para empezar.",
        status: "approved",
        pattern_paths: [DEMO_PDF],
        cover_image_path: svgCover("#3e7ea6", "#1f4258", "Bufanda"),
        gallery_paths: [],
        ai_flag_detected: true,
        ai_flag_signature: "Stable Diffusion",
        ai_disclosed: true,
        virustotal_status: "clean",
        pattern_tags: pt("t-punto", "p-bufanda"),
      },
      // Pendientes de moderar (para probar el panel).
      {
        id: "demo-pending-1",
        created_at: "2026-09-26T11:20:00Z",
        moderated_at: null,
        author_name: "Marisa T.",
        author_email: "marisa.demo@example.com",
        short_description: "Body bebé de manga larga",
        long_description: "Body de punto con cierre de broches en la entrepierna, tallas 3-6 y 6-9 meses.",
        status: "pending",
        pattern_paths: [DEMO_PDF],
        cover_image_path: svgCover("#e4ecd8", "#4b6b32", "Body bebé"),
        gallery_paths: [],
        ai_flag_detected: false,
        ai_disclosed: false,
        virustotal_status: "not_analyzed",
        ip_address: "203.0.113.24",
        pattern_tags: [...pt("t-punto"), { tags: byId["p-pelele"] }],
      },
      {
        id: "demo-pending-2",
        created_at: "2026-09-27T09:05:00Z",
        moderated_at: null,
        author_name: "Clara G.",
        author_email: "clara.demo@example.com",
        short_description: "Vestido veraniego sin mangas",
        long_description: "Vestido ligero de tirantes, patrón en dos fotos de las hojas originales.",
        status: "pending",
        pattern_paths: [svgCover("#f3d9b1", "#a0632a", "Hoja 1"), svgCover("#f3d9b1", "#a0632a", "Hoja 2")],
        cover_image_path: svgCover("#fbeee0", "#c1502e", "Vestido verano"),
        gallery_paths: [],
        ai_flag_detected: true,
        ai_flag_signature: "Midjourney",
        ai_disclosed: false,
        virustotal_status: "not_analyzed",
        ip_address: "198.51.100.7",
        pattern_tags: pt("t-maquina", "p-vestido", "p-mujer"),
      },
    ];

    const communityLinks = [
      { id: "cl-1", created_at: "2026-09-05T10:00:00Z", display_name: "CosturasDeAna", network: "instagram", url: "https://instagram.com/example", status: "approved", submitter_email: null },
      { id: "cl-2", created_at: "2026-09-06T10:00:00Z", display_name: "GanchilloConLola", network: "youtube", url: "https://youtube.com/@example", status: "approved", submitter_email: null },
      { id: "cl-3", created_at: "2026-09-07T10:00:00Z", display_name: "PuntoYLana Shop", network: "etsy", url: "https://etsy.com/shop/example", status: "approved", submitter_email: null },
      { id: "cl-pending-1", created_at: "2026-09-26T16:00:00Z", display_name: "CosturaConMarisa", network: "tiktok", url: "https://tiktok.com/@example", status: "pending", submitter_email: "marisa.demo@example.com", ip_address: "203.0.113.24" },
    ];

    return { tags, patterns, community_links: communityLinks };
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch {
      /* ignore */
    }
    const seed = buildSeedState();
    saveState(seed);
    return seed;
  }

  function saveState(s) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
    } catch {
      /* localStorage lleno o bloqueado: seguimos solo en memoria */
    }
  }

  const state = loadState();

  function resolvePath(path) {
    return path; // en modo demo, el "path" ya es una URL usable (data URI o blob URL)
  }

  function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  // ---------- Query builder que imita lo mínimo de supabase-js que usamos ----------
  class DemoQueryBuilder {
    constructor(rows) {
      this._rows = rows;
      this._filters = [];
      this._order = null;
      this._single = false;
      this._maybeSingle = false;
    }
    select() {
      return this;
    }
    eq(col, val) {
      this._filters.push((r) => r[col] === val);
      return this;
    }
    order(col, opts) {
      this._order = { col, ascending: opts?.ascending !== false };
      return this;
    }
    maybeSingle() {
      this._maybeSingle = true;
      return this;
    }
    single() {
      this._single = true;
      return this;
    }
    async _exec() {
      let rows = this._rows.filter((r) => this._filters.every((f) => f(r)));
      if (this._order) {
        const { col, ascending } = this._order;
        rows = [...rows].sort((a, b) => ((a[col] > b[col] ? 1 : -1) * (ascending ? 1 : -1)));
      }
      if (this._single) return { data: rows[0] ?? null, error: rows[0] ? null : new Error("No encontrado") };
      if (this._maybeSingle) return { data: rows[0] ?? null, error: null };
      return { data: rows, error: null };
    }
    then(resolve, reject) {
      return this._exec().then(resolve, reject);
    }
  }

  let demoSession = sessionStorage.getItem("patronoteca_demo_session") ? { user: { email: ADMIN_EMAIL }, access_token: "demo-token" } : null;

  const demoClient = {
    from(table) {
      return new DemoQueryBuilder(state[table] || []);
    },
    storage: {
      from() {
        return {
          async upload(path, file) {
            try {
              state.demoFiles = state.demoFiles || {};
              state.demoFiles[path] = await fileToDataUrl(file);
              saveState(state);
              return { error: null };
            } catch (e) {
              return { error: e };
            }
          },
          getPublicUrl(path) {
            const url = (state.demoFiles && state.demoFiles[path]) || resolvePath(path);
            return { data: { publicUrl: url } };
          },
        };
      },
    },
    auth: {
      async getSession() {
        return { data: { session: demoSession } };
      },
      async signInWithPassword() {
        demoSession = { user: { email: ADMIN_EMAIL }, access_token: "demo-token" };
        sessionStorage.setItem("patronoteca_demo_session", "1");
        return { data: { user: demoSession.user }, error: null };
      },
      async signInWithOtp() {
        demoSession = { user: { email: ADMIN_EMAIL }, access_token: "demo-token" };
        sessionStorage.setItem("patronoteca_demo_session", "1");
        return { data: {}, error: null };
      },
      async signOut() {
        demoSession = null;
        sessionStorage.removeItem("patronoteca_demo_session");
      },
    },
  };

  function normalizeTagName(txt) {
    return txt
      .trim()
      .toUpperCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "");
  }

  async function demoCallFunction(name, payload) {
    await new Promise((r) => setTimeout(r, 250)); // para que se note que "algo pasa"

    if (name === "submit-pattern") {
      const tagIds = [...(payload.techniqueTagIds || []), ...(payload.productTagIds || [])];
      let newTag = null;
      if (payload.newProductTagName) {
        const name_ = normalizeTagName(payload.newProductTagName);
        newTag = state.tags.find((t) => t.category === "producto" && t.name === name_);
        if (!newTag) {
          newTag = tag(crypto.randomUUID(), "producto", payload.newProductTagName.trim(), "pending");
          state.tags.push(newTag);
        }
        tagIds.push(newTag.id);
      }
      const patternTags = tagIds.map((id) => ({ tags: state.tags.find((t) => t.id === id) })).filter((pt) => pt.tags);
      const newPattern = {
        id: crypto.randomUUID(),
        created_at: new Date().toISOString(),
        moderated_at: null,
        author_name: payload.authorName,
        author_email: payload.authorEmail,
        short_description: payload.shortDescription,
        long_description: payload.longDescription || null,
        status: "pending",
        pattern_paths: payload.patternPaths,
        cover_image_path: payload.coverImagePath || null,
        gallery_paths: payload.galleryPaths || [],
        ai_flag_detected: false,
        ai_disclosed: false,
        virustotal_status: "not_analyzed",
        ip_address: "127.0.0.1 (demo)",
        pattern_tags: patternTags,
      };
      state.patterns.push(newPattern);
      saveState(state);
      return { ok: true, id: newPattern.id };
    }

    if (name === "submit-community-link") {
      const newLink = {
        id: crypto.randomUUID(),
        created_at: new Date().toISOString(),
        display_name: payload.displayName,
        network: payload.network,
        url: payload.url,
        status: "pending",
        submitter_email: payload.submitterEmail || null,
        ip_address: "127.0.0.1 (demo)",
      };
      state.community_links.push(newLink);
      saveState(state);
      return { ok: true, id: newLink.id };
    }

    if (name === "report-content") {
      console.log("[demo] Aviso recibido para el patrón", payload.patternId, payload.message);
      return { ok: true };
    }

    if (name === "list-pending") {
      return {
        ok: true,
        patterns: state.patterns.filter((p) => p.status === "pending"),
        communityLinks: state.community_links.filter((l) => l.status === "pending"),
        allTags: state.tags,
      };
    }

    if (name === "moderate-pattern") {
      const pattern = state.patterns.find((p) => p.id === payload.patternId);
      if (!pattern) return { ok: false, error: "Patrón no encontrado." };

      if (payload.action === "analyze") {
        await new Promise((r) => setTimeout(r, 900));
        pattern.virustotal_status = "clean";
        saveState(state);
        return { ok: true, results: pattern.pattern_paths.map((path) => ({ path, isClean: true, stats: { malicious: 0, suspicious: 0, harmless: 70 } })) };
      }

      if (payload.action === "preview_url") {
        const path = payload.path || pattern.pattern_paths[0];
        return { ok: true, url: (state.demoFiles && state.demoFiles[path]) || resolvePath(path) };
      }

      if (payload.action === "accept") {
        (payload.approveTagIds || []).forEach((id) => {
          const t = state.tags.find((x) => x.id === id);
          if (t) t.status = "approved";
        });
        const finalIds = [...(payload.finalTechniqueTagIds || []), ...(payload.finalProductTagIds || [])];
        pattern.pattern_tags = finalIds.map((id) => ({ tags: state.tags.find((t) => t.id === id) })).filter((pt) => pt.tags);
        pattern.status = "approved";
        pattern.moderated_at = new Date().toISOString();
        pattern.ai_disclosed = !!payload.aiDisclosed;
        saveState(state);
        return { ok: true };
      }

      if (payload.action === "reject" || payload.action === "reject_and_block") {
        pattern.status = "rejected";
        pattern.rejected_reason = payload.reason || null;
        pattern.moderated_at = new Date().toISOString();
        saveState(state);
        return { ok: true };
      }

      if (payload.action === "update") {
        pattern.short_description = payload.shortDescription;
        pattern.long_description = payload.longDescription || null;
        const finalIds = [...(payload.finalTechniqueTagIds || []), ...(payload.finalProductTagIds || [])];
        pattern.pattern_tags = finalIds.map((id) => ({ tags: state.tags.find((t) => t.id === id) })).filter((pt) => pt.tags);
        saveState(state);
        return { ok: true };
      }

      if (payload.action === "delete") {
        state.patterns = state.patterns.filter((p) => p.id !== payload.patternId);
        saveState(state);
        return { ok: true };
      }

      return { ok: false, error: "Acción desconocida." };
    }

    if (name === "moderate-community-link") {
      const link = state.community_links.find((l) => l.id === payload.linkId);
      if (!link) return { ok: false, error: "Enlace no encontrado." };
      if (payload.action === "accept") link.status = "approved";
      else link.status = "rejected";
      saveState(state);
      return { ok: true };
    }

    return { ok: false, error: "Función de demo desconocida: " + name };
  }

  window.PATRONOTECA_DEMO = { client: demoClient, callFunction: demoCallFunction };

  document.addEventListener("DOMContentLoaded", () => {
    const banner = document.createElement("div");
    banner.style.cssText =
      "background:#3e7ea6;color:#fff;text-align:center;padding:8px 14px;font-size:0.85rem;font-weight:600;";
    banner.innerHTML =
      "🧪 Modo demostración: estos datos son de prueba y solo viven en tu navegador. En moderación, cualquier email/contraseña te deja entrar. Sigue SETUP.md para conectar la web de verdad.";
    document.body.prepend(banner);
  });
})();
