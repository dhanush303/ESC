import {Category,Detection} from './types';
import {CELL} from './hotspots';
// ⚠ ALL DATA BELOW IS GENERATED SAMPLE DATA, not real measurements.
export const CATEGORIES:Category[]=['Plastic','Glass','Metal','Paper','Organic','Textile','General waste'];
export const SURVEYS=[
  {id:'S1',date:'2026-05-04',coverageKm2:1.8},{id:'S2',date:'2026-06-08',coverageKm2:2.1},
  {id:'S3',date:'2026-07-13',coverageKm2:1.6},{id:'S4',date:'2026-08-17',coverageKm2:2.4},{id:'S5',date:'2026-09-21',coverageKm2:2.2}];
const AREAS=['North beach','Harbour mouth','Dune path','Estuary','Car park','South pier'];
const WEIGHTS=[0.5,0.12,0.08,0.12,0.12,0.06]; // plastic-heavy sample mix
const N=[5,9,14,19,8,12]; // sample items per survey per area
let seed=42;const rnd=()=>{seed=(seed*1664525+1013904223)%4294967296;return seed/4294967296};
const img=(c:string)=>'data:image/svg+xml,'+encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="320" height="200"><rect width="320" height="200" fill="#c9d6d4"/><text x="160" y="105" text-anchor="middle" font-family="sans-serif" font-size="16" fill="#27403f">Sample image: ${c}</text></svg>`);
const pick=():Category=>{let r=rnd(),i=0;while(i<5&&r>WEIGHTS[i]){r-=WEIGHTS[i];i++}return CATEGORIES[i]};
const row0=Math.floor(37.7/CELL),col0=Math.floor(-122.5/CELL);
export const MAP_CENTER:[number,number]=[(row0+2.5)*CELL,(col0+2.5)*CELL];
export const SAMPLE:Detection[]=[];
SURVEYS.forEach((s,si)=>AREAS.forEach((area,a)=>{
  const lat0=(row0+Math.floor(a/3)*2)*CELL+CELL/2, lng0=(col0+(a%3)*2)*CELL+CELL/2;
  const n=Math.round(N[a]*(1.15-si*0.06)*(0.8+rnd()*0.4));
  for(let i=0;i<n;i++){
    const category=pick(),confidence=+(0.5+rnd()*0.48).toFixed(2);
    const confirmed=si<4&&confidence>0.8&&rnd()<0.6;
    SAMPLE.push({id:`${s.id}-${a}-${i}`,category,confidence,area,surveyId:s.id,
      lat:lat0+(rnd()-0.5)*CELL*0.8,lng:lng0+(rnd()-0.5)*CELL*0.8,
      timestamp:`${s.date}T${String(9+Math.floor(rnd()*5)).padStart(2,'0')}:${String(Math.floor(rnd()*60)).padStart(2,'0')}:00Z`,
      source:confirmed?'confirmed':'ai',cleanup:confirmed&&si<2?'cleaned':confirmed&&si===2?'in_progress':'pending',image:img(category)});
  }}));
['Plastic','Glass','Textile'].forEach((c,i)=>SAMPLE.push({id:`C${i}`,category:c as Category,confidence:0,area:'Community',surveyId:'COMMUNITY',
  lat:MAP_CENTER[0]+(i-1)*0.002,lng:MAP_CENTER[1]+0.0015*i,timestamp:`2026-09-${25+i}T10:00:00Z`,source:'community',cleanup:'pending',
  image:img(c),description:'Sample community report'}));
