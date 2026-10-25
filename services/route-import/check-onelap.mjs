import assert from 'node:assert/strict';
import worker from './worker.mjs';
const endpoint='https://onelap-gpx.changanxiaoxiang.workers.dev/api/convert';
const env={CONVERT_LIMITER:{limit:async()=>({success:true})}};
const post=(url,origin)=>new Request(endpoint,{method:'POST',headers:{'Content-Type':'application/json',...(origin?{Origin:origin}:{})},body:JSON.stringify({url,coordinateSystem:'BD09'})});
assert.equal((await worker.fetch(new Request(endpoint,{method:'OPTIONS',headers:{Origin:'https://zjs1925879492.github.io'}}),env)).status,204);
assert.equal((await worker.fetch(post('https://www.onelap.cn/?id=bad','https://example.org'),env)).status,403);
assert.equal((await worker.fetch(post('https://127.0.0.1/'),env)).status,400);
const urls=['https://www.onelap.cn/bikeroute/detail.html?id=54848&routeType=route','https://www.onelap.cn/bikeroute/detail_old.html?routeType=myroute&id=6abff07ac0a1641f951356e9'];
for(const [i,url] of urls.entries()){
  const r=await worker.fetch(post(url,'https://zjs1925879492.github.io'),env);const d=await r.json();assert.equal(r.status,200,JSON.stringify(d));assert.equal(r.headers.get('Access-Control-Allow-Origin'),'https://zjs1925879492.github.io');assert.equal(d.pointCount,[1699,2352][i]);assert.equal((d.gpx.match(/<trkpt /g)||[]).length,d.pointCount);
  console.log(JSON.stringify({type:d.sourceType,id:d.sourceId,nid:d.nid,points:d.pointCount}));
}
const blocked={CONVERT_LIMITER:{limit:async()=>({success:false})}};
assert.equal((await worker.fetch(post(urls[0]),blocked)).status,429);
console.log('Worker handler checks passed under Node; Cloudflare runtime will be verified after upload.');
