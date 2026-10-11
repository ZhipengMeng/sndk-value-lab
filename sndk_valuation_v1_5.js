'use strict';
/*
 * SNDK Value Lab v1.5 — audit-driven, offline scenario engine.
 * USD billions; shares in millions; ASP and bit indexes relative to FY2027 = 1.
 * No live data calls. Scenario parameters are assumptions, not forecasts.
 * Adjusted EBIT is bridged to economic earnings using a cash-equivalent SBC charge.
 * Company D&A is separate; JV depreciation in wafer purchase costs is NOT added back.
 */
const VERSION = '1.5';
const SCENARIO_ORDER = ['adjustment', 'severe', 'management', 'collapse', 'historical', 'growth'];
const clone = value => JSON.parse(JSON.stringify(value));
const sum = values => values.reduce((a,b)=>a+b,0);
const average = values => sum(values)/values.length;
const YEAR_MS = 365.25*86400000;
const yearEnd = year => Date.UTC(year,5,30); // Explicit fiscal-year-end approximation.
const parseDate = s => Date.parse(s+'T00:00:00Z');
function freezeDeep(o){Object.freeze(o);Object.values(o).forEach(v=>{if(v&&typeof v==='object'&&!Object.isFrozen(v))freezeDeep(v);});return o;}
// Scenario percentages and absolute contract prices are hypothetical, NOT disclosed NBM terms.

// Hypothetical price settlements.  FY2027=1; never a historical price forecast.
// Geometric bridges ensure trough and settlement are separately stressable.
const PRICE_PRESETS=freezeDeep({
 adjustment:{spotSchedule:'troughSettle',troughYear:2029,troughAspIndex:0.69,settleYear:2031,settledAspIndex:0.79,structuralBitGrowth:12,structuralAspGrowth:0},
 severe:{spotSchedule:'troughSettle',troughYear:2029,troughAspIndex:0.61,settleYear:2032,settledAspIndex:0.72,structuralBitGrowth:10,structuralAspGrowth:0},
 management:{spotSchedule:'troughSettle',troughYear:2028,troughAspIndex:1.00,settleYear:2030,settledAspIndex:1.00,structuralBitGrowth:16,structuralAspGrowth:0},
 collapse:{spotSchedule:'troughSettle',troughYear:2029,troughAspIndex:0.35,settleYear:2032,settledAspIndex:0.54,structuralBitGrowth:10,structuralAspGrowth:0},
 historical:{spotSchedule:'troughSettle',troughYear:2029,troughAspIndex:0.30,settleYear:2032,settledAspIndex:0.36,structuralBitGrowth:8,structuralAspGrowth:-1},
 growth:{spotSchedule:'troughSettle',troughYear:2029,troughAspIndex:0.96,settleYear:2032,settledAspIndex:1.02,structuralBitGrowth:15,structuralAspGrowth:0}
});
function spotAt(s,year){
 if(s.spotSchedule!=='troughSettle')throw Error('Price schedule is manual; use annual spotChange');
 const a=s.troughAspIndex,b=s.settledAspIndex;
 if(year<=s.troughYear)return a**((year-2027)/(s.troughYear-2027));
 if(year<s.settleYear)return a*(b/a)**((year-s.troughYear)/(s.settleYear-s.troughYear));
 return b;
}

