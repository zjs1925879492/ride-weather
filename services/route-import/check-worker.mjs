import assert from 'node:assert/strict';
import worker from './worker.mjs';
const endpoint='https://onelap-gpx.changanxiaoxiang.workers.dev/api/xingzhe',share='https://www.imxingzhe.com/routes/5701846/';
const origin='https://zjs1925879492.github.io',env={CONVERT_LIMITER:{limit:async()=>({success:true})}};
const post=(url,source=origin)=>new Request(endpoint,{method:'POST',headers:{'Content-Type':'application/json',Origin:source},body:JSON.stringify({url})});
const savedFetch=globalThis.fetch,calls=[];
const uuid='00000000-0000-4000-8000-000000000001';
try{
  globalThis.fetch=async(url,options)=>{
    calls.push(url);assert.equal(options.redirect,'manual');assert.equal(options.credentials,'omit');
    if(url.includes('/api/v1/lushu/'))return Response.json({code:0,data:{lushu:{id:5701846,type:4,title:'Worker test',uuid,points:3,file_url:`https://xingzhe.oss-cn-hangzhou.aliyuncs.com/lushu-${uuid}.json`}}});
    return Response.json({polylines:['_p~iF~ps|U_ulLnnqC_mqNvxq`@'],elevations:[1,2,3],waypoints:[]});
  };
  const options=await worker.fetch(new Request(endpoint,{method:'OPTIONS',headers:{Origin:origin}}),env);
  assert.equal(options.status,204);assert.equal(options.headers.get('Access-Control-Allow-Origin'),origin);
  assert.equal((await worker.fetch(post(share,'https://example.org'),env)).status,403);
  assert.equal((await worker.fetch(post('https://127.0.0.1/'),env)).status,400);
  assert.equal(calls.length,0);
  const response=await worker.fetch(post(share),env),data=await response.json();
  assert.equal(response.status,200);assert.equal(data.sourceType,'xingzhe');assert.equal(data.pointCount,3);assert.equal(response.headers.get('Access-Control-Allow-Origin'),origin);assert.equal(calls.length,2);
  assert.equal((await worker.fetch(post(share),{CONVERT_LIMITER:{limit:async()=>({success:false})}})).status,429);assert.equal(calls.length,2);
  const badOriginal=new Request(endpoint.replace('/api/xingzhe','/api/convert'),{method:'POST',headers:{'Content-Type':'application/json',Origin:origin},body:JSON.stringify({url:'https://example.org/'})});
  assert.equal((await worker.fetch(badOriginal,env)).status,400);
  console.log('Prepared Worker Xingzhe handler passed under Node with mock upstreams; not deployed or verified in the Cloudflare runtime.');
}finally{globalThis.fetch=savedFetch;}
