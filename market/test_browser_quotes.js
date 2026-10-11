'use strict';
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {chromium}=require('playwright'),root=path.resolve(__dirname,'..'),company=require('../v2.0/model.json').company;
const files=[['model','v2.0/'+company.toLowerCase()+'_valuation_v2_0.html']];if(fs.existsSync(path.join(root,'comparison')))files.push(['comparison','comparison/memory_valuation_comparison.html']);
const checks=[],check=(ok,label)=>{assert.ok(ok,label);checks.push(label);};
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
function payload(prices){const now=new Date().toISOString(),at=new Date(Date.now()-120000).toISOString();return {schema:1,provider:'Yahoo Finance',generatedAt:now,quotes:Object.fromEntries(Object.entries(prices).map(([s,price])=>[s,{symbol:s,price,currency:'USD',exchange:'Nasdaq',session:'regular',security:s==='SKHY'?'ADS':'common stock',asOf:at,retrievedAt:now,sourceUrl:'https://finance.yahoo.com/quote/'+s+'/'}]))};}
async function capture(page){return page.evaluate(()=>{
 const comparison=!!window.comparisonRuns,result=comparison?window.comparisonRuns:(window.ValueLabUI?ValueLabUI.getResults():window.auditResults);
 const values=Object.fromEntries(Object.entries(result).map(([k,r])=>[k,{value:r.price,up:r.upside,pe:r.marketPE,cash:JSON.stringify({rows:r.rows,bridge:r.bridge,fade:r.fade,shares:r.shares,ev:r.enterprise})}]));
 return {values,rows:window.comparisonRows,model:JSON.stringify(comparison?MODELS:(window.ValueLabUI?ValueLabUI.getModel():model))};
 });}
