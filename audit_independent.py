"""Independently reconstruct cash calibration, operating identities, funding,
repurchases and discounted values. Python 3.9+ and Node 18+; no extra packages.
Arithmetic verification does not validate forecasts or undisclosed cost inputs.
"""
from datetime import datetime, timezone
from pathlib import Path
from math import isclose
from subprocess import run
import json

ROOT=Path(__file__).resolve().parent
payload=json.loads(run(['node',str(ROOT/'audit_export.js')],capture_output=True,text=True,check=True).stdout)
cases=payload['cases']; reference=payload['referenceModel']; checks=0

def verify(a,b,name,tol=1e-7):
    global checks
    if a is None or b is None:
        assert a is None and b is None,(name,a,b)
    else:
        assert isclose(a,b,rel_tol=tol,abs_tol=tol),(name,a,b)
    checks+=1

def ye(year): return datetime(year,6,30,tzinfo=timezone.utc)
def taxed(ebit,tax): return ebit-max(ebit,0)*tax/100

# Reconstruct the frozen reference from primitives, not JS allowance outputs.
reference_rows={}; bits=1; nwc=reference['revenue']*.1; cohorts=[]
for row in reference['scenarios']['management']['path'][:3]:
    year=row['year']; bits*=1+row['bitGrowth']/100; revenue=reference['revenue']*bits
    cohorts.append((year,row['directCapexBn']))
    da=reference['baseDaBn']*(1-reference['legacyDaDecayPct']/100)**(year-2027)
    da+=sum(amount/reference['assetLife']*(.5 if cy==year else 1) for cy,amount in cohorts)
    next_nwc=revenue*row['nwcPct']/100
    proxy=taxed(revenue*.75,reference['tax'])+da-row['directCapexBn']-row['jvNetFundingBn']-(next_nwc-nwc)-row['otherCashUseBn']
    nwc=next_nwc
    total=max(0,proxy-revenue*.5)
    capital=min(total,max(0,revenue*.05-row['directCapexBn']-row['jvNetFundingBn']))
    reference_rows[year]={'bits':bits,'capital':capital,'other':total-capital}

