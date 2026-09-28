import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, handleOptions, jsonResponse } from "../_shared/cors.ts";
import { sendEmail } from "../_shared/email.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const moderatorEmail = Deno.env.get("MODERATOR_EMAIL") ?? "hello.ana.dev@gmail.com";
const siteUrl = Deno.env.get("SITE_URL") ?? "http://localhost:8888";

interface Payload {
  displayName: string;
  network: string;
  url: string;
  description?: string;
  submitterEmail?: string;
}

Deno.serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  try {
    const body = (await req.json()) as Payload;
    if (!body.displayName || !body.network || !body.url) {
      return jsonResponse({ ok: false, error: "Faltan campos obligatorios." }, 400);
    }

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "desconocida";
    const admin = createClient(supabaseUrl, serviceRoleKey);

    if (body.submitterEmail) {
      const { data: blocked } = await admin
        .from("blocked_identities")
        .select("id")
        .or(`and(type.eq.email,value.eq.${body.submitterEmail.toLowerCase()}),and(type.eq.ip,value.eq.${ip})`)
        .limit(1);
      if (blocked && blocked.length > 0) {
        return jsonResponse({ ok: true, id: null });
      }
    }

    const { data: link, error } = await admin
      .from("community_links")
      .insert({
        display_name: body.displayName.trim(),
        network: body.network,
        url: body.url.trim(),
        description: body.description?.trim().slice(0, 200) || null,
        submitter_email: body.submitterEmail?.trim().toLowerCase() || null,
        ip_address: ip,
      })
      .select("id")
      .single();

    if (error) throw error;

    await sendEmail({
      to: moderatorEmail,
      subject: `Nueva red social para moderar: ${body.displayName}`,
      html: `
        <p>Alguien quiere aparecer en el apartado de Comunidad.</p>
        <ul>
          <li><strong>Nombre:</strong> ${body.displayName}</li>
          <li><strong>Red:</strong> ${body.network}</li>
          <li><strong>Enlace:</strong> ${body.url}</li>
          ${body.description ? `<li><strong>Descripción:</strong> ${body.description}</li>` : ""}
        </ul>
        <p><a href="${siteUrl}/moderacion.html">Ir al panel de moderación</a></p>
      `,
    });

    return jsonResponse({ ok: true, id: link.id });
  } catch (err) {
    console.error(err);
    return jsonResponse({ ok: false, error: String(err) }, 500);
  }
});
