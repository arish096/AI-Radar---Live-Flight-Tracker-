import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import OpenAI from 'openai';
import { getSnapshot, filterBox, findByQuery, haversineKm, type Aircraft } from './opensky.js';

const app=express();
const port=Number(process.env.BACKEND_PORT ?? 8787);
app.use(cors({origin:process.env.CORS_ORIGIN?.split(',').map(s=>s.trim()) ?? true}));
app.use(express.json({limit:'256kb'}));

function parseBox(q:any) {
  const vals=['lamin','lomin','lamax','lomax'].map(k=>Number(q[k]));
  return vals.every(Number.isFinite) ? {lamin:vals[0],lomin:vals[1],lamax:vals[2],lomax:vals[3]} : null;
}
function limit(xs:Aircraft[], q:any) { const n=Math.min(Math.max(Number(q.limit)||5000,1),10000); return xs.slice(0,n); }
function friendlyError(err:unknown) { const m=err instanceof Error?err.message:String(err); if(m==='OPENSKY_RATE_LIMIT') return {status:429, code:'UPSTREAM_RATE_LIMIT', message:'OpenSky rate limit reached. Please retry shortly.'}; return {status:503, code:'LIVE_DATA_UNAVAILABLE', message:'Live aircraft data is currently unavailable.'}; }

app.get('/api/health', async (_req,res)=>{
  try { const s=await getSnapshot(); res.json({ok:true,liveData:true,aircraftCount:s.aircraft.length,fetchedAt:s.fetchedAt,source:'OpenSky Network'}); }
  catch(err){ const e=friendlyError(err); res.status(e.status).json({ok:false,liveData:false,...e}); }
});

async function aircraftHandler(req:any,res:any){
  try { const s=await getSnapshot(); const box=parseBox(req.query); const data=box?filterBox(s.aircraft,box):s.aircraft; res.json({source:'OpenSky Network',fetchedAt:s.fetchedAt,time:s.time,count:data.length,aircraft:limit(data,req.query)}); }
  catch(err){ const e=friendlyError(err); res.status(e.status).json(e); }
}
app.get('/api/aircraft', aircraftHandler);
app.get('/api/aircraft/area', (req,res)=>{ if(!parseBox(req.query)) return res.status(400).json({code:'INVALID_AREA',message:'Provide lamin,lomin,lamax,lomax numeric bounds.'}); return aircraftHandler(req,res); });
app.get('/api/aircraft/:icao24', async (req,res)=>{
  try { const s=await getSnapshot(); const a=s.aircraft.find(x=>x.icao24===req.params.icao24.toLowerCase()); if(!a) return res.status(404).json({code:'AIRCRAFT_NOT_FOUND',message:'Aircraft is not present in the current live dataset.'}); res.json({source:'OpenSky Network',fetchedAt:s.fetchedAt,aircraft:a}); }
  catch(err){ const e=friendlyError(err); res.status(e.status).json(e); }
});
app.get('/api/search', async (req,res)=>{
  const q=String(req.query.q??'').trim(); if(!q) return res.status(400).json({code:'INVALID_SEARCH',message:'Search query is required.'});
  try { const s=await getSnapshot(); const data=findByQuery(s.aircraft,q).slice(0,100); res.json({source:'OpenSky Network',fetchedAt:s.fetchedAt,count:data.length,aircraft:data}); }
  catch(err){ const e=friendlyError(err); res.status(e.status).json(e); }
});

async function currentFiltered(args:any) {
  const s=await getSnapshot(); let a=s.aircraft;
  if(args?.box) a=filterBox(a,args.box);
  if(args?.q) a=findByQuery(a,String(args.q));
  const minAlt=Number.isFinite(args?.minAltitudeFt)?args.minAltitudeFt:null, maxAlt=Number.isFinite(args?.maxAltitudeFt)?args.maxAltitudeFt:null;
  const minSpd=Number.isFinite(args?.minSpeedKts)?args.minSpeedKts:null, maxSpd=Number.isFinite(args?.maxSpeedKts)?args.maxSpeedKts:null;
  const minH=Number.isFinite(args?.minHeadingDeg)?args.minHeadingDeg:null, maxH=Number.isFinite(args?.maxHeadingDeg)?args.maxHeadingDeg:null;
  a=a.filter(x=>(minAlt===null|| (x.altitudeFt??-Infinity)>=minAlt)&&(maxAlt===null|| (x.altitudeFt??Infinity)<=maxAlt)&&(minSpd===null||(x.groundSpeedKts??-Infinity)>=minSpd)&&(maxSpd===null||(x.groundSpeedKts??Infinity)<=maxSpd)&&(minH===null||(x.headingDeg??-Infinity)>=minH)&&(maxH===null||(x.headingDeg??Infinity)<=maxH));
  return {snapshot:s,aircraft:a};
}

