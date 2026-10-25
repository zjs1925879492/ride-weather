import {prepareRoute} from './core.js?v=release20261026';

const DB_NAME='ride-weather-local',STORE='routes',LIMIT=50;
let opening;
function database(){
  if(!globalThis.indexedDB)return Promise.reject(Error('此浏览器暂不支持本机收藏，请使用普通浏览模式。'));
  if(!opening)opening=new Promise((resolve,reject)=>{
    const request=indexedDB.open(DB_NAME,1);
    request.onupgradeneeded=()=>request.result.createObjectStore(STORE,{keyPath:'id'});
    request.onerror=()=>reject(Error('无法打开本机收藏，请检查浏览器是否允许保存网站数据。'));
    request.onblocked=()=>reject(Error('收藏库正在升级，请关闭此网站的其他标签页后重试。'));
    request.onsuccess=()=>{const db=request.result;db.onversionchange=()=>{db.close();opening=null;};resolve(db);};
  }).catch(error=>{opening=null;throw error;});
  return opening;
}
export function validateFavorite(value){
  if(!value||typeof value.name!=='string'||!value.name.trim()||value.name.length>120)throw Error('路线名称需为 1–120 个字符。');
  if(!Array.isArray(value.segments)||!value.segments.length)throw Error('收藏中没有有效路线。');
  let count=0;
  const segments=value.segments.map(segment=>{
    if(!Array.isArray(segment)||!segment.length)throw Error('路线含无效轨迹段。');
    count+=segment.length;
    if(count>150000)throw Error('单条收藏不能超过 150,000 个轨迹点。');
    return segment.map(p=>{
      if(!p||!Number.isFinite(p.lat)||!Number.isFinite(p.lon)||Math.abs(p.lat)>90||Math.abs(p.lon)>180)throw Error('收藏中含无效坐标。');
      return {lat:p.lat,lon:p.lon};
    });
  });
  if(count<2)throw Error('收藏至少需要两个有效坐标点。');
  const prefs=value.preferences||{};
  const preferences={speed:Number.isFinite(prefs.speed)&&prefs.speed>=3&&prefs.speed<=80?prefs.speed:22,rest:Number.isFinite(prefs.rest)&&prefs.rest>=0&&prefs.rest<=600?prefs.rest:30,spacing:[10,20,30].includes(prefs.spacing)?prefs.spacing:20};
  let sourceUrl='';
  if(typeof value.sourceUrl==='string'&&value.sourceUrl.length<=3000){try{const url=new URL(value.sourceUrl);if(url.protocol==='https:'&&['onelap.cn','www.onelap.cn','imxingzhe.com','www.imxingzhe.com'].includes(url.hostname)&&!url.username&&!url.password&&!url.port)sourceUrl=url.href;}catch{}}
  return {name:value.name.trim(),segments,preferences,sourceUrl,savedAt:Number.isFinite(value.savedAt)&&value.savedAt>=0&&value.savedAt<=Date.now()+86400000?value.savedAt:Date.now()};
}
async function identified(value){
  const record=validateFavorite(value),bytes=new TextEncoder().encode(JSON.stringify(record.segments));
  const digest=await crypto.subtle.digest('SHA-256',bytes);
  const id=[...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,'0')).join('');
  return {...record,id,km:prepareRoute(record.segments).km};
}
export async function listFavorites(){
  const db=await database();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction(STORE,'readonly'),request=tx.objectStore(STORE).getAll();
    tx.oncomplete=()=>resolve(request.result.sort((a,b)=>b.savedAt-a.savedAt));
    tx.onerror=()=>reject(Error('读取本机收藏失败。'));tx.onabort=()=>reject(Error('读取本机收藏已中断。'));
  });
}
async function writeRecords(records,merge){
  const db=await database();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction(STORE,'readwrite'),store=tx.objectStore(STORE),existing=store.getAll();let added=0,reason;
    existing.onsuccess=()=>{
      const known=new Map(existing.result.map(r=>[r.id,r])),incoming=new Map(records.map(r=>[r.id,r]));
      if(new Set([...known.keys(),...incoming.keys()]).size>LIMIT){reason=Error(`本机最多收藏 ${LIMIT} 条路线，请先导出备份并删除不需要的收藏。`);tx.abort();return;}
      for(const record of incoming.values()){
        if(merge&&known.has(record.id))continue;
        if(!known.has(record.id))added++;
        store.put({...record,savedAt:known.get(record.id)?.savedAt??record.savedAt});
      }
    };
    tx.oncomplete=()=>resolve(added);
    tx.onerror=()=>reject(Error('保存失败，浏览器存储空间可能不足。请导出备份后重试。'));
    tx.onabort=()=>reject(reason||Error('保存已中断，原有收藏未被修改。'));
  });
}
export async function saveFavorite(value){const record=await identified(value);await writeRecords([record],false);return record;}
export async function deleteFavorite(id){
  const db=await database();
  return new Promise((resolve,reject)=>{const tx=db.transaction(STORE,'readwrite');tx.objectStore(STORE).delete(id);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(Error('删除收藏失败。'));tx.onabort=()=>reject(Error('删除收藏已中断。'));});
}
export function favoriteRoute(value){const record=validateFavorite(value);return {...prepareRoute(record.segments),name:record.name,sourceUrl:record.sourceUrl};}
export function exportFavorites(records){return JSON.stringify({format:'ride-weather-favorites',version:1,exportedAt:new Date().toISOString(),routes:records.map(validateFavorite)},null,2);}
export async function importFavorites(text){
  let backup;try{backup=JSON.parse(text);}catch{throw Error('无法读取备份，请选择沿途导出的 JSON 文件。');}
  if(backup?.format!=='ride-weather-favorites'||backup.version!==1||!Array.isArray(backup.routes)||backup.routes.length>LIMIT)throw Error('备份格式不支持，或路线超过 50 条。');
  // Validate everything before starting a single atomic write transaction.
  const records=[];for(const route of backup.routes)records.push(await identified(route));
  return writeRecords(records,true);
}
