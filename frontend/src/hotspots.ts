import {Cleanup,Detection,Hotspot,Severity} from './types';
// Grid-cell aggregation. CELL is in degrees (0.003° ≈ 330 m). Make it configurable later.
export const CELL=0.003;
export const SEV:Severity[]=['low','medium','high','critical'];
// Detections per survey in a cell. Normalising by survey count stops frequently-flown areas looking worse.
export const severityOf=(perSurvey:number):Severity=>perSurvey<6?'low':perSurvey<12?'medium':perSurvey<18?'high':'critical';
export function buildHotspots(dets:Detection[],surveyCount:number):Hotspot[]{
  const cells=new Map<string,Detection[]>();
  for(const d of dets){
    if(d.source==='community')continue; // community reports are shown separately
    const k=`${Math.floor(d.lat/CELL)},${Math.floor(d.lng/CELL)}`;
    if(!cells.has(k))cells.set(k,[]);
    cells.get(k)!.push(d);
  }
  return [...cells.entries()].map(([id,ds])=>{
    const categories:Record<string,number>={};
    ds.forEach(d=>{categories[d.category]=(categories[d.category]||0)+1});
    const cleanup:Cleanup=ds.every(d=>d.cleanup==='cleaned')?'cleaned':ds.some(d=>d.cleanup!=='pending')?'in_progress':'pending';
    return {id,count:ds.length,detections:ds,categories,cleanup,area:ds[0].area,
      lat:ds.reduce((s,d)=>s+d.lat,0)/ds.length,lng:ds.reduce((s,d)=>s+d.lng,0)/ds.length,
      severity:severityOf(ds.length/Math.max(1,surveyCount)),
      confirmed:ds.some(d=>d.source==='confirmed'),
      lastSurvey:ds.map(d=>d.timestamp).sort().pop()!.slice(0,10)};
  });
}
