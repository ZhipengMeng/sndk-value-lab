'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const E=require('./source/engine.js'),model=require('./model.json');
let checks=0;
const check=(v,label)=>{assert.ok(v,label);checks++;};
const near=(a,b,label)=>check(Math.abs(a-b)<1e-7,label);
const base=E.all(model),cases=[];
for(const [scenario,target] of Object.entries({central:1998.1509000727237,downside:323.47592050538015,upside:4142.437486388292})){
 const r=base[scenario];near(r.price,target,scenario+' preserved audited value');
 check(r.rows.length===8&&r.fade.length===4,scenario+' forecast and fade periods');
 near(r.enterprise+r.equityBridge,r.equity,scenario+' equity bridge');
 near(r.explicitPV+r.fadePV+r.terminalPV,r.enterprise,scenario+' enterprise bridge');
 for(const row of r.rows){
  near(row.nopat+row.da-row.capex-row.jvFunding-row.cashAllowance-row.deltaNwc,row.fcff,scenario+' cash reconciliation');
  near(row.economicEbit,row.ebit-row.sbc,scenario+' SBC charged');
 }
 cases.push({label:scenario,model,scenario,result:r});
}
for(const row of base.central.rows.slice(1,4)){
 near(row.gm,80,'period GM allocated annually');
 near(row.ebit/row.revenue,.75,'period OM allocated annually');
 near((row.fcff+row.sbc*.85)/row.revenue,.5,'cash proxy before SBC');
}
for(const discount of [10,12,14,16])for(const terminalMargin of [30,40,50,60,70])for(const allowanceScale of [0,100,200]){
 const m=E.clone(model);Object.assign(m.assumptions,{discount,terminalMargin,allowanceScale});
 cases.push({label:`grid ${discount}/${terminalMargin}/${allowanceScale}`,model:m,scenario:'central',result:E.run(m)});
}
for(const [label,changes] of [['no interim credit',{interimCredit:0}],['higher investment',{capexMultiplier:1.25}],['persistent cash drain',{terminalLeakage:5}],['lower gross margin',{gmShock:-5}]]){
 const m=E.clone(model);Object.assign(m.assumptions,changes);const r=E.run(m);
 check(r.price<base.central.price,label+' lowers value');cases.push({label,model:m,scenario:'central',result:r});
}
const noAllowance=E.clone(model);noAllowance.assumptions.allowanceScale=0;
near(E.run(noAllowance).price,2182.1845279466374,'zero allowance sensitivity preserved');
const priceShock=E.clone(model);priceShock.scenarios.central.rows[4].asp=priceShock.scenarios.central.rows[4].asp.map(v=>(1+v/100)*.8*100-100);
const shocked=E.run(priceShock);
near(shocked.rows[4].cashAllowance,base.central.rows[4].cashAllowance,'cash allowance independent of ASP');
check(shocked.price<base.central.price,'price decline lowers value');
for(const changes of [{discount:2},{discount:NaN},{allowanceScale:-1},{sharesMn:0},{terminalRoi:1}]){
 const m=E.clone(model);Object.assign(m.assumptions,changes);
 assert.throws(()=>E.run(m));checks++;
}
const reserve=E.clone(model);reserve.assumptions.operatingReserve=200;check(!E.run(reserve).funded,'funding shortage detected');
check(JSON.stringify(E.session(model,'downside').model)===JSON.stringify(model),'export preserves assumptions');
const dir=path.join(__dirname,'verification');fs.mkdirSync(dir,{recursive:true});
fs.writeFileSync(path.join(dir,'audit_cases.json'),JSON.stringify(cases));
fs.writeFileSync(path.join(dir,'engine_report.json'),JSON.stringify({status:'pass',checks,independentCases:cases.length},null,2)+'\n');
console.log(`PASS v2.0 engine: ${checks} checks; ${cases.length} cases for independent Python validation`);
