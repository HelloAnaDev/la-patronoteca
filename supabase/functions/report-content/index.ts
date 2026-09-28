import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, handleOptions, jsonResponse } from "../_shared/cors.ts";
import { sendEmailBackground } from "../_shared/email.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const moderatorEmail = Deno.env.get("MODERATOR_EMAIL") ?? "hello.ana.dev@gmail.com";
const siteUrl = Deno.env.get("SITE_URL") ?? "http://localhost:8888";

interface Payload {
  patternId: string;
  message: string;
  reporterEmail?: string;
}

Deno.serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  try {
    const body = (await req.json()) as Payload;
    if (!body.patternId || !body.message?.trim()) {
      return jsonResponse({ ok: false, error: "Faltan campos obligatorios." }, 400);
    }

    const admin = createClient(supabaseUrl, serviceRoleKey);

    const { data: pattern } = await admin
      .from("patterns")
      .select("short_description")
      .eq("id", body.patternId)
      .maybeSingle();

    const { error } = await admin.from("reports").insert({
      pattern_id: body.patternId,
      message: body.message.trim(),
      reporter_email: body.reporterEmail?.trim().toLowerCase() || null,
    });
    if (error) throw error;

    sendEmailBackground({
      to: moderatorEmail,
      subject: `Aviso sobre un patrón marcado como posible IA: "${pattern?.short_description ?? ""}"`,
      html: `
        <p>Alguien ha escrito sobre el aviso de contenido IA en un patrón.</p>
        <p><strong>Mensaje:</strong> ${body.message}</p>
        ${body.reporterEmail ? `<p><strong>Email de quien escribe:</strong> ${body.reporterEmail}</p>` : ""}
        <p><a href="${siteUrl}/patron.html?id=${body.patternId}">Ver el patrón</a></p>
      `,
    });

    return jsonResponse({ ok: true });
  } catch (err) {
    console.error(err);
    return jsonResponse({ ok: false, error: String(err) }, 500);
  }
});
