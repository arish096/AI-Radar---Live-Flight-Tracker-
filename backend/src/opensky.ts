export type RawState = [
  string, string | null, string | null, number | null, number | null,
  number | null, number | null, number | null, boolean | null, number | null,
  number | null, number | null, number[] | null, number | null, string | null,
  boolean | null, number | null, number | null
];

export interface Aircraft {
  icao24: string;
  callsign: string | null;
  originCountry: string | null;
  timePosition: string | null;
  lastContact: string | null;
  latitude: number | null;
  longitude: number | null;
  altitudeFt: number | null;
  groundSpeedKts: number | null;
  headingDeg: number | null;
  verticalRateFpm: number | null;
  geoAltitudeFt: number | null;
  onGround: boolean | null;
  squawk: string | null;
  category: number | null;
}

export interface Snapshot { fetchedAt: string; time: number; aircraft: Aircraft[]; }

const API = 'https://opensky-network.org/api/states/all';
const TOKEN_URL = 'https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token';

let token: { value: string; expiresAt: number } | null = null;
let cache: { snapshot: Snapshot; expiresAt: number } | null = null;
let inFlight: Promise<Snapshot> | null = null;

const num = (v: number | null | undefined) => typeof v === 'number' && Number.isFinite(v) ? v : null;
const metersToFeet = (v: number | null) => v == null ? null : v * 3.280839895;
const msToKnots = (v: number | null) => v == null ? null : v * 1.943844492;
const msToFpm = (v: number | null) => v == null ? null : v * 196.8503937;

async function getToken(force = false): Promise<string | null> {
  const id = process.env.OPEN_SKY_CLIENT_ID;
  const secret = process.env.OPEN_SKY_CLIENT_SECRET;
  if (!id || !secret) return null;
  if (!force && token && token.expiresAt > Date.now() + 30_000) return token.value;
  const body = new URLSearchParams({grant_type:'client_credentials', client_id:id, client_secret:secret});
  const res = await fetch(TOKEN_URL, {method:'POST', headers:{'content-type':'application/x-www-form-urlencoded'}, body, signal: AbortSignal.timeout(Number(process.env.REQUEST_TIMEOUT_MS ?? 12000))});
  if (!res.ok) throw new Error(`OpenSky OAuth failed (${res.status})`);
  const data = await res.json() as {access_token:string; expires_in?:number};
  token = {value:data.access_token, expiresAt:Date.now() + ((data.expires_in ?? 1800) * 1000)};
  return token.value;
}

function normalize(states: RawState[], time: number): Aircraft[] {
  return states.map(s => ({
    icao24: String(s[0]).toLowerCase(),
    callsign: s[1]?.trim() || null,
    originCountry: s[2] || null,
    timePosition: s[3] ? new Date(s[3] * 1000).toISOString() : null,
    lastContact: s[4] ? new Date(s[4] * 1000).toISOString() : null,
    longitude: num(s[5]), latitude: num(s[6]), altitudeFt: metersToFeet(num(s[7])),
    groundSpeedKts: msToKnots(num(s[9])), headingDeg: num(s[10]), verticalRateFpm: msToFpm(num(s[11])),
    geoAltitudeFt: metersToFeet(num(s[13])), onGround: typeof s[8] === 'boolean' ? s[8] : null,
    squawk: s[14] || null, category: num(s[17])
  })).filter(a => a.latitude !== null && a.longitude !== null);
}

async function fetchSnapshot(): Promise<Snapshot> {
  const url = new URL(API);
  const auth = await getToken();
  const headers: Record<string,string> = {'accept':'application/json','user-agent':'AI-Radar/1.0'};
  if (auth) headers.authorization = `Bearer ${auth}`;
  let res = await fetch(url, {headers, signal: AbortSignal.timeout(Number(process.env.REQUEST_TIMEOUT_MS ?? 12000))});
  if (res.status === 401 && auth) {
    await getToken(true);
    const fresh = await getToken();
    res = await fetch(url, {headers:{...headers, authorization:`Bearer ${fresh}`}, signal: AbortSignal.timeout(Number(process.env.REQUEST_TIMEOUT_MS ?? 12000))});
  }
  if (res.status === 429) throw new Error('OPENSKY_RATE_LIMIT');
  if (!res.ok) throw new Error(`OPENSKY_HTTP_${res.status}`);
  const data = await res.json() as {time:number; states?:RawState[]|null};
  return {fetchedAt:new Date().toISOString(), time:data.time, aircraft:normalize(data.states ?? [], data.time)};
}

export async function getSnapshot(force = false): Promise<Snapshot> {
  const ttl = Number(process.env.CACHE_TTL_MS ?? 10000);
  if (!force && cache && cache.expiresAt > Date.now()) return cache.snapshot;
  if (inFlight) return inFlight;
  inFlight = fetchSnapshot().then(s => { cache = {snapshot:s, expiresAt:Date.now()+ttl}; return s; }).finally(() => { inFlight = null; });
  try { return await inFlight; } catch (err) {
    if (cache?.snapshot) return cache.snapshot;
    throw err;
  }
}

export function filterBox(aircraft: Aircraft[], box: {lamin:number;lomin:number;lamax:number;lomax:number}) {
  return aircraft.filter(a => a.latitude !== null && a.longitude !== null && a.latitude >= box.lamin && a.latitude <= box.lamax && a.longitude >= box.lomin && a.longitude <= box.lomax);
}

export function findByQuery(aircraft: Aircraft[], q: string) {
  const needle = q.trim().toLowerCase();
  return aircraft.filter(a => a.icao24.includes(needle) || (a.callsign ?? '').toLowerCase().includes(needle));
}

export function haversineKm(lat1:number, lon1:number, lat2:number, lon2:number) {
  const r=6371, rad=(d:number)=>d*Math.PI/180, dLat=rad(lat2-lat1), dLon=rad(lon2-lon1);
  const x=Math.sin(dLat/2)**2+Math.cos(rad(lat1))*Math.cos(rad(lat2))*Math.sin(dLon/2)**2;
  return r*2*Math.atan2(Math.sqrt(x),Math.sqrt(1-x));
}
