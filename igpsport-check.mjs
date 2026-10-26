import assert from 'node:assert/strict';
import {parseIgpsportLink,convertIgpsportData,fetchIgpsportRoute,IGPSPORT_ENDPOINT} from './igpsport.js';
const link='https://analyse.zh.igpsport.com/new/my/road/book/share?routeId=70714&language=zh-Hans',share=parseIgpsportLink(link);
assert.equal(share.id,'70714');assert.equal(share.source,link);
assert.equal(parseIgpsportLink('https://analyse.zh.igpsport.com/new/road/book/share?routeId=70714').id,'70714');
for(const value of ['',link.replace('https:','http:'),link.replace('.com/','.com.evil.test/'),link.replace('https://','https://user:pass@'),link.replace('.com/','.com:8443/'),link.replace('70714','0'),link+'&routeId=2',link.replace('70714','70714x'),link.replace('/share','/edit'),link.replace('analyse.zh','prod.zh'),link.replace('70714','9999999999999')])assert.throws(()=>parseIgpsportLink(value));
const data={code:0,data:{summary:{roadId:70714,title:'路线<&"',distance:1000},routeInfo:{tracks:[{latitude:31,longitute:120,alt:0},{latitude:31.01,longitute:120.01,alt:-4.4},{latitude:31.02,longitute:120.02,alt:null}]},roadBookAuxiliaryPoint:[{latitude:31,longitude:120,name:'水<&'}]}};
const converted=convertIgpsportData(data,share);
assert.equal(converted.pointCount,3);assert.equal(converted.elevationCount,2);assert.equal(converted.waypointCount,1);assert.equal(converted.outputCoordinateSystem,'WGS84');assert(converted.calculatedDistanceMetres>2000);
assert(converted.gpx.includes('路线&lt;&amp;&quot;'));assert(converted.gpx.includes('<ele>0</ele>'));assert(converted.gpx.includes('<ele>-4.4</ele>'));assert(!converted.gpx.includes('<ele>null'));
assert.equal((converted.gpx.match(/<trkpt /g)||[]).length,3);assert(converted.gpx.includes('<wpt lat="31" lon="120">'));
const clone=()=>structuredClone(data);
for(const mutate of [d=>d.code=401,d=>d.data.summary.roadId=2,d=>d.data.routeInfo.tracks=[],d=>d.data.routeInfo.tracks[1].latitude=NaN,d=>d.data.routeInfo.tracks[0].longitute=181,d=>d.data.routeInfo.tracks[0].latitude=null,d=>d.data.routeInfo.tracks[0].latitude='31',d=>d.data.roadBookAuxiliaryPoint[0].longitude=null,d=>d.data.routeInfo.tracks=Array(150001).fill({latitude:31,longitute:120}),d=>d.data.roadBookAuxiliaryPoint=Array(2001).fill({latitude:31,longitude:120})]){const d=clone();mutate(d);assert.throws(()=>convertIgpsportData(d,share));}
let count=0;
const fetched=await fetchIgpsportRoute(link,{fetchImpl:async(url,options)=>{
 count++;assert.equal(url,IGPSPORT_ENDPOINT+'?routeId=70714');assert.equal(options.method,'GET');assert.equal(options.mode,'cors');assert.equal(options.credentials,'omit');assert.equal(options.redirect,'error');assert.equal(options.headers,undefined);return Response.json(data);
}});assert.equal(count,1);assert.equal(fetched.pointCount,3);
for(const status of [401,403,404,429,500])await assert.rejects(fetchIgpsportRoute(link,{fetchImpl:async()=>new Response(null,{status})}));
await assert.rejects(fetchIgpsportRoute(link,{fetchImpl:async()=>new Response('invalid json')}),/格式/);
await assert.rejects(fetchIgpsportRoute(link,{fetchImpl:async()=>new Response('x',{headers:{'Content-Length':String(9*1024*1024)}})}),/8 MB/);
await assert.rejects(fetchIgpsportRoute(link,{fetchImpl:async()=>new Response('x'.repeat(8*1024*1024+1))}),/8 MB/);
await assert.rejects(fetchIgpsportRoute(link,{fetchImpl:async()=>{throw Error('offline');}}),/连接/);
await assert.rejects(fetchIgpsportRoute(link,{timeoutMs:5,fetchImpl:(_url,{signal})=>new Promise((_resolve,reject)=>signal.addEventListener('abort',()=>reject(Error('aborted'))))}),/超时/);
console.log('Passed: iGPSPORT share validation, route identity, coordinates, original elevations, waypoints, XML escaping, bounded response/point counts, anonymous CORS request and failure handling.');