for case in cases:
    m=case['model']; yrs=case['operating']; val=case['valuation']
    asof=datetime.fromisoformat(m['asOf']).replace(tzinfo=timezone.utc)
    sc=m['scenario']; rows=sc['path']; rate=case['rate']/100
    years=lambda year: (ye(year)-asof).total_seconds()/(365.25*86400)
    discount=lambda year: (1+rate)**years(year)
    for i,z in enumerate(yrs):
        verify(z['totalRevenue'],z['coreRevenue']+z['hbfRevenue'],'total revenue')
        verify(z['grossProfit'],z['totalRevenue']-z['cogs'],'gross profit')
        verify(z['adjustedEbit'],z['grossProfit']-z['opex'],'adjusted EBIT')
        verify(z['economicEbit'],z['adjustedEbit']-z['sbc'],'economic EBIT')
        verify(z['economicNI'],taxed(z['economicEbit'],m['tax']),'economic income')
        verify(z['opMargin'],100*z['adjustedEbit']/z['totalRevenue'],'operating margin')
        raw=z['economicNI']+z['companyDa']-z['directCapex']-z['jvNetFunding']-z['wcChange']-z['otherCashUse']
        capital=other=0
        if i and m['cashFlowMode']=='guidance':
            ref=reference_rows[min(z['year'],2030)]
            scale=z['netBitIndex']/ref['bits']*m['revenue']/reference['revenue']*m['guidanceCashScalePct']/100
            capital=ref['capital']*scale; other=ref['other']*scale
        verify(z['rawEconomicFcf'],raw,'raw cash bridge')
        verify(z['guidanceCapitalUse'],capital,'independent capital allowance')
        verify(z['guidanceOtherUse'],other,'independent other allowance')
        verify(z['guidanceCashUse'],capital+other,'total allowance')
        verify(z['fcf'],raw-capital-other,'economic cash flow')
        sbc=taxed(z['adjustedEbit'],m['tax'])-z['economicNI']
        verify(z['economicSbcCost'],sbc,'SBC economic cost')
        verify(z['adjustedFcfProxy'],z['fcf']+sbc,'adjusted FCF proxy')
        if i:
            hcash=rows[i-1]['hbfCashCogsBn'] if case['hbfEnabled'] else 0
            verify(z['cogs'],z['variableCogs']+z['fixedCogs']+z['companyDa']+z['unidentifiedCogs']+hcash,'COGS components')
            core=z['variableCogs']+z['fixedCogs']+z['companyDa']-z['hbfDa']+z['unidentifiedCogs']
            verify(z['coreGM'],100*(z['coreRevenue']-core)/z['coreRevenue'],'core GM')
        else:
            verify(z['coreGM'],100*z['grossProfit']/z['coreRevenue'],'base GM')
    shortfalls=[]; first_years=[]
    for branch_name,gpct in [('branchLow',m['growthLow']),('branchHigh',m['growthHigh'])]:
        b=val[branch_name]; g=gpct/100; roi=m['terminalRoi']/100
        explicit=[z for z in yrs if z['year']<=case['targetYear']]
        normal_margin=sum(z['economicEbit'] for z in explicit[-3:])/sum(z['totalRevenue'] for z in explicit[-3:])
        start_margin=explicit[-1]['economicEbit']/explicit[-1]['totalRevenue']
        structural=(1+sc['structuralBitGrowth']/100)*(1+sc['structuralAspGrowth']/100)-1
        revenue=explicit[-1]['totalRevenue']
        for j,flow in enumerate(b['fade'],1):
            weight=j/m['fadeYears']; growth=g+(structural-g)*(1-weight); revenue*=1+growth
            ni=taxed(revenue*(start_margin+(normal_margin-start_margin)*weight),m['tax'])
            verify(flow['ni'],ni,'independent fade earnings')
            verify(flow['reinvestmentRate'],growth/roi*100,'fade reinvestment')
            verify(flow['fcf'],ni*(1-growth/roi),'fade FCF')
        for flow in b['flows']:
            portion=(ye(2027)-asof).total_seconds()/(ye(2027)-ye(2026)).total_seconds() if flow['year']==2027 else 1
            verify(flow['portion'],portion,'remaining FY2027 fraction')
        pv=sum(z['fcf']*z['portion']/discount(z['year']) for z in b['flows'])
        verify(b['pvFcf'],pv,'all cash-flow PV')
        terminal=b['fade'][-1]; terminal_year=terminal['year']
        sustainable=terminal['ni']*(1+g)*(1-g/roi)
        verify(b['sustainableFcf'],sustainable,'sustainable FCF')
        tv=sustainable/(rate-g) if terminal['ni']>0 else None
        verify(b['tv'],tv,'Gordon terminal value')
        cash=m['excessNetCashBn']; shares=m['shares']; auth=m['buybackAuthorizationBn']; shortfall=0; first=None
        for i,flow in enumerate(b['flows']):
            cash+=flow['fcf']*flow['portion']
            if cash < -1e-9:
                shortfall=max(shortfall,-cash)
                if first is None:first=flow['year']
            if m['capitalMode']=='buyback' and tv is not None:
                future=sum(z['fcf']*z['portion']/(1+rate)**(years(z['year'])-years(flow['year'])) for z in b['flows'][i+1:])
                business=future+tv/(1+rate)**(years(terminal_year)-years(flow['year']))
                proxy=max(1,(business+max(0,cash))*1000/shares*m['buybackPriceFactor'])
                spend=0 if shortfall>0 else max(0,min(max(0,cash)*m['buybackFraction']/100,auth,shares*proxy/1000*.9))
                shares-=spend*1000/proxy; cash-=spend; auth-=spend
                item=b['ledger'][i]
                for field,value in [('priceProxy',proxy),('repurchase',spend),('endShares',shares),('endCash',cash),('remainingAuthorization',auth)]:
                    verify(item[field],value,'buyback '+field)
            verify(b['fundingLedger'][i]['endCash'],cash,'funding ledger')
        verify(b['fundingShortfall'],shortfall,'funding deficit')
        assert b['firstShortfallYear']==first
        expected=None
        if tv is not None and shortfall<=1e-9:
            expected=(tv+cash)*1000/shares/discount(terminal_year) if m['capitalMode']=='buyback' else (m['excessNetCashBn']+pv+tv/discount(terminal_year))*1000/m['shares']
        verify(b['price'],expected,'funded PV/share')
        shortfalls.append(shortfall)
        if first is not None:first_years.append(first)
    verify(val['fundingShortfall'],max(shortfalls),'scenario funding deficit')
    assert val['firstShortfallYear']==(min(first_years) if first_years else None)

assert len(cases)==587
report={'version':'1.5','testedAt':datetime.now(timezone.utc).isoformat(),'caseCount':len(cases),
        'independentArithmeticChecksPassed':checks,'scope':'Independent cash allowance, SBC, operating/fade, funding, buyback and PV reconstruction; not forecast validation.'}
(ROOT/'audit_independent_report.json').write_text(json.dumps(report,indent=2)+'\n')
print(f'PASS {checks} independent arithmetic checks across {len(cases)} cases')
