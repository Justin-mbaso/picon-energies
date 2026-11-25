import type { Catalog, Product, Supplier } from "./types";
import type { ConfigurationCatalog, SystemConfiguration } from "../solar-calculator/recommendation-types";

type Delta = typeof import("../../../picon_research/catalogue_delta.json");
const source = (delta: Delta, id: string) => delta.sources.find((item) => item.id === id);
const canonicalByResearchId: Record<string, string> = {
  "deye-6k-og": "deye-sun-6k-og01lp1-eu-am2", "deye-se-f5": "deye-se-f5",
  "jinko-585-f9-en": "jinko-jkm585n-72hl4-bdv", "itel-6k-pro": "itel-ipv-6k48u-pro",
  "itel-12ku": "itel-ipv-12k48u", "itel-8kl3": "itel-ihy-8kl3", "itel-ipw51100": "itel-ipw-51100-pk2",
  "itel-ipl51314h": "itel-ipl-51314h", "itel-ipl25200x": "itel-ipl-25200x",
};
const sourceEvidence = (delta: Delta, ids: string[]) => ids.flatMap((id) => {
  const item = source(delta, id);
  return item ? [{ url: item.url, note: `${item.title}; research observation ${item.accessed_on}.` }] : [];
});
const techEvidence = (delta: Delta, ids: string[], revision: string, fields: string[]) => ids.flatMap((id) => {
  const item = source(delta, id);
  return item && item.type === "manufacturer" ? [{ url: item.url, revision, fields, reviewedAt: `${item.accessed_on}T12:00:00.000Z` }] : [];
});
function addedProducts(delta: Delta): Product[] {
  const records: Product[] = [];
  const f2 = delta.products.find((p) => p.research_id === "jinko-585-f2-us")!;
  const f2s = f2.specifications;
  records.push({
    id: "jinko-jkm585n-72hl4-bdv-f2-us", model: f2.model, name: "585 W bifacial solar module (F2-US specification record)", manufacturer: "Jinko Solar", kind: "panel",
    researchIds: [f2.research_id], documentRevision: "F2-US", warranty: null, issues: [f2.notes, "F2-US is kept separate from the F9-EN specification; the datasheet revision does not identify the hardware revision. Voc tolerance and hot Vmp coefficient remain unknown."],
    evidence: sourceEvidence(delta, f2.source_ids),
    technicalEvidence: techEvidence(delta, f2.source_ids, "EAGLE 72 G6B, JKM565-585N-72HL4-BDV F2-US; retrieved 2026-11-24", ["watts", "voc", "vmp", "imp", "isc", "vocTempCoefficient", "iscTempCoefficient", "maxSystemV", "dimensionsMm", "technology"]),
    specs: { watts: f2s.pmax_w ?? null, voc: f2s.voc_v ?? null, vmp: f2s.vmp_v ?? null, isc: f2s.isc_a ?? null, imp: f2s.imp_a ?? null, vocTolerance: null, vocTempCoefficient: f2s.voc_temp_coefficient_per_c ?? null, vmpTempCoefficient: null, iscTempCoefficient: f2s.isc_temp_coefficient_per_c ?? null, maxSystemV: f2s.max_module_system_voltage_v ?? null, efficiency: null, dimensionsMm: f2s.dimensions_mm ?? null, technology: "N-type bifacial monocrystalline" },
  });
  for (const researchId of ["itel-8kt", "itel-6k6", "itel-12kl3"]) {
    const p = delta.products.find((item) => item.research_id === researchId)!; const s = p.specifications;
    const vRange = s.battery_voltage_range_v;
    const surgeVa = s.surge_unit === "VA" ? s.surge_value : null;
    records.push({
      id: `research-${researchId}`, model: p.model, name: p.kind === "inverter" ? "Hybrid inverter (research candidate)" : p.kind, manufacturer: p.brand, kind: "inverter",
      researchIds: [p.research_id], warranty: null, issues: [p.notes || "Research candidate; exact hardware revision and supplier eligibility are not confirmed."], evidence: sourceEvidence(delta, p.source_ids),
      technicalEvidence: techEvidence(delta, p.source_ids, "Manufacturer document recorded in 2026-11-24 research delta; exact hardware revision unconfirmed", ["continuousW", "apparentVA", "batteryV", "batteryMinV", "batteryMaxV", "phase", "maxDischargeA", "maxChargeA", "mpptCount", "maxPvW", "maxPvV", "mpptMinV", "mpptMaxV", "startV", "inputA", "communication", "protection"]),
      specs: { continuousW: s.ac_rated_w, apparentVA: s.ac_rated_va, powerFactor: null, surgeVA: surgeVa, surgeSeconds: s.surge_duration_s, surgeW: s.surge_unit === "W" ? s.surge_value : null, batteryV: 48, batteryMinV: vRange?.[0] ?? null, batteryMaxV: vRange?.[1] ?? null, phase: s.phase_count, efficiency: null, maxDischargeA: s.battery_discharge_max_a, maxChargeA: s.battery_charge_max_a, mpptCount: s.mppt_count, maxPvW: s.pv_input_w, maxPvV: s.pv_voltage_absolute_max_v, mpptMinV: s.mppt_range_v?.[0] ?? null, mpptMaxV: s.mppt_range_v?.[1] ?? null, startV: s.start_voltage_v, inputA: s.mppt_operating_current_max_a, shortCircuitA: s.mppt_short_circuit_max_a ?? null, chemistry: null, communication: null, protection: s.ip },
    } as Product);
  }
  const b = delta.products.find((p) => p.research_id === "itel-ipl51200x")!; const bs = b.specifications;
  records.push({
    id: "research-itel-ipl51200x", model: b.model, name: "Lithium battery (research candidate)", manufacturer: b.brand, kind: "battery", researchIds: [b.research_id], warranty: null,
    issues: [b.notes || "Incomplete candidate; exact model documentation and approved pairing are unavailable."], evidence: sourceEvidence(delta, b.source_ids),
    technicalEvidence: techEvidence(delta, b.source_ids, "Supplier/family evidence only; exact model datasheet and hardware revision not verified", ["nominalV", "ah", "nominalWh"]),
    specs: { nominalV: bs.nominal_v ?? null, minV: null, maxV: null, ah: bs.ah ?? null, nominalWh: bs.nominal_kwh == null ? null : bs.nominal_kwh * 1000, usableWh: null, dischargeA: null, chargeA: null, continuousW: null, peakDischargeA: null, peakSeconds: null, cycleLife: null, parallelMax: bs.max_parallel ?? null, chemistry: bs.chemistry ?? null, communication: null, compatibleInverters: null },
  });
  return records;
}
const supplierSlug: Record<string, Supplier> = { "SolarVillage": "solarvillage", Sygnite: "sygnite", CDcare: "cdcare", "Demyl Power": "demylpower", Thrillhouse: "thrillhouse", Ephratop: "ephratop", "NIKADE itel Energy": "nikade", Ogabassey: "ogabassey" };
function addedOffers(delta: Delta, products: Product[]) {
  return delta.offers.map((o) => {
    const mapped = o.research_product_id ? canonicalByResearchId[o.research_product_id] ?? (o.research_product_id === "jinko-585-f2-us" ? "jinko-jkm585n-72hl4-bdv-f2-us" : null) ?? products.find((p) => p.researchIds?.includes(o.research_product_id!))?.id ?? null : null;
    const p = products.find((item) => item.id === mapped);
    const exactLabel = o.match_status === "exact_model_label";
    const s = source(delta, o.source_id);
    return {
      id: `research-${o.research_offer_id}`, supplier: supplierSlug[o.supplier], supplierProductId: o.supplier_sku || `research-${o.research_offer_id}`, parentId: null,
      productId: mapped, originalModel: exactLabel ? p?.model ?? o.supplier_sku : o.supplier_sku,
      name: o.supplier_sku || `${o.research_product_id ?? "Unresolved product"} public listing`, url: s?.url ?? "https://example.invalid",
      variant: {}, priceNgn: o.price_ngn, currency: "NGN" as const, stock: o.listed_stock ?? "unknown", condition: o.condition ?? "unknown",
      identity: exactLabel && mapped ? "verified" as const : mapped ? "needs_review" as const : "unmapped" as const,
      priceBasis: o.unit === "each" ? "materials" as const : "unknown" as const,
      installation: "not_specified" as const, accessories: "not_specified" as const, vat: o.vat_included === null ? "unknown" as const : o.vat_included ? "included" as const : "excluded" as const,
      delivery: o.delivery_ngn === null ? "unknown" as const : "excluded" as const, retrievedAt: `${o.observed_on}T00:00:00.000Z`, supplierUpdatedAt: o.source_price_date ? `${o.source_price_date}T00:00:00.000Z` : null,
      verification: `${o.offer_kind}; ${o.match_status}; public listing only, procurement ineligible. ${o.notes}`.trim(),
      research: { offerId: o.research_offer_id, sourceId: o.source_id, offerKind: o.offer_kind, procurementEligible: false as const, exactMatchStatus: o.match_status, listedStock: o.listed_stock, confirmedStockQty: o.confirmed_stock_qty, condition: o.condition, unit: o.unit, vatIncluded: o.vat_included, deliveryNgn: o.delivery_ngn, validUntil: o.valid_until },
    };
  });
}
export function integrateResearchCatalog(base: Catalog, delta: Delta): Catalog {
  const additions = addedProducts(delta);
  const products = [...base.products, ...additions];
  const idMappings = Object.fromEntries(delta.products.map((p) => [p.research_id, canonicalByResearchId[p.research_id] ?? additions.find((n) => n.researchIds?.includes(p.research_id))?.id ?? (p.research_id === "jinko-585-f2-us" ? "jinko-jkm585n-72hl4-bdv-f2-us" : "unmapped-research-record")]));
  const offers = addedOffers(delta, products);
  return { ...base, products, offers: [...base.offers, ...offers], researchDelta: { ...delta, idMappings } } as Catalog;
}
const screenConfig = (screen: Delta["configuration_screens"][number], productId: string, equipmentRequirements: NonNullable<SystemConfiguration["equipmentRequirements"]>, documentation: SystemConfiguration["documentation"]): SystemConfiguration => ({
  id: `screen-${screen.id}`, category: "full", verification: "review_required", documentation, reviewNotes: [screen.notes, `Supplied screening status: ${screen.engineering_status}; procurement eligible: false; customer recommendation eligible: false.`],
  components: [{ role: "inverter", productId: "deye-sun-6k-og01lp1-eu-am2", quantity: 1 }, { role: "battery", productId: "deye-se-f5", quantity: screen.battery_qty }, { role: "panel", productId, quantity: screen.panel_qty }],
  // Carry the existing Deye BOM scope forward as explicit unpriced lines. The
  // research screen does not approve ratings or substitute accessory leads.
  equipmentRequirements: equipmentRequirements.map((line) => line.name === "PV mounting structure and module clamps" ? { ...line, quantity: screen.panel_qty } : { ...line }),
  pv: { series: screen.mppt_strings[0].series, parallel: screen.mppt_strings[0].parallel }, chargingA: 135, bmsProtocol: null, solarIncluded: true, requiredEquipmentComplete: false,
  researchScreenId: screen.id, researchPanelId: screen.panel_id, screeningVocTolerance: screen.screening_voc_tolerance, screeningColdTempC: screen.screening_min_module_temp_c, suppliedVocScreenV: screen.screening_max_voc_v, suppliedEngineeringStatus: screen.engineering_status,
});
export function integrateResearchConfigurations(base: ConfigurationCatalog, delta: Delta): ConfigurationCatalog {
  const deyeIndex = base.configurations.findIndex((c) => c.id === "deye-residential-01");
  const deyeTemplate = base.configurations[deyeIndex];
  const existing = base.configurations.map((c, i) => i === deyeIndex ? { ...c, researchScreenId: "deye-9s2-f9-en", researchPanelId: "jinko-585-f9-en", screeningVocTolerance: 0.03, screeningColdTempC: 10, suppliedVocScreenV: 506.848838, suppliedEngineeringStatus: "blocked_screen" } : c);
  const extra = delta.configuration_screens.filter((s) => s.id !== "deye-9s2-f9-en").map((s) => {
    const f2 = s.panel_id === "jinko-585-f2-us";
    const panelSource = f2
      ? source(delta, "J01")
      : deyeTemplate?.documentation.find((item) => item.url.includes("jinkosolar.com") && item.revision.includes("F9 EN"));
    const documentation = [
      ...(deyeTemplate?.documentation.filter((item) => item.url.includes("deyeinverter.com")) ?? []),
      ...(panelSource ? [{ url: panelSource.url, revision: "revision-specific Jinko datasheet; document revision does not confirm the physical module revision" }] : []),
    ];
    return screenConfig(
      s,
      f2 ? "jinko-jkm585n-72hl4-bdv-f2-us" : "jinko-jkm585n-72hl4-bdv",
      deyeTemplate?.equipmentRequirements ?? [],
      documentation,
    );
  });
  return { ...base, version: `${base.version}+research-2026-11-24`, configurations: [...existing, ...extra] };
}
