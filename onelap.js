export const ONELAP_ENDPOINT='https://onelap-gpx.changanxiaoxiang.workers.dev/api/convert';
export function validateOnelapLink(value){
  let url;try{url=new URL(String(value).trim());}catch{throw Error('请粘贴完整的顽鹿分享链接。');}
  if(url.protocol!=='https:'||!['www.onelap.cn','onelap.cn'].includes(url.hostname)||url.port||url.username||url.password)throw Error('请使用 HTTPS 的顽鹿 onelap.cn 分享链接。');
  const id=url.searchParams.get('id'),type=url.searchParams.get('routeType')||'myroute';
  if(!((type==='route'&&/^[1-9][0-9]{0,11}$/.test(id||''))||(type==='myroute'&&/^[a-f0-9]{24}$/i.test(id||''))))throw Error('支持数字 ID 的公开路书和 24 位 ID 的分享路线；nid 编辑页请先在顽鹿中复制分享详情链接。');
  return url.href;
}
async function readJSON(response){
  if(!response.body)throw Error('转换服务返回了空响应。');
  const reader=response.body.getReader(),decoder=new TextDecoder();let size=0,text='';
  try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>16*1024*1024)throw Error('路书数据过大，请先精简路线。');text+=decoder.decode(value,{stream:true});}text+=decoder.decode();}
  catch(e){await reader.cancel().catch(()=>{});throw e;}finally{reader.releaseLock();}
  try{return JSON.parse(text);}catch{throw Error('转换服务没有返回有效数据，请稍后重试。');}
}
export async function fetchOnelapRoute(value,coordinateSystem='BD09',{fetchImpl=fetch,timeoutMs=30000}={}){
  const url=validateOnelapLink(value);
  if(!['BD09','GCJ02','WGS84'].includes(coordinateSystem))throw Error('请选择有效的源坐标类型。');
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeoutMs);
  try{
    let response;try{response=await fetchImpl(ONELAP_ENDPOINT,{method:'POST',mode:'cors',credentials:'omit',headers:{'Content-Type':'application/json'},body:JSON.stringify({url,coordinateSystem}),signal:controller.signal});}
    catch(e){if(controller.signal.aborted)throw Error('顽鹿导入超时，请稍后重试。');throw Error('无法连接顽鹿转换服务，请检查网络，或改用 GPX 文件导入。');}
    const data=await readJSON(response);
    if(!response.ok)throw Error(response.status===429?'导入次数较多，请一分钟后再试。':data.error||`转换服务返回 ${response.status}，请稍后重试。`);
    if(typeof data.gpx!=='string'||!data.gpx.includes('<gpx')||!Number.isInteger(data.pointCount)||data.pointCount<2||data.pointCount>150000)throw Error('转换结果缺少有效轨迹，未替换当前路书。');
    return data;
  }catch(e){if(controller.signal.aborted)throw Error('顽鹿导入超时，请稍后重试。');throw e;}finally{clearTimeout(timer);}
}
