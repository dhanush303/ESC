import {FormEvent,useMemo,useState} from 'react';
import {Bar,BarChart,Cell,Pie,PieChart,ResponsiveContainer,Tooltip,XAxis,YAxis} from 'recharts';
import MapView from './MapView';
import {buildHotspots} from './hotspots';
import {CATEGORIES} from './sampleData';
import {api,b64} from './api';
import {PIE} from './Admin';
import {Category,Detection,SetDets,Survey} from './types';
const LABEL={pending:'Awaiting cleanup',in_progress:'Cleanup in progress',cleaned:'Cleaned'};
export default function Public({dets,setDets,surveys:SURVEYS,live,reload}:{dets:Detection[];setDets:SetDets;surveys:Survey[];live:boolean;reload:()=>void}){
  const confirmed=useMemo(()=>dets.filter(d=>d.source==='confirmed'),[dets]); // public never sees unreviewed AI detections
  const community=dets.filter(d=>d.source==='community');
  const hs=useMemo(()=>buildHotspots(confirmed,SURVEYS.length),[confirmed]);
  const [sel,setSel]=useState<string|null>(null);
  const h=hs.find(x=>x.id===sel);
  const [pos,setPos]=useState<[number,number]|null>(null);
  const [cat,setCat]=useState<Category>('Plastic');const [desc,setDesc]=useState('');const [photo,setPhoto]=useState<File|null>(null);
  const [msg,setMsg]=useState('');
  const comp=CATEGORIES.map(c=>({name:c,value:confirmed.filter(d=>d.category===c).length})).filter(x=>x.value);
  const status=(['pending','in_progress','cleaned'] as const).map(s=>({name:LABEL[s],value:hs.filter(x=>x.cleanup===s).length}));
  const locate=()=>navigator.geolocation?.getCurrentPosition(p=>setPos([p.coords.latitude,p.coords.longitude]),()=>setMsg('Could not read your location. Tap the map instead.'));
  const submit=(e:FormEvent)=>{e.preventDefault();
    if(!pos){setMsg('Choose a location: tap the map or use your location.');return}
    if(live){(photo?b64(photo):Promise.resolve(undefined)).then(img=>api.community({category:cat,description:desc,lat:pos[0],lng:pos[1],image_b64:img})).then(reload).catch(()=>setMsg('Could not send the report. Try again.'))}else setDets(a=>[...a,{id:`C${Date.now()}`,category:cat,confidence:0,lat:pos[0],lng:pos[1],area:'Community',surveyId:'COMMUNITY',timestamp:new Date().toISOString(),source:'community',cleanup:'pending',description:desc,
      image:photo?URL.createObjectURL(photo):''}]);
    setMsg('Thanks. Your report is shown as unverified until an administrator reviews it.');setDesc('');setPhoto(null);setPos(null)};
  return <div className="stack">
    <section className="stats" aria-label="Public statistics">
      {[['Confirmed hotspots',hs.length],['Confirmed items',confirmed.length],['Hotspots cleaned',hs.filter(x=>x.cleanup==='cleaned').length],['Community reports',community.length]].map(([k,v])=><div className="stat" key={k as string}><b>{v}</b><span>{k}</span></div>)}</section>
    <section className="panel"><h2>Where litter has been confirmed</h2>
      <MapView hotspots={hs} community={community} selectedId={sel} onSelect={setSel} onMapClick={(a,b)=>setPos([a,b])} picked={pos}/>
      {h?<div className="detail" aria-live="polite"><h3>{h.area}</h3>
        <p><span className="badge confirmed">Admin-confirmed</span> {h.count} items, {h.severity} severity</p>
        <p>Last survey: {h.lastSurvey}. Status: <b>{LABEL[h.cleanup]}</b></p>
        <p>{Object.entries(h.categories).map(([k,v])=>`${k}: ${v}`).join(', ')}</p></div>
        :<p className="note">Select a hotspot for details. Tapping the map also sets your report location.</p>}</section>
    <div className="grid2">
      <section className="panel"><h2>What we found</h2><ResponsiveContainer width="100%" height={240}><PieChart><Pie data={comp} dataKey="value" nameKey="name" outerRadius={85} label>{comp.map((_,i)=><Cell key={i} fill={PIE[i%6]}/>)}</Pie><Tooltip/></PieChart></ResponsiveContainer></section>
      <section className="panel"><h2>Cleanup progress</h2><ResponsiveContainer width="100%" height={240}><BarChart data={status}><XAxis dataKey="name"/><YAxis allowDecimals={false}/><Tooltip/><Bar dataKey="value" fill="#1b7f5c"/></BarChart></ResponsiveContainer></section></div>
    <section className="panel"><h2>Report litter</h2>
      <form onSubmit={submit} className="form">
        <label>Category<select value={cat} onChange={e=>setCat(e.target.value as Category)}>{CATEGORIES.map(c=><option key={c}>{c}</option>)}</select></label>
        <label>Photo<input type="file" accept="image/*" onChange={e=>setPhoto(e.target.files?.[0]??null)}/></label>
        <label>Description<textarea value={desc} onChange={e=>setDesc(e.target.value)} rows={3} required/></label>
        <p>Location: {pos?`${pos[0].toFixed(5)}, ${pos[1].toFixed(5)}`:'not set'} <button type="button" onClick={locate}>Use my location</button></p>
        <button type="submit" className="primary">Send report</button>
        {msg&&<p role="status">{msg}</p>}</form></section>
  </div>;
}
