export function screenBatteryEnergy(modules:number,moduleKwh:number,effectiveFraction:number,requiredAcKwh:number) {
  if (![modules,moduleKwh,effectiveFraction,requiredAcKwh].every(Number.isFinite) || modules<1 || moduleKwh<=0 || effectiveFraction<=0 || effectiveFraction>1 || requiredAcKwh<=0) throw new Error("Invalid battery energy screen inputs.");
  const nominalKwh=modules*moduleKwh;
  return {nominalKwh,usableAcKwh:nominalKwh*effectiveFraction,marginKwh:nominalKwh*effectiveFraction-requiredAcKwh,passesEnergy:nominalKwh*effectiveFraction>=requiredAcKwh};
}
export function screenBatteryPower(minV:number,currentA:number,efficiency:number,requestedW:number,inverterRatedW=Number.POSITIVE_INFINITY) {
  if (![minV,currentA,efficiency,requestedW,inverterRatedW].every((n)=>Number.isFinite(n)||n===Number.POSITIVE_INFINITY) || minV<=0 || currentA<=0 || efficiency<=0 || efficiency>1 || requestedW<=0 || inverterRatedW<=0) throw new Error("Invalid battery power screen inputs.");
  const availableW=Math.min(minV*currentA*efficiency,inverterRatedW);
  return {availableW,passes:requestedW<=availableW};
}
export function screenColdVoc(series:number,vocStc:number,betaVocPerC:number,minModuleTempC:number,positiveTolerance:number,absoluteLimitV:number) {
  if (![series,vocStc,betaVocPerC,minModuleTempC,positiveTolerance,absoluteLimitV].every(Number.isFinite)||series<1||vocStc<=0||minModuleTempC>25||positiveTolerance<0||absoluteLimitV<=0) throw new Error("Invalid PV voltage screen inputs.");
  const vocV=series*vocStc*(1+betaVocPerC*(minModuleTempC-25))*(1+positiveTolerance);
  return {vocV,passesAbsoluteLimit:vocV<absoluteLimitV};
}
export function screenPvCurrent(mpptLimitA:number,parallel:number,impA:number,iscLimitA:number,iscA:number,iscFactor:number) {
  if (![mpptLimitA,parallel,impA,iscLimitA,iscA,iscFactor].every(Number.isFinite)||mpptLimitA<=0||parallel<1||impA<=0||iscLimitA<=0||iscA<=0||iscFactor<=0) throw new Error("Invalid MPPT current screen inputs.");
  const operatingA=parallel*impA,shortCircuitA=parallel*iscA*iscFactor;
  return {operatingA,shortCircuitA,passes:operatingA<=mpptLimitA&&shortCircuitA<=iscLimitA};
}
export function screenPvArray(moduleW:number,count:number,inputLimitW:number,accessLimitW:number) {
  if (![moduleW,count,inputLimitW,accessLimitW].every(Number.isFinite)||moduleW<=0||count<1||inputLimitW<=0||accessLimitW<=0) throw new Error("Invalid PV array screen inputs.");
  const arrayW=moduleW*count;
  return {arrayW,oversizingReview:arrayW>inputLimitW&&arrayW<=accessLimitW,blocked:arrayW>accessLimitW};
}
export function screenPvYield(arrayKwp:number,modelledAcYield:number) {
  if (![arrayKwp,modelledAcYield].every(Number.isFinite)||arrayKwp<=0||modelledAcYield<=0) throw new Error("Invalid PV yield inputs.");
  return arrayKwp*modelledAcYield;
}
export function exactBatteryVoltageCompatible(nominalV:number,range:[number,number]) { return Number.isFinite(nominalV)&&nominalV>=range[0]&&nominalV<=range[1]; }
export function directPhaseCompatible(inverterPhase:number,sitePhase:number) { return inverterPhase===sitePhase; }
export function independentTrackersFit(mpptCount:number,trackers:number) { return Number.isInteger(mpptCount)&&Number.isInteger(trackers)&&mpptCount>=trackers; }
export function physicalStackFits(count:number,maxStack:number) { return Number.isInteger(count)&&Number.isInteger(maxStack)&&count<=maxStack; }
export function hasPairingEvidence(value:unknown) { return Array.isArray(value)&&value.length>0; }
export function quoteCurrent(validUntil:string,asOf:string) { return Number.isFinite(Date.parse(validUntil))&&Date.parse(validUntil)>=Date.parse(asOf); }
export function approvalSurvivesRevisionChange(changed:boolean,priorApproval:boolean) { return priorApproval&&!changed; }
