import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, handleOptions, jsonResponse } from "../_shared/cors.ts";
import { sendEmail } from "../_shared/email.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const adminEmail = Deno.env.get("ADMIN_EMAIL") ?? "hello.ana.dev@gmail.com";
const siteUrl = Deno.env.get("SITE_URL") ?? "http://localhost:8888";

const admin = createClient(supabaseUrl, serviceRoleKey);

async function requireAdmin(req: Request) {
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace("Bearer ", "");
  if (!token) return false;
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) return false;
  return data.user.email?.toLowerCase() === adminEmail.toLowerCase();
}

Deno.serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  if (!(await requireAdmin(req))) {
    return jsonResponse({ ok: false, error: "No autorizado." }, 401);
  }

  try {
    const body = await req.json();
    const { action, linkId, reason } = body;

    const { data: link } = await admin.from("community_links").select("*").eq("id", linkId).single();
    if (!link) return jsonResponse({ ok: false, error: "Enlace no encontrado." }, 404);

    if (action === "accept") {
      await admin.from("community_links").update({ status: "approved", moderated_at: new Date().toISOString() }).eq("id", linkId);
      if (link.submitter_email) {
        await sendEmail({
          to: link.submitter_email,
          subject: "¡Tu red social ya aparece en La Patronoteca!",
          html: `
            <p>Hola ${link.display_name},</p>
            <p>Tu enlace de ${link.network} ya está visible en el apartado de Comunidad de La Patronoteca.</p>
            <p><a href="${siteUrl}/comunidad.html">Ver la sección de Comunidad</a></p>
            <p>¡Esperamos que llegues lejos y puedas acercarte a tu público! Recuerda seguir también a otras costureras/artesanas, ¡estamos todas en el mismo barco! 😉</p>
            <p>La Patronoteca</p>
          `,
        });
      }
      return jsonResponse({ ok: true });
    }

    if (action === "reject") {
      await admin.from("community_links").update({ status: "rejected", moderated_at: new Date().toISOString() }).eq("id", linkId);
      if (link.submitter_email) {
        await sendEmail({
          to: link.submitter_email,
          subject: "Sobre tu enlace enviado a La Patronoteca",
          html: `
            <p>Hola ${link.display_name},</p>
            <p>No hemos podido publicar tu enlace en el apartado de Comunidad.${reason ? ` Motivo: ${reason}` : ""}</p>
            <p>La Patronoteca</p>
          `,
        });
      }
      return jsonResponse({ ok: true });
    }

    if (action === "reject_and_block") {
      await admin.from("community_links").update({ status: "rejected", moderated_at: new Date().toISOString() }).eq("id", linkId);
      const rows = [{ type: "ip", value: link.ip_address, reason: reason ?? null }];
      if (link.submitter_email) rows.push({ type: "email", value: link.submitter_email, reason: reason ?? null });
      await admin.from("blocked_identities").upsert(rows, { onConflict: "type,value" });
      return jsonResponse({ ok: true });
    }

    if (action === "update") {
      const { displayName, network, url, description } = body;
      await admin
        .from("community_links")
        .update({
          display_name: displayName,
          network,
          url,
          description: description || null,
        })
        .eq("id", linkId);
      return jsonResponse({ ok: true });
    }

    if (action === "delete") {
      await admin.from("community_links").delete().eq("id", linkId);
      return jsonResponse({ ok: true });
    }

    return jsonResponse({ ok: false, error: "Acción desconocida." }, 400);
  } catch (err) {
    console.error(err);
    return jsonResponse({ ok: false, error: String(err) }, 500);
  }
});
