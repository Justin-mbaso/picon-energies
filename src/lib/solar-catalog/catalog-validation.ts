import type { Catalog, Offer } from "./types";

const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const https = (v: unknown) => { try { return typeof v === "string" && new URL(v).protocol === "https:"; } catch { return false; } };
const date = (v: unknown) => typeof v === "string" && Number.isFinite(Date.parse(v));
export function validateCatalog(input: unknown): string[] {
  const errors: string[] = [];
  if (!record(input) || input.schemaVersion !== 1 || !Array.isArray(input.products) || !Array.isArray(input.offers) || !Array.isArray(input.packages) || !Array.isArray(input.approvedPairs) || !Array.isArray(input.sources)) return ["Invalid catalogue structure or schema version."];
  if (!date(input.reviewedAt) || typeof input.version !== "string" || !input.version || typeof input.reviewer !== "string" || !input.reviewer) errors.push("Review date, version and reviewer are required.");
  const products = new Map<string, Record<string, unknown>>();
  const requiredSpecs: Record<string,string[]> = {
    inverter: "continuousW apparentVA powerFactor surgeVA surgeSeconds batteryV batteryMinV batteryMaxV phase efficiency maxDischargeA maxChargeA mpptCount maxPvW maxPvV mpptMinV mpptMaxV startV inputA shortCircuitA chemistry communication protection".split(" "),
    battery: "nominalV minV maxV ah nominalWh usableWh dischargeA chargeA continuousW peakDischargeA peakSeconds cycleLife parallelMax chemistry communication compatibleInverters".split(" "),
    panel: "watts voc vmp isc imp vocTolerance vocTempCoefficient vmpTempCoefficient maxSystemV efficiency dimensionsMm technology".split(" "),
    portable: "nominalWh usableAcWh continuousW surgeW surgeSeconds solarMaxW solarMinV solarMaxV solarMaxA chemistry charging ports expansion".split(" "),
    compact: "nominalWh usableAcWh continuousW apparentVA surgeW surgeSeconds solarMaxW solarMinV solarMaxV solarMaxA chemistry charging ports expansion".split(" "),
  };
  const stringSpecs = new Set(["protection","chemistry","technology","charging","expansion"]);
  const arraySpecs = new Set(["inputA","shortCircuitA","dimensionsMm","communication","compatibleInverters","ports"]);
  const offerIds = new Set<string>();
  const unique = new Set<string>();
  for (const p of input.products) {
    if (!record(p) || typeof p.id !== "string" || !p.id || typeof p.model !== "string" || !p.model || !["inverter","battery","panel","portable","compact"].includes(String(p.kind)) || !record(p.specs) || !Array.isArray(p.issues) || !Array.isArray(p.evidence)) { errors.push("Invalid manufacturer product."); continue; }
    if (products.has(p.id)) errors.push(`Duplicate product: ${p.id}`);
    products.set(p.id,p);
    for (const key of requiredSpecs[String(p.kind)]) {
      const v = p.specs[key];
      if (v === undefined) errors.push(`${p.id}: missing specification ${key}; use null for unknown`);
      else if (v !== null && (arraySpecs.has(key) || key === "chemistry" && p.kind === "inverter" ? !Array.isArray(v) || v.length === 0 : stringSpecs.has(key) ? typeof v !== "string" || !v : typeof v !== "number")) errors.push(`${p.id}: invalid specification type ${key}`);
    }
    for (const [key,value] of Object.entries(p.specs)) {
      if (typeof value === "number" && (!Number.isFinite(value) || (key.endsWith("Coefficient") ? value < -0.02 || value > 0.02 : key === "vocTolerance" ? value < 0 || value > 0.2 : value <= 0))) errors.push(`${p.id}: invalid specification ${key}`);
      if (Array.isArray(value) && value.some((v) => ["inputA","shortCircuitA","dimensionsMm"].includes(key) ? typeof v !== "number" || !Number.isFinite(v) || v <= 0 : typeof v !== "string" || !v)) errors.push(`${p.id}: invalid specification array ${key}`);
    }
    for (const key of ["efficiency","powerFactor","typicalEfficiency"]) if (typeof p.specs[key] === "number" && p.specs[key] > 1) errors.push(`${p.id}: ${key} must be a ratio, not a percentage`);
    for (const key of ["typicalEfficiency","surgeW","surgeVA","batteryModeMinimumW","usableBatteryWh"]) if(p.specs[key]!=null && typeof p.specs[key]!=="number") errors.push(`${p.id}: invalid optional numeric ${key}`);
    if(typeof p.specs.usableAcWh==="number" && typeof p.specs.nominalWh==="number" && p.specs.usableAcWh>p.specs.nominalWh) errors.push(`${p.id}: usable AC energy exceeds nominal energy`);
    if(typeof p.specs.batteryModeMinimumW==="number" && typeof p.specs.continuousW==="number" && p.specs.batteryModeMinimumW>p.specs.continuousW) errors.push(`${p.id}: battery-mode floor exceeds rated output`);
    for (const key of ["phase","mpptCount","parallelMax"]) if (p.specs[key] != null && !Number.isInteger(p.specs[key])) errors.push(`${p.id}: ${key} must be an integer`);
    if (p.kind === "inverter") for (const key of ["inputA","shortCircuitA"]) if (Array.isArray(p.specs[key]) && p.specs[key].length !== p.specs.mpptCount) errors.push(`${p.id}: ${key} must have one limit per MPPT`);
    if (typeof p.specs.usableWh === "number" && typeof p.specs.nominalWh === "number" && p.specs.usableWh > p.specs.nominalWh) errors.push(`${p.id}: usable energy exceeds nominal energy`);
    for (const e of p.evidence) if (!record(e) || !https(e.url) || typeof e.note !== "string") errors.push(`${p.id}: invalid evidence`);
    if(p.technicalEvidence!==undefined && (!Array.isArray(p.technicalEvidence) || p.technicalEvidence.some((e)=>!record(e) || !https(e.url) || typeof e.revision!=="string" || !e.revision || !date(e.reviewedAt) || !Array.isArray(e.fields) || e.fields.some((v)=>typeof v!=="string")))) errors.push(`${p.id}: invalid technical field evidence`);
    if(p.energyEvidence!==undefined && (!Array.isArray(p.energyEvidence) || p.energyEvidence.some((e)=>!record(e) || !["manufacturer","picon_measured"].includes(String(e.kind)) || typeof e.usableAcWh!=="number" || !Number.isFinite(e.usableAcWh) || e.usableAcWh<=0 || !record(e.source) || !https(e.source.url) || typeof e.source.revision!=="string" || !e.source.revision || !record(e.scope) || [e.scope.minLoadW,e.scope.maxLoadW,e.scope.minPowerFactor].some((v)=>typeof v!=="number" || !Number.isFinite(v)) || Number(e.scope.minLoadW)<0 || Number(e.scope.maxLoadW)<Number(e.scope.minLoadW) || Number(e.scope.minPowerFactor)<=0 || Number(e.scope.minPowerFactor)>1 || e.configurationId!==undefined && typeof e.configurationId!=="string" || e.kind==="picon_measured" && (!record(e.approval) || typeof e.approval.reviewer!=="string" || !e.approval.reviewer.trim() || !date(e.approval.approvedAt))))) errors.push(`${p.id}: invalid scoped AC-energy evidence / approval`);
  }
  const enumValues = (v: unknown, values: string[]) => typeof v === "string" && values.includes(v);
  for (const o of input.offers) {
    if (!record(o)) { errors.push("Invalid offer."); continue; }
    const key = String(o.id);
    if (!key || offerIds.has(key)) errors.push(`Duplicate offer: ${key}`);
    offerIds.add(key);
    if (!enumValues(o.supplier,["nikade","visibility","cdcare","winboost","sunset","kinbu","lighthousesolar","renewablezmart","fivestara1","rightclick","demylpower","joshville","deluxe","solarvillage","sygnite","thrillhouse","ephratop","ogabassey"]) || typeof o.supplierProductId !== "string" || !o.supplierProductId || typeof o.name !== "string" || !https(o.url) || !date(o.retrievedAt) || o.supplierUpdatedAt !== null && !date(o.supplierUpdatedAt)) errors.push(`${key}: missing supplier provenance`);
    if (o.currency !== "NGN" || o.priceNgn !== null && (typeof o.priceNgn !== "number" || !Number.isFinite(o.priceNgn) || o.priceNgn <= 0 || !Number.isSafeInteger(Math.round(o.priceNgn*100)) || Math.abs(o.priceNgn * 100 - Math.round(o.priceNgn * 100)) > 0.0001)) errors.push(`${key}: invalid NGN price / precision`);
    if (!enumValues(o.stock,["in_stock","out_of_stock","unknown"]) || !enumValues(o.condition,["new","used","unknown"]) || !enumValues(o.identity,["verified","unmapped","needs_review"]) || !enumValues(o.priceBasis,["materials","mixed","unknown"])) errors.push(`${key}: invalid availability or verification`);
    for (const k of ["installation","accessories"]) if (!enumValues(o[k],["included","excluded","separately_quoted","not_specified"])) errors.push(`${key}: invalid ${k}`);
    for (const k of ["vat","delivery"]) if (!enumValues(o[k],["included","excluded","unknown"])) errors.push(`${key}: invalid ${k}`);
    if (o.productId !== null && (typeof o.productId !== "string" || !products.has(o.productId))) errors.push(`${key}: unknown canonical product`);
    if (o.productId && o.identity === "verified") {
      const normalize = (v: unknown) => String(v ?? "").toUpperCase().replace(/[\s-]/g, "");
      if (normalize(o.originalModel) !== normalize(products.get(String(o.productId))?.model)) errors.push(`${key}: model identity mismatch`);
    }
    if (!record(o.variant) || Object.values(o.variant).some((v) => typeof v !== "string" || !v)) errors.push(`${key}: invalid variant options`);
    if (o.parentId !== null && (!o.parentId || !record(o.variant) || !Object.keys(o.variant).length)) errors.push(`${key}: variation requires parent and selected options`);
    const supplierKey = JSON.stringify([o.supplier,o.parentId,o.supplierProductId]);
    if (unique.has(supplierKey)) errors.push(`${key}: duplicate supplier record`);
    unique.add(supplierKey);
    if (typeof o.verification !== "string" || !o.verification) errors.push(`${key}: verification note required`);
  }
  const packages = new Set();
  for (const p of input.packages) {
    if (!record(p) || typeof p.id !== "string" || packages.has(p.id) || !offerIds.has(String(p.offerId)) || !Array.isArray(p.components) || !Array.isArray(p.issues) || !Array.isArray(p.accessories) || !Array.isArray(p.protection)) { errors.push("Invalid package or duplicate ID."); continue; }
    packages.add(p.id);
    for (const component of p.components) if (!record(component) || !Number.isInteger(component.quantity) || Number(component.quantity) < 1 || component.productId !== null && !products.has(String(component.productId))) errors.push(`${p.id}: invalid package component`);
  }
  for (const pair of input.approvedPairs) if (!record(pair) || products.get(String(pair.inverterId))?.kind !== "inverter" || products.get(String(pair.batteryId))?.kind !== "battery" || !https(pair.sourceUrl) || pair.evidenceType !== undefined && !["manufacturer", "supplier_listing"].includes(String(pair.evidenceType))) errors.push("Invalid documented pairing evidence.");
  return errors;
}
export function assertCatalog(input: unknown): asserts input is Catalog {
  const errors = validateCatalog(input);
  if (errors.length) throw new Error(`Catalogue rejected: ${errors.join("; ")}`);
}
export function exactModelMatches(c: Catalog, model: string) {
  const normalized = model.toUpperCase().replace(/[\s-]/g, "");
  return c.products.filter((p) => p.model.toUpperCase().replace(/[\s-]/g, "") === normalized);
}
export function offerChange(before: Offer, after: Offer) {
  return { id: before.id, priceBefore: before.priceNgn, priceAfter: after.priceNgn, stockBefore: before.stock, stockAfter: after.stock };
}
