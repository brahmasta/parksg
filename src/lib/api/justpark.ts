// Frontend client for our own /api/justpark-availability serverless proxy.
// The proxy performs CapitaLand JustPark's antiforgery handshake server-side
// and returns live lot counts already keyed by our DB carpark ids
// (e.g. "LTA:65" → Bedok Mall).

export type JustParkLot = {
  id: string;
  lotsAvailable: number | null;
  lotsTotal: number | null;
};

type ProxyOk = { carparks: JustParkLot[]; cached: boolean; stale?: boolean };
type ProxyErr = { error: string; detail?: string };

export async function getJustParkLots(): Promise<JustParkLot[]> {
  const res = await fetch('/api/justpark-availability');
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as ProxyErr | null;
    throw new Error(body?.error ?? `JustPark proxy failed: ${res.status}`);
  }
  const body = (await res.json()) as ProxyOk;
  return body.carparks ?? [];
}
