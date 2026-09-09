export type Aircraft={icao24:string;callsign:string|null;originCountry:string|null;timePosition:string|null;lastContact:string|null;latitude:number|null;longitude:number|null;altitudeFt:number|null;groundSpeedKts:number|null;headingDeg:number|null;verticalRateFpm:number|null;geoAltitudeFt:number|null;onGround:boolean|null;squawk:string|null;category:number|null};
const BASE=import.meta.env.VITE_BACKEND_URL||'http://localhost:8787';
async function get<T>(path:string):Promise<T>{const r=await fetch(`${BASE}${path}`); const data=await r.json(); if(!r.ok) throw new Error(data.message||'Request failed'); return data;}
export const getAircraft=()=>get<{source:string;fetchedAt:string;time:number;count:number;aircraft:Aircraft[]}>('/api/aircraft?limit=10000');
export const searchAircraft=(q:string)=>get<{fetchedAt:string;count:number;aircraft:Aircraft[]}>(`/api/search?q=${encodeURIComponent(q)}`);
export const getHealth=()=>get<{ok:boolean;liveData:boolean;aircraftCount:number;fetchedAt:string}>('/api/health');
export const askAstra=(message:string)=>fetch(`${BASE}/api/assistant`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({message})}).then(async r=>{const d=await r.json();if(!r.ok)throw new Error(d.message||'Astra unavailable');return d as {answer:string;fetchedAt:string};});
