// Frontend client for our own /api/lta-availability serverless proxy.
// The proxy holds the LTA Datamall key; the browser only ever sees aggregated,
// normalized carpark records.

export type LtaCarpark = {
  id: string;
  agency: 'HDB' | 'URA' | 'LTA';
  name: string;
  area: string;
  lat: number;
  lng: number;
  // null = LTA gave no figure (unknown); 0 = genuinely full.
  lotsAvailable: number | null;
  lotType: string;
};

type ProxyOk = { carparks: LtaCarpark[]; cached: boolean };
type ProxyErr = { error: string; detail?: string };

export async function getLtaCarparks(): Promise<LtaCarpark[]> {
  const res = await fetch('/api/lta-availability');
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as ProxyErr | null;
    throw new Error(body?.error ?? `LTA proxy failed: ${res.status}`);
  }
  const body = (await res.json()) as ProxyOk;
  return body.carparks ?? [];
}