(async()=>{
 const server=http.createServer((req,res)=>{const hit=files.find(([id])=>req.url==='/'+id);if(!hit){res.writeHead(404);return res.end();}res.setHeader('Content-Type','text/html');res.end(fs.readFileSync(path.join(root,hit[1])));});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_EXECUTABLE||process.env.SNDK_BROWSER_EXECUTABLE||[chromium.executablePath(),'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome','/usr/bin/chromium'].find(p=>fs.existsSync(p))});
 try{
  for(const [id] of files)for(const [layout,width,height] of [['desktop',1440,1000],['mobile',390,844]]){
   const context=await browser.newContext({viewport:{width,height}}),page=await context.newPage(),errors=[],requests=[];await page.clock.install();
   page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(!r.url().startsWith('http://127.0.0.1:'))requests.push(r.url());});
   const original={MU:1029,SKHY:169.03,SNDK:1581.82},changed={MU:700,SKHY:300,SNDK:300};let data=payload(original),fail=false;
   await page.route('https://raw.githubusercontent.com/ZhipengMeng/mu-value-lab/main/market/quotes.json*',route=>fail?route.abort():route.fulfill({status:200,contentType:'application/json',headers:{'Access-Control-Allow-Origin':'*'},body:JSON.stringify(data)}));
   await page.goto('http://127.0.0.1:'+server.address().port+'/'+id);
   await page.waitForFunction(()=>document.querySelector('#market-quotes').dataset.state==='automatic'&&!document.querySelector('#quote-refresh').disabled).catch(async e=>{throw Error(company+' '+id+' '+layout+' initialization: '+JSON.stringify({errors,status:await page.locator('#market-quotes').innerText()})+' '+e.message);});
   const label=company+' '+id+' '+layout;
   check(await page.locator('#quote-auto').isChecked(),label+' automatic on website load');
   check(await page.locator('#quote-prices').innerText().then(t=>t.includes('Regular session')&&t.includes('Yahoo Finance')),label+' timestamp and source visible');
   check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),label+' quote panel fits viewport');
   if(id==='model'){
    if(company!=='SNDK')await page.locator('summary').filter({hasText:'Edit valuation, cash-conversion'}).click();
    await page.locator('#input-discount').fill('13');await page.locator('#input-discount').dispatchEvent('change');await page.locator('#quote-refresh').focus();
   }
   const before=await capture(page);data=payload(changed);await page.clock.fastForward(300001);
   await page.waitForFunction(()=>document.querySelector('#quote-prices').textContent.includes('$700.00')||document.querySelector('#quote-prices').textContent.includes('$300.00'));
   const after=await capture(page);check(requests.length>=2,label+' automatic five-minute polling refreshes price');
   check(after.model===before.model,label+' model assumptions and reported inputs unchanged');
   for(const key of Object.keys(before.values)){
    check(after.values[key].value===before.values[key].value&&after.values[key].cash===before.values[key].cash,label+' '+key+' DCF and cash flows unchanged');
    const symbol=id==='comparison'?key:company;
    check(Math.abs(after.values[key].up-(after.values[key].value/changed[symbol]-1)*100)<1e-9,label+' '+key+' upside uses refreshed price');
    check(Math.abs(after.values[key].pe/before.values[key].pe-changed[symbol]/original[symbol])<1e-9,label+' '+key+' P/E repriced');
   }
   if(id==='comparison'){
    check((await page.locator('#winner').innerText()).startsWith('SNDK'),label+' new prices reverse ranking');
    check((await page.locator('#basis').innerText()).includes((700/186.21).toFixed(2)),label+' earnings table P/E repriced');
    check(!(await page.locator('#gridSummary').innerText()).includes('SKHY 240'),label+' robustness claim repriced');
   }else check(await page.locator('#input-discount').inputValue()==='13',label+' custom assumption survives price refresh');
   fail=true;await page.locator('#quote-refresh').click();await page.waitForFunction(()=>document.querySelector('#quote-status').textContent.includes('Update failed'));
   check(JSON.stringify((await capture(page)).values)===JSON.stringify(after.values),label+' network failure retains last good prices');
   fail=false;data=payload(original);data.quotes.SKHY.currency='KRW';await page.locator('#quote-refresh').click();await page.waitForFunction(()=>!document.querySelector('#quote-refresh').disabled);
   check(JSON.stringify((await capture(page)).values)===JSON.stringify(after.values),label+' invalid security batch rejected atomically');
   const older=new Date(Date.now()-3600000).toISOString();data=payload(original);data.generatedAt=older;for(const q of Object.values(data.quotes)){q.asOf=older;q.retrievedAt=older;}
   await page.locator('#quote-refresh').click();await page.waitForFunction(()=>!document.querySelector('#quote-refresh').disabled);
   check(JSON.stringify((await capture(page)).values)===JSON.stringify(after.values),label+' older quote batch cannot overwrite latest');

   await page.locator('#quote-auto').uncheck();const frozen=await capture(page);
   check(await page.locator('#market-quotes').getAttribute('data-state')==='snapshot',label+' snapshot mode explicitly labeled');
   check(JSON.stringify(frozen.values)===JSON.stringify(before.values),label+' snapshot restores original price metrics with custom assumptions intact');
   check(requests.every(u=>u.startsWith('https://raw.githubusercontent.com/ZhipengMeng/mu-value-lab/main/market/quotes.json')),label+' only public shared feed requested');
   check(errors.length===0,label+' no script errors');
   await page.locator('#quote-auto').check();await page.waitForFunction(()=>!document.querySelector('#quote-refresh').disabled);await page.evaluate(()=>scrollTo(0,0));
   await page.screenshot({path:path.join(root,'market',id+'-'+layout+'.png')});
   await context.close();
   const fallbackContext=await browser.newContext(),fallback=await fallbackContext.newPage();
   await fallback.route('https://raw.githubusercontent.com/**',route=>route.abort());
   await fallback.goto('http://127.0.0.1:'+server.address().port+'/'+id);
   await fallback.waitForFunction(()=>document.querySelector('#quote-status').textContent.includes('Update failed'));
   check(await fallback.locator('#market-quotes').getAttribute('data-state')==='fallback',label+' first-load outage explicitly falls back to snapshot');
   check((await fallback.locator('#quote-prices').innerText()).includes('Oct 9, 2026'),label+' first-load fallback date visible');
   await fallbackContext.close();

  }
  const report={status:'pass',checks:checks.length,checksPerformed:checks,htmlSha256:Object.fromEntries(files.map(([,p])=>[p,sha(path.join(root,p))])),scope:'Mocked shared feed: price changes, source timestamps, assumptions separation, fallback, invalid batches and snapshot mode at desktop/mobile widths.'};
  fs.writeFileSync(path.join(__dirname,'browser_report.json'),JSON.stringify(report,null,2)+'\n');console.log('PASS automatic quote browser checks:',checks.length);
 }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
