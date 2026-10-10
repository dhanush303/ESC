import {Detection,Survey} from './types';
const KEY='aeroclean_admin_key';
// Temporary: the admin key is typed once and kept in this browser. Stage 2 replaces this with Firebase login.
const adminKey=()=>{let k=localStorage.getItem(KEY);if(!k){k=prompt('Admin key (ADMIN_KEY from backend/.env):')||'';localStorage.setItem(KEY,k)}return k};
async function call(path:string,opt:RequestInit={},admin=false){
  const headers:Record<string,string>={'Content-Type':'application/json'};
  if(admin)headers['X-Admin-Key']=adminKey();
  let r:Response;
  try{r=await fetch(path,{...opt,headers})}catch{throw new Error('backend offline')}
  if(r.status>=500)throw new Error('backend offline');
  if(r.status===401){if(admin)localStorage.removeItem(KEY);throw new Error('wrong admin key')}
  if(!r.ok)throw new Error(`error ${r.status}`);
  return r.json();
}
export const api={
  publicDetections:():Promise<Detection[]>=>call('/api/public/detections'),
  adminDetections:():Promise<Detection[]>=>call('/api/detections',{},true),
  surveys:():Promise<Survey[]>=>call('/api/surveys'),
  patch:(id:string,p:Partial<Detection>)=>call(`/api/detections/${id}`,{method:'PATCH',body:JSON.stringify({source:p.source,cleanup:p.cleanup})},true),
  remove:(id:string)=>call(`/api/detections/${id}`,{method:'DELETE'},true),
  community:(b:object)=>call('/api/community',{method:'POST',body:JSON.stringify(b)}),
};
export const b64=(f:File)=>new Promise<string>((res,rej)=>{const r=new FileReader();r.onload=()=>res(String(r.result).split(',')[1]);r.onerror=rej;r.readAsDataURL(f)});
