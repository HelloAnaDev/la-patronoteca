import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, handleOptions, jsonResponse } from "../_shared/cors.ts";
import { sendEmailBackground } from "../_shared/email.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const moderatorEmail = Deno.env.get("MODERATOR_EMAIL") ?? "hello.ana.dev@gmail.com";
const siteUrl = Deno.env.get("SITE_URL") ?? "http://localhost:8888";

const admin = createClient(supabaseUrl, serviceRoleKey);

Deno.serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  try {
    const { patternId, alias, message, imagePath } = await req.json();
    if (!patternId || !alias?.trim() || !message?.trim()) {
      return jsonResponse({ ok: false, error: "Faltan campos obligatorios." }, 400);
    }

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "desconocida";

    const { data: blocked } = await admin.from("blocked_identities").select("id").eq("type", "ip").eq("value", ip).limit(1);
    if (blocked && blocked.length > 0) {
      return jsonResponse({ ok: true }); // no delatamos el bloqueo
    }

    const { data: pattern } = await admin.from("patterns").select("short_description").eq("id", patternId).maybeSingle();
    if (!pattern) return jsonResponse({ ok: false, error: "Patrón no encontrado." }, 404);

    const { error } = await admin.from("comments").insert({
      pattern_id: patternId,
      alias: alias.trim().slice(0, 60),
      message: message.trim().slice(0, 1000),
      image_path: imagePath || null,
      ip_address: ip,
    });
    if (error) throw error;

    sendEmailBackground({
      to: moderatorEmail,
      subject: `Nuevo comentario para moderar en "${pattern.short_description}"`,
      html: `
        <p>Alguien ha dejado un comentario en un patrón.</p>
        <p><strong>Alias:</strong> ${alias}</p>
        <p><strong>Comentario:</strong> ${message}</p>
        <p><a href="${siteUrl}/moderacion.html">Ir al panel de moderación</a></p>
      `,
    });

    return jsonResponse({ ok: true });
  } catch (err) {
    console.error(err);
    return jsonResponse({ ok: false, error: String(err) }, 500);
  }
});