function makePath(key){
  const spec={
    adjustment:{bits:[12,12,12,12,12],spot:[-17,-17,8,5,0],cost:-7.5,coverage:[66.67,50,40,30,30],floor:0.80,haircut:5},
    severe:{bits:[8,8,10,10,10],spot:[-22,-22,8,6,3],cost:-5,coverage:[66.67,45,30,25,25],floor:0.70,haircut:25},
    management:{bits:[16,16,16,16,16],spot:[0,0,0,0,0],cost:-7.5,coverage:[66.67,55,50,45,40],floor:0.75,haircut:10},
    collapse:{bits:[8,8,10,12,12],spot:[-50,-30,15,20,12],cost:-5,coverage:[66.67,45,30,25,20],floor:0.60,haircut:0},
    historical:{bits:[8,8,10,10,10],spot:[0,0,0,0,0],cost:-5,coverage:[0,0,0,0,0],floor:0,haircut:100},
    growth:{bits:[17,17,15,15,15],spot:[-2,-2,0,2,0],cost:-10,coverage:[66.67,60,55,50,50],floor:0.90,haircut:0}
  }[key];
  return [2028,2029,2030,2031,2032].map((year,i)=>({
    year,bitGrowth:spec.bits[i],spotChange:spec.spot[i],costChange:spec.cost,
    fixedCostGrowth:8,opexGrowth:6,contractShare:spec.coverage[i],floorIndex:spec.floor,
    floorHaircut:spec.haircut,contractCapIndex:0,contractFixedIndex:1,contractFloatPct:100,
    pricingMode:'spot',targetGM:[50,30,40,50,55][i],
    directCapexBn:[0.30,0.35,0.40,0.42,0.45][i],jvNetFundingBn:[1.0,1.2,1.3,1.4,1.5][i],
    nwcPct:10,otherCashUseBn:0,sbcBn:[0.30,0.33,0.36,0.40,0.44][i],
    hbfRevenueBn:key==='growth'?[0.3,4,7,10,12][i]:key==='adjustment'?[0.1,0.8,1.6,2.4,3.2][i]:0,
    hbfCashCogsBn:key==='growth'?[0.18,1.8,2.9,4,4.8][i]:key==='adjustment'?[0.06,0.44,0.8,1.12,1.44][i]:0,
    hbfOpexBn:key==='growth'?[0.15,0.3,0.45,0.6,0.75][i]:key==='adjustment'?[0.1,0.15,0.2,0.25,0.3][i]:0,
    hbfCapexBn:key==='growth'?[0.5,0.8,1,1.2,1.2][i]:key==='adjustment'?[0.2,0.35,0.4,0.4,0.4][i]:0,
    hbfDisplacementPct:20
  }));
}
const MODEL_DEFAULTS=freezeDeep({
  version:VERSION,asOf:'2026-10-09',price:1581.82,baseYear:2027,targetYear:2032,
  normalizationYears:3,fadeYears:4,revenue:49.14,baseGM:84.64,baseOperatingIncomeBn:39.11,
  consensusEPS:214.82,shares:155,tax:15,discountRate:11,growthLow:1.5,growthHigh:2.5,
  terminalRoi:25,excessNetCashBn:0,capitalMode:'distribution',buybackFraction:50,
  buybackAuthorizationBn:15.5,buybackPriceFactor:1,hbfEnabled:false,spotScale:1,
  calibrationMode:'management',managementTargetGM:80,managementTargetOpexPct:5,
  cashFlowMode:'guidance',guidanceCashScalePct:100,
  referenceBitGrowth:16,referenceCostDown:-7.5,opexVariablePct:50,
  baseDaBn:0.18,baseFixedCogsPct:25,assetLife:5,legacyDaDecayPct:15,
  baseDirectCapexBn:0.25,baseJvNetFundingBn:0.75,baseWcChangeBn:3.0,
  baseNwcPct:10,baseSbcBn:0.28,baseOtherCashUseBn:0,
  scenarios:{
    adjustment:{name:'Price-led adjustment',...PRICE_PRESETS.adjustment,path:makePath('adjustment')},
    severe:{name:'Deeper decline / recovery',...PRICE_PRESETS.severe,path:makePath('severe')},
    management:{name:'Management reference / flat ASP',...PRICE_PRESETS.management,path:makePath('management')},
    collapse:{name:'Deep collapse: floor sensitivity',...PRICE_PRESETS.collapse,path:makePath('collapse')},
    historical:{name:'Historical-economics price stress',...PRICE_PRESETS.historical,path:makePath('historical')},
    growth:{name:'Sustained growth (illustrative)',...PRICE_PRESETS.growth,path:makePath('growth')}
  }
});
// Explicit required-field schemas: missing properties cannot silently become NaN.
const TOP_NUM={
  price:[0.01,1e6],baseYear:[2027,2027],targetYear:[2029,2032],normalizationYears:[1,3],fadeYears:[1,8],
  revenue:[0.001,1e4],baseGM:[0,99.99],baseOperatingIncomeBn:[-1e4,1e4],consensusEPS:[-1e6,1e6],shares:[0.001,1e6],
  tax:[0,99],discountRate:[0.5,50],growthLow:[-5,15],growthHigh:[-5,15],terminalRoi:[0.5,100],
  excessNetCashBn:[0,1e4],buybackFraction:[0,100],buybackAuthorizationBn:[0,1e4],buybackPriceFactor:[0.25,4],
  spotScale:[0.01,5],managementTargetGM:[0,99],managementTargetOpexPct:[0,50],referenceBitGrowth:[-20,100],
  referenceCostDown:[-40,30],opexVariablePct:[0,100],baseDaBn:[0,1e4],baseFixedCogsPct:[0,100],
  assetLife:[2,20],legacyDaDecayPct:[0,100],baseDirectCapexBn:[0,1e4],baseJvNetFundingBn:[0,1e4],
  guidanceCashScalePct:[0,300],
  baseWcChangeBn:[-1e4,1e4],baseNwcPct:[0,100],baseSbcBn:[0,1e4],baseOtherCashUseBn:[-1e4,1e4]
};
const ROW_NUM={year:[2028,2032],bitGrowth:[-90,200],spotChange:[-90,300],costChange:[-90,200],
  fixedCostGrowth:[-90,200],opexGrowth:[-90,200],contractShare:[0,100],floorIndex:[0,10],
  floorHaircut:[0,100],contractCapIndex:[0,10],contractFixedIndex:[0.001,10],contractFloatPct:[0,100],
  targetGM:[-200,99],directCapexBn:[0,1e4],jvNetFundingBn:[0,1e4],nwcPct:[0,100],
  otherCashUseBn:[-1e4,1e4],sbcBn:[0,1e4],hbfRevenueBn:[0,1e4],hbfCashCogsBn:[0,1e4],
  hbfOpexBn:[0,1e4],hbfCapexBn:[0,1e4],hbfDisplacementPct:[0,100]
};
function isPlain(x){return x!==null&&typeof x==='object'&&!Array.isArray(x)&&(Object.getPrototypeOf(x)===Object.prototype||Object.getPrototypeOf(x)===null);}
function checkModel(m){
  const errors=[];
  function keys(o,expected,path){if(!isPlain(o)){errors.push(path+': expected an object');return false;}
    for(const k of expected)if(!Object.hasOwn(o,k))errors.push(path+'.'+k+': missing required field');
    for(const k of Object.keys(o))if(!expected.includes(k))errors.push(path+'.'+k+': unknown field');return true;}
  function numbers(o,schema,path){for(const [k,[lo,hi]] of Object.entries(schema)){
    const v=o[k];if(typeof v!=='number'||!Number.isFinite(v)||v<lo||v>hi)errors.push(`${path}.${k}: finite number required in [${lo}, ${hi}]`);}}
  if(!keys(m,[...Object.keys(TOP_NUM),'version','asOf','capitalMode','hbfEnabled','calibrationMode','cashFlowMode','scenarios'],'model'))return errors;
  numbers(m,TOP_NUM,'model');
  if(m.version!==VERSION)errors.push('model.version: v1.5 required; earlier settings require a reviewed cash-assumption migration');
  if(typeof m.asOf!=='string'||!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(m.asOf)||!Number.isFinite(parseDate(m.asOf))||new Date(parseDate(m.asOf)).toISOString().slice(0,10)!==m.asOf)errors.push('model.asOf: valid YYYY-MM-DD required');
  else if(parseDate(m.asOf)<yearEnd(2026)||parseDate(m.asOf)>=yearEnd(2027))errors.push('model.asOf: must fall within the FY2027 anchor period');
  if(!['distribution','buyback'].includes(m.capitalMode))errors.push('model.capitalMode: distribution or buyback required');
  if(!['management','unadjusted'].includes(m.calibrationMode))errors.push('model.calibrationMode: management or unadjusted required');
  if(!['guidance','unadjusted'].includes(m.cashFlowMode))errors.push('model.cashFlowMode: guidance or unadjusted required');
  if(typeof m.hbfEnabled!=='boolean')errors.push('model.hbfEnabled: boolean required');
  for(const k of ['baseYear','targetYear','normalizationYears','fadeYears','assetLife'])if(!Number.isInteger(m[k]))errors.push('model.'+k+': integer required');
  if(m.growthLow>m.growthHigh)errors.push('Terminal low-growth bound exceeds high-growth bound');
  if(m.discountRate<=m.growthHigh)errors.push('Discount rate must exceed terminal growth');
  if(m.terminalRoi<=Math.max(m.growthHigh,0))errors.push('Terminal incremental ROIC must exceed positive terminal growth');
  if(m.normalizationYears>m.targetYear-2027+1)errors.push('Normalization window is longer than forecast history');
  const baseCogs=m.revenue*(1-m.baseGM/100),baseGP=m.revenue*m.baseGM/100;
  if(m.baseDaBn>baseCogs)errors.push('Company D&A exceeds base COGS');
  if(m.baseOperatingIncomeBn>baseGP)errors.push('Base EBIT exceeds gross profit');
  if(!keys(m.scenarios,SCENARIO_ORDER,'model.scenarios'))return errors;
  for(const k of SCENARIO_ORDER){const s=m.scenarios[k],p='scenarios.'+k;
    if(!keys(s,['name','path','spotSchedule','troughYear','troughAspIndex','settleYear','settledAspIndex','structuralBitGrowth','structuralAspGrowth'],p))continue;
    for(const [f,lo,hi] of [['troughYear',2028,2031],['settleYear',2029,2032],['troughAspIndex',0.03,3],['settledAspIndex',0.03,3],['structuralBitGrowth',-20,40],['structuralAspGrowth',-20,20]]){
      const v=s[f];if(typeof v!=='number'||!Number.isFinite(v)||v<lo||v>hi)errors.push(`${p}.${f}: finite number in [${lo},${hi}] required`);
    }
    if(!Number.isInteger(s.troughYear)||!Number.isInteger(s.settleYear)||s.settleYear<=s.troughYear)errors.push(p+': trough and settlement years must be ordered integers');
    if(s.spotSchedule!=='troughSettle'&&s.spotSchedule!=='annual')errors.push(p+'.spotSchedule must be troughSettle or annual');
    if(s.spotSchedule==='troughSettle'&&s.settledAspIndex<s.troughAspIndex)errors.push(p+': settled ASP must be >= trough ASP');
    if(typeof s.name!=='string'||s.name.length<1||s.name.length>120)errors.push(p+'.name: nonempty text up to 120 chars');
    if(!Array.isArray(s.path)||s.path.length!==5){errors.push(p+'.path: exactly 5 rows FY2028–32');continue;}
    s.path.forEach((r,i)=>{const rp=p+'.path['+i+']';if(!keys(r,[...Object.keys(ROW_NUM),'pricingMode'],rp))return;
      numbers(r,ROW_NUM,rp);if(r.year!==2028+i)errors.push(rp+'.year: order must be FY2028–32');
      if(r.pricingMode!=='spot'&&r.pricingMode!=='solveGM')errors.push(rp+'.pricingMode invalid');
      if(r.pricingMode==='solveGM')errors.push(rp+': use the separate GM diagnostic, not price-led scenario valuation');
      const effectiveFloor=r.floorIndex*(1-r.floorHaircut/100);
      if(r.contractCapIndex>0&&r.contractCapIndex+1e-10<effectiveFloor)errors.push(rp+'.contractCapIndex below effective floor');
    });
  }
  return errors;
}
function afterTax(profit,tax){return profit-Math.max(profit,0)*tax/100;} // No immediate tax credit on losses.
function baseState(m){
  const cogs=m.revenue*(1-m.baseGM/100),opex=m.revenue*m.baseGM/100-m.baseOperatingIncomeBn;
  const economicEbit=m.baseOperatingIncomeBn-m.baseSbcBn,ni=afterTax(economicEbit,m.tax);
  const fcf=ni+m.baseDaBn-m.baseDirectCapexBn-m.baseJvNetFundingBn-m.baseWcChangeBn-m.baseOtherCashUseBn;
  return {year:2027,bitIndex:1,netBitIndex:1,spotIndex:1,blendedAsp:1,contractPrice:1,
    contractShare:50,contractFloorEffective:0,floorBound:false,capBound:false,unidentifiedCogs:0,coreRevenueBefore:m.revenue,displacedRevenue:0,coreRevenue:m.revenue,hbfRevenue:0,totalRevenue:m.revenue,
    variableCogs:(cogs-m.baseDaBn)*(1-m.baseFixedCogsPct/100),fixedCogs:(cogs-m.baseDaBn)*m.baseFixedCogsPct/100,
    companyDa:m.baseDaBn,hbfDa:0,cogs,grossProfit:m.revenue-cogs,coreGM:m.baseGM,totalGM:m.baseGM,opex,
    adjustedEbit:m.baseOperatingIncomeBn,economicEbit,opMargin:m.baseOperatingIncomeBn/m.revenue*100,
    economicNI:ni,eps:ni*1000/m.shares,sbc:m.baseSbcBn,fcf,rawEconomicFcf:fcf,
    adjustedFcfProxy:fcf+afterTax(m.baseOperatingIncomeBn,m.tax)-ni,
    economicSbcCost:afterTax(m.baseOperatingIncomeBn,m.tax)-ni,
    guidanceCashUse:0,guidanceCapitalUse:0,guidanceOtherUse:0,
    directCapex:m.baseDirectCapexBn,jvNetFunding:m.baseJvNetFundingBn,
    wcChange:m.baseWcChangeBn,nwc:m.revenue*m.baseNwcPct/100,otherCashUse:m.baseOtherCashUseBn,buybackPrice:m.baseBuybackPrice,
    priceSolved:false};
}
function depreciation(year,cohorts,life){return sum(cohorts.filter(c=>year>=c.year&&year<c.year+life).map(c=>c.amount/life*(year===c.year?0.5:1)))+sum(cohorts.filter(c=>year===c.year+life).map(c=>c.amount/life*0.5));}
// Reference-market cost wedge: 80% GM / 75% OM in each FY2028–30 reference year.
// The company gives PERIOD AVERAGES; constant annual margins are our allocation.
// FY2031–32 continuation is an assumption beyond guidance. Reference conditions:
// 16% annual bit growth, FLAT ASP, and the specified reference cost curve.
// The wedge is an unidentified future cost/mix/JV burden, NOT a fact about cost per bit.
function calibrationWedge(m,year,b){
  if(m.calibrationMode==='unadjusted'||year===2027)return {cogs:0,opex:0,refGM:null};
  const n=year-2027,refBits=(1+m.referenceBitGrowth/100)**n,refRev=m.revenue*refBits;
  const refVariable=b.variableCogs*refBits*(1+m.referenceCostDown/100)**n;
  const refFixed=b.fixedCogs*1.08**n;
  const dummyCapex=[.30,.35,.40,.42,.45].slice(0,n).map((amount,i)=>({year:2028+i,amount}));
  const da=m.baseDaBn*(1-m.legacyDaDecayPct/100)**n+depreciation(year,dummyCapex,m.assetLife);
  const gmTarget=m.managementTargetGM;
  const missingCogs=Math.max(0,refRev*(1-gmTarget/100)-(refVariable+refFixed+da));
  const refOpex=m.revenue*m.baseGM/100-m.baseOperatingIncomeBn;
  const rawOpex=refOpex*(1-m.opexVariablePct/100)*1.06**n+refOpex*(m.opexVariablePct/100)*refBits;
  const targetOpexPct=m.managementTargetOpexPct;
  const missingOpex=Math.max(0,refRev*targetOpexPct/100-rawOpex);
  return {cogs:missingCogs/refBits,opex:missingOpex,refGM:gmTarget};
}
function operatingPath(m,key){
  const out=[baseState(m)],s=m.scenarios[key],b=out[0],cohorts=[],hbfCohorts=[];
  let bits=1,costIndex=1,fixed=b.fixedCogs,spot=1,nwc=b.nwc,opexFixed=b.opex*(1-m.opexVariablePct/100);
  for(const r of s.path){
    bits*=1+r.bitGrowth/100;costIndex*=1+r.costChange/100;fixed*=1+r.fixedCostGrowth/100;
    opexFixed*=1+r.opexGrowth/100;
    cohorts.push({year:r.year,amount:r.directCapexBn});
    const coreDa=m.baseDaBn*Math.pow(1-m.legacyDaDecayPct/100,r.year-2027)+depreciation(r.year,cohorts,m.assetLife);
    const hRev=m.hbfEnabled?r.hbfRevenueBn:0,hCogs=m.hbfEnabled?r.hbfCashCogsBn:0,
      hOpex=m.hbfEnabled?r.hbfOpexBn:0,hCapex=m.hbfEnabled?r.hbfCapexBn:0;
    hbfCohorts.push({year:r.year,amount:hCapex});const hDa=depreciation(r.year,hbfCohorts,m.assetLife);
    const displacement=hRev*r.hbfDisplacementPct/100;
    const c=r.contractShare/100,floor=r.floorIndex*(1-r.floorHaircut/100),wedge=calibrationWedge(m,r.year,b);
    function atPrice(p){
      const floatPrice=(1-r.contractFloatPct/100)*r.contractFixedIndex+(r.contractFloatPct/100)*p;
      const contractPrice=Math.min(Math.max(floatPrice,floor),r.contractCapIndex>0?r.contractCapIndex:Infinity);
      const blended=(1-c)*p+c*contractPrice,before=m.revenue*bits*blended,coreRevenue=before-displacement;
      if(!(coreRevenue>0))return null;
      const netBits=coreRevenue/(m.revenue*blended);
      const variable=b.variableCogs*netBits*costIndex,extraCogs=wedge.cogs*netBits;
      const coreCogs=variable+fixed+coreDa+extraCogs,coreGM=(coreRevenue-coreCogs)/coreRevenue*100;
      return {contractPrice,blended,before,coreRevenue,netBits,variable,extraCogs,coreCogs,coreGM};
    }
    if(r.pricingMode==='spot')spot=s.spotSchedule==='troughSettle'?spotAt(s,r.year):spot*(1+r.spotChange/100);
    else{
      // The global spot-shock changes only price-led scenarios; target-GM diagnostics solve price endogenously.
      let lo=1e-8,hi=100;const a=atPrice(lo),z=atPrice(hi);
      if(a&&a.coreGM>r.targetGM+1e-7)throw Error(`${s.name} FY${r.year}: contract floor prevents target gross margin`);
      if(!z||z.coreGM<r.targetGM)throw Error(`${s.name}: target gross margin outside solvable ASP range`);
      for(let i=0;i<100;i++){const mid=(lo+hi)/2,v=atPrice(mid);if(!v||v.coreGM<r.targetGM)lo=mid;else hi=mid;}spot=(lo+hi)/2;
    }
    const actualSpot=spot*(r.pricingMode==='spot'?m.spotScale:1),v=atPrice(actualSpot);
    if(!v)throw Error(`${s.name} FY${r.year}: core revenue nonpositive after HBF displacement`);
    const revenue=v.coreRevenue+hRev,cogs=v.coreCogs+hCogs+hDa,gp=revenue-cogs;
    const coreOpex=opexFixed+b.opex*m.opexVariablePct/100*revenue/m.revenue+wedge.opex;
    const adjustedEbit=gp-coreOpex-hOpex,economicEbit=adjustedEbit-r.sbcBn,ni=afterTax(economicEbit,m.tax);
    const nextNwc=revenue*r.nwcPct/100,wcChange=nextNwc-nwc;nwc=nextNwc;
    const da=coreDa+hDa,rawEconomicFcf=ni+da-r.directCapexBn-hCapex-r.jvNetFundingBn-wcChange-r.otherCashUseBn;
    const allowance=cashGuidanceAllowance(m,r.year,v.netBits);
    const economicSbcCost=afterTax(adjustedEbit,m.tax)-ni;
    const fcf=rawEconomicFcf-allowance.total;
    out.push({year:r.year,bitIndex:bits,netBitIndex:v.netBits,spotIndex:actualSpot,blendedAsp:v.blended,
      contractPrice:v.contractPrice,contractShare:r.contractShare,contractFloorEffective:floor,
      floorBound:floor>0&&v.contractPrice<=floor+1e-8,
      capBound:r.contractCapIndex>0&&v.contractPrice>=r.contractCapIndex-1e-8,
      coreRevenueBefore:v.before,displacedRevenue:displacement,coreRevenue:v.coreRevenue,
      hbfRevenue:hRev,totalRevenue:revenue,variableCogs:v.variable,unidentifiedCogs:v.extraCogs,
      fixedCogs:fixed,companyDa:da,hbfDa:hDa,cogs,grossProfit:gp,coreGM:v.coreGM,totalGM:gp/revenue*100,
      opex:coreOpex+hOpex,adjustedEbit,economicEbit,opMargin:adjustedEbit/revenue*100,
      economicNI:ni,eps:ni*1000/m.shares,sbc:r.sbcBn,fcf,rawEconomicFcf,economicSbcCost,
      adjustedFcfProxy:fcf+economicSbcCost,guidanceCashUse:allowance.total,
      guidanceCapitalUse:allowance.capital,guidanceOtherUse:allowance.other,
      directCapex:r.directCapexBn+hCapex,
      jvNetFunding:r.jvNetFundingBn,wcChange,nwc,otherCashUse:r.otherCashUseBn,
      priceSolved:r.pricingMode==='solveGM'});
  }
  return out;
}
// Sources: Sandisk Investor Day CFO deck, PDF page 13 (FY2028–30 AVERAGES),
// and FY2026 Q4 release's adjusted-FCF definition. This is a proxy bridge,
// not a reported cash-flow reconciliation. No NBM deposits enter our forecast.
const CASH_GUIDANCE=freezeDeep({startYear:2028,endYear:2030,adjustedFcfMarginPct:50,
  capitalProxyPct:5,capitalProxyStatus:'Analyst midpoint of mid-single-digit capital intensity; cash-basis interpretation is unverified'});
