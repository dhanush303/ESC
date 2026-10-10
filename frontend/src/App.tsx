import {useCallback,useEffect,useState} from 'react';
import Admin from './Admin';
import Public from './Public';
import {SAMPLE,SURVEYS} from './sampleData';
import {api} from './api';
import {Detection,Survey} from './types';
export default function App(){
  const [view,setView]=useState<'public'|'admin'>('public');
  const [dets,setDets]=useState<Detection[]>(SAMPLE);
  const [surveys,setSurveys]=useState<Survey[]>(SURVEYS);
  const [live,setLive]=useState(false);
  const [err,setErr]=useState('');
  const load=useCallback(async()=>{
    try{
      const [d,s]=await Promise.all([view==='admin'?api.adminDetections():api.publicDetections(),api.surveys()]);
      setDets(d);setSurveys(s);setLive(true);setErr('');
    }catch(e){setLive(false);setErr((e as Error).message)}
  },[view]);
  useEffect(()=>{load()},[load]);
  return <>
    <header className="top"><h1>AeroClean</h1>
      <nav aria-label="Switch view">
        <button onClick={load}>Refresh</button>
        <button aria-pressed={view==='public'} onClick={()=>setView('public')}>Public view</button>
        <button aria-pressed={view==='admin'} onClick={()=>setView('admin')}>Admin view</button></nav></header>
    <p className="banner" role="note">{live?'Live data from the AeroClean backend.':`Showing sample data, not real measurements (${err||'connecting'}).`}</p>
    <main>{view==='admin'?<Admin dets={dets} setDets={setDets} surveys={surveys} live={live}/>:<Public dets={dets} setDets={setDets} surveys={surveys} live={live} reload={load}/>}</main></>;
}
