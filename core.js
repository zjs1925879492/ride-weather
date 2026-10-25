export function haversine(a,b){const r=Math.PI/180;const dlat=(b.lat-a.lat)*r,dlon=(b.lon-a.lon)*r;return 6371.0088*2*Math.asin(Math.min(1,Math.sqrt(Math.sin(dlat/2)**2+Math.cos(a.lat*r)*Math.cos(b.lat*r)*Math.sin(dlon/2)**2)));}
export function prepareRoute(segments){let km=0;const points=[];segments.forEach((seg,si)=>seg.forEach((p,i)=>{if(i)km+=haversine(seg[i-1],p);points.push({...p,km,segment:si});}));return {points,km,segments};}
export function sampleRoute(route,spacing=20,max=18){if(!route.points.length)return [];const step=Math.max(spacing,route.km/(max-1));const out=[{...route.points[0]}];let next=step;for(const p of route.points){if(p.km>=next&&p.km<route.km){out.push({...p});next=p.km+step;}}const end=route.points.at(-1);if(route.points.length>1&&(end.km!==out.at(-1).km||end.lat!==out.at(-1).lat||end.lon!==out.at(-1).lon))out.push({...end});return out;}
export function arrivalEpoch(start,km,speed,rest,total){return start+(km/speed*3600+(total>0?km/total:0)*rest*60);}
export function nearestHour(times,target){if(!times?.length||target<times[0]-1800||target>times.at(-1)+1800)return -1;let best=0;for(let i=1;i<times.length;i++)if(Math.abs(times[i]-target)<Math.abs(times[best]-target))best=i;return best;}
export function weatherAt(data,epoch){const h=data?.hourly,i=nearestHour(h?.time,epoch);if(i<0)return null;const get=k=>Number.isFinite(h[k]?.[i])?h[k][i]:null;return {time:h.time[i],temp:get('temperature_2m'),feels:get('apparent_temperature'),rain:get('precipitation_probability'),amount:get('precipitation'),wind:get('wind_speed_10m'),gust:get('wind_gusts_10m'),direction:get('wind_direction_10m'),code:get('weather_code')};}
export function bearing(a,b){const r=Math.PI/180,x=Math.sin((b.lon-a.lon)*r)*Math.cos(b.lat*r),y=Math.cos(a.lat*r)*Math.sin(b.lat*r)-Math.sin(a.lat*r)*Math.cos(b.lat*r)*Math.cos((b.lon-a.lon)*r);return (Math.atan2(x,y)/r+360)%360;}
export function headwind(speed,from,heading){return speed*Math.cos((from-heading)*Math.PI/180);}
export function condition(code){if(code===null||code===undefined)return ['—','暂无天气'];if(code===0)return ['☀','晴'];if(code<=3)return ['☁',code===3?'阴':'多云'];if(code<=48)return ['≋','雾'];if(code<=67)return ['☂','雨'];if(code<=77)return ['❄','雪'];if(code<=82)return ['☂','阵雨'];if(code<=86)return ['❄','阵雪'];return ['ϟ','雷暴'];}
export function windName(d){return d===null?'风向未知':['北','东北','东','东南','南','西南','西','西北'][Math.round(d/45)%8]+'风';}
export function assess(w){if(!w)return 'unknown';if((w.code??0)>=95||(w.gust??0)>=50||(w.amount??0)>=5)return 'high';if((w.rain??0)>=50||(w.wind??0)>=25||(w.temp??20)>=35||(w.temp??20)<=5)return 'care';return 'normal';}