let referenceCashCache;
function guidanceReferenceRows(){
  if(!referenceCashCache){
    const ref=clone(MODEL_DEFAULTS);ref.cashFlowMode='unadjusted';ref.hbfEnabled=false;
    referenceCashCache=freezeDeep(operatingPath(ref,'management').filter(z=>z.year>=2028&&z.year<=2030).map(z=>{
      const target=z.totalRevenue*CASH_GUIDANCE.adjustedFcfMarginPct/100;
      const total=Math.max(0,z.adjustedFcfProxy-target);
      const capital=Math.min(total,Math.max(0,z.totalRevenue*CASH_GUIDANCE.capitalProxyPct/100-z.directCapex-z.jvNetFunding));
      return {year:z.year,referenceRevenue:z.totalRevenue,referenceBits:z.netBitIndex,
        coreGM:z.coreGM,operatingMargin:z.opMargin,rawAdjustedFcfProxy:z.adjustedFcfProxy,
        directCapex:z.directCapex,netJvFunding:z.jvNetFunding,wcChange:z.wcChange,
        capitalAllowance:capital,otherAllowance:total-capital,totalAllowance:total,
        adjustedFcfProxy:z.adjustedFcfProxy-total,economicFcf:z.fcf-total,economicSbcCost:z.economicSbcCost};
    }));
  }
  return referenceCashCache;
}
function cashGuidanceAllowance(m,year,netBits){
  if(m.cashFlowMode==='unadjusted'||year<2028)return {capital:0,other:0,total:0};
  const ref=guidanceReferenceRows().find(z=>z.year===Math.min(year,2030));
  // Freeze the reference budget. Changing a scenario's tax, capex or costs must
  // not recalibrate them away. Scale by physical core volume, never by ASP.
  // Hold FY2030 dollars per bit through FY2032; that extension is NOT guidance.
  const factor=netBits/ref.referenceBits*m.revenue/MODEL_DEFAULTS.revenue*m.guidanceCashScalePct/100;
  return {capital:ref.capitalAllowance*factor,other:ref.otherAllowance*factor,total:ref.totalAllowance*factor};
}
const FUNDING_TOLERANCE=1e-9; // USD billions; suppress floating-point residue only.
function fundingLedger(flows,openingCash){
  let cash=openingCash,shortfall=0,firstShortfallYear=null;
  const ledger=flows.map(row=>{
    cash+=row.fcf*row.portion;
    if(cash < -FUNDING_TOLERANCE){shortfall=Math.max(shortfall,-cash);firstShortfallYear??=row.year;}
    return {year:row.year,endCash:cash};
  });
  return {fundingShortfall:shortfall,firstShortfallYear,fundingLedger:ledger};
}
// Terminal assumption: sustainable growth g funded with incremental investment g/ROIC.
// Normalization window ends at the SELECTED valuation date, eliminating fixed-window lookahead.
// Beyond explicit NAND projections, the fade is a transparent normalized-earnings bridge,
// not a claim to forecast detailed future ASP or wafer costs.
function valuePath(m,key,path){
  const asOf=parseDate(m.asOf),explicit=path.filter(r=>r.year<=m.targetYear),T=m.targetYear;
  const normalized=explicit.slice(-m.normalizationYears),windowStart=normalized[0].year;
  const normalEbitMargin=sum(normalized.map(r=>r.economicEbit))/sum(normalized.map(r=>r.totalRevenue));
  const normalGM=sum(normalized.map(r=>r.coreRevenue*r.coreGM/100))/sum(normalized.map(r=>r.coreRevenue))*100;
  const normalNI=average(normalized.map(r=>r.economicNI));
  const terminalExplicit=explicit.at(-1),prior=explicit.at(-2);
  const s=m.scenarios[key];
  const lastRevenueGrowth=terminalExplicit.totalRevenue/prior.totalRevenue-1; // diagnostic only
  const secularStartGrowth=(1+s.structuralBitGrowth/100)*(1+s.structuralAspGrowth/100)-1;
  // Structural fade start is explicit per scenario; it does not extrapolate trough/rebound year.
  const fadeStartGrowth=secularStartGrowth;
  const lastEbitMargin=terminalExplicit.economicEbit/terminalExplicit.totalRevenue;
  const yearFraction=year=>(yearEnd(year)-asOf)/YEAR_MS;
  const discount=(year,rate=m.discountRate/100)=>(1+rate)**yearFraction(year);
  const initialExplicit=explicit.map(r=>({year:r.year,fcf:r.fcf,ni:r.economicNI,
    portion:r.year===2027?(yearEnd(2027)-asOf)/(yearEnd(2027)-yearEnd(2026)):1,
    source:'operating model',revenue:r.totalRevenue,gm:r.coreGM,opMargin:r.opMargin}));
  function branch(gPct){
    const g=gPct/100,r=m.discountRate/100,roi=m.terminalRoi/100;
    let rev=terminalExplicit.totalRevenue,margin=lastEbitMargin;
    const fade=[];
    for(let k=1;k<=m.fadeYears;k++){
      const weight=k/m.fadeYears;
      const growth=g+(fadeStartGrowth-g)*(1-weight);
      rev*=1+growth;margin=lastEbitMargin+(normalEbitMargin-lastEbitMargin)*weight;
      const econEbit=rev*margin,ni=afterTax(econEbit,m.tax);
      const reinvestRate=growth/roi,fcf=ni*(1-reinvestRate);
      fade.push({year:T+k,fcf,ni,revenue:rev,operatingMargin:margin*100,
        growth:growth*100,reinvestmentRate:reinvestRate*100,source:'fade / assumed return on new capital',portion:1});
    }
    const finish=fade.at(-1),reinvestment=g/roi;
    const terminalNI=finish.ni;
    const sustainableFcf=terminalNI*(1+g)*(1-reinvestment);
    const tv=terminalNI>0?sustainableFcf/(r-g):null;
    const flows=[...initialExplicit,...fade];
    const pvFcf=sum(flows.map(row=>row.fcf*row.portion/discount(row.year)));
    const totalPV=tv===null?null:m.excessNetCashBn+pvFcf+tv/discount(finish.year);
    const funding=fundingLedger(flows,m.excessNetCashBn);
    return {growthPct:gPct,fade,sustainableFcf,terminalYear:finish.year,tv,pvFcf,totalPV,
      price:totalPV===null||funding.fundingShortfall>FUNDING_TOLERANCE?null:totalPV*1000/m.shares,
      ...funding,
      impliedTerminalPe:terminalNI>0?tv/terminalNI:null,flows};
  }
  const lo=branch(m.growthLow),hi=branch(m.growthHigh);
  // Repurchase ledger spends previously-generated FCF only, no external debt; purchases at
  // distribution-mode scenario-derived per-year intrinsic values, NOT a fixed $1,750.
  function buybackBranch(br){
    if(br.tv===null)return {...br,price:null,ledger:[],sharesEnd:m.shares};
    let cash=m.excessNetCashBn,shares=m.shares,auth=m.buybackAuthorizationBn,shortfall=0,totalBuyback=0,firstShortfallYear=null;
    const ledger=[];
    for(let i=0;i<br.flows.length;i++){
      const f=br.flows[i],fcf=f.fcf*f.portion,beginCash=cash;
      cash+=fcf;if(cash < -FUNDING_TOLERANCE){shortfall=Math.max(shortfall,-cash);firstShortfallYear??=f.year;}
      // Present value of remaining business and terminal franchise at THIS fiscal year end:
      // future FCF are discounted back to fiscal year of purchase, excluding cash already generated.
      const remainingCashflows=sum(br.flows.slice(i+1).map(z=>z.fcf*z.portion/(1+m.discountRate/100)**(yearFraction(z.year)-yearFraction(f.year))));
      const businessPV=remainingCashflows+br.tv/(1+m.discountRate/100)**(yearFraction(br.terminalYear)-yearFraction(f.year));
      const proxy=Math.max(1,(businessPV+Math.max(0,cash))*1000/shares*m.buybackPriceFactor);
      // Buybacks after an immediate liquidity shortfall are disallowed.
      const buyback=shortfall>0?0:Math.max(0,Math.min(Math.max(cash,0)*m.buybackFraction/100,auth,shares*proxy/1000*0.90));
      const removed=buyback*1000/proxy;shares-=removed;cash-=buyback;auth-=buyback;totalBuyback+=buyback;
      ledger.push({year:f.year,fcf,priceProxy:proxy,repurchase:buyback,sharesRepurchased:removed,endShares:shares,endCash:cash,remainingAuthorization:auth,openCash:beginCash});
    }
    const terminalEquity=br.tv+cash;
    const value=shortfall>0?null:terminalEquity*1000/shares/discount(br.terminalYear);
    return {...br,price:value,ledger,fundingShortfall:shortfall,firstShortfallYear,
      fundingLedger:ledger.map(z=>({year:z.year,endCash:z.endCash})),sharesEnd:shares,totalBuyback,
      cashEnd:cash,terminalEquity};
  }
  const low=m.capitalMode==='buyback'?buybackBranch(lo):lo;
  const high=m.capitalMode==='buyback'?buybackBranch(hi):hi;
  const normalEPS=normalNI*1000/m.shares;
  return {windowStart,windowEnd:T,normalNI,normalGM,lastRevenueGrowth,lastRevenueGrowthPct:lastRevenueGrowth*100,structuralStartGrowthPct:fadeStartGrowth*100,normalEbitMargin:normalEbitMargin*100,
    normalEPS,terminalYearLow:low.terminalYear,terminalYearHigh:high.terminalYear,
    pvLow:low.price,pvHigh:high.price,branchLow:low,branchHigh:high,
    valueVsPriceLow:low.price===null?null:(low.price/m.price-1)*100,
    valueVsPriceHigh:high.price===null?null:(high.price/m.price-1)*100,
    fundingShortfall:Math.max(low.fundingShortfall||0,high.fundingShortfall||0),
    firstShortfallYear:[low.firstShortfallYear,high.firstShortfallYear].filter(y=>y!==null).sort((a,b)=>a-b)[0]??null,
    sharesEnd:(low.sharesEnd||m.shares),
    impliedPeLow:low.impliedTerminalPe,impliedPeHigh:high.impliedTerminalPe};
}
function calculateModel(m){
  const errors=checkModel(m);if(errors.length)return {errors,scenarios:null};
  const scenarios={};
  try{
    for(const key of SCENARIO_ORDER){const path=operatingPath(m,key),valuation=valuePath(m,key,path);scenarios[key]={path,valuation};}
    function verify(o){if(typeof o==='number'&&!Number.isFinite(o))throw Error('Computed nonfinite value; revise extreme inputs');
      if(o&&typeof o==='object')Object.values(o).forEach(verify);}verify(scenarios);
  }catch(e){return {errors:[e.message],scenarios:null};}
  return {errors:[],scenarios};
}
function hbfContribution(m,key){const a=clone(m),b=clone(m);a.hbfEnabled=true;b.hbfEnabled=false;
  const aa=calculateModel(a),bb=calculateModel(b);if(aa.errors.length||bb.errors.length)return null;
  const va=aa.scenarios[key].valuation,vb=bb.scenarios[key].valuation;
  return {pvLow:va.pvLow===null||vb.pvLow===null?null:va.pvLow-vb.pvLow,
    pvHigh:va.pvHigh===null||vb.pvHigh===null?null:va.pvHigh-vb.pvHigh};}
