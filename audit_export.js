'use strict';
const E=require('./sndk_valuation_v1_5.js');
const cases=[];
function add(key,m,label='grid'){
 const operating=E.operatingPath(m,key),valuation=E.valuePath(m,key,operating);
 const fields=['asOf','excessNetCashBn','shares','terminalRoi','tax','fadeYears','growthLow','growthHigh',
  'revenue','cashFlowMode','guidanceCashScalePct','capitalMode','buybackFraction','buybackAuthorizationBn','buybackPriceFactor'];
 cases.push({label,key,rate:m.discountRate,calibration:m.calibrationMode,targetYear:m.targetYear,hbfEnabled:m.hbfEnabled,
  model:{...Object.fromEntries(fields.map(k=>[k,m[k]])),scenario:m.scenarios[key]},operating,valuation});
}
for(const key of E.SCENARIO_ORDER){
 for(const rate of [9,11,13])for(const calibration of ['management','unadjusted'])
 for(const targetYear of [2029,2030,2031,2032])for(const hbfEnabled of [false,true])for(const cashFlowMode of ['guidance','unadjusted']){
  const m=E.clone(E.MODEL_DEFAULTS);Object.assign(m,{discountRate:rate,calibrationMode:calibration,targetYear,hbfEnabled,cashFlowMode});add(key,m);
 }
}
for(const capitalMode of ['distribution','buyback'])for(const cashFlowMode of ['guidance','unadjusted']){
 const m=E.clone(E.MODEL_DEFAULTS);Object.assign(m,{capitalMode,cashFlowMode});
 m.scenarios.severe.path[0].otherCashUseBn=50;add('severe',m,'funding stress');
}
for(const capitalMode of ['distribution','buyback']){
 const m=E.clone(E.MODEL_DEFAULTS);m.capitalMode=capitalMode;
 Object.assign(m.scenarios.severe,{troughAspIndex:.03,settledAspIndex:.03});
 m.scenarios.severe.path.forEach(z=>{z.contractShare=0;z.otherCashUseBn=100;});add('severe',m,'negative terminal and funding');
}
for(const key of ['severe','growth']){
 const m=E.clone(E.MODEL_DEFAULTS);m.capitalMode='buyback';add(key,m,'funded buybacks');
}
for(const rate of [11,12,13]){
 const session=E.createPreset('guidance');session.model.discountRate=rate;
 add(session.selectedScenario,session.model,'guidance working preset');
}
process.stdout.write(JSON.stringify({referenceModel:E.MODEL_DEFAULTS,cases}));
