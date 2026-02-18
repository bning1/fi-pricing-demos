function normCDF(x) {
  var a1 = 0.254829592;
  var a2 = -0.284496736;
  var a3 = 1.421413741;
  var a4 = -1.453152027;
  var a5 = 1.061405429;
  var p = 0.3275911;

  var sign = 1;
  if (x &lt; 0) {
    sign = -1;
  }
  x = Math.abs(x) / Math.SQRT2;

  var t = 1.0 / (1.0 + p * x);
  var y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

  return 0.5 * (1.0 + sign * y);
}

function calcCapFloor() {
  const notional = parseFloat(document.getElementById(&#x27;notional&#x27;).value) || 0;
  const K = parseFloat(document.getElementById(&#x27;strike&#x27;).value) || 0;
  const sigma = parseFloat(document.getElementById(&#x27;vol&#x27;).value) || 0;
  const tenor = parseFloat(document.getElementById(&#x27;tenor&#x27;).value) || 0;
  const r = parseFloat(document.getElementById(&#x27;rate&#x27;).value) || 0;
  const freq = parseInt(document.getElementById(&#x27;freq&#x27;).value) || 1;
  const isCap = document.getElementById(&#x27;type&#x27;).value === &#x27;cap&#x27;;

  const tau = 1 / freq;
  const num_periods = Math.floor(tenor * freq);
  let totalPV = 0;
  let tableRows = &#x27;&#x27;;
  const logLines = [];

  if (num_periods &lt;= 0) {
    document.getElementById(&#x27;results&#x27;).innerHTML = &#x27;&lt;p&gt;Invalid tenor/freq&lt;/p&gt;&#x27;;
    return;
  }

  logLines.push(`Calc: Notional=${notional}, K=${K}, vol=${sigma}, tenor=${tenor}y, r=${r}, freq=${freq}, type=${isCap ? &#x27;cap&#x27; : &#x27;floor&#x27;}`);

  for (let i = 1; i &lt;= num_periods; i++) {
    const t = i / freq;
    const T = t; // approx time to fixing/payment
    const df = Math.pow(1 + r / freq, -i);
    const F = r; // flat forward rate

    let vol_t = sigma * Math.sqrt(T);
    let capletPV;

    if (vol_t &lt; 1e-8) {
      // degenerate case
      capletPV = Math.max(F - K, 0) * tau * df * notional;
    } else {
      const d1 = (Math.log(F / K) + 0.5 * vol_t * vol_t) / vol_t;
      const d2 = d1 - vol_t;

      let black;
      if (isCap) {
        black = F * normCDF(d1) - K * normCDF(d2);
      } else {
        black = K * normCDF(-d2) - F * normCDF(-d1);
      }
      capletPV = black * tau * df * notional;
    }

    totalPV += capletPV;
    tableRows += `&lt;tr&gt;&lt;td&gt;${i}&lt;/td&gt;&lt;td&gt;${t.toFixed(2)}&lt;/td&gt;&lt;td&gt;${F.toFixed(4)}&lt;/td&gt;&lt;td&gt;${(capletPV/notional/tau/df).toFixed(6)}&lt;/td&gt;&lt;td&gt;$${capletPV.toFixed(0)}&lt;/td&gt;&lt;/tr&gt;`;
    logLines.push(`Caplet ${i} (t=${t.toFixed(2)}): PV $${capletPV.toFixed(0)}`);
  }

  document.getElementById(&#x27;results&#x27;).innerHTML = `
    &lt;h2&gt;Total Present Value: $${totalPV.toFixed(0)}&lt;/h2&gt;
    &lt;table&gt;
      &lt;thead&gt;&lt;tr&gt;&lt;th&gt;#&lt;/th&gt;&lt;th&gt;Time (y)&lt;/th&gt;&lt;th&gt;F&lt;/th&gt;&lt;th&gt;Black&lt;/th&gt;&lt;th&gt;PV&lt;/th&gt;&lt;/tr&gt;&lt;/thead&gt;
      &lt;tbody&gt;${tableRows}&lt;/tbody&gt;
    &lt;/table&gt;
  `;
  document.getElementById(&#x27;log&#x27;).innerHTML = logLines.join(&#x27;&lt;br&gt;&#x27;);
  console.log(logLines.join(&#x27;\\n&#x27;));
}

function clearResults() {
  document.getElementById(&#x27;results&#x27;).innerHTML = &#x27;&#x27;;
  document.getElementById(&#x27;log&#x27;).innerHTML = &#x27;&lt;p&gt;Cleared.&lt;/p&gt;&#x27;;
  console.log(&#x27;Results cleared.&#x27;);
}