// Configuración pública de La Patronoteca.
// La URL y la "anon key" de Supabase están pensadas para ser públicas (la
// seguridad real la da RLS + las Edge Functions), así que no pasa nada por
// dejarlas en este archivo. NUNCA pongas aquí la "service role key" ni la
// clave de VirusTotal: esas van solo como secretos de las Edge Functions.
window.PATRONOTECA_CONFIG = {
  SUPABASE_URL: "https://kvmxwppltsofhsgnjfdb.supabase.co",
  SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt2bXh3cHBsdHNvZmhzZ25qZmRiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA1MzQyMTYsImV4cCI6MjEwNjExMDIxNn0.UhvM4Dwahi4lpoNUmhkkkPuJPkZZKSNYgDpZwSVHkHA",
  FUNCTIONS_URL: "https://kvmxwppltsofhsgnjfdb.supabase.co/functions/v1",
  ADMIN_EMAIL: "hello.ana.dev@gmail.com",
};
