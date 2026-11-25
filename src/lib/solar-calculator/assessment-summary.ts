import type { Catalog } from "../solar-catalog/types";
import { naira, priceBillOfMaterials } from "../solar-catalog/pricing";
import type { CalculatorRequest, ConfigurationCatalog } from "./recommendation-types";
import { parseCalculatorRequest } from "./calculator-request";
import { recommendSystems } from "./system-recommendations";
import { loadModel } from "./solar-calculations";

export type AssessmentSummary = { v: 1; peakW: number; dailyWh: number; backupHours: number; productIds: string[] };
export type AssessmentSelection = {v:2;peakW:number;dailyWh:number;backupWh:number;backupHours:number;configurationId:string|null};
export type AssessmentRequest = {v:3;request:CalculatorRequest;configurationId:string|null};
export function assessmentUrl(summary: AssessmentSummary | AssessmentSelection | AssessmentRequest) {
  const encoded=encodeURIComponent(JSON.stringify(summary));
  if(summary.v===3 && encoded.length>6000) {
    const m=loadModel(summary.request.loads,summary.request.assumptions);
    return assessmentUrl({v:2,peakW:m.peakW,dailyWh:m.dailyWh,backupWh:m.backupWh,backupHours:summary.request.assumptions.backupHours,configurationId:null});
  }
  return `/contact?intent=solar-assessment&solar=${encoded}`;
}
export function parseAssessmentSummary(value: unknown, catalog: Catalog, configurations?: ConfigurationCatalog, now=new Date()): string {
  if (typeof value !== "string" || value.length > 6000) return "";
  try {
    const s = JSON.parse(value);
    if(s?.v===3) {
      if(!configurations || Object.keys(s).sort().join()!=="configurationId,request,v" || s.configurationId!==null && typeof s.configurationId!=="string")return "";
      const request=parseCalculatorRequest(s.request);if(!request)return "";
      const {customer}=recommendSystems(catalog,configurations,request,now);
      const option=customer.options.find((o)=>o.id===s.configurationId);
      if(s.configurationId!==null && !option)return "";
      const e=customer.energy;
      return `SOLAR ASSESSMENT REQUEST\nPreliminary Picon sizing estimate; final fit, runtime and pricing require assessment.\nPeak load: ${e.peakW.toFixed(0)} W.\nDaily energy: ${(e.dailyWh/1000).toFixed(2)} kWh.\nBackup window: ${e.backupHours} hours.\nSelected system: ${option?.title??"Picon assessment requested"}.\nConfiguration reference: ${option?.id??"To be confirmed"}.\nEquipment estimate: ${option?.price ? priceRangeText(option.price.low,option.price.high) : "Picon to confirm"}.\nInstallation, commissioning and standard installation consumables will be assessed and quoted separately by Picon.\n\nPlease arrange a solar assessment.`;
    }
    if(value.length>1200)return "";
    if(s?.v===2) {
      if(Object.keys(s).sort().join()!=="backupHours,backupWh,configurationId,dailyWh,peakW,v" || ![s.peakW,s.dailyWh,s.backupWh,s.backupHours].every((n)=>typeof n==="number" && Number.isFinite(n) && n>0) || s.backupHours>24 || s.peakW>1e9 || s.dailyWh>24e9 || s.backupWh>s.dailyWh || s.configurationId!==null && (typeof s.configurationId!=="string" || !configurations?.configurations.some((c)=>c.id===s.configurationId && c.verification==="verified")))return "";
      const config=configurations?.configurations.find((c)=>c.id===s.configurationId);
      const names={portable:"Portable Power System",compact:"Compact Power System",full:"Full Solar System"};
      const price=config ? priceBillOfMaterials(catalog,config.components.filter((p)=>p.productId!==null).map((p)=>({productId:p.productId!,quantity:p.quantity})),now) : null;
      return `SOLAR ASSESSMENT REQUEST\nCustomer-entered planning figures; fit and pricing to be confirmed by Picon.\nPeak load: ${s.peakW.toFixed(0)} W.\nDaily energy: ${(s.dailyWh/1000).toFixed(2)} kWh.\nBackup window: ${s.backupHours} hours.\nSelected system: ${config ? names[config.category] : "Picon assessment requested"}.\nConfiguration reference: ${config?.id??"To be confirmed"}.\nEquipment estimate: ${price ? priceRangeText(price.low,price.high) : "Picon to confirm"}.\nInstallation, commissioning and standard installation consumables will be assessed and quoted separately by Picon.\n\nPlease arrange a solar assessment.`;
    }
    if (!s || s.v !== 1 || Object.keys(s).sort().join() !== "backupHours,dailyWh,peakW,productIds,v" ||
      ![s.peakW,s.dailyWh,s.backupHours].every((v) => typeof v === "number" && Number.isFinite(v) && v > 0) ||
      s.peakW > 1e9 || s.dailyWh > 24e9 || s.backupHours > 24 || !Array.isArray(s.productIds) || s.productIds.length > 6 || new Set(s.productIds).size !== s.productIds.length ||
      s.productIds.some((id: unknown) => typeof id !== "string" || !catalog.products.some((p) => p.id === id))) return "";
    // Reconstruct server-side from bounded metrics and known IDs; never trust a URL's quotation or free text.
    return `SOLAR CALCULATOR — visitor planning inputs, not a verified system or quotation.\nPeak simultaneous load: ${s.peakW.toFixed(0)} W.\nDaily energy: ${(s.dailyWh / 1000).toFixed(2)} kWh.\nBackup window: ${s.backupHours} hours.\nSystem and equipment estimate: Picon to confirm during assessment.\n\nPlease arrange a solar assessment.`;
  } catch { return ""; }
}
// Price text is presentation-only; no visitor-supplied amounts are accepted by the contact handoff.
export function priceRangeText(low: number, high: number) { return low===high?naira(low):`${naira(low)}–${naira(high)}`; }