function contractSensitivity(m,key){
  const out=[];
  // Common-spot path, same coverage, other cash economics unchanged.
  for(const effectiveFloor of [0,0.60,0.80]){
    const x=clone(m);
    for(const row of x.scenarios[key].path){row.floorIndex=effectiveFloor;row.floorHaircut=0;
      if(row.contractCapIndex>0&&row.contractCapIndex<effectiveFloor)row.contractCapIndex=0;}
    const v=calculateModel(x);out.push({floor:effectiveFloor,pvLow:v.errors.length?null:v.scenarios[key].valuation.pvLow,
      pvHigh:v.errors.length?null:v.scenarios[key].valuation.pvHigh,error:v.errors.join('; ')});
  }
  return out;
}
// Invert the spot-ASP scale to determine the value-justifying gross margin and trough ASP.
// Uses only price-led scenarios; the solver is conditional algebra, not probability estimation.
function reverseSolve(m,key,quote){
  if(!(typeof quote==='number'&&Number.isFinite(quote)&&quote>0))return {error:'Positive finite target price required'};
  if(!m.scenarios[key].path.every(row=>row.pricingMode==='spot'))return {error:'Choose a price-led scenario, not solveGM'};
  if(m.capitalMode!=='distribution')return {error:'Use distribution-equivalent mode for the reverse solver'};
  const priceAt=scale=>{const x=clone(m);x.spotScale=scale;
    try {const path=operatingPath(x,key),v=valuePath(x,key,path);
      return {value:v.pvLow!==null&&v.pvHigh!==null?(v.pvLow+v.pvHigh)/2:null,path,valuation:v};
    } catch(e) {return {value:null,error:e.message};}
  };
  const solved=solveFundedPrice(scale=>{const z=priceAt(scale);return {...z,midpoint:z.value};},.01,5,quote);
  if(solved.error)return solved;
  const scale=solved.input,x=priceAt(scale),path=x.path.filter(row=>row.year>=2028&&row.year<=m.targetYear);
  const coreGM=sum(path.map(row=>row.coreGM*row.coreRevenue))/sum(path.map(row=>row.coreRevenue));
  const troughSpot=Math.min(...path.map(row=>row.spotIndex));
  return {scale,troughSpot,weightedGM:coreGM,terminalGM:path.at(-1).coreGM,
    pvMidpoint:x.value,contractFloorActivated:path.some(row=>row.floorBound),year:m.targetYear};
}
function marginGrid(m,key,targets=[60,65,70,75,80]){
  const output=[];
  for(const target of targets){const x=clone(m);x.spotScale=1;x.hbfEnabled=false;x.capitalMode='distribution';
    x.calibrationMode='unadjusted';x.scenarios[key].spotSchedule='annual';
    for(const row of x.scenarios[key].path){row.contractShare=0;row.floorIndex=0;row.contractCapIndex=0;row.floorHaircut=0;
      row.pricingMode='solveGM';row.targetGM=row.year===2028?(x.baseGM+target)/2:target;}
    let ans;try {const p=operatingPath(x,key),v=valuePath(x,key,p);ans={errors:[],scenarios:{[key]:{path:p,valuation:v}}};}
    catch(e){ans={errors:[e.message]};}
    if(ans.errors.length){output.push({target,error:ans.errors.join('; ')});continue;}
    const p=ans.scenarios[key].path,v=ans.scenarios[key].valuation;
    output.push({target,pvLow:v.pvLow,pvHigh:v.pvHigh,
      troughSpot:Math.min(...p.filter(r=>r.year>=2028&&r.year<=x.targetYear).map(r=>r.spotIndex)),
      terminalSpot:p.find(r=>r.year===x.targetYear).spotIndex,
      costChangeAssumptions:x.scenarios[key].path.map(z=>z.costChange)});
  }
  return output;
}

