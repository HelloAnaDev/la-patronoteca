import exifr from "npm:exifr@7.1.3";

// Heurística de detección de imágenes generadas por IA a partir de metadatos.
//
// IMPORTANTE — limitación real: la mayoría de fotos reales de móvil pierden sus
// metadatos EXIF al pasar por WhatsApp/Instagram/etc. Por eso esta función NUNCA
// debe usarse para bloquear automáticamente: solo sirve como aviso (⚠) para que
// la persona que modera lo revise. Busca "firmas" conocidas que sí dejan las
// herramientas de IA en los metadatos (no la simple ausencia de EXIF de cámara).
const AI_SIGNATURES: Array<{ match: RegExp; label: string }> = [
  { match: /stable\s*diffusion/i, label: "Stable Diffusion" },
  { match: /midjourney/i, label: "Midjourney" },
  { match: /dall[\s·-]?e/i, label: "DALL·E" },
  { match: /c2pa/i, label: "Credenciales de contenido C2PA" },
  { match: /adobe\s*firefly/i, label: "Adobe Firefly" },
  { match: /leonardo\.?ai/i, label: "Leonardo.Ai" },
  { match: /runwayml|runway\s*gen/i, label: "Runway" },
  { match: /nightcafe/i, label: "NightCafe" },
  { match: /comfyui/i, label: "ComfyUI" },
  { match: /trainedalgorithmicmedia|"digitalsourcetype"\s*:\s*"[^"]*generat/i, label: "Metadato de origen algorítmico" },
];

export async function detectAiSignature(bytes: Uint8Array): Promise<{ detected: boolean; signature?: string }> {
  try {
    const meta = await exifr.parse(bytes, { xmp: true, iptc: true, icc: false, tiff: true, png: true }).catch(() => null);
    const metaText = meta ? JSON.stringify(meta) : "";

    // Además del EXIF/XMP ya parseado, buscamos las firmas directamente en los
    // primeros bytes del archivo (ahí suelen ir los chunks de texto de PNG que
    // generan herramientas como Stable Diffusion WebUI/ComfyUI).
    const head = new TextDecoder("utf-8", { fatal: false }).decode(bytes.slice(0, 300_000));
    const haystack = metaText + "\n" + head;

    for (const sig of AI_SIGNATURES) {
      if (sig.match.test(haystack)) {
        return { detected: true, signature: sig.label };
      }
    }
    return { detected: false };
  } catch {
    return { detected: false };
  }
}
