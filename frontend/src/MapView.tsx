import {useEffect} from 'react';
import {MapContainer,TileLayer,CircleMarker,Tooltip,useMap,useMapEvents} from 'react-leaflet';
import {Detection,Hotspot,Severity} from './types';
import {MAP_CENTER} from './sampleData';
export const SEV_COLOR:Record<Severity,string>={low:'#2e9e5b',medium:'#e0b030',high:'#e8761f',critical:'#c62828'};
function Clicker({onClick}:{onClick?:(lat:number,lng:number)=>void}){useMapEvents({click:e=>onClick?.(e.latlng.lat,e.latlng.lng)});return null}
// Zooms the map to wherever the data is (re-runs only when the data moves to a new area).
function Fit({pts}:{pts:[number,number][]}){
  const map=useMap();
  const key=pts.length?`${(pts.reduce((s,p)=>s+p[0],0)/pts.length).toFixed(1)},${(pts.reduce((s,p)=>s+p[1],0)/pts.length).toFixed(1)}`:'';
  useEffect(()=>{if(pts.length)map.fitBounds(pts,{padding:[40,40],maxZoom:17})},[key]);// eslint-disable-line
  return null}
interface P{hotspots:Hotspot[];community?:Detection[];selectedId?:string|null;onSelect?:(id:string)=>void;onMapClick?:(lat:number,lng:number)=>void;picked?:[number,number]|null}
export default function MapView({hotspots,community=[],selectedId,onSelect,onMapClick,picked}:P){
  return <>
    <div className="mapwrap"><MapContainer center={MAP_CENTER} zoom={15} scrollWheelZoom={false} aria-label="Map of litter hotspots">
      <TileLayer attribution="&copy; OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"/>
      <Clicker onClick={onMapClick}/><Fit pts={[...hotspots.map(h=>[h.lat,h.lng] as [number,number]),...community.map(c=>[c.lat,c.lng] as [number,number])]}/>
      {hotspots.map(h=><CircleMarker key={h.id} center={[h.lat,h.lng]} radius={8+Math.sqrt(h.count)*1.6}
        eventHandlers={{click:()=>onSelect?.(h.id)}}
        pathOptions={{fillColor:SEV_COLOR[h.severity],fillOpacity:.75,color:h.confirmed?'#0b3d2e':'#1565c0',weight:h.id===selectedId?5:3,dashArray:h.confirmed?undefined:'5 4'}}>
        <Tooltip>{h.area}: {h.count} items, {h.severity}</Tooltip></CircleMarker>)}
      {community.map(c=><CircleMarker key={c.id} center={[c.lat,c.lng]} radius={7} pathOptions={{fillColor:'#8e44ad',fillOpacity:.9,color:'#fff',weight:2}}>
        <Tooltip>Community report (unverified): {c.category}</Tooltip></CircleMarker>)}
      {picked&&<CircleMarker center={picked} radius={9} pathOptions={{color:'#000',fillOpacity:0,weight:3}}/>}
    </MapContainer></div>
    <ul className="legend" aria-label="Map legend">
      {(Object.keys(SEV_COLOR) as Severity[]).map(s=><li key={s}><i style={{background:SEV_COLOR[s]}}/>{s}</li>)}
      <li><i className="ring solid"/>Admin-confirmed</li><li><i className="ring dashed"/>AI-detected</li><li><i style={{background:'#8e44ad'}}/>Community-reported</li>
    </ul></>;
}
