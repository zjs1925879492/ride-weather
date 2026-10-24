const osmCredit='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>';
export const MAP_PROVIDERS={
  topo:{name:'OpenTopoMap',maxZoom:17,credit:osmCredit+', SRTM | &copy; <a href="https://opentopomap.org/about">OpenTopoMap (CC-BY-SA)</a>',urls:()=>['https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png'],subdomains:'abc'},
  osm:{name:'OpenStreetMap',maxZoom:19,credit:osmCredit,urls:()=>['https://tile.openstreetmap.org/{z}/{x}/{y}.png']},
  tdt:{name:'天地图 · 矢量',maxZoom:18,needsKey:true,credit:'&copy; <a href="https://www.tianditu.gov.cn/">天地图</a>',urls:key=>tdtLayers('vec','cva',key),subdomains:'01234567'},
  tdtimg:{name:'天地图 · 影像',maxZoom:18,needsKey:true,credit:'&copy; <a href="https://www.tianditu.gov.cn/">天地图</a>',urls:key=>tdtLayers('img','cia',key),subdomains:'01234567'}
};
function tdtLayers(base,labels,key){return [base,labels].map(layer=>`https://t{s}.tianditu.gov.cn/${layer}_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=${layer}&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&tk=${encodeURIComponent(key)}`);}
export function providerConfig(id,key=''){const p=MAP_PROVIDERS[id];if(!p)throw Error('未知地图源');if(p.needsKey&&!/^[a-zA-Z0-9_-]{16,128}$/.test(key))throw Error('请填写你自己的有效天地图浏览器端 Key。');return {...p,urls:p.urls(key)};}
export function fallbackProvider(id){return id==='topo'?'osm':'topo';}
export function installBasemaps(L,map,ui,config={}){let current='',layers=[],timer,revision=0,autoTried=false,tdtKey=typeof config.key==='string'?config.key.trim():'';
  const note=(s,error=false)=>{ui.notice.textContent=s;ui.notice.classList.toggle('error',error);};
  function apply(id,{automatic=false}={}){let cfg;try{cfg=providerConfig(id,tdtKey);}catch(e){note(e.message,true);ui.select.value=current||'topo';ui.requestKey(id);return false;}const token=++revision;clearTimeout(timer);layers.forEach(l=>map.removeLayer(l));layers=[];current=id;ui.select.value=id;let loaded=0,errors=0;note(`${cfg.name} 底图加载中…`);map.setMaxZoom(cfg.maxZoom);if(map.getZoom()>cfg.maxZoom)map.setZoom(cfg.maxZoom);
    const fail=()=>{if(token!==revision)return;if(loaded>0){if(errors>=3)note(`${cfg.name} 部分瓦片未加载，可切换地图源。`,true);return;}if(!autoTried){autoTried=true;const next=fallbackProvider(id);note(`${cfg.name} 暂不可用，尝试 ${MAP_PROVIDERS[next].name}…`,true);apply(next,{automatic:true});}else note('底图未能加载；路线仍可查看。请切换地图源或配置天地图 Key。',true);};
    layers=cfg.urls.map((url,i)=>{const layer=L.tileLayer(url,{maxZoom:cfg.maxZoom,subdomains:cfg.subdomains||'abc',attribution:i===0?cfg.credit:'',keepBuffer:2});layer.on('tileload',()=>{if(token!==revision)return;loaded++;clearTimeout(timer);note(`${cfg.name} · ${automatic?'自动备用底图':'底图已连接'}`);});layer.on('tileerror',()=>{if(token!==revision)return;errors++;if(errors>=3)fail();});layer.addTo(map);return layer;});timer=setTimeout(fail,12000);return true;
  }
  ui.select.addEventListener('change',()=>{autoTried=false;apply(ui.select.value);});
  ui.openSettings.addEventListener('click',()=>ui.requestKey(current));
  const initial=MAP_PROVIDERS[config.provider]&&(!MAP_PROVIDERS[config.provider].needsKey||/^[a-zA-Z0-9_-]{16,128}$/.test(tdtKey))?config.provider:'topo';
  apply(initial);
  return {setKey(key,id){tdtKey=key.trim();autoTried=false;return apply(id==='tdtimg'?'tdtimg':'tdt');},clearKey(){tdtKey='';if(MAP_PROVIDERS[current]?.needsKey){autoTried=false;apply('topo');}},current:()=>current};
}
