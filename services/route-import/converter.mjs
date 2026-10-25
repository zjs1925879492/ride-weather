import {gunzipSync} from 'node:zlib';
import {Buffer} from 'node:buffer';
import gcoord from './gcoord.mjs';
class RouteError extends Error {constructor(message,status=400){super(message);this.status=status;}}
function parseShare(value){
  if(typeof value!=='string'||value.length>3000)throw new RouteError('请输入顽鹿分享链接。');
  let url;try{url=new URL(value.trim());}catch{throw new RouteError('链接格式不正确。');}
  if(url.protocol!=='https:'||!['www.onelap.cn','onelap.cn'].includes(url.hostname)||url.port||url.username||url.password)throw new RouteError('仅支持 HTTPS 顽鹿 onelap.cn 分享链接。');
  const id=url.searchParams.get('id');
  const type=url.searchParams.get('routeType')||'myroute';
  if(type==='route'&&id&&/^[1-9][0-9]{0,11}$/.test(id))return {id,type,source:`https://www.onelap.cn/bikeroute/detail.html?id=${id}&routeType=route`};
  if(type==='myroute'&&id&&/^[a-f0-9]{24}$/i.test(id))return {id,type,source:`https://www.onelap.cn/bikeroute/detail_old.html?routeType=myroute&id=${id}`};
  throw new RouteError('支持 routeType=route 的数字 ID 路书和 myroute 的 24 位 ID 分享路线；只有 nid 的编辑链接暂不支持。');
}
async function readLimited(stream,max){
  if(!stream)throw new RouteError('顽鹿返回了空响应。',502);
  const reader=stream.getReader();const chunks=[];let size=0;
  try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>max)throw new RouteError('路线响应过大，请使用较短的路书。',413);chunks.push(Buffer.from(value));}}
  catch(e){await reader.cancel().catch(()=>{});throw e;}finally{reader.releaseLock();}
  return Buffer.concat(chunks).toString('utf8');
}
const xml=value=>String(value??'').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g,'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
function coordinate(p,system){
  const number=v=>(typeof v==='number'||(typeof v==='string'&&v.trim()))?Number(v):NaN;
  const lon=number(p?.lng),lat=number(p?.lat);
  if(!Number.isFinite(lon)||!Number.isFinite(lat)||Math.abs(lon)>180||Math.abs(lat)>90)throw new RouteError('路线包含无效经纬度，已停止导出。',422);
  const out=system==='WGS84'?[lon,lat]:gcoord.transform([lon,lat],gcoord[system],gcoord.WGS84);
  if(!out.every(Number.isFinite)||Math.abs(out[0])>180||Math.abs(out[1])>90)throw new RouteError('坐标转换失败。',422);
  return out;
}
function distance(a,b){const r=Math.PI/180;const v=Math.sin((b[1]-a[1])*r/2)**2+Math.cos(a[1]*r)*Math.cos(b[1]*r)*Math.sin((b[0]-a[0])*r/2)**2;return 6371008.8*2*Math.asin(Math.sqrt(Math.min(1,Math.max(0,v))));}
function convertResponse(response,{id,source,type='myroute'},system='BD09'){
  if(!['BD09','GCJ02','WGS84'].includes(system))throw new RouteError('不支持的源坐标类型。');
  const data=response?.data;
  if(response?.code!==200||!data)throw new RouteError('顽鹿未提供路线数据；路线可能已删除、未公开或需要登录。',502);
  if(type==='myroute'&&data.id!==id)throw new RouteError('返回路线与分享链接不匹配，已停止导出。',502);
  // Public road books do not echo their numeric road-book ID; nid is a different identifier.
  if(type==='route'&&data.status!==4)throw new RouteError('该路书当前不是公开可用状态。',502);
  const name=typeof data.name==='string'?data.name.slice(0,300):'顽鹿路书';
  if(typeof data.points!=='string')throw new RouteError('顽鹿响应缺少完整轨迹字段。',422);
  const encoded=data.points.replace(/\s/g,'');
  if(encoded.length>2*1024*1024)throw new RouteError('压缩轨迹过大。',413);
  if(encoded.length===0||encoded.length%4!==0||!/^[A-Za-z0-9+/]*={0,2}$/.test(encoded))throw new RouteError('轨迹编码格式不正确。',422);
  let points;try{points=JSON.parse(gunzipSync(Buffer.from(encoded,'base64'),{maxOutputLength:16*1024*1024}).toString('utf8'));}catch{throw new RouteError('轨迹解压失败，或解压后超过 16 MiB。',422);}
  if(!Array.isArray(points)||points.length<2||points.length>150000)throw new RouteError('轨迹必须包含 2–150,000 个点。',422);
  const coords=points.map(p=>coordinate(p,system));
  if(data.path_point!=null&&!Array.isArray(data.path_point))throw new RouteError('途经点格式不正确。',422);
  const waypoints=data.path_point||[];if(waypoints.length>2000)throw new RouteError('途经点过多。',413);
  const waypointCoords=waypoints.map(p=>coordinate(p,system));
  const metres=coords.slice(1).reduce((sum,p,i)=>sum+distance(coords[i],p),0);
  const coordinateNote=system==='BD09'?'源坐标按 BD-09 转换为 WGS84；BD-09 为根据顽鹿编辑器及既有样本推断，尚未实地核验。':`源坐标按用户选择的 ${system} 处理，输出 WGS84。`;
  const desc=`路线类型 ${type}，分享 ID ${id}。${coordinateNote} 保留全部 ${coords.length} 个轨迹点；不补写海拔或记录时间。`;
  const lines=['<?xml version="1.0" encoding="UTF-8"?>','<gpx version="1.1" creator="RideWeather Onelap converter" xmlns="http://www.topografix.com/GPX/1/1">',`  <metadata><name>${xml(name)}</name><desc>${xml(desc)}</desc><link href="${xml(source)}"><text>顽鹿分享路线</text></link></metadata>`];
  waypoints.forEach((p,i)=>{const [lon,lat]=waypointCoords[i];lines.push(`  <wpt lat="${lat.toFixed(8)}" lon="${lon.toFixed(8)}"><name>${xml(p.name||p.real_name||'途经点')}</name></wpt>`);});
  lines.push(`  <trk><name>${xml(name)}</name><trkseg>`);
  coords.forEach(([lon,lat])=>lines.push(`    <trkpt lat="${lat.toFixed(8)}" lon="${lon.toFixed(8)}"/>`));
  lines.push('  </trkseg></trk>','</gpx>');
  const safeName=name.replace(/[<>:"/\\|?*\u0000-\u001f]/g,'_').replace(/[. ]+$/,'').slice(0,100)||'顽鹿路书';
  return {name,sourceId:id,sourceType:type,nid:data.nid??null,pointCount:coords.length,waypointCount:waypoints.length,sourceDistanceMetres:Number.isFinite(data.distance)?data.distance:null,calculatedDistanceMetres:metres,sourceCoordinateSystem:system,outputCoordinateSystem:'WGS84',coordinateNote,start:coords[0],end:coords.at(-1),filename:`${safeName}_${type==='route'?'route'+id:data.nid||id}.gpx`,gpx:lines.join('\n')};
}
async function convertShare(url,system='BD09'){
  const share=parseShare(url);
  if(!['BD09','GCJ02','WGS84'].includes(system))throw new RouteError('不支持的源坐标类型。');
  let response;try{
    const endpoint=share.type==='route'?`/api/road/road_book/${share.id}`:`/indoor/v1/navigation/share/detail/${share.id}`;
    const upstream=await fetch('https://www.onelap.cn'+endpoint,{redirect:'manual',signal:AbortSignal.timeout(20000),headers:{Accept:'application/json'}});
    if(!upstream.ok)throw new RouteError(`顽鹿接口返回 HTTP ${upstream.status}。`,502);
    const body=await readLimited(upstream.body,3*1024*1024);
    try{response=JSON.parse(body);}catch{throw new RouteError('顽鹿接口没有返回有效 JSON。',502);}
  }catch(e){if(e instanceof RouteError)throw e;throw new RouteError(e.name==='TimeoutError'?'请求顽鹿超时，请稍后重试。':'无法连接顽鹿接口，请稍后重试。',502);}
  return convertResponse(response,share,system);
}
export {parseShare,convertResponse,convertShare,readLimited,RouteError};
