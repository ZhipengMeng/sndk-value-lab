'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const E=require('./sndk_valuation_v1_5.js');
let tests=0;
const test=(name,fn)=>{try{fn();tests++;}catch(e){console.error('FAILED: '+name);throw e;}};
const near=(a,b,tol=1e-8)=>assert.ok(Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<=tol*Math.max(1,Math.abs(b)),`${a} != ${b}`);
const m=()=>E.clone(E.MODEL_DEFAULTS);
test('v1.5 default version and valid schema',()=>{assert.equal(E.VERSION,'1.5');assert.deepEqual(E.checkModel(m()),[])});
test('six scenarios price-led, all annual figures finite',()=>{const r=E.calculateModel(m());assert.deepEqual(r.errors,[]);for(const k of E.SCENARIO_ORDER){for(const y of r.scenarios[k].path){for(const f of ['coreRevenue','coreGM','spotIndex','variableCogs','unidentifiedCogs','fcf','totalRevenue'])assert.ok(Number.isFinite(y[f]),`${k}/${y.year}/${f}`);}}});
test('baseline company values and v1.5 deep decline',()=>{const r=E.calculateModel(m()),s=r.scenarios.severe;near(s.valuation.pvLow,1522.8035483912236,1e-9);near(s.valuation.pvHigh,1602.1021370230792,1e-9);near(s.path.find(z=>z.year===2029).spotIndex,.61,1e-10);near(s.path.find(z=>z.year===2032).spotIndex,.72,1e-10);});
test('historical-economics price stress can reach low price-cost state',()=>{const r=E.calculateModel(m()),h=r.scenarios.historical;assert.equal(h.path.at(-1).spotIndex,.36);assert.ok(h.path.at(-1).coreGM<60);});
test('explicit FY2028-32 price bridge is correctly ordered',()=>{for(const k of E.SCENARIO_ORDER){const s=m().scenarios[k];let path=[];for(let y=2028;y<=2032;y++)path.push(E.spotAt(s,y));let tr=path[s.troughYear-2028];near(tr,s.troughAspIndex);near(path[s.settleYear-2028],s.settledAspIndex);assert.ok(path.every(p=>p>=s.troughAspIndex-1e-8));}});
test('op margin identity and HBF adjusted FCF bridge',()=>{const x=m();x.hbfEnabled=true;const r=E.calculateModel(x);assert.deepEqual(r.errors,[]);for(const k of E.SCENARIO_ORDER){for(const z of r.scenarios[k].path.slice(1)){near(z.totalRevenue,z.coreRevenue+z.hbfRevenue);near(z.grossProfit,z.totalRevenue-z.cogs);near(z.adjustedEbit,z.grossProfit-z.opex);near(z.economicEbit,z.adjustedEbit-z.sbc);near(z.fcf,z.economicNI+z.companyDa-z.directCapex-z.jvNetFunding-z.wcChange-z.otherCashUse-z.guidanceCashUse);}}});
// Explicitly test steady state horizon invariance with internally consistent conversion and fractional FY2027.
test('steady-state fixture PV invariant within 0.1% across FY2029–32',()=>{
 const x=m();x.growthLow=2;x.growthHigh=2;x.scenarios.severe.structuralBitGrowth=2;x.scenarios.severe.structuralAspGrowth=0;
 const a=[];for(let y=2027;y<=2032;y++){const rev=20*Math.pow(1.02,y-2027),economicEbit=rev*.35,economicNI=economicEbit*.85;
  a.push({year:y,totalRevenue:rev,economicEbit,economicNI,fcf:economicNI*(1-.02/.25),coreRevenue:rev,coreGM:60});}
 const values=[];for(let y=2029;y<=2032;y++){x.targetYear=y;values.push(E.valuePath(x,'severe',a).pvLow);}
 const spread=(Math.max(...values)-Math.min(...values))/((Math.max(...values)+Math.min(...values))/2);
 assert.ok(spread<.001,`steady state should be endpoint invariant: ${spread}`);
});
test('cyclical endpoint spread reported (no hidden lookahead)',()=>{const a=E.endpointSensitivity(m(),'severe');assert.equal(a.length,4);assert.ok(a[0].midpoint<a[3].midpoint);assert.ok(a.every((v,i)=>v.targetYear===2029+i));});
test('fade uses structural change, not last-year cyclical observed change',()=>{const x=m(),s=E.calculateModel(x).scenarios.severe.valuation;near(s.structuralStartGrowthPct,10);assert.ok(Math.abs(s.lastRevenueGrowthPct-s.structuralStartGrowthPct)>1);});
test('discount-rate 9/11/13 strong monotonic default',()=>{const v=E.discountSensitivity(m(),'severe');assert.ok(v[0].midpoint>v[1].midpoint&&v[1].midpoint>v[2].midpoint)});
test('inverse post-cycle price recovers reference price',()=>{const x=m(),v=E.reverseSettlement(x,'severe',x.price);assert.ok(v.settledAspIndex>.72&&v.settledAspIndex<.80);near(v.modeledPV,x.price,1e-9);assert.ok(v.impliedTerminalGM<75)});
test('ASP × settled grid yields increasing value and rejects inconsistent cells',()=>{const g=E.priceSettlementGrid(m(),'severe');assert.equal(g.cells.length,4);assert.ok(g.cells[1][0].error);assert.ok(g.cells[0][0].midpoint<g.cells[0][5].midpoint);assert.ok(g.cells[0][5].midpoint<g.cells[1][5].midpoint)});
test('contract floors boost downside value only when binding',()=>{const x=m();x.scenarios.collapse.path.forEach(y=>{y.contractShare=60;y.floorHaircut=0;y.contractCapIndex=0;});let v=[];for(const f of [0,.5,.6,.8]){const z=E.clone(x);z.scenarios.collapse.path.forEach(y=>y.floorIndex=f);v.push(E.valueAt(z,'collapse').midpoint);}assert.ok(v.every((a,i)=>i===0||a>=v[i-1]-1e-7),JSON.stringify(v));});
test('cost premium monotonic under exogenous prices',()=>{for(const k of ['severe','collapse','adjustment','management']){const x=m();const base=E.valueAt(x,k).midpoint;const y=E.clone(x);y.scenarios[k].path.forEach(r=>r.costChange+=8);const cost=E.valueAt(y,k).midpoint;assert.ok(cost<=base+1e-8,`${k}: more cost increased value ${cost} > ${base}`);}});
test('fixed manufacturing cost monotonic under exogenous prices',()=>{const x=m(),v=E.valueAt(x,'severe').midpoint;const y=E.clone(x);y.scenarios.severe.path.forEach(r=>r.fixedCostGrowth+=10);assert.ok(E.valueAt(y,'severe').midpoint<v);});
test('settled ASP monotonic (market price is exogenous)',()=>{for(const k of ['severe','adjustment','collapse']){const x=m(),values=[.65,.7,.8,.9].filter(z=>z>=x.scenarios[k].troughAspIndex).map(z=>E.valueAt(x,k,{settledAspIndex:z}).midpoint);assert.ok(values.every((v,i)=>i===0||v>=values[i-1]));}});
test('lower spot price path does not improve economic value',()=>{const x=m();for(const k of ['severe','adjustment']){const s=x.scenarios[k],lo=E.valueAt(x,k,{troughAspIndex:s.troughAspIndex*.8}).midpoint,hi=E.valueAt(x,k,{troughAspIndex:s.troughAspIndex}).midpoint;assert.ok(lo<hi);}});
test('management calibration is explicit, not hidden',()=>{const x=m(),a=E.valueAt(x,'severe',{calibrationMode:'management'}),b=E.valueAt(x,'severe',{calibrationMode:'unadjusted'});assert.ok(a.costWedgeBn>0);near(b.costWedgeBn,0);assert.ok(b.midpoint>a.midpoint)});
test('fixed-GM mode is diagnostic and unadjusted independent of user cost mode',()=>{const a=E.marginGrid(m(),'severe');const x=m();x.calibrationMode='unadjusted';const b=E.marginGrid(x,'severe');near(a[2].pvLow,b[2].pvLow);assert.ok(a.every(v=>!v.error&&v.pvLow>0));});
test('buybacks are scenario-derived and cash is not double-counted',()=>{const x=m();x.capitalMode='buyback';let r=E.calculateModel(x);assert.equal(r.errors.length,0);const a=r.scenarios.severe.valuation.branchLow;assert.ok(a.ledger.length>0);assert.ok(a.ledger.every(z=>z.priceProxy>0&&z.repurchase>=0));assert.ok(a.sharesEnd<x.shares);});
test('HBF disabled by default; positive impact is not guaranteed',()=>{const x=m();assert.equal(x.hbfEnabled,false);const h=E.hbfContribution(x,'growth');assert.ok(h&&Number.isFinite(h.pvLow));});
test('JSON roundtrip retains all assumptions',()=>{const x=m();const y=E.parseSettings(JSON.stringify(x));assert.deepEqual(x,y)});
test('reject old version, missing / unknown fields and invalid temporal indexes',()=>{const x=m();for(const f of ['consensusEPS','scenarios','discountRate']){const y=E.clone(x);delete y[f];assert.ok(E.checkModel(y).length);}const z=E.clone(x);z.version='1.2';assert.ok(E.checkModel(z).length);const q=E.clone(x);q.scenarios.severe.troughYear=2031;q.scenarios.severe.settleYear=2030;assert.ok(E.checkModel(q).length);const w=E.clone(x);w.fake=1;assert.ok(E.checkModel(w).length);});
test('reject margin-solve mode in price-led scenario',()=>{const x=m();x.scenarios.severe.path[0].pricingMode='solveGM';assert.ok(E.calculateModel(x).errors.some(s=>s.includes('price-led')));});
test('reject invalid and nonfinite settings',()=>{for(const val of [NaN,Infinity,-Infinity,0,-1]){const x=m();x.scenarios.severe.settledAspIndex=val;assert.ok(E.checkModel(x).length);}});
test('standalone HTML contains exact current JS source',()=>{const text=fs.readFileSync(path.join(__dirname,'sndk_valuation_v1_5.html'),'utf8');const js=fs.readFileSync(path.join(__dirname,'sndk_valuation_v1_5.js'),'utf8');assert.ok(text.includes('<script>'+js+'</script>'));assert.ok(!text.includes('<script src='));});
test('deep-trough reverse regression: invalid lower bound still has an interior solution',()=>{
 for(const cashFlowMode of ['guidance','unadjusted'])for(const trough of [.2,.25]){
  const x=m();x.cashFlowMode=cashFlowMode;x.scenarios.severe.troughAspIndex=trough;
  const f=E.valueAt(x,'severe',{noContracts:true,hbfEnabled:false});
  assert.ok(Number.isFinite(f.midpoint),JSON.stringify(f));
  const inverse=E.reverseSettlement(x,'severe',f.midpoint);
  assert.ok(!inverse.error,JSON.stringify(inverse));near(inverse.settledAspIndex,.72,1e-8);near(inverse.modeledPV,f.midpoint,1e-8);
 }
});
test('reverse reports unreachable quotes and invalid settings without a false solution',()=>{
 const x=m();assert.ok(E.reverseSettlement(x,'severe',1).error);
 assert.ok(E.reverseSettlement(x,'severe',1e9).error);
 for(const q of [NaN,Infinity,-10,0])assert.ok(E.reverseSettlement(x,'severe',q).error);
 x.guidanceCashScalePct=NaN;assert.ok(E.reverseSettlement(x,'severe',1000).error);
});
test('reverse solution is funded even when the lower boundary has a funding deficit',()=>{
 const x=m();x.scenarios.severe.troughAspIndex=.25;x.scenarios.severe.path[0].otherCashUseBn=18;
 const target=E.valueAt(x,'severe',{settledAspIndex:1.5,noContracts:true,hbfEnabled:false});
 assert.ok(Number.isFinite(target.midpoint),JSON.stringify(target));
 const inverse=E.reverseSettlement(x,'severe',target.midpoint);
 assert.ok(!inverse.error,JSON.stringify(inverse));near(inverse.settledAspIndex,1.5,1e-8);
});
test('cash guidance reconciles published period averages and separates SBC economics',()=>{
 const rows=E.guidanceReferenceRows();assert.equal(rows.length,3);
 let revenue=0,fcf=0;
 for(const z of rows){
  near(z.coreGM,80);near(z.operatingMargin,75);
  near(z.adjustedFcfProxy/z.referenceRevenue,.5);
  near(z.directCapex+z.netJvFunding+z.capitalAllowance,z.referenceRevenue*.05);
  near(z.rawAdjustedFcfProxy-z.capitalAllowance-z.otherAllowance,z.adjustedFcfProxy);
  near(z.economicFcf,z.adjustedFcfProxy-z.economicSbcCost);
  assert.ok(z.economicSbcCost>0&&z.otherAllowance>0);
  revenue+=z.referenceRevenue;fcf+=z.adjustedFcfProxy;
 }
 near(fcf/revenue,.5);
 const actual=E.calculateModel(m()).scenarios.management.path.filter(z=>z.year>=2028&&z.year<=2030);
 actual.forEach(z=>near(z.adjustedFcfProxy/z.totalRevenue,.5));
 near(E.baseState(m()).fcf,29.1855); // FY2027 remains the original forecast anchor.
});
test('guidance does not turn the downside into a 50 percent FCF floor',()=>{
 const r=E.calculateModel(m());const ref=r.scenarios.management.path.find(z=>z.year===2030),stress=r.scenarios.historical.path.find(z=>z.year===2030);
 assert.ok(stress.adjustedFcfProxy/stress.totalRevenue < ref.adjustedFcfProxy/ref.totalRevenue-.1);
 const x=m();x.cashFlowMode='unadjusted';const off=E.calculateModel(x);
 assert.ok(off.scenarios.severe.valuation.pvLow>r.scenarios.severe.valuation.pvLow);
 near(off.scenarios.severe.path.at(-1).coreGM,r.scenarios.severe.path.at(-1).coreGM);
});
test('cash calibration never cancels user spending, tax or cost stress',()=>{
 const x=m(),base=E.operatingPath(x,'management');
 x.scenarios.management.path[0].directCapexBn+=1;
 x.scenarios.management.path[0].otherCashUseBn+=2;
 const changed=E.operatingPath(x,'management');
 near(changed[1].guidanceCashUse,base[1].guidanceCashUse);
 assert.ok(changed[1].fcf<base[1].fcf-2.9);
 const y=m();y.tax=25;assert.ok(E.valueAt(y,'management').midpoint<E.valueAt(m(),'management').midpoint);
 near(E.operatingPath(y,'management')[1].guidanceCashUse,base[1].guidanceCashUse);
});
test('distribution and buyback modes flag and suppress unfunded valuations',()=>{
 for(const capitalMode of ['distribution','buyback']){
  const x=m();x.capitalMode=capitalMode;x.buybackFraction=0;x.scenarios.severe.path[0].otherCashUseBn=50;
  const r=E.calculateModel(x);assert.deepEqual(r.errors,[]);const v=r.scenarios.severe.valuation;
  let cash=x.excessNetCashBn,min=0;
  for(const z of v.branchLow.flows){cash+=z.fcf*z.portion;min=Math.min(min,cash);}
  near(v.fundingShortfall,-min);assert.ok(v.fundingShortfall>4);assert.equal(v.firstShortfallYear,2028);
  assert.equal(v.pvLow,null);assert.equal(v.pvHigh,null);
  assert.equal(E.valueAt(x,'severe').errorCode,'FUNDING_SHORTFALL');
  x.excessNetCashBn=-min+.1;assert.ok(Number.isFinite(E.valueAt(x,'severe').midpoint));
 }
});
test('negative terminal earnings do not hide an earlier funding gap',()=>{
 for(const capitalMode of ['distribution','buyback']){
  const x=m();x.capitalMode=capitalMode;
  Object.assign(x.scenarios.severe,{troughAspIndex:.03,settledAspIndex:.03});
  x.scenarios.severe.path.forEach(z=>{z.contractShare=0;z.otherCashUseBn=100;});
  const v=E.calculateModel(x).scenarios.severe.valuation;
  assert.equal(v.branchLow.tv,null);assert.ok(v.fundingShortfall>0);assert.equal(v.pvLow,null);
 }
});
test('funding ledger tolerates rounding only and starts from available opening cash',()=>{
 assert.equal(E.fundingLedger([{year:2027,fcf:-1e-12,portion:1}],0).fundingShortfall,0);
 near(E.fundingLedger([{year:2027,fcf:-2,portion:.5},{year:2028,fcf:-3,portion:1}],.5).fundingShortfall,3.5);
});
test('v1.3 imports cannot silently acquire the new cash assumptions',()=>{
 const x=m();x.version='1.3';assert.throws(()=>E.parseSettings(JSON.stringify(x)),/v1.5/);
 const y=m();delete y.cashFlowMode;assert.ok(E.checkModel(y).some(z=>z.includes('cashFlowMode')));
 const z=m();delete z.guidanceCashScalePct;assert.ok(E.checkModel(z).some(z=>z.includes('guidanceCashScalePct')));
});
test('guidance preset reproduces all three independently specified valuation ranges',()=>{
 const {model,selectedScenario}=E.createPreset('guidance');
 assert.equal(selectedScenario,'management');assert.equal(model.targetYear,2030);assert.equal(model.discountRate,12);
 const expected=[[3013.0255065910123,3195.9471428835614],[2682.868034197595,2817.077454714779],[2412.491765416343,2512.7250932052807]];
 const v=E.workingValuation(model,selectedScenario);
 v.rates.forEach((r,i)=>{near(r.pvLow,expected[i][0],1e-10);near(r.pvHigh,expected[i][1],1e-10);assert.equal(r.fundingShortfall,0);});
 near(v.low,expected[2][0]);near(v.high,expected[0][1]);near(v.midpoint,2749.972744456187);
 assert.equal(Math.round(v.low/100)*100,2400);assert.equal(Math.round(v.high/100)*100,3200);
 const result=E.calculateModel(model).scenarios.management.valuation;
 assert.equal(result.terminalYearLow,2034);assert.equal(result.windowEnd,2030);
});
test('guidance preset ignores operating inputs beyond FY2030 and preserves the reference budget',()=>{
 const a=E.createPreset(),b=E.createPreset();
 for(const row of b.model.scenarios.management.path.filter(r=>r.year>2030)){row.bitGrowth=1;row.otherCashUseBn=50;}
 const x=E.workingValuation(a.model,a.selectedScenario),y=E.workingValuation(b.model,b.selectedScenario);
 near(x.low,y.low);near(x.high,y.high);
 assert.equal(E.matchingPreset(a.model,a.selectedScenario),'guidance');
 b.model.discountRate=13;assert.equal(E.matchingPreset(b.model,b.selectedScenario),'custom');
 assert.equal(E.MODEL_DEFAULTS.targetYear,2032);assert.equal(E.MODEL_DEFAULTS.discountRate,11);
});
test('session roundtrip preserves the selected scenario and valuation inputs',()=>{
 const s=E.createPreset();const restored=E.parseSession(E.serializeSession(s.model,s.selectedScenario));
 assert.deepEqual(restored.model,s.model);assert.equal(restored.selectedScenario,'management');
 const legacy=E.createPreset('legacy');assert.equal(E.matchingPreset(legacy.model,legacy.selectedScenario),'legacy');
 assert.equal(E.parseSession(JSON.stringify(legacy.model)).selectedScenario,'severe');
 const bad={...s,selectedScenario:'unknown'};assert.throws(()=>E.parseSession(JSON.stringify(bad)));
 const extra={...s,unrecognized:true};assert.throws(()=>E.parseSession(JSON.stringify(extra)));
 const old={...s,version:'1.4'};assert.throws(()=>E.parseSession(JSON.stringify(old)));
 const next=E.createPreset();next.model.revenue=30;assert.equal(E.createPreset().model.revenue,49.14);
});
test('working range responds to edits and does not hide unfunded branches',()=>{
 const {model,selectedScenario}=E.createPreset();const base=E.workingValuation(model,selectedScenario);
 model.tax=25;assert.ok(E.workingValuation(model,selectedScenario).low<base.low);
 model.scenarios.management.path[0].otherCashUseBn=100;
 const bad=E.workingValuation(model,selectedScenario);assert.equal(bad.low,null);assert.equal(bad.high,null);
});
const info={engineAssertionsPassed:tests,date:'2026-10-10',testedAt:new Date().toISOString(),snapshot:'2026-10-09',version:E.VERSION,defaultDeepDecline:E.valueAt(m(),'severe'),reverse:E.reverseSettlement(m(),'severe',m().price)};
fs.writeFileSync(path.join(__dirname,'test_engine_report.json'),JSON.stringify(info,null,2)+'\n');
console.log('PASS '+tests+' named engine test groups; '+E.SCENARIO_ORDER.length+' scenarios; steady-state error tolerance 0.1%.');
