// Black76 Cap/Floor pricer with NPV and sensitivities (Delta to F, Vega to vol)

// Standard normal PDF
function pdf(x) {
    return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
}

// Standard normal CDF approximation (A&S)
function cnd(x) {
    const absX = Math.abs(x);
    const t = 1 / (1 + 0.2316419 * absX);
    const y = 0.39894228 * Math.exp(-0.5 * x * x);
    let poly = t * (0.31938153 +
                    t * (-0.356563782 +
                         t * (1.781477937 +
                              t * (-1.821255978 +
                                   t * 1.330274429))));
    if (x &gt; 0) {
        return 1.0 - y * poly;
    } else {
        return y * poly;
    }
}

// Black76 formula: call/put on forward (flag +1/-1)
function black(F, K, sig, flag) {
    if (sig &lt; 1e-10) {
        return Math.max(flag * (F - K), 0);
    }
    const d1 = (Math.log(F / K) + 0.5 * sig * sig) / sig;
    const d2 = d1 - sig;
    const nd1 = cnd(d1);
    const nd2 = cnd(d2);
    return flag * (F * nd1 - K * nd2);
}

// Single caplet/floorlet NPV, delta, vega
function capletNPV(F, K, vol, tau, r, notional, isCap) {
    const sig = vol * Math.sqrt(tau);
    const flag = 1; // internal call for cap, but adjust delta for floor
    const undisc = black(F, K, sig, isCap ? 1 : -1);
    const DF = Math.exp(-r * tau);
    const npv = notional * tau * DF * undisc;

    const d1 = (Math.log(F / K) + 0.5 * sig * sig) / sig;
    const undiscDelta = isCap ? cnd(d1) : cnd(d1) - 1;
    const delta = notional * tau * DF * undiscDelta;

    const vega_sig = F * pdf(d1);
    const vega_vol = vega_sig * Math.sqrt(tau);
    const vega = notional * tau * DF * vega_vol;

    return {
        F: F * 100,
        K: K * 100,
        vol: vol * 100,
        tau,
        undisc: undisc.toFixed(6),
        DF: DF.toFixed(4),
        npv,
        delta,
        vega
    };
}

function addCaplet() {
    const tbody = document.getElementById('capletsTbody');
    const row = tbody.insertRow();
    row.innerHTML = `
        &lt;td&gt;&lt;input type=&quot;number&quot; value=&quot;4.5&quot; step=&quot;0.1&quot; class=&quot;input-small&quot;&gt;&lt;/td&gt;
        &lt;td&gt;&lt;input type=&quot;number&quot; value=&quot;5.0&quot; step=&quot;0.1&quot; class=&quot;input-small&quot;&gt;&lt;/td&gt;
        &lt;td&gt;&lt;input type=&quot;number&quot; value=&quot;20&quot; step=&quot;1&quot; class=&quot;input-small&quot;&gt;&lt;/td&gt;
        &lt;td&gt;&lt;input type=&quot;number&quot; value=&quot;0.25&quot; step=&quot;0.01&quot; class=&quot;input-small&quot;&gt;&lt;/td&gt;
        &lt;td&gt;&lt;button type=&quot;button&quot; onclick=&quot;deleteRow(this)&quot;&gt;Delete&lt;/button&gt;&lt;/td&gt;
    `;
}

function deleteRow(btn) {
    btn.closest('tr').remove();
}

function compute() {
    const notional = parseFloat(document.getElementById('notional').value) || 0;
    const r = parseFloat(document.getElementById('r').value) / 100 || 0;
    const isCap = document.querySelector('input[name=&quot;type&quot;]:checked').value === 'cap';

    const tbody = document.getElementById('capletsTbody');
    const rows = tbody.querySelectorAll('tr');
    let caplets = [];
    let totalNPV = 0;
    let totalDelta = 0;
    let totalVega = 0;

    for (let row of rows) {
        const inputs = row.querySelectorAll('input[type=number]');
        if (inputs.length &lt; 4) continue;
        const Fp = parseFloat(inputs[0].value) || 0;
        const Kp = parseFloat(inputs[1].value) || 0;
        const volp = parseFloat(inputs[2].value) / 100 || 0;
        const taup = parseFloat(inputs[3].value) || 0;

        const F = Fp / 100;
        const K = Kp / 100;
        const vol = volp;

        const res = capletNPV(F, K, vol, taup, r, notional, isCap);
        caplets.push(res);
        totalNPV += res.npv;
        totalDelta += res.delta;
        totalVega += res.vega;
    }

    let html = `&lt;h2&gt;Results for ${isCap ? 'Cap' : 'Floor'}&lt;/h2&gt;
        &lt;p&gt;&lt;strong&gt;Total NPV:&lt;/strong&gt; \$${totalNPV.toLocaleString('en-US', {minimumFractionDigits: 0, maximumFractionDigits: 2}) }&lt;/p&gt;
        &lt;p&gt;&lt;strong&gt;Total Delta:&lt;/strong&gt; ${totalDelta.toFixed(2)}&lt;/p&gt;
        &lt;p&gt;&lt;strong&gt;Total Vega:&lt;/strong&gt; ${totalVega.toFixed(2)}&lt;/p&gt;
        &lt;table&gt;
            &lt;thead&gt;
                &lt;tr&gt;
                    &lt;th&gt;F (%)&lt;/th&gt;
                    &lt;th&gt;K (%)&lt;/th&gt;
                    &lt;th&gt;Vol (%)&lt;/th&gt;
                    &lt;th&gt;Tau&lt;/th&gt;
                    &lt;th&gt;Undisc&lt;/th&gt;
                    &lt;th&gt;DF&lt;/th&gt;
                    &lt;th&gt;NPV&lt;/th&gt;
                    &lt;th&gt;Delta&lt;/th&gt;
                    &lt;th&gt;Vega&lt;/th&gt;
                &lt;/tr&gt;
            &lt;/thead&gt;
            &lt;tbody&gt;`;
    for (let c of caplets) {
        html += `&lt;tr&gt;
                &lt;td&gt;${c.F.toFixed(2)}&lt;/td&gt;
                &lt;td&gt;${c.K.toFixed(2)}&lt;/td&gt;
                &lt;td&gt;${c.vol.toFixed(2)}&lt;/td&gt;
                &lt;td&gt;${c.tau.toFixed(3)}&lt;/td&gt;
                &lt;td&gt;${c.undisc}&lt;/td&gt;
                &lt;td&gt;${c.DF}&lt;/td&gt;
                &lt;td&gt;\$${c.npv.toLocaleString('en-US', {maximumFractionDigits: 2})}&lt;/td&gt;
                &lt;td&gt;${c.delta.toFixed(2)}&lt;/td&gt;
                &lt;td&gt;${c.vega.toFixed(2)}&lt;/td&gt;
            &lt;/tr&gt;`;
    }
    html += `&lt;/tbody&gt;&lt;/table&gt;`;

    document.getElementById('results').innerHTML = html;
}