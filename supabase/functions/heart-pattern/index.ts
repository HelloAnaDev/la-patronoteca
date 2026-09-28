import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, handleOptions, jsonResponse } from "../_shared/cors.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(supabaseUrl, serviceRoleKey);

// Favoritos: requiere cuenta (email + contraseña). "Toggle": si ya le habías
// dado, lo quita; si no, lo añade, en una sola operación atómica en la BD.
Deno.serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await admin.auth.getUser(token);
    if (userError || !userData.user) {
      return jsonResponse({ ok: false, error: "Inicia sesión para guardar favoritos." }, 401);
    }

    const { patternId } = await req.json();
    if (!patternId) return jsonResponse({ ok: false, error: "Datos inválidos." }, 400);

    const { data, error } = await admin.rpc("toggle_pattern_heart", { p_pattern_id: patternId, p_user_id: userData.user.id });
    if (error) throw error;

    return jsonResponse({ ok: true, result: data, favorited: data === "added" });
  } catch (err) {
    console.error(err);
    return jsonResponse({ ok: false, error: String(err) }, 500);
  }
});
