import type { Product } from "../solar-catalog/types";
import type { SystemConfiguration } from "./recommendation-types";

export const SIZING_POLICY = {
  id: "picon-solar-sizing-v1.0",
  powerHeadroom: 0.25, powerFactor: 0.8, surgeSeconds: 3,
  peakSunHours: 4.5, pvPerformance: 0.75, pvShortCircuitFactor: 1.25,
  energy: { lifepo4: { depthOfDischarge: 0.70, efficiency: 0.85 }, leadAcid: { depthOfDischarge: 0.50, efficiency: 0.85 } },
  starting: { ordinary: 1, fan: 2, refrigeration: 3, washing: 3, pump: 5, airConditioner: 5, inverterAirConditioner: 2 },
  ranking: { power: 0.45, energy: 0.45, price: 0.10, estimatedPenalty: 0.05 },
};
export type EnergyBasis = "manufacturer" | "picon_measured" | "picon_estimate" | "unknown";
export type EnergyCalculation = {
  usableAcWh: number | null; nominalWh: number | null; basis: EnergyBasis; policyId: string;
  depthOfDischarge: number | null; efficiency: number | null; efficiencyBasis: string | null;
  sources: string[]; assumptions: string[]; reasons: string[];
};
export function manufacturerUrl(url: string) {
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    return u.protocol === "https:" && (
      host === "itel-life.com" || host.endsWith(".itel-life.com") || host === "transsion-platform01.oss-accelerate.aliyuncs.com" ||
      host === "deyeinverter.com" || host.endsWith(".deyeinverter.com") ||
      host === "jinkosolar.com" || host.endsWith(".jinkosolar.com") || host === "jinkosolar.us" || host.endsWith(".jinkosolar.us") || host === "jinkosolarcdn.shwebspace.com"
    );
  } catch { return false; }
}
export function documented(product: Product, field: string) {
  return product.technicalEvidence?.some((e) => manufacturerUrl(e.url) && !!e.revision && e.fields.includes(field)) ?? false;
}
const positive = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n) && n > 0;
export function estimatedAcEnergy(nominalWh: number, chemistry: string, typicalEfficiency?: number | null) {
  const name = chemistry.toLowerCase().replaceAll("₄", "4").replace(/[^a-z0-9]/g, "");
  const factors = name === "lifepo4" || name === "lithiumironphosphate" ? SIZING_POLICY.energy.lifepo4 : name === "leadacid" ? SIZING_POLICY.energy.leadAcid : null;
  if (!factors || !positive(nominalWh) || typicalEfficiency != null && (!positive(typicalEfficiency) || typicalEfficiency > 1)) return null;
  const efficiency = typicalEfficiency ?? factors.efficiency;
  return { usableAcWh: nominalWh * factors.depthOfDischarge * efficiency, depthOfDischarge: factors.depthOfDischarge, efficiency };
}
export function runtimeHours(usableAcWh: number | null, backupWh: number, backupHours: number) {
  if (!positive(usableAcWh) || !positive(backupWh) || !positive(backupHours)) return null;
  const hours = usableAcWh / (backupWh / backupHours);
  return Number.isFinite(hours) && hours > 0 ? hours : null;
}
export function startingEstimate(load: { id: string; name: string; watts: number; startingW: number | null }) {
  if (load.startingW !== null) return { id: load.id, watts: load.startingW, basis: "explicit_input" as const, type: "explicit", multiplier: null, policyId: null };
  const name = `${load.id} ${load.name}`.toLowerCase();
  const ac = /air.?condition|aircon|\bac\d?\b/.test(name);
  const type = ac && /inverter/.test(name) ? "inverterAirConditioner" : ac ? "airConditioner" : /pump|borehole/.test(name) ? "pump" : /wash/.test(name) ? "washing" : /fridg|freez|refrigerat/.test(name) ? "refrigeration" : /fan/.test(name) ? "fan" : /light|led|bulb|lamp|tv|television|router|wi.?fi|modem|laptop|desktop|computer|phone|charg|cctv|camera|heat|kettle|iron|microwave|rice cooker|oven|toaster|decoder|speaker|radio|monitor/.test(name) ? "ordinary" : null;
  const multiplier = type ? SIZING_POLICY.starting[type] : null;
  return { id: load.id, watts: multiplier ? load.watts * multiplier : null, basis: multiplier ? "picon_estimate" as const : "unknown" as const, type: type ?? "unknown", multiplier, policyId: SIZING_POLICY.id };
}
export function systemEnergy(product: Product, configuration: SystemConfiguration, demand: { peakW: number; backupWh: number; backupHours: number; powerFactor: number }, inverter?: Product): EnergyCalculation {
  const result: EnergyCalculation = { usableAcWh: null, nominalWh: null, basis: "unknown", policyId: SIZING_POLICY.id, depthOfDischarge: null, efficiency: null, efficiencyBasis: null, sources: [], assumptions: [], reasons: [] };
  const full = configuration.category === "full";
  const part = configuration.components.find((p) => p.role === (full ? "battery" : "unit") && p.productId === product.id);
  if (!part || !full && part.quantity !== 1) { result.reasons.push("Exact fixed battery quantity / configuration is not available for this energy calculation."); return result; }
  const s = product.specs;
  const nominal = "nominalWh" in s && positive(s.nominalWh) && documented(product, "nominalWh") ? s.nominalWh : product.kind === "battery" && positive(product.specs.nominalV) && positive(product.specs.ah) && documented(product, "nominalV") && documented(product, "ah") ? product.specs.nominalV * product.specs.ah : null;
  result.nominalWh = nominal === null ? null : nominal * part.quantity;
  const efficiencyProduct = full ? inverter : product;
  const typical = efficiencyProduct && "typicalEfficiency" in efficiencyProduct.specs && documented(efficiencyProduct, "typicalEfficiency") ? efficiencyProduct.specs.typicalEfficiency : null;
  const chemistry = "chemistry" in s && typeof s.chemistry === "string" && documented(product, "chemistry") ? s.chemistry : "unknown";
  const documentedUsableBatteryWh = !full && "usableBatteryWh" in s && positive(s.usableBatteryWh) && documented(product, "usableBatteryWh") ? s.usableBatteryWh * part.quantity : null;
  // Manufacturer-stated usable DC battery energy has already had the battery's
  // usable window applied. Apply only the planning DC-to-AC conversion allowance.
  const dcToAcEstimate = documentedUsableBatteryWh !== null && typical == null
    ? documentedUsableBatteryWh * SIZING_POLICY.energy.lifepo4.efficiency
    : documentedUsableBatteryWh !== null && typical != null
      ? documentedUsableBatteryWh * typical
      : null;
  const fallback = result.nominalWh === null ? null : estimatedAcEnergy(result.nominalWh, chemistry, typical);
  const records = (product.energyEvidence ?? []).filter((e) => e.configurationId === (full ? configuration.id : undefined) && positive(e.usableAcWh) && !!e.source.revision && (result.nominalWh === null || e.usableAcWh <= result.nominalWh) && e.scope.minLoadW <= demand.backupWh / demand.backupHours && e.scope.maxLoadW >= demand.peakW && e.scope.minPowerFactor <= demand.powerFactor && (e.kind === "manufacturer" ? manufacturerUrl(e.source.url) : !!e.approval?.reviewer && Number.isFinite(Date.parse(e.approval.approvedAt))));
  const manufacturerRecord = records.find((e) => e.kind === "manufacturer");
  const measuredRecord = records.find((e) => e.kind === "picon_measured");
  if (manufacturerRecord) {
    result.usableAcWh = manufacturerRecord.usableAcWh; result.basis = "manufacturer"; result.sources = [manufacturerRecord.source.url];
  } else if (!full && "usableAcWh" in s && positive(s.usableAcWh) && documented(product, "usableAcWh") && (result.nominalWh === null || s.usableAcWh <= result.nominalWh)) {
    result.usableAcWh = s.usableAcWh; result.basis = "manufacturer";
    result.sources = product.technicalEvidence!.filter((e) => e.fields.includes("usableAcWh")).map((e) => e.url);
  } else if (measuredRecord) {
    result.usableAcWh = measuredRecord.usableAcWh; result.basis = "picon_measured"; result.sources = [measuredRecord.source.url];
  } else if (dcToAcEstimate !== null) {
    result.usableAcWh = dcToAcEstimate; result.basis = "picon_estimate";
    result.efficiency = typical ?? SIZING_POLICY.energy.lifepo4.efficiency;
    result.depthOfDischarge = null;
    result.efficiencyBasis = typical ? "manufacturer_load_relevant" : "picon_conversion_fallback";
    result.assumptions = ["Manufacturer usable battery energy is DC; a Picon planning conversion is applied once to estimate AC energy.", "Runtime uses the selected average backup load; load profile, temperature and battery condition can change actual runtime."];
    result.sources = product.technicalEvidence!.filter((e) => e.fields.includes("usableBatteryWh")).map((e) => e.url);
  } else if (fallback) {
    Object.assign(result, fallback); result.basis = "picon_estimate";
    result.assumptions = ["Nominal energy reduced once by the Picon chemistry-specific planning DoD and DC-to-AC efficiency.", "Runtime uses the selected average backup load; load profile, temperature and battery condition can change actual runtime."];
    result.sources = product.technicalEvidence!.filter((e) => e.fields.some((f) => ["nominalWh", "nominalV", "ah", "chemistry"].includes(f))).map((e) => e.url);
  } else result.reasons.push("Neither applicable usable AC energy evidence nor documented nominal battery energy and an approved chemistry policy is available.");
  if (result.efficiency === null) result.efficiency = result.basis === "picon_estimate" ? fallback?.efficiency ?? typical ?? null : typical ?? null;
  if (result.efficiencyBasis === null) result.efficiencyBasis = result.basis === "picon_estimate" ? typical != null ? "manufacturer_load_relevant" : fallback ? "picon_conversion_fallback" : null : typical != null ? "manufacturer_load_relevant" : null;
  return result;
}
