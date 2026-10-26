export const IGPSPORT_ENDPOINT='https://prod.zh.igpsport.com/service/sportg/roadbook4j/road-book/detailsRoutesShare';
const MAX_BYTES=8*1024*1024,MAX_POINTS=150000;
export function parseIgpsportLink(value){
  if(typeof value!=='string'||value.length>3000)throw Error('请粘贴完整的 iGPSPORT 路书分享链接。');
  let url;try{url=new URL(value.trim());}catch{throw Error('iGPSPORT 分享链接格式有误，请检查完整地址。');}
  if(url.protocol!=='https:'||url.hostname!=='analyse.zh.igpsport.com'||url.port||url.username||url.password)throw Error('请使用 iGPSPORT 国内站的 HTTPS 分享链接。');
  if(!/^\/new\/(?:my\/)?road\/book\/share\/?$/.test(url.pathname))throw Error('请使用 iGPSPORT 路书分享页链接。');
  const ids=url.searchParams.getAll('routeId');
  if(ids.length!==1||!/^[1-9][0-9]{0,11}$/.test(ids[0]))throw Error('请使用包含有效 routeId 的 iGPSPORT 分享链接。');
  return {id:ids[0],source:`https://analyse.zh.igpsport.com/new/my/road/book/share?routeId=${ids[0]}&language=zh-Hans`};
}
const xml=value=>String(value??'').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g,'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
function coordinate(lat,lon){
  if(!Number.isFinite(lat)||!Number.isFinite(lon)||Math.abs(lat)>90||Math.abs(lon)>180)throw Error('iGPSPORT 轨迹含异常坐标，请检查源路书。');
  return {lat,lon};
}
export function convertIgpsportData(response,share){
  if(response?.code!==0)throw Error('iGPSPORT 暂未提供此路书的公开数据，请检查分享状态，或导出 GPX 后上传。');
  const data=response.data,summary=data?.summary,tracks=data?.routeInfo?.tracks;
  if(String(summary?.roadId)!==share.id)throw Error('iGPSPORT 返回的路书 ID 与分享链接有差异，请重新获取链接。');
  if(!Array.isArray(tracks)||tracks.length<2)throw Error('这条 iGPSPORT 路书需要至少两个有效轨迹点。');
  if(tracks.length>MAX_POINTS)throw Error('请将路书精简至 150,000 个轨迹点以内。');
  // Official share renderer applies WGS84 -> GCJ02 for its map; keep original WGS84 here.
  const points=tracks.map(p=>coordinate(p?.latitude,p?.longitute));
  const waypoints=data.roadBookAuxiliaryPoint??[];
  if(!Array.isArray(waypoints)||waypoints.length>2000)throw Error('请使用途经点数量在 2,000 以内的 iGPSPORT 路书。');
  const name=typeof summary.title==='string'&&summary.title.trim()?summary.title.trim().slice(0,120):`iGPSPORT 路书 ${share.id}`;
  const coordinateNote='来自 iGPSPORT 官方公开分享接口，使用原始 WGS84 轨迹，保留可用高程和途经点。';
  const lines=['<?xml version="1.0" encoding="UTF-8"?>','<gpx version="1.1" creator="RideWeather iGPSPORT public-route importer" xmlns="http://www.topografix.com/GPX/1/1">',`<metadata><name>${xml(name)}</name><desc>${xml(coordinateNote)}</desc><link href="${xml(share.source)}"><text>iGPSPORT 分享路书</text></link></metadata>`];
  for(const p of waypoints){
    const point=coordinate(p?.latitude,p?.longitude);
    const label=typeof p.name==='string'?p.name:typeof p.title==='string'?p.title:'途经点';
    lines.push(`<wpt lat="${point.lat}" lon="${point.lon}"><name>${xml(label.slice(0,120))}</name></wpt>`);
  }
  lines.push(`<trk><name>${xml(name)}</name><trkseg>`);
  let elevationCount=0,metres=0;const radians=Math.PI/180;
  for(let i=0;i<points.length;i++){
    const p=points[i],alt=tracks[i].alt,hasElevation=Number.isFinite(alt)&&alt>=-12000&&alt<=10000;
    if(hasElevation)elevationCount++;
    lines.push(`<trkpt lat="${p.lat}" lon="${p.lon}">${hasElevation?`<ele>${alt}</ele>`:''}</trkpt>`);
    if(i){const prev=points[i-1],a=Math.sin((p.lat-prev.lat)*radians/2)**2+Math.cos(prev.lat*radians)*Math.cos(p.lat*radians)*Math.sin((p.lon-prev.lon)*radians/2)**2;metres+=6371008.8*2*Math.asin(Math.sqrt(Math.min(1,Math.max(0,a))));}
  }
  lines.push('</trkseg></trk>','</gpx>');
  const safeName=name.replace(/[<>:"/\\|?*\u0000-\u001f]/g,'_').replace(/[. ]+$/,'').slice(0,90)||'iGPSPORT路书';
  return {name,sourceId:share.id,sourceType:'igpsport',sourceUrl:share.source,pointCount:points.length,segmentCount:1,waypointCount:waypoints.length,elevationCount,sourceDistanceMetres:Number.isFinite(summary.distance)&&summary.distance>=0?summary.distance:null,calculatedDistanceMetres:metres,outputCoordinateSystem:'WGS84',coordinateNote,filename:`${safeName}_igpsport${share.id}.gpx`,gpx:lines.join('\n')};
}
async function readData(response){
  if(!response.body)throw Error('iGPSPORT 返回了空数据，请稍后重试。');
  if(Number(response.headers.get('Content-Length'))>MAX_BYTES){await response.body.cancel();throw Error('请使用数据大小在 8 MB 以内的 iGPSPORT 路书。');}
  const reader=response.body.getReader(),decoder=new TextDecoder();let text='',size=0;
  try{
    for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>MAX_BYTES)throw Error('请使用数据大小在 8 MB 以内的 iGPSPORT 路书。');text+=decoder.decode(value,{stream:true});}
    text+=decoder.decode();
  }catch(error){await reader.cancel().catch(()=>{});throw error;}finally{reader.releaseLock();}
  try{return JSON.parse(text);}catch{throw Error('iGPSPORT 返回的数据格式有误，请稍后重试。');}
}
export async function fetchIgpsportRoute(value,{fetchImpl=fetch,timeoutMs=30000}={}){
  const share=parseIgpsportLink(value),controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeoutMs);
  try{
    let response;try{response=await fetchImpl(`${IGPSPORT_ENDPOINT}?routeId=${share.id}`,{method:'GET',mode:'cors',credentials:'omit',redirect:'error',signal:controller.signal});}
    catch{throw Error(controller.signal.aborted?'iGPSPORT 导入超时，请稍后重试。':'连接 iGPSPORT 失败，请检查网络，或在 iGPSPORT 导出 GPX 后上传。');}
    if(response.status===401||response.status===403)throw Error('此路书需要在 iGPSPORT 登录后访问，请自行导出 GPX 后上传。');
    if(response.status===429)throw Error('iGPSPORT 请求较多，请稍后再试。');
    if(!response.ok)throw Error(`iGPSPORT 数据请求遇到 HTTP ${response.status}，请稍后重试。`);
    return convertIgpsportData(await readData(response),share);
  }catch(error){if(controller.signal.aborted)throw Error('iGPSPORT 导入超时，请稍后重试。');throw error;}
  finally{clearTimeout(timer);}
}
