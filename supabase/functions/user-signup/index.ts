import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, handleOptions, jsonResponse } from "../_shared/cors.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(supabaseUrl, serviceRoleKey);

// Crea una cuenta de email + contraseña para guardar favoritos. Usamos la API
// de administración (service role) para no depender de tener el registro
// público abierto en Supabase Auth, que mantenemos cerrado por seguridad.
Deno.serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  try {
    const { email, password } = await req.json();
    if (!email || !password || String(password).length < 6) {
      return jsonResponse({ ok: false, error: "Escribe un email y una contraseña de al menos 6 caracteres." }, 400);
    }

    const { data, error } = await admin.auth.admin.createUser({
      email: String(email).trim().toLowerCase(),
      password: String(password),
      email_confirm: true,
    });

    if (error) {
      const msg = /already|existe|registered/i.test(error.message)
        ? "Ya existe una cuenta con ese email. Prueba a iniciar sesión."
        : error.message;
      return jsonResponse({ ok: false, error: msg }, 400);
    }

    return jsonResponse({ ok: true, userId: data.user?.id });
  } catch (err) {
    console.error(err);
    return jsonResponse({ ok: false, error: String(err) }, 500);
  }
});
