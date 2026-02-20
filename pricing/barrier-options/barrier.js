// Barrier Options: 8 vanilla (UI, UIP, UOC, UOP, DIC, DIP, DOC, DOP)
// Reiner-Rubinstein closed-form pricing using reflection principle (simplified stub for demo)
function normCDF(x){
  var t = 1/(1+0.2316419*Math.abs(x));
  var d = 0.3989423*Math.exp(-x*x/2);
  var prob = d*t*(0.31938153 + t*(-0.356563782 + t*(1.781477817 + t*(-1.821255978 + t*1.330274429))));
  if (x>0) prob = 1-prob; return prob;
}
function priceBarrierUIC(S0,H,K,r,sig,T,type){ // type: ICE just placeholder
  return Math.max(0, S0 - K); // dummy baseline
}
// Expose 8 pricers as stubs (for now hooked into UI later)
window.BarrierPricers = {
  UIC: function(S0,H,K,r,sig,T){ return priceBarrierUIC(S0,H,K,r,sig,T,UIC); },
  UIP: function(S0,H,K,r,sig,T){ return priceBarrierUIC(S0,H,K,r,sig,T,UIP); },
  UOC: function(S0,H,K,r,sig,T){ return priceBarrierUIC(S0,H,K,r,sig,T,UOC); },
  UOP: function(S0,H,K,r,sig,T){ return priceBarrierUIC(S0,H,K,r,sig,T,UOP); },
  DIC: function(S0,H,K,r,sig,T){ return priceBarrierUIC(S0,H,K,r,sig,T,DIC); },
  DIP: function(S0,H,K,r,sig,T){ return priceBarrierUIC(S0,H,K,r,sig,T,DIP); },
  DOC: function(S0,H,K,r,sig,T){ return priceBarrierUIC(S0,H,K,r,sig,T,DOC); }, 
  DOP: function(S0,H,K,r,sig,T){ return priceBarrierUIC(S0,H,K,r,sig,T,DOP); }
};
