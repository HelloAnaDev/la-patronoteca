import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

// Envía un correo usando Gmail SMTP con una "contraseña de aplicación".
// Variables de entorno necesarias (se configuran con `supabase secrets set`):
//   GMAIL_USER            -> ej. hello.ana.dev@gmail.com
//   GMAIL_APP_PASSWORD    -> contraseña de aplicación de 16 caracteres de Google
export async function sendEmail(opts: { to: string; subject: string; html: string }) {
  const user = Deno.env.get("GMAIL_USER");
  const pass = Deno.env.get("GMAIL_APP_PASSWORD");

  if (!user || !pass) {
    console.warn("GMAIL_USER o GMAIL_APP_PASSWORD no configurados: no se envía email.", opts.subject);
    return;
  }

  const client = new SMTPClient({
    connection: {
      hostname: "smtp.gmail.com",
      port: 465,
      tls: true,
      auth: { username: user, password: pass },
    },
  });

  try {
    await client.send({
      from: `La Patronoteca <${user}>`,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
      content: "auto", // genera correctamente la parte de texto plano y evita artefactos como "=20"
    });
  } finally {
    await client.close();
  }
}
