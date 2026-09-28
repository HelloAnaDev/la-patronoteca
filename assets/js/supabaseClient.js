// Requiere que la página haya cargado antes:
//   <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
//   <script src="assets/js/config.js"></script>
const { SUPABASE_URL, SUPABASE_ANON_KEY, FUNCTIONS_URL } = window.PATRONOTECA_CONFIG;

// En modo demo (ver assets/js/demoData.js) usamos un cliente falso que guarda
// todo en el navegador; con claves reales, el cliente normal de Supabase.
const supabaseClient = window.PATRONOTECA_DEMO ? window.PATRONOTECA_DEMO.client : window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function callFunction(name, payload, useAuth = false) {
  if (window.PATRONOTECA_DEMO) {
    return window.PATRONOTECA_DEMO.callFunction(name, payload, useAuth);
  }

  // Supabase exige un JWT válido para invocar cualquier Edge Function (aunque
  // sea pública), así que por defecto mandamos la propia "anon key" (que es un
  // JWT público). Cuando useAuth=true, la sustituimos por la sesión de la
  // persona que ha iniciado sesión, y la función comprueba dentro que sea la
  // cuenta de moderación.
  const headers = {
    "Content-Type": "application/json",
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
  };
  if (useAuth) {
    const { data } = await supabaseClient.auth.getSession();
    const token = data.session?.access_token;
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }
  const res = await fetch(`${FUNCTIONS_URL}/${name}`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });
  const json = await res.json().catch(() => ({ ok: false, error: "Respuesta inválida del servidor." }));
  if (!res.ok || !json.ok) {
    throw new Error(json.error || `Error llamando a ${name}`);
  }
  return json;
}

function normalizeTag(text) {
  return text
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

// Convierte una imagen a WebP en el propio navegador (sin necesitar servidor).
async function convertImageToWebp(file, maxSize = 1600, quality = 0.82) {
  if (!file.type.startsWith("image/")) return file;
  const bitmap = await createImageBitmap(file);
  let { width, height } = bitmap;
  if (width > maxSize || height > maxSize) {
    const scale = maxSize / Math.max(width, height);
    width = Math.round(width * scale);
    height = Math.round(height * scale);
  }
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(bitmap, 0, 0, width, height);

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/webp", quality));
  if (!blob) return file;
  const newName = file.name.replace(/\.[^.]+$/, "") + ".webp";
  return new File([blob], newName, { type: "image/webp" });
}

function publicFileUrl(path) {
  const { data } = supabaseClient.storage.from("published").getPublicUrl(path);
  return data.publicUrl;
}

function randomFileName(originalName) {
  const ext = originalName.includes(".") ? originalName.split(".").pop() : "dat";
  const id = crypto.randomUUID();
  return `${id}.${ext}`;
}

// ---------- Cuenta de usuario (email + contraseña) ----------
// Los favoritos ahora se guardan ligados a la cuenta, no al navegador.

async function getCurrentUser() {
  if (window.PATRONOTECA_DEMO) return null;
  const { data } = await supabaseClient.auth.getSession();
  return data.session?.user ?? null;
}

async function signUp(email, password) {
  await callFunction("user-signup", { email, password });
  return signIn(email, password);
}

async function signIn(email, password) {
  const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
  if (error) throw new Error(error.message.includes("Invalid login") ? "Email o contraseña incorrectos." : error.message);
  return data.user;
}

async function signOutUser() {
  await supabaseClient.auth.signOut();
}

// Marca/desmarca favorito: requiere sesión iniciada; el servidor decide de
// verdad (toggle atómico) para evitar que el navegador se desincronice.
async function toggleHeart(patternId) {
  const { favorited } = await callFunction("heart-pattern", { patternId }, true);
  return favorited;
}

const NEW_BADGE_DAYS = 14;

function isRecentPattern(pattern) {
  const ref = pattern.moderated_at || pattern.created_at;
  if (!ref) return false;
  const days = (Date.now() - new Date(ref).getTime()) / (1000 * 60 * 60 * 24);
  return days <= NEW_BADGE_DAYS;
}