export const WEATHER_STYLES = Object.freeze({
  sunny: {label:'晴', color:'#e7853e', symbol:'☀'},
  cloudy: {label:'多云 / 阴', color:'#7a8490', symbol:'☁'},
  rain: {label:'雨', color:'#3185d5', symbol:'☂'},
  fog: {label:'雾', color:'#ffffff', symbol:'≋'},
  snow: {label:'雪', color:'#b6a0dc', symbol:'❄'},
  thunder: {label:'雷暴', color:'#b64c89', symbol:'ϟ'},
  unknown: {label:'天气待查询 / 暂缺', color:'#6c8276', symbol:'—'}
});
export function weatherKind(code){
  if(code===0)return 'sunny';
  if([1,2,3].includes(code))return 'cloudy';
  if([45,48].includes(code))return 'fog';
  if([51,53,55,56,57,61,63,65,66,67,80,81,82].includes(code))return 'rain';
  if([71,73,75,77,85,86].includes(code))return 'snow';
  if([95,96,99].includes(code))return 'thunder';
  return 'unknown';
}
function interpolatePoint(a,b,f){return {lat:a.lat+(b.lat-a.lat)*f,lon:a.lon+(b.lon-a.lon)*f,km:a.km+(b.km-a.km)*f,segment:a.segment};}
export function pointAtDistance(route,km){
  if(!route?.points.length)return null;
  const points=route.points;
  if(km<=0)return {...points[0]};
  for(let i=1;i<points.length;i++){
    const a=points[i-1],b=points[i];
    if(b.km>=km&&a.segment===b.segment&&b.km>a.km)return interpolatePoint(a,b,(km-a.km)/(b.km-a.km));
  }
  return {...points.at(-1)};
}
// Nearest-sample zones meet at mileage midpoints; never join separate GPX tracks.
export function weatherRouteSections(route,samples,weather){
  if(!route||!samples.length)return [];
  const boundaries=samples.slice(1).map((s,i)=>(samples[i].km+s.km)/2);
  const sections=[];
  const indexAt=km=>{let i=0;while(i<boundaries.length&&km>=boundaries[i])i++;return i;};
  for(let i=1;i<route.points.length;i++){
    const a=route.points[i-1],b=route.points[i];
    if(a.segment!==b.segment||b.km<=a.km)continue;
    const cuts=[a,...boundaries.filter(k=>k>a.km&&k<b.km).map(k=>interpolatePoint(a,b,(k-a.km)/(b.km-a.km))),b];
    for(let j=1;j<cuts.length;j++){
      const start=cuts[j-1],end=cuts[j],sampleIndex=indexAt((start.km+end.km)/2),kind=weatherKind(weather[sampleIndex]?.code);
      const prev=sections.at(-1);
      if(prev&&prev.segment===a.segment&&prev.sampleIndex===sampleIndex)prev.points.push(end);
      else sections.push({segment:a.segment,sampleIndex,kind,points:[start,end]});
    }
  }
  return sections;
}

// Solve ETA - local solar time = 0 between forecast samples. Dates are UTC API days.
export function solarRouteEvents(samples,forecasts,plan,totalKm,nearSeconds=1800){
  if(!samples.length||!Number.isFinite(plan.start)||totalKm<=0)return [];
  const start=plan.start,end=arrivalEpoch(start,totalKm,plan.speed,plan.rest,totalKm),groups=new Map();
  samples.forEach((sample,i)=>{
    const daily=forecasts[i]?.daily;
    if(!daily?.time)return;
    for(const type of ['sunrise','sunset'])daily.time.forEach((day,j)=>{
      const time=daily[type]?.[j];
      if(!Number.isFinite(time)||time<=0)return;
      const key=type+':'+day;
      if(!groups.has(key))groups.set(key,[]);
      groups.get(key).push({type,time,km:sample.km,index:i,eta:arrivalEpoch(start,sample.km,plan.speed,plan.rest,totalKm)});
    });
  });
  const events=[];
  for(const nodes of groups.values()){
    let event=null;
    for(let i=0;i<nodes.length;i++){
      const a=nodes[i];
      if(a.eta===a.time){event={type:a.type,time:a.time,km:a.km,phase:'during'};break;}
      const b=nodes[i+1];
      if(!b||b.index!==a.index+1||b.km<=a.km)continue;
      const da=a.eta-a.time,db=b.eta-b.time;
      if(da<0&&db>=0){
        const f=-da/(db-da);
        event={type:a.type,time:a.eta+(b.eta-a.eta)*f,km:a.km+(b.km-a.km)*f,phase:'during'};break;
      }
    }
    if(!event){
      const first=nodes.find(n=>n.index===0),last=nodes.find(n=>n.index===samples.length-1);
      if(first&&first.time<start&&start-first.time<=nearSeconds)event={type:first.type,time:first.time,km:0,phase:'before'};
      else if(last&&last.time>end&&last.time-end<=nearSeconds)event={type:last.type,time:last.time,km:totalKm,phase:'after'};
    }
    if(event)events.push({...event,remainingMinutes:Math.max(0,Math.round((end-event.time)/60))});
  }
  return events.sort((a,b)=>a.time-b.time);
}
