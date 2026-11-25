export type Supplier = "nikade" | "visibility" | "cdcare" | "winboost" | "sunset" | "kinbu" | "lighthousesolar" | "renewablezmart" | "fivestara1" | "rightclick" | "demylpower" | "joshville" | "deluxe" | "solarvillage" | "sygnite" | "thrillhouse" | "ephratop" | "ogabassey";
export type Inclusion = "included" | "excluded" | "separately_quoted" | "not_specified";
export type CompatibilityStatus = "verified" | "incompatible" | "insufficient_information";
export type Evidence = { url: string; note: string };
export type InverterSpecs = {
  surgeW?: number | null; typicalEfficiency?: number | null;
  continuousW: number | null; apparentVA: number | null; powerFactor: number | null;
  surgeVA: number | null; surgeSeconds: number | null; batteryV: number | null;
  batteryMinV: number | null; batteryMaxV: number | null; phase: number | null;
  efficiency: number | null; maxDischargeA: number | null; maxChargeA: number | null;
  mpptCount: number | null; maxPvW: number | null; maxPvV: number | null;
  /** Maximum PV access power before the inverter's conversion limit. */
  maxPvAccessW?: number | null;
  mpptMinV: number | null; mpptMaxV: number | null; fullLoadMpptMinV?: number | null; startV: number | null;
  inputA: number[] | null; shortCircuitA: number[] | null;
  chemistry: string[] | null; communication: string[] | null; protection: string | null;
};
export type BatterySpecs = {
  nominalV: number | null; minV: number | null; maxV: number | null;
  ah: number | null; nominalWh: number | null; usableWh: number | null;
  dischargeA: number | null; chargeA: number | null; continuousW: number | null;
  peakDischargeA: number | null; peakSeconds: number | null;
  cycleLife: number | null; parallelMax: number | null; chemistry: string | null;
  communication: string[] | null; compatibleInverters: string[] | null;
};
export type PanelSpecs = {
  watts: number | null; voc: number | null; vmp: number | null; isc: number | null; imp: number | null;
  vocTolerance: number | null; vocTempCoefficient: number | null; vmpTempCoefficient: number | null; iscTempCoefficient?: number | null;
  maxSystemV: number | null; efficiency: number | null; dimensionsMm: number[] | null; technology: string | null;
};
export type PortableSpecs = {
  apparentVA?: number | null; surgeVA?: number | null; batteryModeMinimumW?: number | null; usableBatteryWh?: number | null; typicalEfficiency?: number | null;
  nominalWh: number | null; usableAcWh: number | null; continuousW: number | null;
  surgeW: number | null; surgeSeconds: number | null; solarMaxW: number | null;
  solarMinV: number | null; solarMaxV: number | null; solarMaxA: number | null;
  chemistry: string | null; charging: string | null; ports: string[] | null; expansion: string | null;
};
type ProductBase = { id: string; model: string; name: string; manufacturer: string; evidence: Evidence[]; issues: string[]; warranty: string | null;
  researchIds?: string[]; documentRevision?: string | null;
  technicalEvidence?: { url: string; revision: string; fields: string[]; reviewedAt: string }[];
  energyEvidence?: { kind: "manufacturer" | "picon_measured"; usableAcWh: number; configurationId?: string;
    scope: { minLoadW: number; maxLoadW: number; minPowerFactor: number };
    source: { url: string; revision: string }; approval?: { reviewer: string; approvedAt: string } }[];
};
export type Product = ProductBase & (
  { kind: "inverter"; specs: InverterSpecs } | { kind: "battery"; specs: BatterySpecs } |
  { kind: "panel"; specs: PanelSpecs } | { kind: "portable"; specs: PortableSpecs } |
  { kind: "compact"; specs: PortableSpecs & { apparentVA: number | null; expansion: string | null } }
);
export type Offer = {
  id: string; supplier: Supplier; supplierProductId: string; parentId: string | null;
  productId: string | null; originalModel: string | null; name: string; url: string;
  variant: Record<string, string>; priceNgn: number | null; currency: "NGN";
  stock: "in_stock" | "out_of_stock" | "unknown"; condition: "new" | "used" | "unknown";
  identity: "verified" | "unmapped" | "needs_review";
  priceBasis: "materials" | "mixed" | "unknown";
  installation: Inclusion; accessories: Inclusion; vat: "included" | "excluded" | "unknown";
  delivery: "included" | "excluded" | "unknown";
  retrievedAt: string; supplierUpdatedAt: string | null; verification: string;
  research?: { offerId: string; sourceId: string; offerKind: string; procurementEligible: false; exactMatchStatus: string; listedStock: string | null; confirmedStockQty: number | null; condition: string | null; unit: string; vatIncluded: boolean | null; deliveryNgn: number | null; validUntil: string | null };
};
export type Package = {
  id: string; offerId: string; name: string; description: string;
  components: { name: string; productId: string | null; quantity: number }[];
  accessories: string[]; protection: string[]; warranty: string | null;
  issues: string[];
};
export type Catalog = {
  schemaVersion: 1; version: string; reviewedAt: string; reviewer: string;
  sources: { id: Supplier; name: string; url: string; note: string }[];
  products: Product[]; offers: Offer[]; packages: Package[];
  approvedPairs: { inverterId: string; batteryId: string; sourceUrl: string; evidenceType?: "manufacturer" | "supplier_listing" }[];
  researchDelta?: { as_of: string; sources: unknown[]; products: unknown[]; offers: unknown[]; accessory_price_leads: unknown[]; conflicts: unknown[]; configuration_screens: unknown[]; idMappings: Record<string, string> };
};
