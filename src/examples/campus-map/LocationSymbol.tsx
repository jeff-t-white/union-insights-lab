export type LocationKind = 'coffee' | 'cafeteria' | 'restaurant' | 'market' | 'vending';

export const symbolLabels: Record<LocationKind, string> = {
  coffee: 'Café / coffee', cafeteria: 'Dining hall / cafeteria',
  restaurant: 'Restaurant / other dining', market: 'Market / convenience', vending: 'Vending',
};

export function diningKind(name: string, provider: string): LocationKind {
  if (/cafeteria/i.test(name) || (provider === 'housing' && /^(Carson’s|Four Lakes|Gordon Avenue|Liz’s|Rheta’s) Market$/.test(name))) return 'cafeteria';
  if (/caf[eé]|coffee|peets|starbucks|java|bean & creamery|ground truth|prairie fire|revive/i.test(name)) return 'coffee';
  if (/market|flamingo run/i.test(name)) return 'market';
  return 'restaurant';
}

/** Small, monochrome, code-native icons inherit the location provider color. */
export function LocationSymbol({ kind }: { kind: LocationKind }) {
  return <svg className="location-symbol" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    {kind === 'coffee' && <><path d="M4 8h12v7a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4Z" /><path d="M16 9h2a3 3 0 0 1 0 6h-2M3 22h16M7 2v3m4-3v3" /></>}
    {kind === 'cafeteria' && <><path d="M2 19h20M4 16h16a8 8 0 0 0-16 0ZM12 6V4m-2 0h4" /></>}
    {kind === 'restaurant' && <><path d="M5 3v6m3-6v6M2 3v6a3 3 0 0 0 6 0M5 12v9M19 3c-4 3-5 7-5 10h5m0-10v18" /></>}
    {kind === 'market' && <><path d="M5 8h14l2 13H3ZM8 8V6a4 4 0 0 1 8 0v2" /></>}
    {kind === 'vending' && <><rect x="3" y="2" width="18" height="20" rx="2" /><path d="m7 7 3.5 10L14 7m3 4h1m-1 4h1" /></>}
  </svg>;
}
