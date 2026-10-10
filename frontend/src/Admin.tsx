import {useMemo,useState} from 'react';
import {Bar,BarChart,CartesianGrid,Cell,Legend,Line,LineChart,Pie,PieChart,ResponsiveContainer,Tooltip,XAxis,YAxis} from 'recharts';
import MapView,{SEV_COLOR} from './MapView';
import {buildHotspots,SEV} from './hotspots';
import {CATEGORIES} from './sampleData';
import {api} from './api';
import {Cleanup,Detection,SetDets,Survey} from './types';
export const PIE=['#1b7f5c','#2f6fb3','#8d6e63','#f2b84b','#7e57c2','#78909c'];
const sel_=(l:string,v:string,on:(v:string)=>void,opts:string[][])=><label>{l}<select value={v} onChange={e=>on(e.target.value)}><option value="all">All</option>{opts.map(([k,t])=><option key={k} value={k}>{t}</option>)}</select></label>;
export default function Admin({dets,setDets,surveys:SURVEYS,live}:{dets:Detection[];setDets:SetDets;surveys:Survey[];live:boolean}){
  const [f,setF]=useState({survey:'all',area:'all',cat:'all',sev:'all',src:'all'});
  const [sel,setSel]=useState<string|null>(null);
  const set=(k:string)=>(v:string)=>{setF({...f,[k]:v});setSel(null)};
  const ai=useMemo(()=>dets.filter(d=>d.source!=='community'),[dets]);
  const areas=[...new Set(ai.map(d=>d.area))];
  const base=useMemo(()=>ai.filter(d=>(f.survey==='all'||d.surveyId===f.survey)&&(f.area==='all'||d.area===f.area)&&(f.cat==='all'||d.category===f.cat)&&(f.src==='all'||d.source===f.src)),[ai,f]);
  const hs=useMemo(()=>buildHotspots(base,f.survey==='all'?SURVEYS.length:1).filter(h=>f.sev==='all'||h.severity===f.sev),[base,f]);
  const shown=useMemo(()=>{const ids=new Set(hs.flatMap(h=>h.detections.map(d=>d.id)));return base.filter(d=>ids.has(d.id))},[base,hs]);
  const list=(sel?hs.find(h=>h.id===sel)?.detections??[]:shown).slice().sort((a,b)=>b.timestamp.localeCompare(a.timestamp)).slice(0,25);
  const upd=(id:string,p:Partial<Detection>)=>{setDets(a=>a.map(d=>d.id===id?{...d,...p}:d));if(live)api.patch(id,p).catch(e=>alert(e.message))};
  const surveys=SURVEYS.filter(s=>f.survey==='all'||s.id===f.survey);
  const coverage=surveys.reduce((s,x)=>s+x.coverageKm2,0);
  const comp=CATEGORIES.map(c=>({name:c,value:shown.filter(d=>d.category===c).length})).filter(x=>x.value);
  const byCat=CATEGORIES.map(c=>({name:c,...Object.fromEntries((['pending','in_progress','cleaned'] as Cleanup[]).map(s=>[s,shown.filter(d=>d.category===c&&d.cleanup===s).length]))}));
  const bySev=SEV.map(s=>({name:s,hotspots:hs.filter(h=>h.severity===s).length}));
  const trend=SURVEYS.map(s=>{const n=shown.filter(d=>d.surveyId===s.id).length;return {survey:s.date,detections:n,per_km2:+(n/s.coverageKm2).toFixed(1)}});
  const pending=shown.filter(d=>d.source==='ai').length;
  return <div className="stack">
    <section className="stats" aria-label="Summary">
      {[['Detections',shown.length],['Hotspots',hs.length],['Critical hotspots',hs.filter(h=>h.severity==='critical').length],['Surveyed (km²)',coverage.toFixed(1)],['Awaiting review',pending]].map(([k,v])=><div key={k as string} className="stat"><b>{v}</b><span>{k}</span></div>)}</section>
    <section className="filters" aria-label="Filters">
      {sel_('Survey',f.survey,set('survey'),SURVEYS.map(s=>[s.id,s.date]))}
      {sel_('Area',f.area,set('area'),areas.map(a=>[a,a]))}
      {sel_('Waste category',f.cat,set('cat'),CATEGORIES.map(c=>[c,c]))}
      {sel_('Severity',f.sev,set('sev'),SEV.map(s=>[s,s]))}
      {sel_('Source',f.src,set('src'),[['ai','AI-detected'],['confirmed','Confirmed']])}</section>
    <section className="panel"><h2>Hotspot map</h2>
      <MapView hotspots={hs} selectedId={sel} onSelect={setSel}/>
      <p className="note">Locations are the drone's position at capture, not exact object positions. Exact placement needs camera geometry and telemetry (Stage 4).</p></section>
    <div className="grid2">
      <section className="panel"><h2>Waste composition</h2><ResponsiveContainer width="100%" height={240}><PieChart>
        <Pie data={comp} dataKey="value" nameKey="name" outerRadius={85} label>{comp.map((_,i)=><Cell key={i} fill={PIE[i%6]}/>)}</Pie><Tooltip/><Legend/></PieChart></ResponsiveContainer></section>
      <section className="panel"><h2>Categories by cleanup status</h2><ResponsiveContainer width="100%" height={240}><BarChart data={byCat}>
        <CartesianGrid strokeDasharray="3 3"/><XAxis dataKey="name"/><YAxis/><Tooltip/><Legend/>
        <Bar dataKey="pending" stackId="a" fill="#c62828"/><Bar dataKey="in_progress" stackId="a" fill="#e0b030"/><Bar dataKey="cleaned" stackId="a" fill="#2e9e5b"/></BarChart></ResponsiveContainer></section>
      <section className="panel"><h2>Hotspot severity</h2><ResponsiveContainer width="100%" height={240}><BarChart data={bySev}>
        <CartesianGrid strokeDasharray="3 3"/><XAxis dataKey="name"/><YAxis allowDecimals={false}/><Tooltip/>
        <Bar dataKey="hotspots">{bySev.map(b=><Cell key={b.name} fill={SEV_COLOR[b.name]}/>)}</Bar></BarChart></ResponsiveContainer></section>
      <section className="panel"><h2>Trend across surveys</h2><ResponsiveContainer width="100%" height={240}><LineChart data={trend}>
        <CartesianGrid strokeDasharray="3 3"/><XAxis dataKey="survey"/><YAxis/><Tooltip/><Legend/>
        <Line dataKey="detections" stroke="#2f6fb3" strokeWidth={2}/><Line dataKey="per_km2" name="per km² surveyed" stroke="#1b7f5c" strokeWidth={2}/></LineChart></ResponsiveContainer></section></div>
    <section className="panel"><h2>Detections {sel&&<button className="link" onClick={()=>setSel(null)}>Show all</button>}</h2>
      <div className="tablewrap"><table><thead><tr><th>Image</th><th>Category</th><th>Confidence</th><th>Location (approx.)</th><th>Time</th><th>Source</th><th>Review</th><th>Cleanup</th></tr></thead><tbody>
      {list.map(d=><tr key={d.id}><td><img src={d.image} alt={`${d.category} detection`} width={64}/></td><td>{d.category}</td><td>{Math.round(d.confidence*100)}%</td>
        <td>{d.lat.toFixed(5)}, {d.lng.toFixed(5)}</td><td>{d.timestamp.slice(0,16).replace('T',' ')}</td>
        <td><span className={`badge ${d.source}`}>{d.source==='ai'?'AI-detected':'Confirmed'}</span></td>
        <td>{d.source==='ai'?<><button onClick={()=>upd(d.id,{source:'confirmed'})}>Confirm</button> <button className="danger" onClick={()=>{setDets(a=>a.filter(x=>x.id!==d.id));if(live)api.remove(d.id).catch(e=>alert(e.message))}}>Reject</button></>:'Reviewed'}</td>
        <td><select aria-label="Cleanup status" value={d.cleanup} onChange={e=>upd(d.id,{cleanup:e.target.value as Cleanup})}><option value="pending">Pending</option><option value="in_progress">In progress</option><option value="cleaned">Cleaned</option></select></td></tr>)}
      </tbody></table></div></section>
    <section className="panel"><h2>Survey history</h2><div className="tablewrap"><table><thead><tr><th>Survey</th><th>Date</th><th>Coverage (km²)</th><th>Detections</th></tr></thead><tbody>
      {SURVEYS.map(s=><tr key={s.id}><td>{s.id}</td><td>{s.date}</td><td>{s.coverageKm2}</td><td>{ai.filter(d=>d.surveyId===s.id).length}</td></tr>)}</tbody></table></div></section>
  </div>;
}
