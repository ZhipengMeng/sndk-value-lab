'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {pathToFileURL}=require('node:url'),{chromium}=require('playwright');
const P=__dirname,app=path.join(P,'sndk_valuation_v2_0.html'),checks=[];
const check=(value,label)=>{assert.ok(value,label);checks.push(label);};
const candidates=[process.env.SNDK_BROWSER_EXECUTABLE,chromium.executablePath(),'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome','/usr/bin/chromium','/usr/bin/google-chrome'].filter(Boolean);
const executablePath=candidates.find(p=>fs.existsSync(p));
async function main(){
 const browser=await chromium.launch({headless:true,executablePath});
 try{
  for(const [layout,width,height] of [['desktop',1440,1000],['mobile',390,844]]){
   const context=await browser.newContext({viewport:{width,height},offline:true,acceptDownloads:true}),page=await context.newPage(),errors=[],requests=[];
   page.on('pageerror',e=>errors.push(e.message));
   await context.route(/^https?:/,route=>{requests.push(route.request().url());return route.abort();});
   await page.goto(pathToFileURL(app).href);
   check((await page.title()).includes('2.0'),layout+' version title');
   check((await page.locator('#headlineValue').innerText())==='$1,998',layout+' central displayed');
   check(Math.abs((await page.evaluate(()=>auditResults.central.price))-1998.1509000727237)<1e-7,layout+' central arithmetic');
   check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),layout+' no page overflow');
   check(await page.locator('#drivers tbody tr').count()===8,layout+' eight driver years');
   check(await page.locator('#sources a').count()===6,layout+' six attributed sources');
   const links=await page.locator('a').evaluateAll(a=>a.map(x=>x.getAttribute('href')));
   check(links.every(x=>!x.includes('MU_valuation')&&!x.includes('SKHY_valuation')&&!x.includes('/Users/')),layout+' no private or missing comparison links');
   for(const href of links.filter(x=>x.startsWith('#')))check(await page.locator(href).count()===1,layout+' section exists '+href);
   const fill=async(k,v)=>{await page.locator('#input-'+k).fill(String(v));await page.locator('#input-'+k).dispatchEvent('change');};
   await fill('allowanceScale',0);check((await page.locator('#headlineValue').innerText())==='$2,182',layout+' cash sensitivity');
   await page.locator('#reset').click();await page.locator('#scenario').selectOption('downside');check((await page.locator('#headlineValue').innerText())==='$323',layout+' downside');
   await page.locator('#scenario').selectOption('upside');check((await page.locator('#headlineValue').innerText())==='$4,142',layout+' upside');
   await page.locator('#reset').click();await fill('discount',2);
   check(await page.locator('#error').isVisible(),layout+' invalid return rejected');
   check(await page.locator('#export').isDisabled(),layout+' invalid export blocked');
   check((await page.locator('#annual').innerText())==='',layout+' stale values cleared');
   await page.locator('#reset').click();await fill('sharesMn','');check(await page.locator('#error').isVisible(),layout+' blank input rejected');
   await page.locator('#reset').click();await fill('discount',14);
   const exported=page.waitForEvent('download');await page.locator('#export').click();const download=await exported;
   const output=path.join(P,'verification',layout+'_settings.json');await download.saveAs(output);const session=JSON.parse(fs.readFileSync(output));
   check(session.company==='SNDK'&&session.scenario==='central'&&session.model.assumptions.discount===14,layout+' exported edited assumptions');
   await page.locator('#reset').click();check((await page.locator('#headlineValue').innerText())==='$1,998',layout+' reset');
   await page.screenshot({path:path.join(P,'verification',layout+'.png'),fullPage:false});
   check(errors.length===0,layout+' no script errors');check(requests.length===0,layout+' no automatic network requests');
   await context.close();
  }
  const report={status:'pass',checks:checks.length,appSha256:crypto.createHash('sha256').update(fs.readFileSync(app)).digest('hex'),checksPerformed:checks,scope:'Offline Chromium, desktop and mobile viewports. Software behavior, not forecast accuracy.'};
  fs.writeFileSync(path.join(P,'verification/browser_report.json'),JSON.stringify(report,null,2)+'\n');console.log(`PASS v2.0 browser: ${checks.length} checks`);
 }finally{await browser.close();}
}
main().catch(e=>{console.error(e);process.exit(1);});