app.post('/api/assistant', async (req,res)=>{
  const key=process.env.OPENAI_API_KEY;
  if(!key) return res.status(503).json({code:'AI_NOT_CONFIGURED',message:'Astra local chat is not configured. Add OPENAI_API_KEY to the backend environment.'});
  const prompt=String(req.body?.message??'').trim();
  if(!prompt) return res.status(400).json({code:'INVALID_MESSAGE',message:'Message is required.'});
  const client=new OpenAI({apiKey:key});
  const tools=[
    {type:'function' as const,name:'get_live_aircraft',description:'Return current aircraft from the live backend dataset. Never invent aircraft.',parameters:{type:'object',properties:{limit:{type:'number'}},additionalProperties:false}},
    {type:'function' as const,name:'search_aircraft',description:'Search the current live dataset by callsign or ICAO24.',parameters:{type:'object',properties:{q:{type:'string'}},required:['q'],additionalProperties:false}},
    {type:'function' as const,name:'get_aircraft_details',description:'Get one current aircraft by ICAO24.',parameters:{type:'object',properties:{icao24:{type:'string'}},required:['icao24'],additionalProperties:false}},
    {type:'function' as const,name:'filter_aircraft',description:'Filter current live aircraft by altitude, speed and heading.',parameters:{type:'object',properties:{minAltitudeFt:{type:'number'},maxAltitudeFt:{type:'number'},minSpeedKts:{type:'number'},maxSpeedKts:{type:'number'},minHeadingDeg:{type:'number'},maxHeadingDeg:{type:'number'}},additionalProperties:false}},
    {type:'function' as const,name:'get_aircraft_near_location',description:'Find current aircraft near a latitude/longitude. Use this when the user asks which aircraft are near a location.',parameters:{type:'object',properties:{latitude:{type:'number'},longitude:{type:'number'},radiusKm:{type:'number'},limit:{type:'number'}},required:['latitude','longitude'],additionalProperties:false}}
  ];
  const system='You are Astra, the AI assistant inside AI Radar. Aircraft facts MUST come only from the live backend tools. Never invent callsigns, positions, altitudes, speeds, headings or flight status. If live data is unavailable or a field is null, say so. When a user names a city such as Delhi, use geographic reasoning only to select coordinates, then query the live nearby-aircraft tool; do not claim an aircraft is near a city without tool data. Mention the live dataset timestamp when useful.';
  const runTool=async(name:string,args:any)=>{
    const s=await getSnapshot();
    if(name==='get_live_aircraft') return {source:'OpenSky Network',fetchedAt:s.fetchedAt,count:s.aircraft.length,aircraft:s.aircraft.slice(0,Math.min(Number(args.limit)||100,500))};
    if(name==='search_aircraft') return {source:'OpenSky Network',fetchedAt:s.fetchedAt,...(()=>{const a=findByQuery(s.aircraft,String(args.q));return {count:a.length,aircraft:a.slice(0,100)}})()};
    if(name==='get_aircraft_details'){const a=s.aircraft.find(x=>x.icao24===String(args.icao24).toLowerCase());return {source:'OpenSky Network',fetchedAt:s.fetchedAt,aircraft:a??null};}
    if(name==='filter_aircraft'){const {aircraft}=await currentFiltered(args);return {source:'OpenSky Network',fetchedAt:s.fetchedAt,count:aircraft.length,aircraft:aircraft.slice(0,200)};}
    if(name==='get_aircraft_near_location'){const lat=Number(args.latitude),lon=Number(args.longitude),radius=Number(args.radiusKm)||100;const a=s.aircraft.filter(x=>x.latitude!=null&&x.longitude!=null).map(x=>({...x,distanceKm:haversineKm(lat,lon,x.latitude!,x.longitude!)})).filter(x=>x.distanceKm<=radius).sort((a,b)=>a.distanceKm-b.distanceKm).slice(0,Math.min(Number(args.limit)||10,50));return {source:'OpenSky Network',fetchedAt:s.fetchedAt,count:a.length,aircraft:a};}
    throw new Error('Unknown live-flight tool');
  };
  try {
    let response=await client.responses.create({model:process.env.OPENAI_MODEL??'gpt-5.6',input:[{role:'system',content:system},{role:'user',content:prompt}],tools});
    for(let round=0;round<4;round++){
      const calls=(response.output??[]).filter((x:any)=>x.type==='function_call') as any[];
      if(!calls.length) break;
      const outputs=[];
      for(const call of calls){
        try{const result=await runTool(call.name,JSON.parse(call.arguments||'{}'));outputs.push({type:'function_call_output' as const,call_id:call.call_id,output:JSON.stringify(result)});}
        catch(err){outputs.push({type:'function_call_output' as const,call_id:call.call_id,output:JSON.stringify({error:'LIVE_DATA_UNAVAILABLE',message:'Live aircraft data is currently unavailable.'})});}
      }
      response=await client.responses.create({model:process.env.OPENAI_MODEL??'gpt-5.6',previous_response_id:response.id,input:outputs,tools});
    }
    res.json({answer:response.output_text||'I could not produce an answer from the current live dataset.',fetchedAt:(await getSnapshot()).fetchedAt});
  } catch(err){ console.error(err); res.status(503).json({code:'AI_ERROR',message:'Astra could not complete the live-data query.'}); }
});

app.use((_req,res)=>res.status(404).json({code:'NOT_FOUND',message:'Endpoint not found.'}));
app.listen(port,()=>console.log(`AI Radar backend listening on http://localhost:${port}`));
