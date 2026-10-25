import {test} from 'node:test';
import assert from 'node:assert/strict';
import {gzipSync} from 'node:zlib';
import {parseShare,convertResponse} from './converter.mjs';
const link='https://www.onelap.cn/bikeroute/detail_old.html?routeType=myroute&id=6abff07ac0a1641f951356e9';
const share=parseShare(link);
function response(points=[{lng:119.6,lat:31.6},{lng:119.7,lat:31.7}]){return {code:200,data:{id:share.id,nid:1915243,name:'A & <B>',distance:1000,points:gzipSync(JSON.stringify(points)).toString('base64'),path_point:[{lng:119.6,lat:31.6,name:'转弯 & <路口>'}]}};}
test('Only public Onelap share identifiers can become upstream requests',()=>{
  for(const v of ['http://www.onelap.cn/?id='+share.id,'https://www.onelap.cn.evil.test/?id='+share.id,'https://user@www.onelap.cn/?id='+share.id,'https://127.0.0.1/?id='+share.id,'https://www.onelap.cn/mRouter/index.html#/index?nid=1915243'])assert.throws(()=>parseShare(v));
  assert.equal(parseShare(link).id,share.id);
});
test('GPX escapes XML text, retains points and avoids invented elevation/time',()=>{
  const result=convertResponse(response(),share,'WGS84');assert.equal(result.pointCount,2);assert.equal(result.waypointCount,1);assert.match(result.gpx,/A &amp; &lt;B&gt;/);assert.match(result.gpx,/转弯 &amp; &lt;路口&gt;/);assert.match(result.gpx,/lat="31.60000000" lon="119.60000000"/);assert.doesNotMatch(result.gpx,/<ele>|<time>/);assert.equal(result.sourceCoordinateSystem,'WGS84');
});
test('Identity, business errors, malformed compression and invalid coordinates fail closed',()=>{
  const wrong=response();wrong.data.id='000000000000000000000000';assert.throws(()=>convertResponse(wrong,share));
  assert.throws(()=>convertResponse({code:403},share));
  const bad=response();bad.data.points='not gzip';assert.throws(()=>convertResponse(bad,share));
  for(const p of [{lat:null,lng:119},{lat:false,lng:119},{lat:91,lng:119}])assert.throws(()=>convertResponse(response([p,p]),share));
  assert.throws(()=>convertResponse(response(),share,'UNKNOWN'));
});
test('Decompression size limit prevents oversized decoded payloads',()=>{
  const large=response();large.data.points=gzipSync(Buffer.alloc(17*1024*1024,32)).toString('base64');assert.throws(()=>convertResponse(large,share),/16 MiB/);
});
test('Numeric public road-book ID is routed separately from its navigation nid',()=>{
  const official=parseShare('https://www.onelap.cn/bikeroute/detail.html?id=54848&routeType=route');
  assert.equal(official.id,'54848');assert.equal(official.type,'route');
  const data=response();delete data.data.id;data.data.nid=1364371;data.data.status=4;
  const out=convertResponse(data,official,'WGS84');
  assert.equal(out.sourceId,'54848');assert.equal(out.nid,1364371);assert.match(out.filename,/_route54848\.gpx$/);
  data.data.status=0;assert.throws(()=>convertResponse(data,official),/公开/);
  for(const id of ['54848/other','54848?x=1','0','-1'])assert.throws(()=>parseShare('https://www.onelap.cn/bikeroute/detail.html?routeType=route&id='+encodeURIComponent(id)));
});
