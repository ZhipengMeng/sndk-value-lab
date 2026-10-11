'use strict';
const fs=require('node:fs');
const path=require('node:path');
const E=require('./sndk_valuation_v1_5.js');
const m=E.clone(E.MODEL_DEFAULTS),r=E.calculateModel(m);
if(r.errors.length)throw Error(r.errors.join('; '));
const scenarios={};
for(const k of E.SCENARIO_ORDER){
 const s=r.scenarios[k],v=s.valuation;
 scenarios[k]={name:m.scenarios[k].name,pvLow:v.pvLow,pvHigh:v.pvHigh,
   terminalGM:s.path.at(-1).coreGM,troughIndex:m.scenarios[k].troughAspIndex,
   settledIndex:m.scenarios[k].settledAspIndex,fundingShortfall:v.fundingShortfall,
   annualCashBridge:s.path.map(z=>({year:z.year,revenue:z.totalRevenue,
     rawEconomicFcf:z.rawEconomicFcf,capitalAllowance:z.guidanceCapitalUse,
     otherAllowance:z.guidanceOtherUse,adjustedFcfProxy:z.adjustedFcfProxy,
     economicSbcCost:z.economicSbcCost,economicFcf:z.fcf}))};
}
const out={version:E.VERSION,asOf:m.asOf,scenarios,
 discountSensitivity:E.discountSensitivity(m,'severe'),endpointSensitivity:E.endpointSensitivity(m,'severe'),
 reverseAtReference:E.reverseSettlement(m,'severe',m.price),cashGuidanceReference:E.guidanceReferenceRows()};
const write=(name,obj)=>fs.writeFileSync(path.join(__dirname,name),JSON.stringify(obj,null,2)+'\n');
write('legacy_settings.json',m);write('legacy_results.json',out);
const preset=E.createPreset('guidance');
write('guidance_preset.json',preset);
write('guidance_results.json',{version:E.VERSION,asOf:preset.model.asOf,selectedScenario:preset.selectedScenario,
 targetYear:preset.model.targetYear,fadeYears:preset.model.fadeYears,
 ...E.workingValuation(preset.model,preset.selectedScenario)});
console.log('Generated v1.5 settings and numerical results');
