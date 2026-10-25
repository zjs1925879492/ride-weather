export const XINGZHE_ENDPOINT='https://onelap-gpx.changanxiaoxiang.workers.dev/api/xingzhe';
export function validateXingzheLink(value){
  if(typeof value!=='string'||value.length>3000)throw Error('请粘贴完整的行者路书分享链接。');
  let url;try{url=new URL(value.trim());}catch{throw Error('行者分享链接格式不正确。');}
  if(url.protocol!=='https:'||!['www.imxingzhe.com','imxingzhe.com'].includes(url.hostname)||url.port||url.username||url.password)throw Error('请使用 HTTPS 的行者 imxingzhe.com 分享链接。');
  const match=/^\/routes\/([1-9][0-9]{0,11})\/?$/.exec(url.pathname);
  if(!match)throw Error('请粘贴包含数字路书 ID 的行者分享链接，例如 /routes/5701846/。');
  return `https://www.imxingzhe.com/routes/${match[1]}/`;
}
export async function fetchXingzheRoute(value,{fetchImpl=fetch,endpoint=XINGZHE_ENDPOINT,timeoutMs=35000}={}){
  const url=validateXingzheLink(value),controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeoutMs);
  try{
    let response;try{response=await fetchImpl(endpoint,{method:'POST',mode:'cors',credentials:'omit',headers:{'Content-Type':'application/json'},body:JSON.stringify({url}),signal:controller.signal});}
    catch{throw Error(controller.signal.aborted?'行者导入超时，请稍后重试。':'无法连接行者导入服务，请检查网络，或在行者导出 GPX 后上传。');}
    if(response.status===404)throw Error('当前服务尚未启用行者导入，请使用本机验收页或上传 GPX 文件。');
    if(!response.body)throw Error('行者导入服务返回了空响应。');
    const reader=response.body.getReader(),decoder=new TextDecoder();let text='',size=0;
    try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>16*1024*1024)throw Error('行者路书数据过大，请先精简路线。');text+=decoder.decode(value,{stream:true});}text+=decoder.decode();}
    catch(error){await reader.cancel().catch(()=>{});throw error;}finally{reader.releaseLock();}
    let data;try{data=JSON.parse(text);}catch{throw Error('行者导入服务未返回有效数据。');}
    if(!response.ok)throw Error(response.status===429?'导入次数较多，请稍后再试。':typeof data.error==='string'?data.error:`行者导入失败（HTTP ${response.status}）。`);
    if(data.sourceType!=='xingzhe'||data.sourceId!==new URL(url).pathname.split('/')[2]||typeof data.gpx!=='string'||!data.gpx.includes('<gpx')||!Number.isInteger(data.pointCount)||data.pointCount<2||data.pointCount>150000)throw Error('行者导入结果无效，未替换当前路线。');
    return data;
  }catch(error){if(controller.signal.aborted)throw Error('行者导入超时，请稍后重试。');throw error;}
  finally{clearTimeout(timer);}
}
