'use strict';
const assert=require('node:assert/strict'),Q=require('./quotes.js');
const base={schema:1,provider:'Yahoo Finance',generatedAt:'2026-10-11T12:00:00Z',quotes:{}};
for(const s of ['MU','SKHY','SNDK'])base.quotes[s]={symbol:s,price:100,currency:'USD',exchange:'Nasdaq',session:'regular',security:s==='SKHY'?'ADS':'common stock',asOf:'2026-10-09T20:00:00Z',retrievedAt:base.generatedAt,sourceUrl:'https://finance.yahoo.com/quote/'+s+'/'};
const now=Date.parse('2026-10-11T12:05:00Z');assert.equal(Q.validate(base,now),base);
let checks=1;
for(const mutate of [q=>q.quotes.SKHY.currency='KRW',q=>q.quotes.SKHY.symbol='000660.KS',q=>q.quotes.SKHY.security='common stock',q=>q.quotes.MU.price=0,q=>q.quotes.MU.price='100',q=>q.quotes.MU.price=NaN,q=>q.quotes.MU.asOf='2026-11-01T20:00:00Z',q=>q.quotes.MU.asOf='2026-10-08T20:00:00Z',q=>q.generatedAt='bad',q=>q.generatedAt='2026-12-01T00:00:00Z',q=>delete q.quotes.SNDK,q=>q.quotes.MU.sourceUrl='https://example.com/',q=>q.quotes.MU.session='postmarket']){const q=structuredClone(base);mutate(q);assert.throws(()=>Q.validate(q,now));checks++;}
console.log('PASS quote validation:',checks);
