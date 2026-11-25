import type { Appliance, Assumptions } from "./solar-calculations";
import type { EnergyCalculation } from "./sizing-policy";

export type SystemCategory = "portable" | "compact" | "full";
export type CalculatorRequest = { loads: Appliance[]; assumptions: Assumptions; solarCharging: boolean };
export type CustomerOption = {
  id: string; category: SystemCategory; title: string; description: string;
  distinction: string; bestFit: boolean; runtimeNote: string;
  meetsRequirements?: boolean;
  price: { low: number; high: number; referenceDate: string } | null;
  priceMethod?: "exact_model_observations" | "capacity_market_benchmark";
  priceNote?: string;
  specifications: { label: string; value: string }[];
  solarCharging?: { maxW: number; minV: number; maxV: number; maxA: number };
  equipment?: { role: "unit" | "inverter" | "battery" | "panel" | "required_equipment"; manufacturer: string; model: string; quantity: number; capacity?: string; unitPrice: { low: number; high: number } | null; linePrice: { low: number; high: number } | null }[];
};
export type CustomerPlan = {
  energy: { peakW: number; dailyWh: number; backupWh: number; pvW: number; backupHours: number };
  options: CustomerOption[]; shortRuntimeAlternatives?: CustomerOption[]; bestFitId: string | null;
};
export type SystemConfiguration = {
  id: string; category: SystemCategory; verification: "verified" | "review_required";
  documentation: { url: string; revision: string }[]; reviewNotes: string[];
  components: { role: "unit" | "inverter" | "battery" | "panel" | "required_equipment"; productId: string | null; offerId?: string; name?: string; quantity: number }[];
  equipmentRequirements?: { name: string; quantity: number; scope: "fixed" | "site_assessed"; selectionNote: string }[];
  // Quantities and settings belong to this reviewed configuration, not an on-the-fly product permutation.
  pv: { series: number; parallel: number; derivedVmpTempCoefficient?: number } | null;
  chargingA: number | null; bmsProtocol: string | null;
  solarIncluded: boolean; requiredEquipmentComplete: boolean;
  researchScreenId?: string; researchPanelId?: string; screeningVocTolerance?: number; screeningColdTempC?: number; suppliedVocScreenV?: number; suppliedEngineeringStatus?: string;
};
export type ConfigurationCatalog = { schemaVersion: 1; version: string; configurations: SystemConfiguration[] };
export type Stage = { status: "passed" | "failed" | "insufficient_information" | "not_applicable"; reasons: string[] };
export type ConfigurationDiagnostic = {
  id: string; category: SystemCategory;
  classification: "VERIFIED" | "ESTIMATED" | "BLOCKED";
  energy: EnergyCalculation | null;
  sizing: { policyId: string; requiredContinuousW: number; requiredVA: number; requiredStartingW: number | null; requiredStartingVA: number | null; starting: ReturnType<typeof import("./sizing-policy").startingEstimate>[]; runtimeHours: number | null };
  stages: Record<"identity" | "availability" | "technical" | "compatibility" | "pricing" | "recommendation", Stage>;
  technicalCompatible: boolean; priceRefreshDue: boolean; rankingScore: number | null;
};
