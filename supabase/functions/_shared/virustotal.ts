// Analiza una URL en VirusTotal, exactamente igual que si alguien entrara en
// virustotal.com, pegara el enlace y le diera a "Analizar".
// Variable de entorno necesaria: VIRUSTOTAL_API_KEY (gratuita, de virustotal.com)

const VT_API = "https://www.virustotal.com/api/v3";

export async function scanUrlWithVirusTotal(url: string) {
  const apiKey = Deno.env.get("VIRUSTOTAL_API_KEY");
  if (!apiKey) {
    throw new Error("VIRUSTOTAL_API_KEY no está configurada.");
  }

  const submitRes = await fetch(`${VT_API}/urls`, {
    method: "POST",
    headers: {
      "x-apikey": apiKey,
      "content-type": "application/x-www-form-urlencoded",
    },
    body: `url=${encodeURIComponent(url)}`,
  });

  if (!submitRes.ok) {
    const errorBody = await submitRes.text().catch(() => "");
    throw new Error(`VirusTotal rechazó el envío (${submitRes.status}): ${errorBody}`);
  }

  const submitJson = await submitRes.json();
  const analysisId: string = submitJson.data.id;

  // VirusTotal tarda unos segundos en analizar. Reintentamos varias veces.
  for (let i = 0; i < 8; i++) {
    await new Promise((r) => setTimeout(r, 3000));
    const checkRes = await fetch(`${VT_API}/analyses/${analysisId}`, {
      headers: { "x-apikey": apiKey },
    });
    if (!checkRes.ok) continue;
    const checkJson = await checkRes.json();
    const status = checkJson.data.attributes.status;
    if (status === "completed") {
      const stats = checkJson.data.attributes.stats;
      return {
        analysisId,
        stats,
        isClean: (stats.malicious ?? 0) === 0 && (stats.suspicious ?? 0) === 0,
        raw: checkJson.data.attributes,
      };
    }
  }

  return { analysisId, stats: null, isClean: false, pending: true, raw: null };
}
