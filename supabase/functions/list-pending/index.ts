import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, handleOptions, jsonResponse } from "../_shared/cors.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const adminEmail = Deno.env.get("ADMIN_EMAIL") ?? "hello.ana.dev@gmail.com";

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

  const { data: patterns, error: patternsError } = await admin
    .from("patterns")
    .select("*, pattern_tags(tags(*))")
    .eq("status", "pending")
    .order("created_at", { ascending: true });
  if (patternsError) return jsonResponse({ ok: false, error: patternsError.message }, 500);

  const { data: communityLinks, error: linksError } = await admin
    .from("community_links")
    .select("*")
    .eq("status", "pending")
    .order("created_at", { ascending: true });
  if (linksError) return jsonResponse({ ok: false, error: linksError.message }, 500);

  const { data: allTags, error: tagsError } = await admin
    .from("tags")
    .select("*")
    .order("display_name");
  if (tagsError) return jsonResponse({ ok: false, error: tagsError.message }, 500);

  const { data: comments, error: commentsError } = await admin
    .from("comments")
    .select("*, patterns(short_description)")
    .eq("status", "pending")
    .order("created_at", { ascending: true });
  if (commentsError) return jsonResponse({ ok: false, error: commentsError.message }, 500);

  return jsonResponse({ ok: true, patterns, communityLinks, allTags, comments });
});