// Decision-facing valuation works exclusively from EXOGENOUS NAND prices, with GM as an output.
function valueAt(m,key,overrides={}){
 const x=clone(m);
 if(x.scenarios[key].spotSchedule==='annual'&&(overrides.troughAspIndex!==undefined||overrides.settledAspIndex!==undefined))
   return {error:'Equilibrium grid requires troughSettle price schedule',pvLow:null,pvHigh:null,midpoint:null};
 if(overrides.discountRate!==undefined)x.discountRate=overrides.discountRate;
 if(overrides.targetYear!==undefined)x.targetYear=overrides.targetYear;
 if(overrides.calibrationMode!==undefined)x.calibrationMode=overrides.calibrationMode;
 if(overrides.hbfEnabled===false)x.hbfEnabled=false;
 if(overrides.noContracts===true){for(const row of x.scenarios[key].path){
   row.contractShare=0;row.floorIndex=0;row.floorHaircut=0;row.contractCapIndex=0;
 }}
 if(overrides.troughAspIndex!==undefined)x.scenarios[key].troughAspIndex=overrides.troughAspIndex;
 if(overrides.settledAspIndex!==undefined)x.scenarios[key].settledAspIndex=overrides.settledAspIndex;
 const errors=checkModel(x);
 if(errors.length)return {error:errors.join('; '),errorCode:'INVALID_INPUT',pvLow:null,pvHigh:null,midpoint:null};
 try {const path=operatingPath(x,key),v=valuePath(x,key,path);
   const terminal=path.find(z=>z.year===x.targetYear);
   const errorCode=v.fundingShortfall>FUNDING_TOLERANCE?'FUNDING_SHORTFALL':v.pvLow===null||v.pvHigh===null?'TERMINAL_EARNINGS':null;
   const error=errorCode==='FUNDING_SHORTFALL'?`Unfunded cash shortfall $${v.fundingShortfall.toFixed(2)}B beginning FY${v.firstShortfallYear}; financing terms are not modeled`:
     errorCode==='TERMINAL_EARNINGS'?'Non-positive terminal earnings':undefined;
   return {error,errorCode,fundingShortfall:v.fundingShortfall,firstShortfallYear:v.firstShortfallYear,
     pvLow:v.pvLow,pvHigh:v.pvHigh,midpoint:v.pvLow===null||v.pvHigh===null?null:(v.pvLow+v.pvHigh)/2,
     coreGM:terminal.coreGM,troughSpot:Math.min(...path.filter(z=>z.year>=2028&&z.year<=x.targetYear).map(z=>z.spotIndex)),
     settledSpot:x.scenarios[key].settledAspIndex,costWedgeBn:terminal.unidentifiedCogs};
 }catch(e){return {error:e.message,errorCode:'MODEL_ERROR',pvLow:null,pvHigh:null,midpoint:null};}
}
function discountSensitivity(m,key,rates=[9,11,13]){
 return rates.map(discountRate=>({discountRate,...valueAt(m,key,{discountRate})}));
}
function endpointSensitivity(m,key){
 return [2029,2030,2031,2032].map(targetYear=>({targetYear,...valueAt(m,key,{targetYear})}));
}
function priceSettlementGrid(m,key,troughs=[.30,.45,.60,.75],settlements=[.40,.50,.60,.70,.80,.90]){
 return {troughs,settlements,cells:troughs.map(trough=>settlements.map(settled=>
    settled<trough?{pvLow:null,pvHigh:null,midpoint:null,error:'Settlement below trough'}:
    valueAt(m,key,{troughAspIndex:trough,settledAspIndex:settled,noContracts:true,hbfEnabled:false}))) };
}
// Find a funded bracket, including boundaries between invalid terminal/funding
// states and valid values. An invalid extreme does not invalidate the interior.
function solveFundedPrice(evaluate,low,high,quote){
 const valid=z=>Number.isFinite(z.value.midpoint)&&!z.value.error;
 const point=input=>({input,value:evaluate(input)});
 const close=z=>valid(z)&&Math.abs(z.value.midpoint-quote)<=1e-9*Math.max(1,quote);
 const points=Array.from({length:65},(_,i)=>point(low+(high-low)*i/64));
 const brackets=[];
 for(let i=0;i<points.length-1;i++){
   let a=points[i],b=points[i+1];
   if(close(a))return a;if(close(b))return b;
   if(!valid(a)&&!valid(b))continue;
   if(valid(a)!==valid(b)){
     let left=a,right=b;const leftValid=valid(left);
     for(let j=0;j<55;j++){
       const mid=point((left.input+right.input)/2);
       if(valid(mid)===leftValid)left=mid;else right=mid;
     }
     if(leftValid)b=left;else a=right;
   }
   if(close(a))return a;if(close(b))return b;
   if(valid(a)&&valid(b)&&(a.value.midpoint-quote)*(b.value.midpoint-quote)<0)brackets.push([a,b]);
 }
 if(brackets.length!==1)return {error:brackets.length?'Multiple valuation solutions; inspect the price path':
   'No funded, positive-terminal-earnings solution for this quote within the tested ASP range'};
 let [a,b]=brackets[0];
 for(let i=0;i<60;i++){
   const mid=point((a.input+b.input)/2);
   if(!valid(mid))return {error:'Funding or terminal-value discontinuity inside the price bracket'};
   if(close(mid))return mid;
   if((a.value.midpoint-quote)*(mid.value.midpoint-quote)<0)b=mid;else a=mid;
 }
 const answer=point((a.input+b.input)/2);
 return close(answer)?answer:{error:'No price solution within the required residual tolerance'};
}
// Change post-cycle settlement only; trough depth, bit shipments and modeled costs are fixed.
function reverseSettlement(m,key,quote){
 if(!Number.isFinite(quote)||quote<=0)return {error:'Positive finite reference quote required'};
 if(m.capitalMode!=='distribution')return {error:'Reverse equilibrium price requires distribution mode'};
 const s=m.scenarios[key];
 if(s.spotSchedule!=='troughSettle')return {error:'Select trough / settle price schedule'};
 if(m.targetYear<s.settleYear)return {error:`Select an explicit forecast reaching FY${s.settleYear} settlement to solve equilibrium price`};
 const errors=checkModel(m);if(errors.length)return {error:errors.join('; ')};
 const calc=settled=>valueAt(m,key,{settledAspIndex:settled,noContracts:true,hbfEnabled:false});
 const solved=solveFundedPrice(calc,s.troughAspIndex,3,quote);
 if(solved.error)return solved;
 const settle=solved.input,v=solved.value;
 return {settledAspIndex:settle,impliedTerminalGM:v.coreGM,impliedPriceCost:v.coreGM<100?1/(1-v.coreGM/100):null,
   modeledPV:v.midpoint,troughAspIndex:s.troughAspIndex};
}

// Presets change assumptions, never the valuation equations or fixed guidance budget.
// MODEL_DEFAULTS retains v1.4 economics for regression comparisons.
function createPreset(name='guidance'){
  if(!['guidance','legacy'].includes(name))throw Error('Unknown valuation preset');
  const model=clone(MODEL_DEFAULTS);
  if(name==='guidance'){model.targetYear=2030;model.discountRate=12;}
  return {format:'sndk-value-lab-session',version:VERSION,
    selectedScenario:name==='guidance'?'management':'severe',model};
}
function matchingPreset(model,selectedScenario){
  for(const name of ['guidance','legacy']){
    const preset=createPreset(name);
    if(selectedScenario===preset.selectedScenario&&JSON.stringify(model)===JSON.stringify(preset.model))return name;
  }
  return 'custom';
}
function workingValuation(model,key){
  const rates=[11,12,13].map(discountRate=>({discountRate,...valueAt(model,key,{discountRate})}));
  const valid=rates.every(r=>Number.isFinite(r.pvLow)&&Number.isFinite(r.pvHigh));
  return {rates,low:valid?Math.min(...rates.map(r=>r.pvLow)):null,
    high:valid?Math.max(...rates.map(r=>r.pvHigh)):null,midpoint:rates[1].midpoint};
}
function serializeSession(model,selectedScenario){
  if(!SCENARIO_ORDER.includes(selectedScenario))throw Error('Unknown selected scenario');
  const errors=checkModel(model);if(errors.length)throw Error(errors.join('; '));
  return JSON.stringify({format:'sndk-value-lab-session',version:VERSION,selectedScenario,model},null,2);
}
function parseSession(text){
  const value=JSON.parse(text);
  if(!isPlain(value))throw Error('A settings object is required');
  // Flat v1.5 engine settings remain usable; explicitly select the legacy scenario.
  if(!Object.hasOwn(value,'format'))return {model:parseSettings(text),selectedScenario:'severe'};
  if(value.format!=='sndk-value-lab-session'||value.version!==VERSION||
    Object.keys(value).sort().join(',')!=='format,model,selectedScenario,version'||
    !SCENARIO_ORDER.includes(value.selectedScenario))throw Error('Valid v1.5 session and selected scenario required');
  return {model:parseSettings(JSON.stringify(value.model)),selectedScenario:value.selectedScenario};
}
function parseSettings(text){const value=JSON.parse(text);const errors=checkModel(value);
  if(errors.length)throw Error(errors.join('\n'));
  const computed=calculateModel(value);if(computed.errors.length)throw Error(computed.errors.join('\n'));
  return value;}
