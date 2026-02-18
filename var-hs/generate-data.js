const fs = require('fs');

function gaussian(mean = 0, sigma = 1) {
  let u = 0, v = 0;
  while (u === 0) u = Math.random(); //Converting [0,1) to (0,1)
  while (v === 0) v = Math.random();
  let num = Math.sqrt( -2.0 * Math.log( u ) ) * Math.cos( 2.0 * Math.PI * v );
  num = num * sigma + mean; // Translate to desired mean and standard deviation
  return num;
}

const N = 252;
const stockPnls = [];
const bondPnls = [];
const fxPnls = [];

for (let i = 0; i < N; i++) {
  stockPnls.push(gaussian(0, 0.02)); // stock ~2% daily vol for demo
  bondPnls.push(gaussian(0, 0.008)); // bond lower
  fxPnls.push(gaussian(0, 0.012)); // fx medium
}

const round2 = (x) => Math.round(x * 10000) / 100 / 100; // % to 2 decimals, but as decimal

console.log('const stockPnls = ' + JSON.stringify(stockPnls.map(round2)) + ';');
console.log('const bondPnls = ' + JSON.stringify(bondPnls.map(round2)) + ';');
console.log('const fxPnls = ' + JSON.stringify(fxPnls.map(round2)) + ';');

// Compute example stats
const weights = [1/3,1/3,1/3];
const pnls = stockPnls.map((s,i) => s*weights[0] + bondPnls[i]*weights[1] + fxPnls[i]*weights[2]);
const mean = pnls.reduce((a,b)=>a+b)/N;
const std = Math.sqrt( pnls.reduce((a,b)=>a+(b-mean)**2,0)/N );
console.log('Example portfolio std: ' + (std*100).toFixed(2) + '%');
const sorted = [...pnls].sort((a,b)=>a-b);
const var99_idx = Math.floor(0.01 * N);
const var99 = -sorted[var99_idx];
console.log('VaR 99% (252 days): ' + (var99*100).toFixed(2) + '%');
