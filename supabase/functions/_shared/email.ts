import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

// Envía un correo usando Gmail SMTP con una "contraseña de aplicación".
// Variables de entorno necesarias (se configuran con `supabase secrets set`):
//   GMAIL_USER            -> ej. hello.ana.dev@gmail.com
//   GMAIL_APP_PASSWORD    -> contraseña de aplicación de 16 caracteres de Google

// Codificamos el cuerpo en base64 en vez de dejar que la librería use
// "quoted-printable": esa codificación puede cortar mal el texto al partirlo
// en líneas y dejar artefactos visibles como "=20" en el correo recibido.
// Base64 no tiene ese problema.
function toBase64MimePart(text: string, mimeType: string) {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  const base64 = btoa(binary).replace(/.{76}/g, "$&\r\n");
  return { mimeType, content: base64, transferEncoding: "base64" };
}

function htmlToPlainText(html: string) {
  return html
    .replace(/<head((.|\n|\r)*?)<\/head>/g, "")
    .replace(/<style((.|\n|\r)*?)<\/style>/g, "")
    .replace(/<[^>]+>/g, "");
}

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
      mimeContent: [
        toBase64MimePart(htmlToPlainText(opts.html), 'text/plain; charset="utf-8"'),
        toBase64MimePart(opts.html, 'text/html; charset="utf-8"'),
      ],
    });
  } finally {
    await client.close();
  }
}
