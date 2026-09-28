import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, handleOptions, jsonResponse } from "../_shared/cors.ts";
import { sendEmailBackground } from "../_shared/email.ts";
import { scanUrlWithVirusTotal } from "../_shared/virustotal.ts";

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

async function movePendingFileToPublished(path: string): Promise<string> {
  const { data: fileData, error: downloadError } = await admin.storage.from("pending-uploads").download(path);
  if (downloadError || !fileData) throw downloadError ?? new Error("No se pudo descargar " + path);

  const { error: uploadError } = await admin.storage.from("published").upload(path, fileData, { upsert: true });
  if (uploadError) throw uploadError;

  await admin.storage.from("pending-uploads").remove([path]);
  return path;
}

async function deletePendingFiles(pattern: { pattern_paths: string[]; cover_image_path: string | null; gallery_paths: string[] }) {
  const paths = [...pattern.pattern_paths, pattern.cover_image_path, ...pattern.gallery_paths].filter(Boolean) as string[];
  if (paths.length > 0) {
    await admin.storage.from("pending-uploads").remove(paths);
  }
}

Deno.serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  if (!(await requireAdmin(req))) {
    return jsonResponse({ ok: false, error: "No autorizado." }, 401);
  }

  try {
    const body = await req.json();
    const { action, patternId } = body;

    const { data: pattern, error: patternError } = await admin
      .from("patterns")
      .select("*")
      .eq("id", patternId)
      .single();
    if (patternError || !pattern) return jsonResponse({ ok: false, error: "Patrón no encontrado." }, 404);

    switch (action) {
      case "analyze": {
        await admin.from("patterns").update({ virustotal_status: "analyzing" }).eq("id", patternId);

        const results = [];
        for (const path of pattern.pattern_paths as string[]) {
          const { data: signed } = await admin.storage.from("pending-uploads").createSignedUrl(path, 3600);
          if (!signed) throw new Error("No se pudo generar el enlace de " + path);
          const result = await scanUrlWithVirusTotal(signed.signedUrl);
          results.push({ path, ...result });
        }

        const allClean = results.every((r) => r.isClean);

        await admin
          .from("patterns")
          .update({
            virustotal_status: allClean ? "clean" : "flagged",
            virustotal_result: results,
          })
          .eq("id", patternId);

        return jsonResponse({ ok: true, results });
      }

      case "preview_url": {
        const targetPath = body.path || pattern.pattern_paths[0];
        const { data: signed } = await admin.storage
          .from("pending-uploads")
          .createSignedUrl(targetPath, 3600);
        return jsonResponse({ ok: true, url: signed?.signedUrl });
      }

      case "accept": {
        const { finalTechniqueTagIds = [], finalProductTagIds = [], approveTagIds = [], aiDisclosed = false } = body;

        if (approveTagIds.length > 0) {
          await admin.from("tags").update({ status: "approved" }).in("id", approveTagIds);
        }

        const finalTagIds = [...finalTechniqueTagIds, ...finalProductTagIds];
        await admin.from("pattern_tags").delete().eq("pattern_id", patternId);
        if (finalTagIds.length > 0) {
          await admin.from("pattern_tags").insert(finalTagIds.map((tag_id: string) => ({ pattern_id: patternId, tag_id })));
        }

        const newPatternPaths: string[] = [];
        for (const path of pattern.pattern_paths as string[]) {
          newPatternPaths.push(await movePendingFileToPublished(path));
        }
        const newCoverPath = pattern.cover_image_path ? await movePendingFileToPublished(pattern.cover_image_path) : null;
        const newGalleryPaths: string[] = [];
        for (const path of pattern.gallery_paths ?? []) {
          newGalleryPaths.push(await movePendingFileToPublished(path));
        }

        await admin
          .from("patterns")
          .update({
            status: "approved",
            moderated_at: new Date().toISOString(),
            pattern_paths: newPatternPaths,
            cover_image_path: newCoverPath,
            gallery_paths: newGalleryPaths,
            ai_disclosed: aiDisclosed,
          })
          .eq("id", patternId);

        sendEmailBackground({
          to: pattern.author_email,
          subject: "¡Tu patrón ya está publicado en La Patronoteca!",
          html: `
            <p>Hola ${pattern.author_name},</p>
            <p>Buenas noticias: tu patrón "<strong>${pattern.short_description}</strong>" ya está publicado en La Patronoteca. ¡Gracias por compartirlo con la comunidad!</p>
            <p><a href="${siteUrl}/patron.html?id=${patternId}">Ver tu patrón publicado</a></p>
            <p>Muchas gracias por tu colaboración, gracias a tu aporte esta comunidad acaba de crecer un poquito más 😊</p>
            <p>La Patronoteca</p>
          `,
        });

        return jsonResponse({ ok: true });
      }

      case "reject": {
        const { reason } = body;
        await deletePendingFiles(pattern);
        await admin
          .from("patterns")
          .update({ status: "rejected", rejected_reason: reason ?? null, moderated_at: new Date().toISOString() })
          .eq("id", patternId);

        sendEmailBackground({
          to: pattern.author_email,
          subject: "Sobre el patrón que enviaste a La Patronoteca",
          html: `
            <p>Hola ${pattern.author_name},</p>
            <p>Gracias por enviar tu patrón "<strong>${pattern.short_description}</strong>" a La Patronoteca. Esta vez no lo hemos podido publicar.</p>
            ${reason ? `<p><strong>Motivo:</strong> ${reason}</p>` : ""}
            <p>Si crees que ha sido un error, puedes responder a este correo.</p>
            <p>La Patronoteca</p>
          `,
        });

        return jsonResponse({ ok: true });
      }

      case "update": {
        const { shortDescription, longDescription, finalTechniqueTagIds = [], finalProductTagIds = [] } = body;

        await admin
          .from("patterns")
          .update({
            short_description: shortDescription,
            long_description: longDescription || null,
          })
          .eq("id", patternId);

        const finalTagIds = [...finalTechniqueTagIds, ...finalProductTagIds];
        await admin.from("pattern_tags").delete().eq("pattern_id", patternId);
        if (finalTagIds.length > 0) {
          await admin.from("pattern_tags").insert(finalTagIds.map((tag_id: string) => ({ pattern_id: patternId, tag_id })));
        }

        return jsonResponse({ ok: true });
      }

      case "delete": {
        const paths = [...pattern.pattern_paths, pattern.cover_image_path, ...(pattern.gallery_paths ?? [])].filter(Boolean) as string[];
        if (paths.length > 0) {
          await admin.storage.from("published").remove(paths);
        }
        await admin.from("patterns").delete().eq("id", patternId);
        return jsonResponse({ ok: true });
      }

      case "reject_and_block": {
        const { reason } = body;
        await deletePendingFiles(pattern);
        await admin
          .from("patterns")
          .update({ status: "rejected", rejected_reason: reason ?? "Bloqueado por seguridad", moderated_at: new Date().toISOString() })
          .eq("id", patternId);

        await admin.from("blocked_identities").upsert(
          [
            { type: "email", value: pattern.author_email, reason: reason ?? null },
            { type: "ip", value: pattern.ip_address, reason: reason ?? null },
          ],
          { onConflict: "type,value" }
        );

        return jsonResponse({ ok: true });
      }

      default:
        return jsonResponse({ ok: false, error: "Acción desconocida." }, 400);
    }
  } catch (err) {
    console.error(err);
    return jsonResponse({ ok: false, error: String(err) }, 500);
  }
});
