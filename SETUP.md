# Poner en marcha La Patronoteca (100% gratis)

Esta guía está pensada para hacerse una sola vez, sin experiencia técnica previa.
Tardarás entre 30 y 60 minutos. Sigue los pasos en orden.

## Resumen de lo que vamos a usar (todo gratis, sin tarjeta de crédito)

- **Supabase**: base de datos, almacén de PDFs/fotos, login de moderación y la "trastienda" que analiza los PDFs y manda los emails.
- **VirusTotal**: el antivirus online que analiza cada PDF.
- **Gmail**: para que la web te mande los avisos de moderación (con hello.ana.dev@gmail.com).
- **Netlify**: para publicar la página web en internet.

---

## 1. Crear el proyecto en Supabase

1. Ve a https://supabase.com y crea una cuenta gratis (con tu Gmail, por ejemplo).
2. Crea un **nuevo proyecto**. Ponle de nombre "patronoteca". Elige una contraseña de base de datos (guárdala, aunque no la necesitarás casi nunca) y una región cercana (ej. Europa).
3. Espera un par de minutos a que el proyecto se cree.

## 2. Crear las tablas y la seguridad de la base de datos

1. Dentro del proyecto, en el menú de la izquierda, entra en **SQL Editor**.
2. Abre el archivo `supabase/schema.sql` de esta carpeta, copia **todo** su contenido y pégalo en el editor.
3. Pulsa **Run**. Debería terminar sin errores. Esto crea todas las tablas, la seguridad y las etiquetas "OTROS".

## 3. Crear tu usuario de moderación

1. Ve a **Authentication → Users** (en el menú de la izquierda).
2. Pulsa **Add user → Create new user**.
3. Email: `hello.ana.dev@gmail.com` (o el que prefieras usar para moderar).
4. Ponle una contraseña seguridad y márcala como "Auto Confirm User".
5. Guarda. Esta es la cuenta con la que entrarás en `moderacion.html`.

## 4. Copiar las claves públicas al sitio web

1. Ve a **Project Settings → API**.
2. Copia la **Project URL** y pégala en `assets/js/config.js`, en `SUPABASE_URL`.
3. Copia la **anon public key** y pégala en `SUPABASE_ANON_KEY`.
4. La **Functions URL** es la Project URL añadiendo `/functions/v1` al final (ej. `https://tuproyecto.supabase.co/functions/v1`). Pégala en `FUNCTIONS_URL`.
5. En `ADMIN_EMAIL` deja el email que usaste en el paso 3.

## 5. Conseguir tu API key gratuita de VirusTotal

1. Ve a https://www.virustotal.com y crea una cuenta gratis.
2. Entra en tu perfil (arriba a la derecha) → **API Key**. Copia esa clave larga.
3. Guárdala para el paso 7 (no la escribas en ningún archivo del proyecto).

## 6. Preparar Gmail para enviar los avisos

1. En la cuenta de Gmail que quieras usar, activa la **verificación en dos pasos** (Cuenta de Google → Seguridad).
2. Una vez activada, busca **Contraseñas de aplicaciones** (Cuenta de Google → Seguridad → Contraseñas de aplicaciones).
3. Crea una nueva, ponle de nombre "Patronoteca", y copia la contraseña de 16 letras que te da. Guárdala para el paso siguiente.

## 7. Instalar la herramienta de Supabase y publicar la "trastienda" (Edge Functions)

Esto se hace una vez desde el ordenador, con la terminal (símbolo del sistema / PowerShell).

1. Instala Node.js si no lo tienes: https://nodejs.org (la versión "LTS").
2. Instala la herramienta de Supabase:
   ```
   npm install -g supabase
   ```
3. Entra en la carpeta del proyecto:
   ```
   cd "C:\xampp\htdocs\patronoteca"
   ```
4. Inicia sesión:
   ```
   supabase login
   ```
5. Conecta esta carpeta con tu proyecto de Supabase (te pedirá el "project ref", que ves en la URL del proyecto o en Project Settings → General):
   ```
   supabase link --project-ref TU-PROJECT-REF
   ```
6. Configura los secretos (sustituye los valores entre `<>` por los tuyos; nada de esto se ve nunca en la web):
   ```
   supabase secrets set VIRUSTOTAL_API_KEY=<tu-api-key-de-virustotal>
   supabase secrets set GMAIL_USER=hello.ana.dev@gmail.com
   supabase secrets set GMAIL_APP_PASSWORD=<tu-contraseña-de-aplicacion-de-16-letras>
   supabase secrets set MODERATOR_EMAIL=hello.ana.dev@gmail.com
   supabase secrets set ADMIN_EMAIL=hello.ana.dev@gmail.com
   supabase secrets set SITE_URL=https://tu-sitio.netlify.app
   ```
7. Publica las seis funciones:
   ```
   supabase functions deploy submit-pattern
   supabase functions deploy submit-community-link
   supabase functions deploy report-content
   supabase functions deploy moderate-pattern
   supabase functions deploy moderate-community-link
   supabase functions deploy list-pending
   ```

Si más adelante cambias algún secreto (por ejemplo, si renuevas la contraseña de Gmail), solo tienes que repetir el `supabase secrets set` correspondiente; no hace falta volver a publicar las funciones.

## 8. Publicar la web en Netlify (gratis)

**Opción sencilla (arrastrar y soltar), sin usar la terminal:**

1. Ve a https://app.netlify.com y crea una cuenta gratis.
2. En el panel, busca la opción de subir un sitio arrastrando una carpeta ("Deploys" → arrastra la carpeta del proyecto, o usa "Deploy manually").
3. Arrastra la carpeta `patronoteca` completa (con el `index.html` dentro).
4. Netlify te dará una dirección tipo `https://algo-al-azar.netlify.app`. Puedes cambiarla en **Site settings → Change site name**.
5. Actualiza `SITE_URL` en el paso 7.6 con esa dirección definitiva y vuelve a ejecutar ese `supabase secrets set SITE_URL=...`.
6. **Importante para el login de moderación:** en Supabase, ve a Authentication → URL Configuration y añade tu dirección real de Netlify (ej. `https://tu-sitio.netlify.app/*`) en "Redirect URLs", y ponla también como "Site URL". Si no lo haces, el enlace mágico de acceso a moderación no funcionará en la web publicada (solo en local).

Cada vez que cambies algo en la carpeta del proyecto, vuelve a arrastrarla a Netlify para actualizar la web (o conecta un repositorio de GitHub desde Netlify para que se actualice sola).

---

## Cómo probarlo todo

1. Abre tu web publicada y entra en "Subir un patrón". Sube un PDF de prueba.
2. Revisa que te llega el email de aviso a `hello.ana.dev@gmail.com`.
3. Entra en `tuweb.netlify.app/moderacion.html`, inicia sesión con la cuenta del paso 3.
4. Pulsa "Analizar PDF" (tarda unos segundos), luego "Ver PDF", y prueba "Aceptar".
5. Comprueba que el patrón aparece en la portada y que el email de "publicado" llega a quien lo subió.

## Límites del plan gratuito a tener en cuenta

- Supabase gratis: 500 MB de base de datos y 1 GB de archivos — de sobra para empezar; si algún día se llena, Supabase avisa antes de cobrar nada.
- VirusTotal gratis: unos 4 análisis por minuto y 500 al día — más que suficiente salvo que lleguen muchísimos patrones a la vez.
- Nada de esto pide tarjeta de crédito para el uso gratuito.
