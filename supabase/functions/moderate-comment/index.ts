import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, handleOptions, jsonResponse } from "../_shared/cors.ts";
import { sendEmailBackground } from "../_shared/email.ts";

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

async function movePendingImageToPublished(path: string): Promise<string> {
  const { data: fileData, error: downloadError } = await admin.storage.from("pending-uploads").download(path);
  if (downloadError || !fileData) throw downloadError ?? new Error("No se pudo descargar " + path);
  const { error: uploadError } = await admin.storage.from("published").upload(path, fileData, { upsert: true });
  if (uploadError) throw uploadError;
  await admin.storage.from("pending-uploads").remove([path]);
  return path;
}

Deno.serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  if (!(await requireAdmin(req))) {
    return jsonResponse({ ok: false, error: "No autorizado." }, 401);
  }

  try {
    const { action, commentId, reason } = await req.json();

    const { data: comment } = await admin.from("comments").select("*").eq("id", commentId).maybeSingle();
    if (!comment) return jsonResponse({ ok: false, error: "Comentario no encontrado." }, 404);

    if (action === "preview_url") {
      if (!comment.image_path) return jsonResponse({ ok: false, error: "Sin imagen." }, 400);
      const { data: signed } = await admin.storage.from("pending-uploads").createSignedUrl(comment.image_path, 3600);
      return jsonResponse({ ok: true, url: signed?.signedUrl });
    }

    if (action === "preview_published_url") {
      if (!comment.image_path) return jsonResponse({ ok: false, error: "Sin imagen." }, 400);
      const { data: pub } = admin.storage.from("published").getPublicUrl(comment.image_path);
      return jsonResponse({ ok: true, url: pub?.publicUrl });
    }

    if (action === "accept") {
      let newImagePath = comment.image_path;
      if (comment.image_path) {
        newImagePath = await movePendingImageToPublished(comment.image_path);
      }
      await admin
        .from("comments")
        .update({ status: "approved", moderated_at: new Date().toISOString(), image_path: newImagePath })
        .eq("id", commentId);
      await admin.rpc("increment_pattern_counter", { p_pattern_id: comment.pattern_id, p_column: "comments_count", p_delta: 1 });

      const { data: pattern } = await admin
        .from("patterns")
        .select("author_email, notify_on_comment, short_description")
        .eq("id", comment.pattern_id)
        .maybeSingle();

      if (pattern?.notify_on_comment && pattern.author_email) {
        sendEmailBackground({
          to: pattern.author_email,
          subject: `Nuevo comentario en tu patrón "${pattern.short_description}"`,
          html: `
            <p>Alguien ha comentado tu patrón en La Patronoteca.</p>
            <p><strong>${comment.alias}:</strong> ${comment.message}</p>
            <p><a href="${siteUrl}/patron.html?id=${comment.pattern_id}">Ver el comentario</a></p>
          `,
        });
      }

      return jsonResponse({ ok: true });
    }

    if (action === "reject" || action === "reject_and_block") {
      if (comment.image_path) {
        await admin.storage.from("pending-uploads").remove([comment.image_path]);
      }
      await admin.from("comments").update({ status: "rejected", moderated_at: new Date().toISOString() }).eq("id", commentId);
      if (action === "reject_and_block" && comment.ip_address) {
        await admin.from("blocked_identities").upsert([{ type: "ip", value: comment.ip_address, reason: reason ?? null }], { onConflict: "type,value" });
      }
      return jsonResponse({ ok: true });
    }

    if (action === "delete") {
      if (comment.image_path) {
        await admin.storage.from("published").remove([comment.image_path]);
      }
      await admin.from("comments").delete().eq("id", commentId);
      if (comment.status === "approved") {
        await admin.rpc("increment_pattern_counter", { p_pattern_id: comment.pattern_id, p_column: "comments_count", p_delta: -1 });
      }
      return jsonResponse({ ok: true });
    }

    return jsonResponse({ ok: false, error: "Acción desconocida." }, 400);
  } catch (err) {
    console.error(err);
    return jsonResponse({ ok: false, error: String(err) }, 500);
  }
});
