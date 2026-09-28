import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, handleOptions, jsonResponse } from "../_shared/cors.ts";
import { sendEmail } from "../_shared/email.ts";
import { detectAiSignature } from "../_shared/aiMetadata.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const moderatorEmail = Deno.env.get("MODERATOR_EMAIL") ?? "hello.ana.dev@gmail.com";
const siteUrl = Deno.env.get("SITE_URL") ?? "http://localhost:8888";

interface Payload {
  authorName: string;
  authorEmail: string;
  notifyOnComment?: boolean;
  shortDescription: string;
  longDescription?: string;
  originalSource?: string;
  patternPaths: string[];
  coverImagePath?: string;
  galleryPaths?: string[];
  techniqueTagIds: string[];
  productTagIds: string[];
  newProductTagNames?: string[];
  newTechniqueTagName?: string;
}

function normalize(txt: string) {
  return txt
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

async function findOrCreatePendingTag(admin: ReturnType<typeof createClient>, category: "tecnica" | "producto", rawName: string) {
  const displayName = rawName.trim();
  if (!displayName) return null;
  const name = normalize(displayName);

  const { data: existing } = await admin.from("tags").select("id").eq("category", category).eq("name", name).maybeSingle();
  if (existing) return existing.id as string;

  const { data: inserted, error: insertTagError } = await admin
    .from("tags")
    .insert({ category, name, display_name: displayName, status: "pending" })
    .select("id")
    .single();
  if (insertTagError) throw insertTagError;
  return inserted.id as string;
}

Deno.serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  try {
    const body = (await req.json()) as Payload;

    if (!body.authorName || !body.authorEmail || !body.shortDescription || !body.patternPaths?.length) {
      return jsonResponse({ ok: false, error: "Faltan campos obligatorios." }, 400);
    }

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "desconocida";
    const admin = createClient(supabaseUrl, serviceRoleKey);

    // Comprobar bloqueos. Respondemos "todo ok" igualmente para no avisar
    // a quien esté bloqueado de que lo está.
    const { data: blocked } = await admin
      .from("blocked_identities")
      .select("id")
      .or(`and(type.eq.email,value.eq.${body.authorEmail.toLowerCase()}),and(type.eq.ip,value.eq.${ip})`)
      .limit(1);

    if (blocked && blocked.length > 0) {
      return jsonResponse({ ok: true, id: null });
    }

    // Heurística de IA sobre la portada y la galería (solo aviso, nunca bloqueo).
    // Se comprueban todas las imágenes a la vez en vez de una a una, para no
    // sumar el tiempo de descarga de cada una.
    let aiDetected = false;
    let aiSignature: string | undefined;
    const imagePaths = [body.coverImagePath, ...(body.galleryPaths ?? []), ...body.patternPaths].filter(Boolean) as string[];
    const aiChecks = await Promise.all(
      imagePaths.map(async (path) => {
        const { data: fileData } = await admin.storage.from("pending-uploads").download(path);
        if (!fileData) return null;
        const bytes = new Uint8Array(await fileData.arrayBuffer());
        return detectAiSignature(bytes);
      })
    );
    const firstDetected = aiChecks.find((r) => r?.detected);
    if (firstDetected) {
      aiDetected = true;
      aiSignature = firstDetected.signature;
    }

    // Etiquetas sugeridas libremente: hasta 3 de producto y 1 de técnica.
    const newTagIds: string[] = [];
    for (const rawName of (body.newProductTagNames ?? []).slice(0, 3)) {
      const id = await findOrCreatePendingTag(admin, "producto", rawName);
      if (id) newTagIds.push(id);
    }
    if (body.newTechniqueTagName) {
      const id = await findOrCreatePendingTag(admin, "tecnica", body.newTechniqueTagName);
      if (id) newTagIds.push(id);
    }

    const { data: pattern, error: insertError } = await admin
      .from("patterns")
      .insert({
        author_name: body.authorName.trim(),
        author_email: body.authorEmail.trim().toLowerCase(),
        notify_on_comment: !!body.notifyOnComment,
        short_description: body.shortDescription.trim(),
        long_description: body.longDescription?.trim() || null,
        original_source: body.originalSource?.trim() || null,
        pattern_paths: body.patternPaths,
        cover_image_path: body.coverImagePath ?? null,
        gallery_paths: body.galleryPaths ?? [],
        ai_flag_detected: aiDetected,
        ai_flag_signature: aiSignature ?? null,
        ip_address: ip,
      })
      .select("id")
      .single();

    if (insertError) throw insertError;

    const tagIds = [...(body.techniqueTagIds ?? []), ...(body.productTagIds ?? []), ...newTagIds];

    if (tagIds.length > 0) {
      const rows = tagIds.map((tag_id) => ({ pattern_id: pattern.id, tag_id }));
      const { error: tagLinkError } = await admin.from("pattern_tags").insert(rows);
      if (tagLinkError) throw tagLinkError;
    }

    await sendEmail({
      to: moderatorEmail,
      subject: `Nuevo patrón para moderar: "${body.shortDescription}"`,
      html: `
        <p>Hay un nuevo patrón esperando moderación en La Patronoteca.</p>
        <ul>
          <li><strong>Autor/a:</strong> ${body.authorName}</li>
          <li><strong>Descripción:</strong> ${body.shortDescription}</li>
          ${aiDetected ? `<li><strong>⚠ Aviso IA:</strong> ${aiSignature}</li>` : ""}
        </ul>
        <p><a href="${siteUrl}/moderacion.html">Ir al panel de moderación</a></p>
      `,
    });

    return jsonResponse({ ok: true, id: pattern.id });
  } catch (err) {
    console.error(err);
    return jsonResponse({ ok: false, error: String(err) }, 500);
  }
});
