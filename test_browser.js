'use strict';
// Test the actual standalone file in a real browser. No Python Playwright required.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const {chromium}=require('playwright');
const E=require('./sndk_valuation_v1_5.js');
const ROOT=__dirname;
let checks=0;
const check=(ok,msg)=>{assert.ok(ok,msg);checks++;};
const candidates=[chromium.executablePath(),
 '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
 '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
 '/usr/bin/chromium','/usr/bin/chromium-browser','/usr/bin/google-chrome',
 process.env.PROGRAMFILES&&path.join(process.env.PROGRAMFILES,'Google/Chrome/Application/chrome.exe')].filter(Boolean);
const executablePath=process.env.SNDK_BROWSER_EXECUTABLE||candidates.find(p=>fs.existsSync(p));
if(!executablePath)throw Error('Install a Playwright Chromium browser, or set SNDK_BROWSER_EXECUTABLE to an installed Chrome/Chromium executable.');
async function main(){
 const browser=await chromium.launch({executablePath,headless:true});
 const layouts={};
 try{
  for(const [label,width,height] of [['desktop',1440,1000],['mobile',390,844]]){
   const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:1,acceptDownloads:true});
   const page=await context.newPage(),errors=[],requests=[];
   page.on('pageerror',e=>errors.push(e.message));
   await context.route(/^https?:/,route=>{requests.push(route.request().url());return route.abort();});
   const text=id=>page.locator('#'+id).innerText();
   const d=()=>page.locator('details[data-scenario="severe"]');
   const fill=async(locator,value)=>{await locator.fill(String(value));await locator.dispatchEvent('change');};
   const reset=async()=>{await page.locator('#reset').click();await page.locator('#valuationPreset').selectOption('legacy');};
   await page.goto(pathToFileURL(path.join(ROOT,'sndk_valuation_v1_5.html')).href,{waitUntil:'load'});
   check((await page.title()).includes('v1.5'),label+': title');
   check(await text('heroPV')==='$2,683 – $2,817',label+': guidance default at 12 percent');
   check(await text('workingPV')==='$2,400 – $3,200',label+': rounded guidance range');
   check((await text('workingExact')).includes('$2,412 – $3,196'),label+': exact guidance envelope');
   check((await text('workingMid')).includes('$2,750'),label+': guidance midpoint');
   check(await page.locator('#selected').inputValue()==='management',label+': guidance scenario');
   check(await page.locator('#targetYear').inputValue()==='2030',label+': guidance horizon');
   check(await page.locator('#workingRates tbody tr').count()===3,label+': guidance rate rows');
   check(!(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)),label+': guidance no page overflow');
   const presetDownloadPromise=page.waitForEvent('download');await page.locator('#downloadJson').click();
   const presetDownload=await presetDownloadPromise;const presetPath=path.join(ROOT,label+'_guidance_export.json');
   await presetDownload.saveAs(presetPath);const savedPreset=JSON.parse(fs.readFileSync(presetPath,'utf8'));
   check(savedPreset.selectedScenario==='management'&&savedPreset.model.discountRate===12,label+': guidance session export');
   await page.locator('#valuationPreset').selectOption('legacy');
   await page.locator('#importSettings').setInputFiles({name:'guidance.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(savedPreset))});
   await page.waitForFunction(()=>document.getElementById('selected').value==='management');
   check(await text('workingPV')==='$2,400 – $3,200',label+': real guidance import reproduces range');
   await fill(page.getByRole('spinbutton',{name:'Illustrative tax rate (%)',exact:true}),25);
   check(await page.locator('#valuationPreset').inputValue()==='custom',label+': edits label custom assumptions');
   check(await text('workingPV')!=='$2,400 – $3,200',label+': working range recalculates');
   await page.locator('#reset').click();
   check(await page.locator('#valuationPreset').inputValue()==='guidance',label+': reset restores guidance preset');
   await page.evaluate(()=>{document.documentElement.style.scrollBehavior='auto';document.getElementById('overview').scrollIntoView();});
   await page.screenshot({path:path.join(ROOT,label+'_guidance_overview.png'),animations:'disabled'});
   await page.locator('#valuationPreset').selectOption('legacy');
   check(await text('heroPV')==='$1,523 – $1,602',label+': v1.4 equivalent value');
   for(const [id,count] of [['summaryTable',6],['priceGrid',4],['rateTable',3],['horizonTable',4],['costCompare',2],['reconciliationTable',6],['guidanceReferenceTable',3]]){
    check(await page.locator('#'+id+' tbody tr').count()===count,label+': '+id);
   }
   check((await text('reverseReport')).includes('0.727'),label+': default reverse');
   check((await text('fundingReport')).includes('No annual funding shortfall'),label+': default funded');
   check(!(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)),label+': no page overflow');
   check(errors.length===0,label+': initial page errors');
   await page.screenshot({path:path.join(ROOT,label+'_preview.png'),fullPage:true,animations:'disabled'});
   await page.screenshot({path:path.join(ROOT,label+'_overview.png'),animations:'disabled'});
   if(label==='desktop')await page.locator('#reconciliationTable').screenshot({path:path.join(ROOT,'cash_reconciliation_preview.png'),animations:'disabled'});
   await page.locator('#selected').selectOption('historical');
   check((await text('heroPV'))!=='N/M',label+': downside is calculated');
   await page.locator('#selected').selectOption('severe');
   const base=await text('heroPV');
   await page.locator('#calibrationMode').selectOption('unadjusted');
   check((await text('heroPV'))!==base,label+': cost toggle');
   await page.locator('#calibrationMode').selectOption('management');
   check(await text('heroPV')===base,label+': restore cost mode');
   await page.locator('#cashFlowMode').selectOption('unadjusted');
   check((await text('heroPV'))!==base,label+': cash mode affects value');
   check((await text('cashGuidanceNote')).includes('OFF'),label+': cash mode disclosure');
   await page.locator('#cashFlowMode').selectOption('guidance');
   check(await text('heroPV')===base,label+': restore cash mode');
   await page.locator('#selected').selectOption('management');
   const reconciliation=await page.locator('#reconciliationTable tbody tr').allTextContents();
   check(reconciliation.slice(1,4).every(s=>s.includes('50.00%')),label+': management cash guidance matched');
   await page.locator('#selected').selectOption('severe');
   await page.locator('#targetYear').selectOption('2029');
   check((await text('reverseReport')).includes('FY2032'),label+': earlier horizon blocks reverse');
   await page.locator('#targetYear').selectOption('2032');
   await fill(d().getByRole('spinbutton',{name:'Trough spot ASP (FY27=1)',exact:true}),.5);
   check((await text('heroPV'))!==base,label+': editable trough');
   await fill(d().getByRole('spinbutton',{name:'Long-run settled ASP (FY27=1)',exact:true}),.64);
   check((await text('heroASPSub')).includes('0.64'),label+': editable settlement');
   check(!(await page.locator('#errors').isVisible()),label+': valid edits');
   await reset();check(await text('heroPV')===base,label+': reset');
   const downloadPromise=page.waitForEvent('download');await page.locator('#downloadJson').click();
   const download=await downloadPromise;
   check(download.suggestedFilename()==='sndk_v1_5_settings.json',label+': export name');
   const settingsPath=path.join(ROOT,label+'_export_settings.json');await download.saveAs(settingsPath);
   const session=JSON.parse(fs.readFileSync(settingsPath,'utf8'));const settings=session.model;
   check(session.selectedScenario==='severe',label+': legacy export retains scenario');
   check(settings.version==='1.5'&&settings.cashFlowMode==='guidance',label+': cash assumptions exported');
   const old={...settings,version:'1.3'};
   const err=await page.evaluate(s=>{try{window.SNDKUI.importText(s);return '';}catch(e){return e.message;}},JSON.stringify(old));
   check(err.includes('v1.5'),label+': reject old settings');
   check(await text('heroPV')===base,label+': preserve settings after rejected import');
   await page.locator('#importSettings').setInputFiles({name:'restored.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(settings))});
   await page.waitForFunction(()=>document.getElementById('status').textContent.includes('Validated and imported'));
   check((await text('status')).includes('v1.5'),label+': real file import');
   await page.locator('#hbfEnabled').check();
   check((await text('hbfImpact')).includes('contribution'),label+': HBF comparison');
   check(errors.length===0,label+': HBF no errors');await reset();
   await fill(d().getByRole('spinbutton',{name:'Long-run settled ASP (FY27=1)',exact:true}),.2);
   check(await page.locator('#errors').isVisible(),label+': invalid input alert');
   check(await page.locator('#downloadJson').isDisabled(),label+': invalid export blocked');
   check(await text('heroPV')==='Invalid model',label+': invalid headline');
   check(await text('workingPV')==='—'&&await page.locator('#workingRates tbody tr').count()===0,label+': stale working range cleared');
   check(await page.locator('#summaryTable tbody tr').count()===0,label+': stale scenario results cleared');
   check(await page.locator('#reconciliationTable tbody tr').count()===0,label+': stale cash results cleared');
   check(await text('heroGap')==='—'&&await text('safetyReport')==='—',label+': stale return and safety values cleared');
   await reset();check(!(await page.locator('#errors').isVisible()),label+': valid recovery');
   await d().getByRole('combobox',{name:'severe price schedule'}).selectOption('annual');
   check((await text('reverseReport')).includes('Select trough / settle'),label+': manual inverse blocked');
   check((await text('priceGrid')).includes('—'),label+': manual grid blocked');await reset();
   // The review's low-trough bug must be fixed in the rendered UI too.
   await fill(d().getByRole('spinbutton',{name:'Trough spot ASP (FY27=1)',exact:true}),.25);
   const low=E.clone(settings);low.scenarios.severe.troughAspIndex=.25;
   const forward=E.valueAt(low,'severe',{noContracts:true,hbfEnabled:false});
   await fill(page.locator('#quote'),forward.midpoint);
   check((await text('reverseReport')).includes('0.720'),label+': low-trough reverse regression');await reset();
   // Unfunded annual cash needs are visible in BOTH capital modes.
   for(const mode of ['distribution','buyback']){
    await page.locator('#capitalMode').selectOption(mode);
    await d().locator('summary').filter({hasText:'Cash investments and working capital'}).click();
    await fill(d().getByRole('spinbutton',{name:'severe FY2028 Other uses $B',exact:true}),50);
    check(await text('heroPV')==='N/M',label+': unfunded '+mode+' valuation suppressed');
    check((await text('fundingReport')).includes('Unfunded cash shortfall')&&(await text('fundingReport')).includes('FY2028'),label+': '+mode+' funding warning');
    await reset();
   }
   const csvPromise=page.waitForEvent('download');await page.locator('#downloadCsv').click();
   const csvDownload=await csvPromise;const csvPath=path.join(ROOT,label+'_export_results.csv');await csvDownload.saveAs(csvPath);
   const csv=fs.readFileSync(csvPath,'utf8');
   check(csv.includes('guidance_capital_use_bn')&&csv.includes('funding_shortfall_bn'),label+': cash/funding CSV fields');
   check(csv.trim().split(/\r?\n/).length===37,label+': six scenarios exported');
   check(errors.length===0,label+': final page errors');check(requests.length===0,label+': no external network requests');
   layouts[label]={viewport:[width,height],pageErrors:errors,externalRequests:requests,screenshot:label+'_preview.png'};
   await context.close();
  }
  const report={version:'1.5',testedAt:new Date().toISOString(),browser:await browser.version(),executable:path.basename(executablePath),
   appSha256:require('node:crypto').createHash('sha256').update(fs.readFileSync(path.join(ROOT,'sndk_valuation_v1_5.html'))).digest('hex'),
   method:'Direct file:// navigation of complete standalone HTML',checksPassed:checks,testedLayouts:layouts};
  fs.writeFileSync(path.join(ROOT,'test_browser_report.json'),JSON.stringify(report,null,2)+'\n');
  console.log(`PASS ${checks} desktop/mobile browser checks; direct local-file opening; no external requests`);
 }finally{await browser.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
