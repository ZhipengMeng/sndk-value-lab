"""Independent Python valuation from SNDK inputs; no use of engine equations at runtime."""
from pathlib import Path
from datetime import date
import json,math,copy
P=Path(__file__).resolve().parent
def days(a,b):return (date.fromisoformat(b)-date.fromisoformat(a)).days
def compute(m,key='central'):
 a=m['assumptions'];f=m['facts'];c=m['company'];tax=a['tax']/100;r=a['discount']/100;g=a['terminalGrowth']/100;roi=a['terminalRoi']/100
 end=lambda y:f'{y}-06-30' if c=='SNDK' else ('2027-09-02' if y==2027 else f'{y}-08-31') if c=='MU' else f'{y}-12-31'
 pv=lambda x,d:x/(1+r)**(days(m['asOf'],d)/365.25)
 after=lambda e:e-max(0,e)*tax
 buy=f['buybackBudget']*a['buybackFraction']/100 if c=='SKHY' else 0
 shares=a['sharesMn']-buy*m['epsScale']/a['buybackPrice']
 convert=lambda x:x*m['epsScale']/shares*m['ordinaryPerQuote']/a['fx']
 bridge=f['cash']-f['debt']-f['taxLiability']-f['customerDeposits']-a['operatingReserve']
 if c in ['SNDK','SKHY']:bridge+=f['investments']*(1-a['investmentHaircut']/100)-f['investmentClaims']
 if c=='SKHY':bridge+=f['ipoGross']*(1-a['ipoFeePct']/100)-buy
 nwc=lambda rev,cost:rev*(a['dso']/365-a['accruedPct']/100)+cost*(a['dio']-a['dpo'])/365
 previous=f['openingNwc'];explicit=0
 if c=='SKHY':
  endNwc=nwc(f['cy2026ConsensusRevenue'],f['cy2026ConsensusRevenue']-f['cy2026ConsensusEbit']-m['anchor']['opex'])
  cash=after(f['cy2026ConsensusEbit']-f['halfEbit'])+m['stub']['daHalf']-(m['stub']['capexYear']*a['capexMultiplier']-f['halfCashCapex'])-(endNwc-previous)
  elapsed=days('2026-06-30',m['asOf'])/days('2026-06-30','2026-12-31');bridge+=cash*elapsed*a['interimCredit']/100;explicit+=pv(cash*(1-elapsed),'2026-12-31');previous=endNwc
 rev=m['anchor']['revenues'][:];cost=m['anchor']['cashCosts'][:];units=[1]*len(rev);rows=[]
 for i,z in enumerate(m['scenarios'][key]['rows']):
  v=[x*(1+b/100)*(1+p/100) for x,b,p in zip(rev,z['volume'],z['asp'])]
  if z['revenueTarget'] is not None:v=[x*z['revenueTarget']/sum(v) for x in v]
  units=[x*(1+b/100) for x,b in zip(units,z['volume'])]
  if c=='SNDK':
   q=z['costBudget'];cost=[q['cash'][j]*(.25+.75*units[j]/q['volumeIndex'][j]) if q else x*(.75*(1+z['volume'][j]/100)*(1+z['cost'][j]/100)+.25*1.03) for j,x in enumerate(cost)]
  else:cost=[x*(1+b/100)*(1+d/100) for x,b,d in zip(cost,z['volume'],z['cost'])]
  da=z['da']*a['capexMultiplier'];cogs=sum(cost)+da*m['anchor']['manufacturingDaShare']-sum(v)*a['gmShock']/100;revenue=sum(v);opex=z['opex']+da*(1-m['anchor']['manufacturingDaShare'])
  ebit=revenue-cogs-opex;sbc=a['sbc']*1.06**i if c!='SKHY' else 0;econ=ebit-sbc;cap=z['capex']*a['capexMultiplier'];jv=z['jvFunding']*a['capexMultiplier'] if c=='SNDK' else 0
  allowance=z['cashAllowance']*a['allowanceScale']/100*sum(x*u for x,u in zip(m['anchor']['revenues'],units))/sum(x*u for x,u in zip(m['anchor']['revenues'],z['referenceVolumeIndex'])) if c=='SNDK' else 0
  endNwc=nwc(revenue,cogs);delta=endNwc-previous;fcff=after(econ)+da-cap-jv-allowance-delta
  fraction=1
  if c!='SKHY' and i==0:
   elapsed=days(m['balanceDate'],m['asOf'])/days(m['balanceDate'],end(z['year']));bridge+=fcff*elapsed*a['interimCredit']/100;fraction=1-elapsed
  explicit+=pv(fcff*fraction,end(z['year']))
  rows.append(dict(revenue=revenue,cogs=cogs,ebit=ebit,economicEbit=econ,fcff=fcff,usdEPS=convert(after(ebit+a['netInterest'])-m['epsMinority']),reinvestment=cap+jv+allowance-da+delta));rev=v;previous=endNwc
 last=rows[-1];growth=max(g,min(.12,last['revenue']/rows[-2]['revenue']-1));om=last['economicEbit']/last['revenue'];target=(a['terminalMargin']+m['scenarios'][key]['marginOffset'])/100;rv=last['revenue'];fade=0
 for i in range(1,5):
  w=i/4;gg=growth*(1-w)+g*w;mar=om*(1-w)+target*w;rv*=1+gg;nopat=rv*mar*(1-tax)
  reinvest=last['reinvestment']*(1-w)+nopat*gg/roi*w
  cash=nopat-reinvest-rv*a.get('terminalLeakage',0)/100*w
  fade+=pv(cash,end(2034+i))
 term=(rv*(1+g)*target*(1-tax)*(1-g/roi)-rv*(1+g)*a.get('terminalLeakage',0)/100)/(r-g);terminal=pv(term,end(2038));equity=explicit+fade+terminal+bridge
 return dict(price=convert(equity),equityBridge=bridge,explicitPV=explicit,fadePV=fade,terminalPV=terminal,rows=rows)

checks=0
for case in json.loads((P/'verification/audit_cases.json').read_text()):
 result=compute(case['model'],case['scenario']);target=case['result']
 for k in ['price','equityBridge','explicitPV','fadePV','terminalPV']:
  assert math.isclose(result[k],target[k],rel_tol=1e-9,abs_tol=1e-7),(case['label'],k,result[k],target[k]);checks+=1
 for i,row in enumerate(result['rows']):
  for k in ['revenue','cogs','ebit','economicEbit','fcff','usdEPS']:
   assert math.isclose(row[k],target['rows'][i][k],rel_tol=1e-9,abs_tol=1e-7),(case['label'],i,k);checks+=1
report={'status':'pass','checks':checks,'scope':'Independent Python rebuild from saved SNDK inputs across defaults and sensitivity cases. This validates arithmetic, not financial forecasts.'}
(P/'verification/independent_audit.json').write_text(json.dumps(report,indent=2)+'\n')
print('PASS v2.0 independent arithmetic:',checks,'checks')
