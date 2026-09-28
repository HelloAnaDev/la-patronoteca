import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, handleOptions, jsonResponse } from "../_shared/cors.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(supabaseUrl, serviceRoleKey);

// "Toggle": si repites la misma valoración, se quita tu voto. Si votas la
// contraria, se cambia. Todo en una función de base de datos atómica, para
// que no cuente doble aunque se pulse varias veces muy rápido.
Deno.serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  try {
    const { patternId, rating } = await req.json();
    if (!patternId || !["good", "bad"].includes(rating)) {
      return jsonResponse({ ok: false, error: "Datos inválidos." }, 400);
    }

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "desconocida";
    const { data, error } = await admin.rpc("toggle_pattern_experience", {
      p_pattern_id: patternId,
      p_ip: ip,
      p_rating: rating,
    });
    if (error) throw error;

    return jsonResponse({ ok: true, result: data });
  } catch (err) {
    console.error(err);
    return jsonResponse({ ok: false, error: String(err) }, 500);
  }
});
