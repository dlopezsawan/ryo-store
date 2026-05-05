import { NextResponse } from "next/server";

const CACHE_MAX_AGE = 60 * 60; // 1 hora - BCV publica una vez al día

const headers = {
  "Cache-Control": `public, s-maxage=${CACHE_MAX_AGE}, stale-while-revalidate=${CACHE_MAX_AGE * 2}`,
};

/**
 * Obtiene la tasa EUR/VES para convertir total USD → Bs.
 * total_Bs = total_USD * eur_ves
 *
 * Fuentes EUR (orden):
 * 1. api.elcamb.io (alcamb.io - gratis)
 * 2. BCV_API_KEY → bcvapi.tech
 * 3. api-bcvcurs (gratis)
 * 4. BCV_EUR_RATE → variable de entorno manual
 */
export async function GET() {
  const apiKey = process.env.BCV_API_KEY;
  const manualEurRate = process.env.BCV_EUR_RATE;

  let eurVes: number | null = null;
  let date: string | null = null;

  // 1. alcamb.io (api.elcamb.io/history - gratis)
  try {
    const res = await fetch("https://api.elcamb.io/history", {
      next: { revalidate: CACHE_MAX_AGE },
    });
    if (res.ok) {
      const arr = (await res.json()) as Array<{ eur?: string; last_updated?: string }>;
      const last = Array.isArray(arr) ? arr[arr.length - 1] : null;
      const tasa = last ? parseFloat(String(last.eur ?? 0)) : 0;
      if (tasa > 0) {
        eurVes = tasa;
        date = last?.last_updated ?? null;
      }
    }
  } catch {
    /* fallback */
  }

  // 2. bcvapi.tech (requiere API Key)
  if (eurVes == null && apiKey) {
    try {
      const res = await fetch("https://bcvapi.tech/api/v1/euro", {
        headers: { Authorization: apiKey },
        next: { revalidate: CACHE_MAX_AGE },
      });
      if (res.ok) {
        const data = (await res.json()) as { tasa?: number; fecha?: string };
        const tasa = Number(data?.tasa);
        if (tasa > 0) {
          eurVes = tasa;
          date = data?.fecha ?? null;
        }
      }
    } catch {
      /* fallback */
    }
  }

  // 3. api-bcvcurs (gratis)
  if (eurVes == null) {
    try {
      const res = await fetch("https://api-bcvcurs.herokuapp.com/v1/euro", {
        next: { revalidate: CACHE_MAX_AGE },
      });
      if (res.ok) {
        const data = (await res.json()) as { rate?: number; tasa?: number; euro?: number };
        const tasa = Number(data?.rate ?? data?.tasa ?? data?.euro);
        if (tasa > 0) {
          eurVes = tasa;
        }
      }
    } catch {
      /* fallback */
    }
  }

  // 4. Variable de entorno manual
  if (eurVes == null && manualEurRate) {
    const tasa = parseFloat(manualEurRate);
    if (tasa > 0) eurVes = tasa;
  }

  if (eurVes == null) {
    return NextResponse.json(
      {
        error:
          "No hay tasa EUR. Fuentes: alcamb.io, BCV_API_KEY o BCV_EUR_RATE en .env.local",
      },
      { status: 503 }
    );
  }

  // En Venezuela se usa la tasa EUR BCV directamente como referencia para USD → Bs
  // total_Bs = total_USD * eur_ves
  return NextResponse.json(
    { eur: eurVes, usdToBs: eurVes, date },
    { headers }
  );
}
