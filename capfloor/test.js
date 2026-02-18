const face = 100;
const coupon = 5 / 100;
const ytm = 4 / 100;
const years = 10;
const freq = 2;

console.log('Inputs:', {face, coupon_pct: coupon*100, ytm_pct: ytm*100, years, freq});

const N = years * freq;
const delta_years = 1 / freq;
const r_period = ytm / freq;
const coupon_payment = face * coupon / freq;

let price = 0;
let duration_weighted = 0;
const detailLines = [];

console.log(`N periods: ${N}, delta: ${delta_years}, r_per: ${r_period.toFixed(4)}, c_pay: ${coupon_payment.toFixed(2)}`);

for(let i = 1; i <= N; i++) {
  const t_years = i * delta_years;
  const df = Math.pow(1 + r_period, -i);
  const cf = (i === N ? coupon_payment + face : coupon_payment);
  const pv_cf = cf * df;
  price += pv_cf;
  duration_weighted += pv_cf * t_years;
  
  console.log(`Period ${i}: t=${t_years.toFixed(2)}y, df=${df.toFixed(6)}, CF=${cf.toFixed(2)}, PV=${pv_cf.toFixed(4)}`);
  detailLines.push(`P${i} t=${t_years.toFixed(2)} DF=${df.toFixed(4)} CF=${cf.toFixed(0)} PV=${pv_cf.toFixed(0)}`);
}

const mac_duration = duration_weighted / price;

console.log(`\n#price: ${price.toFixed(2)}`);
console.log(`#duration: ${mac_duration.toFixed(2)}y`);
// console.log('Details:', detailLines.slice(0,5), '...');
