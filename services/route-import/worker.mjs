import {convertShare,parseShare,readLimited,RouteError} from './converter.mjs';
import {importXingzheShare,parseXingzheShare,XingzheError} from './xingzhe.mjs';
import files from './static-content.mjs';
const otherOrigins=new Set(['https://zjs1925879492.github.io','https://ride-weather.changanxiaoxiang.workers.dev','http://127.0.0.1:8879','http://localhost:8879','http://127.0.0.1:8765','http://localhost:8765']);
const security={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'"};
function send(value,status=200,cors={}){return Response.json(value,{status,headers:{...security,...cors}});}
export default {async fetch(request,env){
  const started=Date.now();let response;
  try{response=await handle(request,env);}catch(e){console.error(JSON.stringify({event:'converter_internal_error',type:e.name}));response=send({error:'服务暂时不可用，请稍后重试。'},500);}
  console.log(JSON.stringify({event:'converter_request',method:request.method,path:new URL(request.url).pathname,status:response.status,durationMs:Date.now()-started}));
  return response;
}};
async function handle(request,env){
  const url=new URL(request.url),origin=request.headers.get('Origin');
  const allowed=!origin||origin===url.origin||otherOrigins.has(origin);
  const cors=origin&&allowed?{'Access-Control-Allow-Origin':origin,'Vary':'Origin'}:{};
  if((request.method==='GET'||request.method==='HEAD')&&Object.hasOwn(files,url.pathname)){
    const f=files[url.pathname];return new Response(request.method==='HEAD'?null:f.body,{headers:{...security,'Content-Type':f.type}});
  }
  if(url.pathname==='/health'&&request.method==='GET')return send({ok:true,service:'onelap-gpx',version:'2026-10-26',providers:['onelap','xingzhe']},200,cors);
  if(!['/api/convert','/api/xingzhe'].includes(url.pathname))return send({error:'接口不存在。'},404);
  const isXingzhe=url.pathname==='/api/xingzhe';
  if(!allowed)return send({error:'此来源不允许调用转换接口。'},403);
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers:{...security,...cors,'Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type','Access-Control-Max-Age':'600'}});
  if(request.method!=='POST')return send({error:'请使用 POST 请求。'},405,cors);
  if(request.headers.get('Content-Type')?.split(';')[0].trim()!=='application/json')return send({error:'请发送 JSON 请求。'},415,cors);
  if(Number(request.headers.get('Content-Length'))>8192)return send({error:'请求过大。'},413,cors);
  try{
    let input;try{input=JSON.parse(await readLimited(request.body,8192));}catch(e){if(e instanceof RouteError)throw new RouteError('请求过大或为空。',e.status===413?413:400);throw new RouteError('请求不是有效 JSON。');}
    if(isXingzhe)parseXingzheShare(input?.url);else parseShare(input?.url);
    const ip=request.headers.get('CF-Connecting-IP')||'unknown';
    const limit=await env.CONVERT_LIMITER.limit({key:'convert:'+ip});
    if(!limit.success)return new Response(JSON.stringify({error:'转换次数较多，请一分钟后再试。'}),{status:429,headers:{...security,...cors,'Content-Type':'application/json; charset=utf-8','Retry-After':'60'}});
    const result=isXingzhe?await importXingzheShare(input.url):await convertShare(input.url,input.coordinateSystem||'BD09');return send(result,200,cors);
  }catch(e){const known=e instanceof RouteError||e instanceof XingzheError;return send({error:known?e.message:'转换失败，请稍后重试。'},known?e.status:500,cors);}
}