const api={VERSION,MODEL_DEFAULTS,SCENARIO_ORDER,TOP_NUM,ROW_NUM,clone,checkModel,calculateModel,
  operatingPath,valuePath,baseState,afterTax,calibrationWedge,parseSettings,contractSensitivity,
  reverseSolve,reverseSettlement,valueAt,discountSensitivity,endpointSensitivity,priceSettlementGrid,spotAt,PRICE_PRESETS,marginGrid,hbfContribution,
  CASH_GUIDANCE,guidanceReferenceRows,cashGuidanceAllowance,fundingLedger,
  createPreset,matchingPreset,workingValuation,serializeSession,parseSession};
if(typeof module!=='undefined'&&module.exports)module.exports=api;
if(typeof window!=='undefined')window.SNDKModel=api;
// Browser adapter for the v1.5 independently testable valuation engine.
function mountSndkApp(){
  if(!document.getElementById('summaryTable'))return;
  const initial=createPreset();let model=initial.model,selected=initial.selectedScenario;
  const $=id=>document.getElementById(id);
  const n=(v,d=1)=>v===null||v===undefined||!Number.isFinite(v)?'N/M':new Intl.NumberFormat('en-US',{minimumFractionDigits:d,maximumFractionDigits:d}).format(v);
  const money=v=>v===null||!Number.isFinite(v)?'N/M':'$'+n(v,0);
  const range=(a,b)=>a===null||b===null?'N/M':money(a)+' – '+money(b);
  const bn=v=>'$'+n(v,2)+'B';
  const node=(tag,t,cls)=>{const a=document.createElement(tag);if(t!==undefined)a.textContent=t;if(cls)a.className=cls;return a;};
  const addField=(parent,label,value,fn,step='.5')=>{const l=node('label'),s=node('span',label),a=node('input');
    a.type='number';a.step=step;a.value=String(value);a.setAttribute('aria-label',label);
    a.addEventListener('change',()=>{fn(a.value.trim()===''?NaN:Number(a.value));render();});
    l.append(s,a);parent.append(l);return a;};
  const topLabels={price:['Reference price ($)','0.01'],revenue:['FY27 forecast revenue ($B)','0.01'],
    baseGM:['FY27 forecast gross margin (%)','0.01'],baseOperatingIncomeBn:['FY27 forecast EBIT ($B)','0.01'],
    consensusEPS:['FY27 consensus adjusted EPS ($)','0.01'],shares:['FY27 diluted shares (millions)','1'],
    tax:['Illustrative tax rate (%)','.5'],discountRate:['Cost of equity (%)','.5'],
    growthLow:['Long-run growth: low (%)','.25'],growthHigh:['Long-run growth: high (%)','.25'],
    terminalRoi:['Return on incremental capital (%)','1'],fadeYears:['Additional fade years','1'],
    normalizationYears:['Trailing normalization years','1'],spotScale:['Spot-ASP scale (all projected years)','0.01'],
    managementTargetGM:['Management-reference GM target (%)','.5'],managementTargetOpexPct:['Management-reference opex / revenue (%)','.5'],
    guidanceCashScalePct:['Guidance cash allowance scale (%)','5'],
    referenceBitGrowth:['Reference bits annual growth (%)','.5'],referenceCostDown:['Reference cost/bit annual change (%)','.5'],
    opexVariablePct:['Opex sensitive to revenue (%)','1'],excessNetCashBn:['Verified excess net cash (default 0) ($B)','.1'],
    buybackFraction:['Percent positive cash used for buybacks','5'],buybackAuthorizationBn:['Remaining authorization proxy ($B)','.1'],
    buybackPriceFactor:['Repurchase price / modeled intrinsic proxy','0.1'],
    baseDaBn:['Base company D&A ($B)','0.01'],baseFixedCogsPct:['Fixed manufacturing cost share (%)','1'],
    assetLife:['Direct-capex life (years)','1'],legacyDaDecayPct:['Legacy D&A decline (%)','1'],
    baseDirectCapexBn:['Base direct capex ($B)','0.05'],baseJvNetFundingBn:['Base net JV funding ($B)','0.05'],
    baseWcChangeBn:['Base working-capital change ($B)','0.1'],baseNwcPct:['Base working capital / revenue (%)','1'],
    baseSbcBn:['Base economic SBC charge ($B)','0.01'],baseOtherCashUseBn:['Other base cash use ($B)','0.1']};
  const groups={anchors:['price','revenue','baseGM','baseOperatingIncomeBn','consensusEPS','shares'],
    valuation:['tax','discountRate','growthLow','growthHigh','terminalRoi','fadeYears','normalizationYears','spotScale','excessNetCashBn'],
    management:['managementTargetGM','managementTargetOpexPct','referenceBitGrowth','referenceCostDown','opexVariablePct','guidanceCashScalePct'],
    capital:['buybackFraction','buybackAuthorizationBn','buybackPriceFactor'],
    costs:['baseDaBn','baseFixedCogsPct','assetLife','legacyDaDecayPct','baseDirectCapexBn','baseJvNetFundingBn','baseWcChangeBn','baseNwcPct','baseSbcBn','baseOtherCashUseBn']};
  const mainFields={bitGrowth:'Bits growth %',spotChange:'Manual spot ASP change % (annual mode only)',costChange:'Cost/bit change %',
    fixedCostGrowth:'Fixed COGS growth %',opexGrowth:'Fixed opex growth %',contractShare:'NBM-contracted bits %',
    floorIndex:'Floor price index',floorHaircut:'Floor haircut %',contractCapIndex:'Optional ceiling (0 = none)',
    contractFixedIndex:'Fixed contract index',contractFloatPct:'Contract floating share %',targetGM:'Diagnostic GM target %'};
  const cashFields={directCapexBn:'Direct capex $B',jvNetFundingBn:'Incremental net JV funding $B',
    nwcPct:'Working capital/revenue %',otherCashUseBn:'Other uses $B',sbcBn:'Economic SBC $B'};
  const hbfFields={hbfRevenueBn:'Illustrative HBF revenue $B',hbfCashCogsBn:'HBF COGS $B',
    hbfOpexBn:'HBF opex $B',hbfCapexBn:'HBF capex $B',hbfDisplacementPct:'Core NAND displaced %'};
  function drawTable(id,headers,body){const t=$(id);t.replaceChildren();const thead=node('thead'),head=node('tr');headers.forEach(z=>head.append(node('th',z)));
    thead.append(head);const tbody=node('tbody');for(const cells of body){const tr=node('tr');for(const txt of cells)tr.append(node('td',txt));tbody.append(tr);}t.append(thead,tbody);}
  function inputScenarioTable(key,fields,showMode=false){const s=model.scenarios[key],wrap=node('div',undefined,'table-scroll'),table=node('table');
    const h=node('thead'),hr=node('tr');hr.append(node('th','FY'));
    if(showMode)hr.append(node('th','ASP calculation'));
    for(const label of Object.values(fields))hr.append(node('th',label));h.append(hr);table.append(h);const b=node('tbody');
    for(const row of s.path){const tr=node('tr');tr.append(node('td',row.year));
      if(showMode){const td=node('td'),sel=node('select');for(const [v,label]of [['spot','Spot-price path'],['solveGM','Solve ASP for GM']]){const opt=node('option',label);opt.value=v;sel.append(opt);}sel.value=row.pricingMode;
        sel.setAttribute('aria-label',key+' FY'+row.year+' pricing mode');sel.addEventListener('change',()=>{row.pricingMode=sel.value;render();});td.append(sel);tr.append(td);}
      for(const [field,label] of Object.entries(fields)){
        const td=node('td'),input=node('input');input.type='number';input.step=field.includes('Bn')||field.includes('Index')?'0.05':'0.5';
        input.value=String(row[field]);input.setAttribute('aria-label',key+' FY'+row.year+' '+label);
        input.addEventListener('change',()=>{row[field]=input.value===''?NaN:Number(input.value);render();});td.append(input);tr.append(td);
      }b.append(tr);}table.append(b);wrap.append(table);return wrap;
  }
  function buildPriceMeta(parent,key){
    const s=model.scenarios[key],wrap=node('div',undefined,'input-grid');
    const lab=node('label'),title=node('span','ASP path mode'),sel=node('select');
    for(const [k,text] of [['troughSettle','Trough → settled equilibrium'],['annual','Manual year-on-year changes']]){
      const opt=node('option',text);opt.value=k;sel.append(opt);
    }
    sel.value=s.spotSchedule;sel.setAttribute('aria-label',key+' price schedule');
    sel.addEventListener('change',()=>{s.spotSchedule=sel.value;render();});lab.append(title,sel);wrap.append(lab);
    for(const [field,label,step] of [
      ['troughYear','Trough FY','1'],['troughAspIndex','Trough spot ASP (FY27=1)','0.01'],
      ['settleYear','Equilibrium reached FY','1'],['settledAspIndex','Long-run settled ASP (FY27=1)','0.01'],
      ['structuralBitGrowth','Structural bit growth during fade %','0.5'],
      ['structuralAspGrowth','Structural ASP growth during fade %','0.5']
    ]) addField(wrap,label,s[field],v=>{s[field]=v;},step);
    parent.append(node('p','Two prices are independent: the cyclical trough and the post-cycle equilibrium. Margin is calculated from ASP and manufacturing costs. Annual spotChange inputs below matter only in manual mode.','note'),wrap);
  }
  function build(){
    for(const [name,fields] of Object.entries(groups)){
      const wrap=$('group_'+name);wrap.replaceChildren();fields.forEach(key=>addField(wrap,topLabels[key][0],model[key],v=>{model[key]=v;},topLabels[key][1]));
    }
    $('targetYear').value=model.targetYear;$('asOf').value=model.asOf;$('capitalMode').value=model.capitalMode;
    $('calibrationMode').value=model.calibrationMode;$('cashFlowMode').value=model.cashFlowMode;
    $('hbfEnabled').checked=model.hbfEnabled;$('selected').value=selected;
    const box=$('scenarioInputs');box.replaceChildren();
    for(const key of SCENARIO_ORDER){const s=model.scenarios[key],outer=node('details',undefined,'scenario-input');outer.dataset.scenario=key;
      outer.open=key===selected;outer.append(node('summary',s.name));
      outer.append(node('p','FY2028–FY2032 values are editable; contract floors, caps, pricing and volumes are analyst assumptions, NOT publicly disclosed contract terms.','note'));
      buildPriceMeta(outer,key);
      outer.append(node('h3','Volume / pricing / manufacturing'),inputScenarioTable(key,mainFields,false));
      const cash=node('details');cash.append(node('summary','Cash investments and working capital'),inputScenarioTable(key,cashFields));outer.append(cash);
      const hbf=node('details');hbf.append(node('summary','HBF options (evidence layer)'),inputScenarioTable(key,hbfFields));outer.append(hbf);
      box.append(outer);
    }
  }
  function render(){
    const preset=matchingPreset(model,selected);$('valuationPreset').value=preset;
    const report=calculateModel(model),errors=$('errors');errors.textContent=report.errors.join(' · ');
    errors.style.display=report.errors.length?'block':'none';for(const k of ['downloadCsv','downloadJson'])$(k).disabled=report.errors.length>0;
    if(report.errors.length){
      $('heroPV').textContent='Invalid model';
      for(const k of ['workingPV','workingExact','workingMid','presetNote'])$(k).textContent='—';
      $('workingRates').replaceChildren();
      for(const k of ['heroMargin','heroASP','heroTerminal','heroGap','heroMarginSub','heroASPSub','heroTerminalSub',
        'reverseReport','cashSummary','warnings','windowNote','fundingReport','cashGuidanceNote','fadeLogic','safetyReport','hbfImpact','gridNote'])$(k).textContent='—';
      for(const k of ['summaryTable','bridgeTable','fadeTable','priceGrid','rateTable','horizonTable','costCompare','gmGrid','contractTable','reconciliationTable','guidanceReferenceTable'])$(k).replaceChildren();
      return;
    }
    const x=report.scenarios[selected],v=x.valuation,yr=x.path.find(row=>row.year===model.targetYear),all=x.path;
    const working=workingValuation(model,selected);
    $('workingPV').textContent=working.low===null?'N/M':range(Math.round(working.low/100)*100,Math.round(working.high/100)*100);
    $('workingExact').textContent='Exact envelope at 11%–13% required return: '+range(working.low,working.high)+' per share. Headline rounded to the nearest $100.';
    $('workingMid').textContent=money(working.midpoint)+' midpoint at 12%';
    $('presetNote').textContent=preset==='guidance'?
      'Guidance-based working case: management reference through FY2030, followed by four years of slower growth toward 1.5%–2.5%. Long-run margins remain strong; this is an analyst scenario, not a company price target or downside floor.':
      preset==='legacy'?'v1.4-equivalent assumptions: deeper-decline scenario, FY2032 forecast endpoint and 11% selected return. The envelope below uses 11%–13%.':
      'Custom assumptions: the range below recalculates the selected scenario at 11%–13%. It no longer represents the unchanged guidance-based preset.';
    drawTable('workingRates',['Required return','PV today / share','Midpoint'],working.rates.map(r=>[n(r.discountRate,0)+'%',range(r.pvLow,r.pvHigh),money(r.midpoint)]));
    $('heroPV').textContent=range(v.pvLow,v.pvHigh);
    $('heroGap').textContent=v.pvLow===null?'Not meaningful under these assumptions':`${n(v.valueVsPriceLow,1)}% to ${n(v.valueVsPriceHigh,1)}% conditional PV gap to the reference price`;
    $('heroMargin').textContent=n(yr.coreGM,1)+'%';$('heroMarginSub').textContent=`FY${model.targetYear} derived core GM (total OM ${n(yr.opMargin,1)}%)`;
    $('heroASP').textContent=n(Math.min(...all.filter(r=>r.year<=model.targetYear).map(r=>r.spotIndex)),3);
    $('heroASPSub').textContent=`Trough ${n(model.scenarios[selected].troughAspIndex,2)} → settled ${n(model.scenarios[selected].settledAspIndex,2)} (FY2027=1)`;
    $('heroTerminal').textContent=`${n(v.impliedPeLow,1)}–${n(v.impliedPeHigh,1)}×`;
    $('heroTerminalSub').textContent=`Implied earnings multiple at FY${v.terminalYearLow}, DERIVED from growth and ROIC`;
    $('windowNote').textContent=`Normalization FY${v.windowStart}–${v.windowEnd}; explicit FY2027–${model.targetYear}; secular fade FY${model.targetYear+1}–${v.terminalYearLow}. Prices are not projected from the final cyclical growth rate.`;
    drawTable('summaryTable',['Scenario','PV today / share','Gap vs reference','FY'+model.targetYear+' derived GM','Spot trough','Floor active?','Implied PE','Funding gap $B'],
      SCENARIO_ORDER.map(k=>{const a=report.scenarios[k],b=a.valuation,p=a.path.find(row=>row.year===model.targetYear),q=a.path.filter(r=>r.year<=model.targetYear);
        return [model.scenarios[k].name,range(b.pvLow,b.pvHigh),b.pvLow===null?'N/M':n(b.valueVsPriceLow)+'% – '+n(b.valueVsPriceHigh)+'%',
          n(p.coreGM)+'%',n(Math.min(...q.map(z=>z.spotIndex)),3),q.some(z=>z.floorBound)?'YES':'No',n(b.impliedPeLow)+'–'+n(b.impliedPeHigh)+'×',n(b.fundingShortfall,2)];}));
    $('selectedTitle').textContent=model.scenarios[selected].name+' · cash / operating bridge';
    drawTable('bridgeTable',['FY','Bits index','Spot','Blended ASP','Total sales $B','Core GM','Total OM','Unmodeled cost wedge $B','NBM floor binds','Economic FCF $B'],
      x.path.map(z=>[z.year,n(z.bitIndex,3),n(z.spotIndex,3),n(z.blendedAsp,3),n(z.totalRevenue,2),n(z.coreGM)+'%',n(z.opMargin)+'%',n(z.unidentifiedCogs,2),z.floorBound?'Yes':'No',n(z.fcf,2)]));
    $('cashGuidanceNote').textContent=model.cashFlowMode==='guidance'?
      `Guidance cash allowance ON (${n(model.guidanceCashScalePct,0)}% scale). The unchanged management reference matches the company's approximately 50% FY2028–30 AVERAGE adjusted FCF margin; 50% each year is our simplifying allocation. Other scenarios are not forced to 50%. The 5% capital proxy and remaining unexplained cash use are assumptions. FY2031–32 carries FY2030 cash use per bit; fade/terminal reinvestment still uses ROIC. NBM deposits are excluded throughout.`:
      'Guidance cash allowance OFF: original detailed cash assumptions, without the additional capital/other cash budget. The company’s 50% target is not imposed. Economic FCF still deducts the after-tax stock-compensation charge.';
    drawTable('reconciliationTable',['FY','Raw adjusted FCF proxy $B','Capital allowance $B','Other cash allowance $B','Adjusted FCF proxy %','Economic SBC cost $B','Economic FCF %'],
      x.path.map(z=>[z.year,n(z.rawEconomicFcf+z.economicSbcCost,2),n(z.guidanceCapitalUse,2),n(z.guidanceOtherUse,2),n(100*z.adjustedFcfProxy/z.totalRevenue,2)+'%',n(z.economicSbcCost,2),n(100*z.fcf/z.totalRevenue,2)+'%']));
    drawTable('guidanceReferenceTable',['Reference FY','GM','OM','Adjusted FCF proxy','Economic FCF','Added cash use $B'],
      guidanceReferenceRows().map(z=>[z.year,n(z.coreGM)+'%',n(z.operatingMargin)+'%',n(100*z.adjustedFcfProxy/z.referenceRevenue,2)+'%',n(100*z.economicFcf/z.referenceRevenue,2)+'%',n(z.totalAllowance,2)]));
    $('fundingReport').textContent=v.fundingShortfall>FUNDING_TOLERANCE?
      `Unfunded cash shortfall: ${bn(v.fundingShortfall)}, first appearing in FY${v.firstShortfallYear}. Per-share valuation is N/M because financing costs and dilution are not specified.`:
      'No annual funding shortfall detected under the selected path. Distribution mode tests the minimum funding need assuming earlier cash can be retained; intra-year timing and liquidity restrictions are not modeled.';
    drawTable('fadeTable',['FY','Source','Revenue $B','Growth %','Economic net income $B','FCF $B','Reinvestment %'],
      [...v.branchLow.flows.filter(z=>z.year>model.targetYear-1)].map(z=>[z.year,z.source,n(z.revenue,2),z.growth===undefined?'—':n(z.growth,1),n(z.ni,2),n(z.fcf,2),z.reinvestmentRate===undefined?'—':n(z.reinvestmentRate)]));
    const warn=[];
    if(model.excessNetCashBn===0)warn.push('Excess net cash is conservatively excluded (not asserted to be zero).');
    if(all.some(r=>r.totalGM>86))warn.push('Some years exceed 86% GM; test cost calibration and product mix.');
    if(v.pvLow===null)warn.push('Negative terminal earnings or funding deficits make positive enterprise value N/M under this convention.');
    if(model.capitalMode==='buyback')warn.push('Buybacks use a model-derived intrinsic price proxy (not a stock forecast). Cash is not double counted; buying at proxy price does not guarantee accretion.');
    $('warnings').textContent=warn.join(' ');
    const quote=Number($('quote').value);
    const rev=reverseSettlement(model,selected,quote);
    $('reverseReport').textContent=rev.error?rev.error:
      `At ${money(quote)} on this SPECIFIED volume/cost/trough path, break-even SETTLED ASP ≈ ${n(rev.settledAspIndex,3)} (FY2027=1). NBM/HBF OFF for this inverse. Core GM at FY${model.targetYear} ≈ ${n(rev.impliedTerminalGM)}%; implied realized core selling price / cost ≈ ${n(rev.impliedPriceCost,2)}×. Not a forecast of where the industry will settle.`;
    const pg=priceSettlementGrid(model,selected);
    $('gridNote').textContent=`Spot ASP trough × equilibrium ASP, FY2027=1. Modeled PV midpoints ($ per share), at ${n(model.discountRate,1)}% cost of equity. NAND bit growth, costs and terminal economics unchanged; NBM floors/caps and HBF switched OFF. Dash = inconsistent prices, unfunded cash need or no positive terminal franchise.`;
    drawTable('priceGrid',['Trough \ Equilibrium',...pg.settlements.map(z=>n(z,2)+'×')],
      pg.troughs.map((t,i)=>[n(t,2)+'×',...pg.cells[i].map(c=>c.midpoint===null?'—':money(c.midpoint))]));
    const discounts=discountSensitivity(model,selected);
    drawTable('rateTable',['Cost of equity','PV today','Gap vs market'],discounts.map(r=>[n(r.discountRate,0)+'%',range(r.pvLow,r.pvHigh),r.midpoint===null?'N/M':n((r.midpoint/model.price-1)*100,1)+'%']));
    const horizons=endpointSensitivity(model,selected);
    drawTable('horizonTable',['Explicit horizon','PV today','Traded terminal-start vs structural growth'],horizons.map(r=>[String(r.targetYear),range(r.pvLow,r.pvHigh),r.midpoint===null?'N/M':'Structural basis']));
    $('fadeLogic').textContent=`FY${model.targetYear}: observed modeled last-year revenue growth ${n(v.lastRevenueGrowthPct,1)}%; fade starts from structural bit×ASP growth ${n(v.structuralStartGrowthPct,1)}%, not that cyclical observation. Normalization window FY${v.windowStart}–FY${v.windowEnd}.`;
    const unadj=valueAt(model,selected,{calibrationMode:'unadjusted'}),cal=valueAt(model,selected,{calibrationMode:'management'});
    drawTable('costCompare',['Cost treatment','Present value','FY'+model.targetYear+' incremental cost wedge'],[
      ['Management-reference synthetic wedge',range(cal.pvLow,cal.pvHigh),bn(cal.costWedgeBn)],
      ['Unadjusted cost curve',range(unadj.pvLow,unadj.pvHigh),'$0.00B']]);
    const grid=marginGrid(model,selected,[60,65,70,75,80]);
    drawTable('gmGrid',['Fixed GM diagnostic','PV (unadjusted costs)','Implied trough ASP','Warning'],
      grid.map(r=>[n(r.target,0)+'%',range(r.pvLow,r.pvHigh),n(r.troughSpot,3),'NOT a market-price scenario']));
    const safety=v.pvLow===null?null:(v.pvLow+v.pvHigh)/2;
    $('safetyReport').textContent=safety===null?'N/M':
      `If, and ONLY if, you choose this scenario as a defensible intrinsic value (${money(safety)} midpoint), hypothetical prices with 10% / 20% / 30% discounts would be ${money(safety*.9)} / ${money(safety*.8)} / ${money(safety*.7)}. These are arithmetic discounts, not approved entry points or market floors.`;
    const contracts=contractSensitivity(model,selected==='historical'?'collapse':selected);
    drawTable('contractTable',['Effective hypothetical floor','PV today / share','Difference vs floor 0'],contracts.map(row=>[
      row.floor===0?'None':n(row.floor,2)+'× FY27 ASP',range(row.pvLow,row.pvHigh),
      row.pvLow===null||contracts[0].pvLow===null?'N/M':money((row.pvLow+row.pvHigh-contracts[0].pvLow-contracts[0].pvHigh)/2)
    ]));
    const h=hbfContribution(model,selected);
    $('hbfImpact').textContent=h&&h.pvLow!==null?`Illustrative HBF on–off PV contribution: ${range(h.pvLow,h.pvHigh)} per share. This is a scenario difference, not an established technology moat.`:'No meaningful HBF comparison under these assumptions.';
    const b=v.branchLow;
    $('cashSummary').textContent=`Explicit + fade FCF PV: ${bn(b.pvFcf)} (low-growth branch). Terminal franchise value: ${b.tv===null?'N/M':bn(b.tv)} at FY${b.terminalYear}; implied terminal PE ${n(b.impliedTerminalPe)}×. `+
      (model.capitalMode==='buyback'?`End shares ${n(b.sharesEnd,2)}M; modeled cumulative repurchases ${bn(b.totalBuyback||0)}.`:'Distribution-equivalent cash flows are included once; unchanged diluted-share proxy.');
  }
  function download(name,type,data){const blob=new Blob([data],{type}),url=URL.createObjectURL(blob),a=node('a');a.download=name;a.href=url;a.click();setTimeout(()=>URL.revokeObjectURL(url),3000);}
  function loadPreset(name){const next=createPreset(name);model=next.model;selected=next.selectedScenario;$('quote').value=model.price;build();render();}
  function importSession(text){const next=parseSession(text);model=next.model;selected=next.selectedScenario;build();render();}
  $('valuationPreset').addEventListener('change',e=>loadPreset(e.target.value));
  $('selected').addEventListener('change',e=>{selected=e.target.value;render();});
  $('targetYear').addEventListener('change',e=>{model.targetYear=Number(e.target.value);render();});
  $('asOf').addEventListener('change',e=>{model.asOf=e.target.value;render();});
  $('capitalMode').addEventListener('change',e=>{model.capitalMode=e.target.value;render();});
  $('calibrationMode').addEventListener('change',e=>{model.calibrationMode=e.target.value;render();});
  $('cashFlowMode').addEventListener('change',e=>{model.cashFlowMode=e.target.value;render();});
  $('hbfEnabled').addEventListener('change',e=>{model.hbfEnabled=e.target.checked;render();});
  $('quote').value=String(model.price);$('quote').addEventListener('change',render);
  $('reset').addEventListener('click',()=>loadPreset('guidance'));
  $('downloadJson').addEventListener('click',()=>download('sndk_v1_5_settings.json','application/json',serializeSession(model,selected)));
  $('downloadCsv').addEventListener('click',()=>{const r=calculateModel(model);if(r.errors.length)return;
    const rows=[['scenario','year','trough_input','settled_input','bits','spot','contract_asp','blended_asp','core_revenue_bn','hbf_revenue_bn','total_revenue_bn','unmodeled_cost_bn','gross_margin_pct','operating_margin_pct','raw_economic_fcf_bn','guidance_capital_use_bn','guidance_other_use_bn','adjusted_fcf_proxy_bn','economic_sbc_cost_bn','economic_fcf_bn','funding_shortfall_bn','first_shortfall_fy','pv_low','pv_high']];
    for(const k of SCENARIO_ORDER){const a=r.scenarios[k];for(const z of a.path)rows.push([k,z.year,model.scenarios[k].troughAspIndex,model.scenarios[k].settledAspIndex,z.bitIndex,z.spotIndex,z.contractPrice,z.blendedAsp,z.coreRevenue,z.hbfRevenue,z.totalRevenue,z.unidentifiedCogs,z.coreGM,z.opMargin,z.rawEconomicFcf,z.guidanceCapitalUse,z.guidanceOtherUse,z.adjustedFcfProxy,z.economicSbcCost,z.fcf,a.valuation.fundingShortfall,a.valuation.firstShortfallYear,a.valuation.pvLow,a.valuation.pvHigh]);}
    const escape=v=>{let t=v===null?'':String(v);if(typeof v==='string'&&/^[=+@-]/.test(t))t="'"+t;return '"'+t.replaceAll('"','""')+'"';};
    download('sndk_v1_5_results.csv','text/csv;charset=utf-8','\ufeff'+rows.map(row=>row.map(escape).join(',')).join('\r\n'));
  });
  $('importSettings').addEventListener('change',e=>{const f=e.target.files[0];if(!f)return;const rd=new FileReader();
    rd.onload=()=>{try{importSession(String(rd.result));$('status').textContent='Validated and imported v1.5 settings and selected scenario.';}
      catch(err){$('status').textContent='Import rejected; existing assumptions preserved. '+err.message;}};
    rd.onerror=()=>{$('status').textContent='Read failed; original settings unchanged.';};rd.readAsText(f);e.target.value='';});
  window.SNDKUI={getModel:()=>clone(model),getSession:()=>JSON.parse(serializeSession(model,selected)),render,importText:importSession,setScenario:key=>{if(!SCENARIO_ORDER.includes(key))throw Error('Unknown scenario');selected=key;$('selected').value=key;render();}};
  build();render();
}
if(typeof document!=='undefined'){if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mountSndkApp);else mountSndkApp();}
