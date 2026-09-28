import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, handleOptions, jsonResponse } from "../_shared/cors.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(supabaseUrl, serviceRoleKey);

Deno.serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await admin.auth.getUser(token);
    if (userError || !userData.user) {
      return jsonResponse({ ok: false, error: "Inicia sesión para ver tus favoritos." }, 401);
    }

    const { data: heartRows, error: heartsError } = await admin
      .from("pattern_hearts")
      .select("pattern_id")
      .eq("user_id", userData.user.id);
    if (heartsError) throw heartsError;

    const ids = (heartRows ?? []).map((r) => r.pattern_id);
    if (!ids.length) return jsonResponse({ ok: true, patterns: [] });

    const { data: patterns, error: patternsError } = await admin
      .from("patterns")
      .select("id, short_description, author_name, cover_image_path, hearts_count, good_experience_count, bad_experience_count")
      .in("id", ids)
      .eq("status", "approved");
    if (patternsError) throw patternsError;

    return jsonResponse({ ok: true, patterns: patterns ?? [] });
  } catch (err) {
    console.error(err);
    return jsonResponse({ ok: false, error: String(err) }, 500);
  }
});
