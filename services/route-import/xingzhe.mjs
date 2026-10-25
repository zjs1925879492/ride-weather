// Anonymous public share data only; the login-protected GPX download is not used.
class XingzheError extends Error {constructor(message,status=400){super(message);this.status=status;}}
function parseXingzheShare(value){
  if(typeof value!=='string'||value.length>3000)throw new XingzheError('请粘贴完整的行者路书分享链接。');
  let url;try{url=new URL(value.trim());}catch{throw new XingzheError('行者分享链接格式不正确。');}
  if(url.protocol!=='https:'||!['www.imxingzhe.com','imxingzhe.com'].includes(url.hostname)||url.username||url.password||url.port)throw new XingzheError('请使用 HTTPS 的行者 imxingzhe.com 分享链接。');
  const match=/^\/routes\/([1-9][0-9]{0,11})\/?$/.exec(url.pathname);
  if(!match)throw new XingzheError('请使用包含数字路书 ID 的行者分享链接，例如 /routes/5701846/。');
  return {id:match[1],source:`https://www.imxingzhe.com/routes/${match[1]}/`};
}
async function readBounded(response,max){
  if(!response.body)throw new XingzheError('行者返回了空响应。',502);
  if(Number(response.headers.get('Content-Length'))>max){await response.body.cancel();throw new XingzheError('行者路书数据过大。',413);}
  const reader=response.body.getReader(),chunks=[];let size=0;
  try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>max)throw new XingzheError('行者路书数据过大。',413);chunks.push(value);}}
  catch(error){await reader.cancel().catch(()=>{});throw error;}finally{reader.releaseLock();}
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
  try{return JSON.parse(new TextDecoder().decode(bytes));}catch{throw new XingzheError('行者未返回有效的公开路书数据。',502);}
}
function routeFileURL(meta){
  if(typeof meta.uuid!=='string'||!/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(meta.uuid))throw new XingzheError('行者路书缺少有效文件标识。',422);
  let url;try{url=new URL(meta.file_url);}catch{throw new XingzheError('行者没有提供公开轨迹文件。',422);}
  if(url.protocol!=='https:'||url.hostname!=='xingzhe.oss-cn-hangzhou.aliyuncs.com'||url.username||url.password||url.port||url.hash||url.pathname!==`/lushu-${meta.uuid}.json`)throw new XingzheError('行者轨迹文件地址不在允许范围内。',422);
  return url.href;
}
// The share page decodes latitude/longitude deltas at 1e-5 precision.
function decodePolyline(encoded,remaining=150000){
  if(typeof encoded!=='string'||!encoded.length||encoded.length>8*1024*1024)throw new XingzheError('行者轨迹编码无效。',422);
  let position=0,lat=0,lon=0;const points=[];
  function delta(){
    let value=0,shift=0,byte;
    do{
      if(position>=encoded.length||shift>30)throw new XingzheError('行者轨迹编码不完整或溢出。',422);
      byte=encoded.charCodeAt(position++)-63;
      if(byte<0||byte>63)throw new XingzheError('行者轨迹含无效编码字符。',422);
      value+=(byte&31)*2**shift;shift+=5;
    }while(byte>=32);
    return value%2?-(Math.floor(value/2)+1):Math.floor(value/2);
  }
  while(position<encoded.length){
    lat+=delta();lon+=delta();
    if(!Number.isSafeInteger(lat)||!Number.isSafeInteger(lon)||Math.abs(lat)>9000000||Math.abs(lon)>18000000)throw new XingzheError('行者轨迹含无效经纬度。',422);
    if(points.length>=remaining)throw new XingzheError('轨迹不能超过 150,000 个点。',413);
    points.push({lat:lat/1e5,lon:lon/1e5});
  }
  return points;
}
const xml=value=>String(value??'').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g,'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
function geometryMetres(segments){
  let metres=0;const r=Math.PI/180;
  for(const segment of segments)for(let i=1;i<segment.length;i++){
    const a=segment[i-1],b=segment[i],v=Math.sin((b.lat-a.lat)*r/2)**2+Math.cos(a.lat*r)*Math.cos(b.lat*r)*Math.sin((b.lon-a.lon)*r/2)**2;
    metres+=6371008.8*2*Math.asin(Math.sqrt(Math.min(1,Math.max(0,v))));
  }
  return metres;
}
function convertXingzheData(meta,route,share){
  if(!meta||String(meta.id)!==share.id)throw new XingzheError('返回路书与分享 ID 不一致，未替换当前路线。',502);
  if(!route||!Array.isArray(route.polylines)||!route.polylines.length||route.polylines.length>2000)throw new XingzheError('这条行者路书缺少支持的公开轨迹数据。',422);
  const segments=[];let count=0;
  for(const line of route.polylines){const points=decodePolyline(line,150000-count);count+=points.length;segments.push(points);}
  if(count<2)throw new XingzheError('行者路书至少需要两个有效轨迹点。',422);
  if(Number.isInteger(meta.points)&&meta.points!==count)throw new XingzheError('公开轨迹点数与行者详情不一致，未替换当前路线。',422);
  const name=typeof meta.title==='string'&&meta.title.trim()?meta.title.trim().slice(0,120):`行者路书 ${share.id}`;
  const elevations=Array.isArray(route.elevations)&&route.elevations.length===count?route.elevations:null;
  const waypoints=Array.isArray(route.waypoints)?route.waypoints:[];
  if(waypoints.length>2000)throw new XingzheError('行者途经点过多。',413);
  const coordinateNote='按行者分享页的公开轨迹生成 GPX，保留原始分段与可用高程。坐标按当前网页绘制逻辑读取为 WGS84，未实地核验。';
  const lines=['<?xml version="1.0" encoding="UTF-8"?>','<gpx version="1.1" creator="RideWeather Xingzhe public-route importer" xmlns="http://www.topografix.com/GPX/1/1">',`<metadata><name>${xml(name)}</name><desc>${xml(coordinateNote)}</desc><link href="${xml(share.source)}"><text>行者分享路书</text></link></metadata>`];
  let waypointCount=0,elevationCount=0,index=0;
  for(const waypoint of waypoints){
    if(!Array.isArray(waypoint.coordinate)||waypoint.coordinate.length<2)throw new XingzheError('行者途经点坐标无效。',422);
    const [lat,lon]=waypoint.coordinate;
    if(!Number.isFinite(lat)||!Number.isFinite(lon)||Math.abs(lat)>90||Math.abs(lon)>180)throw new XingzheError('行者途经点坐标无效。',422);
    lines.push(`<wpt lat="${lat}" lon="${lon}"><name>${xml(String(waypoint.name||'途经点').slice(0,120))}</name></wpt>`);waypointCount++;
  }
  lines.push(`<trk><name>${xml(name)}</name>`);
  for(const segment of segments){
    lines.push('<trkseg>');
    for(const point of segment){
      const elevation=elevations?.[index++],hasElevation=Number.isFinite(elevation)&&elevation>=-12000&&elevation<=10000;
      if(hasElevation)elevationCount++;
      lines.push(`<trkpt lat="${point.lat.toFixed(5)}" lon="${point.lon.toFixed(5)}">${hasElevation?`<ele>${elevation}</ele>`:''}</trkpt>`);
    }
    lines.push('</trkseg>');
  }
  lines.push('</trk>','</gpx>');
  const safeName=name.replace(/[<>:"/\\|?*\u0000-\u001f]/g,'_').replace(/[. ]+$/,'').slice(0,90)||'行者路书';
  return {name,sourceId:share.id,sourceType:'xingzhe',sourceUrl:share.source,pointCount:count,segmentCount:segments.length,waypointCount,elevationCount,sourceDistanceMetres:Number.isFinite(meta.distance)?meta.distance:null,calculatedDistanceMetres:geometryMetres(segments),outputCoordinateSystem:'WGS84',coordinateNote,filename:`${safeName}_xingzhe${share.id}.gpx`,gpx:lines.join('\n')};
}
async function importXingzheShare(value,{fetchImpl=fetch,timeoutMs=30000,signal}={}){
  const share=parseXingzheShare(value),controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeoutMs);
  const abort=()=>controller.abort();if(signal?.aborted)abort();signal?.addEventListener('abort',abort,{once:true});
  async function request(url,limit){
    const response=await fetchImpl(url,{method:'GET',redirect:'manual',credentials:'omit',headers:{Accept:'application/json'},signal:controller.signal});
    if(response.status===401||response.status===403)throw new XingzheError('行者未公开此路书或需要登录；请在行者中自行导出 GPX 后上传。',422);
    if(!response.ok)throw new XingzheError(`行者数据请求失败（HTTP ${response.status}），请稍后重试。`,502);
    return readBounded(response,limit);
  }
  try{
    const detail=await request(`https://www.imxingzhe.com/api/v1/lushu/${share.id}/?tunnels=true`,256*1024),meta=detail?.data?.lushu;
    if(detail.code!==0||!meta||String(meta.id)!==share.id)throw new XingzheError('行者没有返回对应的公开路书，请检查链接与公开状态。',422);
    const route=String(meta.type)==='4'?await request(routeFileURL(meta),8*1024*1024):(await request(`https://www.imxingzhe.com/api/v1/lushu/${share.id}/version2/`,8*1024*1024))?.data;
    return convertXingzheData(meta,route,share);
  }catch(error){
    if(error instanceof XingzheError)throw error;
    throw new XingzheError(controller.signal.aborted?'行者导入超时，请稍后重试。':'无法获取行者公开轨迹，请检查网络或上传 GPX 文件。',502);
  }finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);}
}
export {XingzheError,parseXingzheShare,decodePolyline,routeFileURL,convertXingzheData,importXingzheShare};
