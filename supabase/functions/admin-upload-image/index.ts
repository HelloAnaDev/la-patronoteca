import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, handleOptions, jsonResponse } from "../_shared/cors.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const adminEmail = Deno.env.get("ADMIN_EMAIL") ?? "hello.ana.dev@gmail.com";

const admin = createClient(supabaseUrl, serviceRoleKey);

async function requireAdmin(req: Request) {
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace("Bearer ", "");
  if (!token) return false;
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) return false;
  return data.user.email?.toLowerCase() === adminEmail.toLowerCase();
}

// Sube una imagen directamente al bucket "published" (solo para admin: se usa
// para añadir fotos a un patrón que ya está publicado, sin pasar por el
// bucket de pendientes porque ya ha pasado la revisión).
Deno.serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  if (!(await requireAdmin(req))) {
    return jsonResponse({ ok: false, error: "No autorizado." }, 401);
  }

  try {
    const form = await req.formData();
    const file = form.get("file");
    const patternId = form.get("patternId");
    if (!(file instanceof File) || typeof patternId !== "string" || !patternId) {
      return jsonResponse({ ok: false, error: "Faltan datos." }, 400);
    }

    const ext = file.name.includes(".") ? file.name.split(".").pop() : "webp";
    const path = `${patternId}/${crypto.randomUUID()}.${ext}`;
    const bytes = new Uint8Array(await file.arrayBuffer());
    const { error } = await admin.storage.from("published").upload(path, bytes, {
      contentType: file.type || "image/webp",
    });
    if (error) throw error;

    return jsonResponse({ ok: true, path });
  } catch (err) {
    console.error(err);
    return jsonResponse({ ok: false, error: String(err) }, 500);
  }
});
