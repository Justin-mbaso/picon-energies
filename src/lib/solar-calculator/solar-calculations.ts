import type { Catalog, Product, CompatibilityStatus } from "../solar-catalog/types";
import { isCurrent, priceBillOfMaterials } from "../solar-catalog/pricing";
import { DEFAULT_ASSUMPTIONS } from "./solar-config";
import { SIZING_POLICY, startingEstimate, systemEnergy, type EnergyCalculation } from "./sizing-policy";

export type Appliance = { id: string; name: string; quantity: number; watts: number; hours: number; startingW: number | null; powerFactor?: number };
export type Assumptions = typeof DEFAULT_ASSUMPTIONS & { simultaneousStarts?: boolean };
export type Generator = { fuel: "petrol" | "diesel"; pricePerLitre: number; litresPerHour: number; hoursPerDay: number };
export type Check = { status: CompatibilityStatus; reasons: string[] };
export function parseNumber(value: string): number {
  return /^(?:\d+(?:\.\d*)?|\.\d+)$/.test(value.trim()) ? Number(value) : NaN;
}
const positive = (n: number) => Number.isFinite(n) && n > 0;
export function validateInputs(loads: Appliance[], a: Assumptions, gen?: Generator): string[] {
  const errors: string[] = [];
  if (!loads.length) errors.push("Choose at least one appliance.");
  if (loads.length > 100 || new Set(loads.map((l) => l.id)).size !== loads.length) errors.push("Use up to 100 distinct appliance rows.");
  for (const l of loads) {
    if (!l.name.trim() || l.name.length > 100) errors.push("Every appliance needs a name of up to 100 characters.");
    if (!Number.isInteger(l.quantity) || l.quantity < 1 || l.quantity > 999) errors.push(`${l.name || "Appliance"}: quantity must be a whole number from 1 to 999.`);
    if (!positive(l.watts) || l.watts > 100_000) errors.push(`${l.name}: watts must be greater than zero and at most 100,000.`);
    if (!positive(l.hours) || l.hours > 24) errors.push(`${l.name}: hours must be greater than zero and at most 24.`);
    if (l.startingW !== null && (!positive(l.startingW) || l.startingW < l.watts)) errors.push(`${l.name}: starting watts must be at least running watts, or left unknown.`);
    if (l.powerFactor !== undefined && (!positive(l.powerFactor) || l.powerFactor > 1)) errors.push(`${l.name}: power factor must be greater than zero and at most 1.`);
  }
  if (!positive(a.backupHours) || a.backupHours > 24) errors.push("Backup duration must be greater than zero and at most 24 hours.");
  if (!positive(a.peakSunHours) || a.peakSunHours > 12) errors.push("Peak sun hours must be greater than zero and at most 12.");
  if (!positive(a.pvPerformance) || a.pvPerformance > 1 || !positive(a.powerFactor) || a.powerFactor > 1) errors.push("Performance ratio and power factor must be greater than zero and at most 1.");
  if (!Number.isFinite(a.headroom) || a.headroom < SIZING_POLICY.powerHeadroom || a.headroom > 1) errors.push("Inverter headroom must be at least 25% and at most 100%.");
  if (a.simultaneousStarts !== undefined && typeof a.simultaneousStarts !== "boolean") errors.push("Simultaneous starting preference must be true or false.");
  if (!Number.isFinite(a.coldC) || !Number.isFinite(a.hotCellC) || a.coldC < -40 || a.coldC > 25 || a.hotCellC < 25 || a.hotCellC > 100 || !positive(a.surgeSeconds)) errors.push("Check the site temperatures and starting-surge duration.");
  if (gen && (!["petrol", "diesel"].includes(gen.fuel) || [gen.pricePerLitre, gen.litresPerHour, gen.hoursPerDay].some((n) => !Number.isFinite(n) || n < 0) || gen.hoursPerDay > 24)) errors.push("Enter valid non-negative fuel values and generator runtime from 0 to 24 hours.");
  return errors;
}
export function loadModel(loads: Appliance[], a: Assumptions) {
  const errors = validateInputs(loads, a);
  if (errors.length) throw new Error(errors.join(" "));
  const peakW = loads.reduce((s, l) => s + l.quantity * l.watts, 0);
  const dailyWh = loads.reduce((s, l) => s + l.quantity * l.watts * l.hours, 0);
  const backupWh = loads.reduce((s, l) => s + l.quantity * l.watts * Math.min(l.hours, a.backupHours), 0);
  const startingEvidence = loads.map(startingEstimate);
  const runningVA = loads.reduce((sum, l) => sum + l.quantity * l.watts / (l.powerFactor ?? a.powerFactor), 0);
  const startsKnown = startingEvidence.every((s) => s.watts !== null);
  const increment = (index: number) => startingEvidence[index].watts! - loads[index].watts;
  const startingW = !startsKnown ? null : a.simultaneousStarts ? loads.reduce((sum, l, i) => sum + l.quantity * startingEvidence[i].watts!, 0) : peakW + Math.max(0, ...loads.map((_, i) => increment(i)));
  const startingVA = !startsKnown ? null : a.simultaneousStarts ? loads.reduce((sum, l, i) => sum + l.quantity * startingEvidence[i].watts! / (l.powerFactor ?? a.powerFactor), 0) : runningVA + Math.max(0, ...loads.map((l, i) => increment(i) / (l.powerFactor ?? a.powerFactor)));
  return { peakW, dailyWh, backupWh, minimumInverterW: peakW * (1 + a.headroom),
    minimumVA: runningVA * (1 + a.headroom), startingW, startingVA, startingEvidence,
    pvW: dailyWh / (a.peakSunHours * a.pvPerformance) };
}
export function monthlyFuelCost(g: Generator) {
  if ([g.pricePerLitre, g.litresPerHour, g.hoursPerDay].some((n) => !Number.isFinite(n) || n < 0) || g.hoursPerDay > 24 || !["petrol", "diesel"].includes(g.fuel)) throw new Error("Invalid generator inputs.");
  const cost = g.pricePerLitre * g.litresPerHour * g.hoursPerDay * 30;
  if (!Number.isFinite(cost) || cost > Number.MAX_SAFE_INTEGER) throw new Error("Generator inputs are too large.");
  return cost;
}
type Inverter = Extract<Product, { kind: "inverter" }>;
type Battery = Extract<Product, { kind: "battery" }>;
type Panel = Extract<Product, { kind: "panel" }>;
type Portable = Extract<Product, { kind: "portable" }>;
function verdict(failures: string[], missing: string[]): Check {
  return { status: failures.length ? "incompatible" : missing.length ? "insufficient_information" : "verified", reasons: [...failures, ...missing] };
}
export function checkInverter(inv: Inverter, model: ReturnType<typeof loadModel>, a: Assumptions): Check {
  const s = inv.specs, fail: string[] = [], missing = [...inv.issues];
  if (s.continuousW === null) missing.push("Continuous output is undocumented.");
  else if (s.continuousW < model.minimumInverterW) fail.push("Continuous output is below the running load plus headroom.");
  if (s.apparentVA !== null && s.apparentVA < model.minimumVA) fail.push("Apparent output is below the load at the selected power factor.");
  if (s.phase === null) missing.push("Phase configuration is undocumented.");
  else if (s.phase !== 1) fail.push("This calculator models a single-phase supply; three-phase designs need assessment.");
  if (model.startingW === null) missing.push("Confirm starting watts for every load, including motors and compressors.");
  else {
    if (s.continuousW !== null && model.startingW > s.continuousW) {
      if (!s.surgeW || !s.surgeSeconds) missing.push("Starting surge W rating and duration are undocumented; VA cannot substitute for W.");
      else if (model.startingW > s.surgeW || a.surgeSeconds > s.surgeSeconds) fail.push("Starting surge exceeds the documented W rating or duration.");
    }
    if (s.apparentVA !== null && model.startingVA !== null && model.startingVA > s.apparentVA) {
      if (!s.surgeVA || !s.surgeSeconds) missing.push("Starting apparent-power overload and duration need confirmation.");
      else if (model.startingVA > s.surgeVA || a.surgeSeconds > s.surgeSeconds) fail.push("Starting apparent power exceeds the documented VA overload or duration.");
    }
  }
  return verdict(fail, missing);
}
export function batteryQuantity(inv: Inverter, battery: Battery, m: ReturnType<typeof loadModel>) {
  const s = battery.specs, i = inv.specs;
  if (!s.usableWh || !i.efficiency || !s.dischargeA || !s.minV) return null;
  const outputW=s.continuousW ?? s.dischargeA*s.minV;
  return Math.max(1, Math.ceil(m.backupWh / (s.usableWh * i.efficiency)),
    Math.ceil(m.peakW / (s.dischargeA * s.minV * i.efficiency)), Math.ceil(m.peakW / (outputW * i.efficiency)));
}
export function checkBattery(c: Catalog, inv: Inverter, b: Battery, quantity: number | null, m: ReturnType<typeof loadModel>, energy?: EnergyCalculation): Check {
  const i = energy ? { ...inv.specs, efficiency: energy.efficiency } : inv.specs;
  const s = energy && quantity ? { ...b.specs, usableWh: energy.usableAcWh !== null && i.efficiency ? energy.usableAcWh / quantity / i.efficiency : null } : b.specs;
  const fail: string[] = [], missing = [...b.issues];
  const outputW=s.continuousW ?? (s.dischargeA && s.minV ? s.dischargeA*s.minV : null);
  if(!s.usableWh || !i.efficiency || !s.dischargeA || !s.minV) missing.push("Usable battery energy, minimum voltage, current or conversion efficiency is undocumented.");
  if (quantity === null || !Number.isInteger(quantity) || quantity < 1) missing.push("Battery quantity cannot be verified without usable energy, output current, voltage and conversion efficiency.");
  if ([i.batteryV, i.batteryMinV, i.batteryMaxV, s.nominalV, s.minV, s.maxV].some((v) => v === null)) missing.push("Battery and inverter voltage limits need confirmation.");
  else if (i.batteryV !== s.nominalV && !(i.batteryV === 48 && s.nominalV === 51.2) || s.minV! < i.batteryMinV! || s.maxV! > i.batteryMaxV!) fail.push("Battery voltage falls outside inverter limits.");
  if (s.parallelMax === null) missing.push("Permitted parallel configuration is undocumented.");
  else if (quantity !== null && quantity > s.parallelMax) fail.push("Required battery count exceeds the documented parallel limit.");
  const pairing=c.approvedPairs.find((p) => p.inverterId === inv.id && p.batteryId === b.id);
  if (!pairing) missing.push("Documented inverter / battery / BMS pairing is not available.");
  if (!s.chemistry || !i.communication || !s.communication || !s.compatibleInverters) missing.push("Battery chemistry, communications and compatible inverter evidence need confirmation.");
  else if (!i.communication.some((v) => s.communication!.includes(v)) || !s.compatibleInverters.includes(inv.model) || i.chemistry && !i.chemistry.includes(s.chemistry)) fail.push("Chemistry, BMS protocol or compatible model does not match.");
  else if (!i.chemistry && pairing?.evidenceType !== "supplier_listing") missing.push("Inverter battery chemistry support is not established by manufacturer evidence or an exact supplier pairing.");
  if (!i.maxDischargeA || !i.efficiency || !i.batteryMinV || !i.maxChargeA || !s.chargeA) missing.push("Charging and inverter battery-current limits need confirmation.");
  else if (m.peakW / (i.batteryMinV * i.efficiency) > i.maxDischargeA || (quantity !== null && i.maxChargeA > quantity * s.chargeA)) fail.push("Battery discharge demand or configured charging current exceeds a limit.");
  if (quantity !== null && s.usableWh && i.efficiency && s.minV && s.dischargeA && outputW && (quantity * s.usableWh * i.efficiency < m.backupWh || quantity * Math.min(s.dischargeA * s.minV, outputW) * i.efficiency < m.peakW)) fail.push("Battery energy or continuous output is inadequate.");
  if (m.startingW !== null && quantity !== null && s.minV && s.dischargeA && outputW && i.efficiency && m.startingW <= quantity * Math.min(s.dischargeA*s.minV,outputW)*i.efficiency) { /* Continuous battery output covers this declared start. */ }
  else if (m.startingW === null || !s.peakDischargeA || !s.peakSeconds || !s.minV || !i.efficiency) missing.push("Battery starting-current capability and duration need confirmation.");
  else if (quantity !== null && m.startingW > quantity * s.peakDischargeA * s.minV * i.efficiency) fail.push("Battery starting-current capability is inadequate.");
  return verdict(fail, missing);
}
export function pvConfiguration(inv: Inverter, panel: Panel, requiredW: number, a: Assumptions): Check & { quantity: number | null; series: number | null; parallel: number | null } {
  const s = panel.specs, i = inv.specs;
  const missing = [...panel.issues];
  const fields = [s.watts,s.voc,s.vmp,s.isc,s.imp,s.vocTolerance,s.vocTempCoefficient,s.vmpTempCoefficient,s.maxSystemV,i.maxPvW,i.maxPvV,i.mpptMinV,i.mpptMaxV,i.startV,i.mpptCount];
  if (fields.some((v) => v === null) || !i.inputA || !i.shortCircuitA) missing.push("PV voltage/current, temperature coefficients, tolerances or MPPT limits are incomplete.");
  if (missing.length) return { status: "insufficient_information", reasons: missing, quantity: s.watts ? Math.max(1, Math.ceil(requiredW / s.watts)) : null, series: null, parallel: null };
  const coldVoc = s.voc! * (1 + s.vocTolerance!) * (1 + s.vocTempCoefficient! * (a.coldC - 25));
  const hotVmp = s.vmp! * (1 + s.vmpTempCoefficient! * (a.hotCellC - 25));
  const coldVmp = s.vmp! * (1 + s.vmpTempCoefficient! * (a.coldC - 25));
  const maxSeries = Math.floor(Math.min(i.maxPvV!,s.maxSystemV!) / coldVoc);
  let best: { quantity: number; series: number; parallel: number } | null = null;
  // Identical strings on every MPPT; no unsupported unequal-string assumption.
  for (let series = 1; series <= Math.min(maxSeries, 200); series++) {
    if (series * hotVmp < i.mpptMinV! || series * coldVmp > i.mpptMaxV! || series * s.voc! < i.startV!) continue;
    const maxParallel = Math.floor(Math.min(...i.inputA!) / s.imp!);
    for (let parallel = 1; parallel <= Math.min(maxParallel, 100); parallel++) {
      const quantity = series * parallel * i.mpptCount!;
      if (Math.min(...i.shortCircuitA!) < parallel * s.isc! * SIZING_POLICY.pvShortCircuitFactor || quantity * s.watts! > i.maxPvW! || quantity * s.watts! < requiredW) continue;
      if (!best || quantity < best.quantity) best = { quantity, series, parallel };
    }
  }
  return best ? { ...best, status: "verified", reasons: [] } : { status: "incompatible", reasons: ["No equal-string configuration satisfies the PV power, temperature-corrected voltage and current limits."], quantity: null, series: null, parallel: null };
}
export function checkPortable(p: Portable | Extract<Product, {kind:"compact"}>, m: ReturnType<typeof loadModel>, a: Assumptions, solarCharging = false, energy?: EnergyCalculation): Check {
  const s = p.specs, fail: string[] = [], missing: string[] = [];
  const ac = energy ?? systemEnergy(p, { id: "unit-screen", category: p.kind, verification: "review_required", documentation: [], reviewNotes: [], components: [{ role: "unit", productId: p.id, quantity: 1 }], pv: null, chargingA: null, bmsProtocol: null, solarIncluded: false, requiredEquipmentComplete: true }, { ...m, backupHours: a.backupHours, powerFactor: a.powerFactor });
  const continuous = s.batteryModeMinimumW ?? s.continuousW;
  if (continuous === null) missing.push("Continuous AC output is undocumented.");
  else if (continuous < m.minimumInverterW) fail.push("Continuous AC output is below running load plus headroom.");
  if (ac.usableAcWh === null) missing.push(...ac.reasons);
  else if (ac.usableAcWh < m.backupWh) fail.push("Usable AC energy is below the requested backup energy.");
  if (s.apparentVA != null && s.apparentVA < m.minimumVA) fail.push("Apparent output is below the load at the selected power factor.");
  if (m.startingW === null) missing.push("Confirm appliance type or explicit starting watts for unrecognised loads.");
  else if (continuous !== null && m.startingW > continuous) {
    if (s.surgeW == null || s.surgeSeconds == null) missing.push("Starting surge W rating and duration are missing; VA is not a surge W rating.");
    if (s.surgeW != null && s.surgeW < m.startingW || s.surgeSeconds != null && s.surgeSeconds < a.surgeSeconds) fail.push("Starting demand exceeds documented surge W or duration.");
  }
  if (s.apparentVA != null && m.startingVA !== null && m.startingVA > s.apparentVA) {
    if (s.surgeVA == null || s.surgeSeconds == null) missing.push("Starting VA overload and duration are undocumented.");
    if (s.surgeVA != null && m.startingVA > s.surgeVA || s.surgeSeconds != null && s.surgeSeconds < a.surgeSeconds) fail.push("Starting apparent power exceeds the documented VA overload or duration.");
  }
  if (solarCharging && (!s.solarMaxW || !s.solarMinV || !s.solarMaxV || !s.solarMaxA)) missing.push("Portable solar charging limits need confirmation.");
  if (!s.charging) missing.push("Supported charging method needs confirmation.");
  return verdict(fail, missing);
}
export function calculateSolar(c: Catalog, loads: Appliance[], a: Assumptions, now = new Date()) {
  const model = loadModel(loads, a);
  const available = (p: Product) => c.offers.some((o) => o.productId === p.id && o.identity === "verified" && o.condition === "new" && o.stock === "in_stock" && isCurrent(o,now));
  const inverters = c.products.filter((p): p is Inverter => p.kind === "inverter" && available(p)).map((p) => ({ product: p, check: checkInverter(p, model, a) }));
  const batteries = c.products.filter((p): p is Battery => p.kind === "battery" && available(p));
  const panels = c.products.filter((p): p is Panel => p.kind === "panel" && available(p));
  const systems = inverters.flatMap(({ product: inv, check }) => batteries.flatMap((b) => panels.map((p) => {
    const quantity = batteryQuantity(inv,b,model), battery = checkBattery(c,inv,b,quantity,model), pv = pvConfiguration(inv,p,model.pvW,a);
    if (b.specs.peakSeconds !== null && b.specs.peakSeconds < a.surgeSeconds) { battery.status = "incompatible"; battery.reasons.push("Battery starting-current duration is inadequate."); }
    const checks = [check,battery,pv];
    const status: CompatibilityStatus = checks.some((x) => x.status === "incompatible") ? "incompatible" : checks.every((x) => x.status === "verified") ? "verified" : "insufficient_information";
    const bom = quantity !== null && pv.quantity !== null ? [{ productId: inv.id, quantity: 1 }, { productId: b.id, quantity }, { productId: p.id, quantity: pv.quantity }] : [];
    return { inverter: inv, battery: b, panel: p, batteryQuantity: quantity, pv, status, reasons: [...new Set(checks.flatMap((x) => x.reasons))], price: status === "verified" ? priceBillOfMaterials(c,bom,now) : null };
  })));
  const portable = c.products.filter((p): p is Portable => p.kind === "portable" && available(p)).map((product) => ({ product, check: checkPortable(product,model,a) }));
  return { model, inverters, systems, portable, verifiedSystems: systems.filter((s) => s.status === "verified") };
}
