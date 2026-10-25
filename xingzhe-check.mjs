import assert from 'node:assert/strict';
import {validateXingzheLink,fetchXingzheRoute,XINGZHE_ENDPOINT} from './xingzhe.js';
import {validateFavorite} from './favorites.js';
import {parseXingzheShare,decodePolyline,routeFileURL,convertXingzheData,importXingzheShare} from './services/route-import/xingzhe.mjs';
const share='https://www.imxingzhe.com/routes/5701846/?from=app',canonical='https://www.imxingzhe.com/routes/5701846/';
assert.equal(validateXingzheLink(share),canonical);assert.equal(validateXingzheLink(' https://imxingzhe.com/routes/5701846 '),canonical);
assert.equal(parseXingzheShare(share).source,canonical);
for(const url of ['http://www.imxingzhe.com/routes/5701846/','https://imxingzhe.com.evil.test/routes/5701846/','https://user:pass@www.imxingzhe.com/routes/5701846/','https://www.imxingzhe.com:8443/routes/5701846/','https://www.imxingzhe.com/routes/0/','https://www.imxingzhe.com/routes/5701846/edit','https://www.imxingzhe.com/api/v1/lushu/5701846/gpx/']){
  assert.throws(()=>validateXingzheLink(url));assert.throws(()=>parseXingzheShare(url));
}
const encoded='_p~iF~ps|U_ulLnnqC_mqNvxq`@';
assert.deepEqual(decodePolyline(encoded),[{lat:38.5,lon:-120.2},{lat:40.7,lon:-120.95},{lat:43.252,lon:-126.453}]);
for(const bad of ['','?','~~~~~~~','!','_p~iF~ps|U_ulLnnqC_mqNvxq`'])assert.throws(()=>decodePolyline(bad));
assert.throws(()=>decodePolyline(encoded,2),/150,000/);
const uuid='00000000-0000-4000-8000-000000000001';
const meta={id:5701846,title:'路线<&"',type:4,uuid,file_url:`https://xingzhe.oss-cn-hangzhou.aliyuncs.com/lushu-${uuid}.json`,points:3,distance:1000};
const data={polylines:[encoded],elevations:[10,null,12],waypoints:[{name:'起点<&',coordinate:[38.5,-120.2]}]};
const converted=convertXingzheData(meta,data,parseXingzheShare(share));
assert.equal(converted.pointCount,3);assert.equal(converted.elevationCount,2);assert.equal(converted.waypointCount,1);assert(converted.gpx.includes('路线&lt;&amp;&quot;'));assert.equal((converted.gpx.match(/<trkpt /g)||[]).length,3);
assert.throws(()=>convertXingzheData({...meta,id:1},data,parseXingzheShare(share)),/不一致/);
assert.throws(()=>convertXingzheData({...meta,points:9},data,parseXingzheShare(share)),/点数/);
assert.throws(()=>convertXingzheData(meta,{...data,polylines:['?']},parseXingzheShare(share)),/编码/);
for(const file_url of ['https://example.org/private.json','https://127.0.0.1/private.json',meta.file_url.replace(uuid,'other'),'http://xingzhe.oss-cn-hangzhou.aliyuncs.com/lushu-'+uuid+'.json'])assert.throws(()=>routeFileURL({...meta,file_url}));
let calls=[];
const fakeFetch=async(url,options)=>{
  calls.push(url);assert.equal(options.redirect,'manual');assert.equal(options.credentials,'omit');assert(!('Cookie' in options.headers));assert(!('Authorization' in options.headers));
  return Response.json(calls.length===1?{code:0,data:{lushu:meta}}:data);
};
const result=await importXingzheShare(share,{fetchImpl:fakeFetch});assert.equal(result.sourceType,'xingzhe');assert.equal(calls.length,2);assert.equal(calls[1],meta.file_url);
assert(!calls.some(url=>url.includes('/gpx')),'Public import does not call the authenticated GPX download');
calls=[];
await assert.rejects(importXingzheShare(share,{fetchImpl:async()=>{calls.push(1);return Response.json({code:0,data:{lushu:{...meta,file_url:'https://127.0.0.1/'}}});}}),/允许范围/);assert.equal(calls.length,1);
await assert.rejects(importXingzheShare(share,{fetchImpl:async()=>Response.json({code:401},{status:401})}),/需要登录/);
await assert.rejects(importXingzheShare(share,{fetchImpl:async()=>new Response(null,{status:302,headers:{Location:'https://example.org/'}})}),/HTTP 302/);
await assert.rejects(importXingzheShare(share,{fetchImpl:async()=>new Response('x'.repeat(300000))}),/过大/);
const fetched=await fetchXingzheRoute(share,{fetchImpl:async(endpoint,options)=>{
  assert.equal(endpoint,XINGZHE_ENDPOINT);assert.equal(options.mode,'cors');assert.equal(options.credentials,'omit');assert.deepEqual(JSON.parse(options.body),{url:canonical});return Response.json(converted);
}});assert.equal(fetched.pointCount,3);
await assert.rejects(fetchXingzheRoute(share,{fetchImpl:async()=>Response.json({...converted,sourceId:'other'})}),/结果无效/);
await assert.rejects(fetchXingzheRoute(share,{fetchImpl:async()=>Response.json({error:'not deployed'},{status:404})}),/尚未启用/);
await assert.rejects(fetchXingzheRoute(share,{fetchImpl:async()=>Response.json({error:'limited'},{status:429})}),/稍后再试/);
await assert.rejects(fetchXingzheRoute(share,{fetchImpl:async()=>{throw TypeError('offline');}}),/GPX/);
await assert.rejects(fetchXingzheRoute(share,{timeoutMs:5,fetchImpl:(_url,{signal})=>new Promise((_resolve,reject)=>signal.addEventListener('abort',()=>reject(Error('aborted'))))}),/超时/);
assert.equal(validateFavorite({name:'行者路线',segments:[[{lat:31,lon:119},{lat:32,lon:120}]],sourceUrl:canonical}).sourceUrl,canonical);
console.log('Passed: Xingzhe link/domain checks, known polyline vector, malformed/oversized data, point and route ownership, file allowlist, XML escaping/elevation, no credentials or GPX-auth calls, errors/timeouts, favorite source URL.');
