// Convertible Bond New Model Demo - JS (pricing logic)

function straightBondValue(face, couponRate, maturity, yieldRate){
  const coupon = face * couponRate;
  let pv = 0;
  for(let t=1; t<=maturity; t++){
    pv += coupon / Math.pow(1+yieldRate, t);
  }
  pv += face / Math.pow(1+yieldRate, maturity);
  return pv;
}

function conversionValue(stockPrice, conversionRatio){
  return stockPrice * conversionRatio;
}

function convertibleValue(face, couponRate, maturity, yieldRate, stockPrice, conversionRatio, vol, rfRate, divYield){
  const straight = straightBondValue(face, couponRate, maturity, yieldRate);
  const convValue = conversionValue(stockPrice, conversionRatio);
  const optionValue = Math.max(0, stockPrice * conversionRatio - face);
  return straight + Math.max(0, optionValue - Math.max(0, convValue - straight));
}

function updatePricing(){
  const face = parseFloat(document.getElementById('face').value) || 1000;
  const couponRate = parseFloat(document.getElementById('coupon').value) / 100;
  const maturity = parseFloat(document.getElementById('maturity').value) || 5;
  const yieldRate = parseFloat(document.getElementById('yield').value) / 100;
  const stockPrice = parseFloat(document.getElementById('stock').value) || 50;
  const convRatio = parseFloat(document.getElementById('ratio').value) || 20;
  const vol = parseFloat(document.getElementById('vol').value) / 100;
  const rf = parseFloat(document.getElementById('rf').value) / 100;
  const divY = parseFloat(document.getElementById('div').value) / 100;

  const straightVal = straightBondValue(face, couponRate, maturity, yieldRate);
  const convVal = conversionValue(stockPrice, convRatio);
  const convPrice = convertibleValue(face, couponRate, maturity, yieldRate, stockPrice, convRatio, vol, rf, divY);

  document.getElementById('straight').textContent = '$' + straightVal.toFixed(2);
  document.getElementById('conversion').textContent = '$' + convVal.toFixed(2);
  document.getElementById('premiumStraight').textContent = ((convPrice - straightVal) / straightVal * 100).toFixed(1) + '%';
  document.getElementById('premiumConv').textContent = ((convPrice - convVal) / convVal * 100).toFixed(1) + '%';
  document.getElementById('convPrice').textContent = '$' + convPrice.toFixed(2);

  // Basic chart placeholder
  drawChart(stockPrice);
}

function drawChart(currentStock){
  const canvas = document.getElementById('priceChart');
  const ctx = canvas.getContext('2d');
  canvas.width = canvas.offsetWidth;
  canvas.height = 260;

  const face = parseFloat(document.getElementById('face').value) || 1000;
  const couponRate = parseFloat(document.getElementById('coupon').value) / 100;
  const maturity = parseFloat(document.getElementById('maturity').value) || 5;
  const yieldRate = parseFloat(document.getElementById('yield').value) / 100;
  const convRatio = parseFloat(document.getElementById('ratio').value) || 20;
  const vol = parseFloat(document.getElementById('vol').value) / 100;
  const rf = parseFloat(document.getElementById('rf').value) / 100;
  const divY = parseFloat(document.getElementById('div').value) / 100;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  // grid
  ctx.strokeStyle = '#e9ecef';
  for(let i=0;i<=5;i++){
    const y = canvas.height * (1 - i/5);
    ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(canvas.width,y); ctx.stroke();
  }
  // Straight line (simplified)
  const straight = straightBondValue(face, couponRate, maturity, yieldRate);
  ctx.strokeStyle = '#6c757d';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, canvas.height * 0.8);
  for(let i=0;i<=100;i++){
    ctx.lineTo(canvas.width * i/100, canvas.height * (0.8));
  }
  ctx.stroke();
  // Conversion line
  ctx.strokeStyle = '#007bff';
  ctx.lineWidth = 2;
  ctx.setLineDash([5,5]);
  ctx.beginPath();
  for(let i=0;i<=100;i++){
    const s = currentStock * i/100;
    const yNorm = (s * convRatio) / (currentStock * convRatio);
    ctx.lineTo(canvas.width * i/100, canvas.height * (1 - yNorm));
  }
  ctx.stroke();
  ctx.setLineDash([]);
  // Convertible price curve (rough)
  ctx.strokeStyle = '#28a745';
  ctx.lineWidth = 3;
  ctx.beginPath();
  for(let i=0;i<=100;i++){
    const s = currentStock * i/100;
    const cv = convertibleValue(face, couponRate, maturity, yieldRate, s, convRatio, vol, rf, divY);
    const yNorm = cv / (currentStock * convRatio);
    ctx.lineTo(canvas.width * i/100, canvas.height * (1 - yNorm));
  }
  ctx.stroke();
  // Current point
  const currY = canvas.height * (1 - convertibleValue(face, couponRate, maturity, yieldRate, currentStock, convRatio, vol, rf, divY) / (currentStock * convRatio));
  ctx.fillStyle = '#ff6b6b';
  ctx.beginPath();
  ctx.arc((currentStock / (currentStock*2)) * canvas.width, currY, 6, 0, 2*Math.PI); ctx.fill();
}

document.addEventListener('DOMContentLoaded', () => {
  const inputs = document.querySelectorAll('input');
  inputs.forEach(i => i.addEventListener('input', updatePricing));
  updatePricing();
});