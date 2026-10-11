/* Shared, price-only quote controller. Forecasts never enter this module. */
(function(root){
 'use strict';
 const SYMBOLS=['MU','SKHY','SNDK'];
 const FEED='https://raw.githubusercontent.com/ZhipengMeng/mu-value-lab/main/market/quotes.json';
 const CACHE='memory-value-lab.quotes.v1', MIN_TIME=Date.parse('2026-10-09T20:00:00Z');
 function validate(data,now=Date.now()){
  if(!data||data.schema!==1||data.provider!=='Yahoo Finance'||!data.quotes||Object.keys(data.quotes).sort().join()!==SYMBOLS.join())throw Error('Invalid quote feed');
  const generated=Date.parse(data.generatedAt);
  if(!Number.isFinite(generated)||generated>now+300000||generated<MIN_TIME)throw Error('Invalid feed time');
  for(const s of SYMBOLS){const q=data.quotes[s],at=Date.parse(q?.asOf),checked=Date.parse(q?.retrievedAt);
   if(!q||q.symbol!==s||q.currency!=='USD'||q.exchange!=='Nasdaq'||q.session!=='regular'||q.security!==(s==='SKHY'?'ADS':'common stock')||typeof q.price!=='number'||!Number.isFinite(q.price)||q.price<=0||!Number.isFinite(at)||at<MIN_TIME||at>now+300000||!Number.isFinite(checked)||checked<at-120000||checked>generated+300000||q.sourceUrl!=='https://finance.yahoo.com/quote/'+s+'/')throw Error('Invalid '+s+' quote');
  }
  return data;
 }
 function create({symbols,baseline,onChange}){
  let feed=null,mode=/^https?:$/.test(location.protocol)?'auto':'snapshot',busy=false,error='',timer;
  const mount=document.getElementById('market-quotes');
  mount.className='market-quotes';
  mount.innerHTML='<div class="market-heading"><strong>Market prices</strong><label><input id="quote-auto" type="checkbox"> Update automatically</label><button id="quote-refresh" type="button">Refresh prices</button></div><p id="quote-status" role="status" aria-live="polite"></p><div id="quote-prices"></div><p class="market-note">Prices affect P/E, upside and rankings only. Earnings, business drivers, share/ADS ratios, FX and DCF valuation date remain the October 9, 2026 model assumptions. Regular-session USD quotes; no extended-hours prices. Feed refreshes about every 15 minutes on weekdays; this page checks every 5 minutes. Refresh can be delayed. Not a real-time trading feed.</p>';
  const auto=mount.querySelector('#quote-auto'),button=mount.querySelector('#quote-refresh'),status=mount.querySelector('#quote-status'),list=mount.querySelector('#quote-prices');
  const stamp=s=>new Date(s).toLocaleString('en-US',{timeZone:'America/New_York',month:'short',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit',timeZoneName:'short'});
  const quote=s=>mode==='auto'&&feed?feed.quotes[s]:null;
  const price=s=>quote(s)?.price??baseline[s];
  const context=()=>({mode,feedGeneratedAt:feed?.generatedAt??null,quotes:Object.fromEntries(symbols.map(s=>[s,quote(s)||{symbol:s,price:baseline[s],currency:'USD',asOf:'2026-10-09T20:00:00Z',source:'Embedded October 9 snapshot'}]))});
  function notify(){
   const active=document.activeElement;
   if(active?.matches('input[type="number"],select')&&!mount.contains(active)){active.addEventListener('blur',()=>onChange(),{once:true});}
   else onChange();
  }
  function draw(){
   auto.checked=mode==='auto';button.disabled=busy||mode!=='auto';list.replaceChildren();
   const age=feed?Date.now()-Date.parse(feed.generatedAt):0,oldQuote=feed&&symbols.some(s=>Date.now()-Date.parse(feed.quotes[s].asOf)>96*3600000);
   let message=mode==='snapshot'?'October 9 snapshot selected.':feed?'Automatic prices · source checked '+stamp(feed.generatedAt)+'.':'Automatic prices unavailable; using the October 9 snapshot.';
   if(mode==='auto'&&busy)message+=' Checking for an update…';
   if(mode==='auto'&&error)message+=' Update failed; last dated prices retained.';
   if(mode==='auto'&&feed&&age>90*60000)message+=' Feed is over 90 minutes old; the market may be closed or refresh delayed.';
   if(mode==='auto'&&oldQuote)message+=' A quote is over four days old; check its timestamp before use.';
   status.textContent=message;
   mount.dataset.state=mode==='snapshot'?'snapshot':feed?(error||oldQuote||age>90*60000?'stale':'automatic'):'fallback';
   for(const s of symbols){const q=quote(s),item=document.createElement('div'),b=document.createElement('strong'),a=document.createElement('a'),small=document.createElement('small');
    b.textContent=s+' $'+price(s).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})+(s==='SKHY'?' / ADS':' / share');
    a.href='https://finance.yahoo.com/quote/'+s+'/';a.textContent=q?'Yahoo Finance':'Snapshot source';a.target='_blank';a.rel='noopener';
    small.textContent='Regular session · '+stamp(q?.asOf||'2026-10-09T20:00:00Z')+' · ';
    small.appendChild(a);item.append(b,small);list.appendChild(item);
   }
  }
  function accept(data){
   validate(data);
   if(feed&&(Date.parse(data.generatedAt)<Date.parse(feed.generatedAt)||SYMBOLS.some(s=>Date.parse(data.quotes[s].asOf)<Date.parse(feed.quotes[s].asOf))))throw Error('Older quote feed rejected');
   const hadFeed=!!feed,before=symbols.map(price).join();feed=data;error='';
   try{localStorage.setItem(CACHE,JSON.stringify(data));}catch(_){}
   draw();if(!hadFeed||before!==symbols.map(price).join())notify();
  }
  async function refresh(){
   if(busy||mode!=='auto')return;
   busy=true;draw();const abort=new AbortController(),timeout=setTimeout(()=>abort.abort(),8000);
   try{const r=await fetch(FEED+'?t='+Math.floor(Date.now()/300000),{cache:'no-store',credentials:'omit',signal:abort.signal});if(!r.ok)throw Error('Quote service unavailable');accept(await r.json());}
   catch(_){error='unavailable';}finally{clearTimeout(timeout);busy=false;draw();}
  }
  auto.addEventListener('change',()=>{mode=auto.checked?'auto':'snapshot';draw();notify();if(mode==='auto')refresh();});
  button.addEventListener('click',refresh);
  draw();
  return {price,context,label:()=>mode==='auto'&&feed?'Market quote (USD)':'Snapshot close · October 9, 2026',start(){
   if(mode==='auto'){try{feed=validate(JSON.parse(localStorage.getItem(CACHE)));}catch(_){feed=null;}draw();notify();refresh();}
   timer=setInterval(()=>{draw();if(document.visibilityState==='visible')refresh();},300000);
   document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')refresh();});
  },refresh};
 }
 const api={validate,create,FEED};if(typeof module==='object')module.exports=api;root.MarketQuotes=api;
})(typeof window==='undefined'?globalThis:window);
