import http from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {importXingzheShare,XingzheError} from './services/route-import/xingzhe.mjs';
import {convertShare,RouteError} from './services/route-import/converter.mjs';
const root=path.dirname(fileURLToPath(import.meta.url)),port=8765;
const origins=new Set([`http://127.0.0.1:${port}`,`http://localhost:${port}`]);let active=0;
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.gpx':'application/gpx+xml; charset=utf-8','.json':'application/json; charset=utf-8','.txt':'text/plain; charset=utf-8','.png':'image/png','.svg':'image/svg+xml','.ico':'image/x-icon'};
function send(res,status,data){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(data));}
const server=http.createServer(async(req,res)=>{
  if(!['127.0.0.1:'+port,'localhost:'+port].includes(req.headers.host)){send(res,403,{error:'仅允许本机访问。'});return;}
  let url;try{url=new URL(req.url,`http://127.0.0.1:${port}`);}catch{send(res,400,{error:'无效地址。'});return;}
  if(url.pathname.startsWith('/api/')){
    if(!['/api/import/xingzhe','/api/import/onelap'].includes(url.pathname)){send(res,404,{error:'接口不存在。'});return;}
    if(req.headers.origin&&!origins.has(req.headers.origin)){send(res,403,{error:'不允许其他网站调用本机导入接口。'});return;}
    if(req.method!=='POST'){send(res,405,{error:'请使用 POST 请求。'});return;}
    if(req.headers['content-type']?.split(';')[0].trim()!=='application/json'){send(res,415,{error:'请发送 JSON 请求。'});return;}
    if(active>=2){send(res,429,{error:'已有导入任务，请稍后重试。'});return;}
    active++;
    try{
      const chunks=[];let size=0;
      for await(const chunk of req){size+=chunk.length;if(size>8192)throw new XingzheError('请求过大。',413);chunks.push(chunk);}
      let input;try{input=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw new XingzheError('请求不是有效 JSON。');}
      const data=url.pathname.endsWith('/xingzhe')?await importXingzheShare(input?.url):await convertShare(input?.url,input?.coordinateSystem||'BD09');
      send(res,200,data);
    }catch(error){send(res,error instanceof XingzheError||error instanceof RouteError?error.status:500,{error:error instanceof XingzheError||error instanceof RouteError?error.message:'本机导入失败，请稍后重试。'});}
    finally{active--;}
    return;
  }
  if(!['GET','HEAD'].includes(req.method)){send(res,405,{error:'不支持此请求方式。'});return;}
  try{
    const pathname=decodeURIComponent(url.pathname),target=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
    if(!target.startsWith(root+path.sep)||!types[path.extname(target)]||(await stat(target)).isDirectory()){send(res,404,{error:'文件不存在。'});return;}
    res.writeHead(200,{'Content-Type':types[path.extname(target)],'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'strict-origin-when-cross-origin'});
    res.end(req.method==='HEAD'?undefined:await readFile(target));
  }catch{if(!res.headersSent)send(res,404,{error:'文件不存在。'});else res.end();}
});
server.requestTimeout=40000;
server.listen(port,'127.0.0.1',()=>console.log(`本机骑行天气与路书导入：http://127.0.0.1:${port}/ （未发布远端）`));
