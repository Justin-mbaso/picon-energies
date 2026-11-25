import type { Catalog, Product } from "../solar-catalog/types";
import { SIZING_POLICY, documented, manufacturerUrl, runtimeHours, systemEnergy, type EnergyCalculation } from "./sizing-policy";
import { applyPiconMarkup, capacityPriceBenchmark, isCurrent, observedProductPrice, priceFreshness } from "../solar-catalog/pricing";
import { checkBattery, checkInverter, checkPortable, loadModel, pvConfiguration, validateInputs } from "./solar-calculations";
import type { CalculatorRequest, CustomerOption, CustomerPlan, ConfigurationCatalog, ConfigurationDiagnostic, SystemConfiguration, Stage } from "./recommendation-types";

const passed = (): Stage => ({status:"passed",reasons:[]});
const missing = (...reasons:string[]): Stage => ({status:"insufficient_information",reasons});
const failed = (...reasons:string[]): Stage => ({status:"failed",reasons});
const titles = {portable:"Portable Power System",compact:"Compact Power System",full:"Full Solar System"};
const descriptions = {
  portable:"A self-contained power solution suited to your selected appliances and backup requirements.",
  compact:"An integrated inverter and battery solution offering a convenient alternative to a larger modular installation.",
  full:"An inverter, battery and solar panel configuration sized for your selected energy and backup requirements.",
};
const number = (n:number) => new Intl.NumberFormat("en-NG",{maximumFractionDigits:2}).format(n);
const official = manufacturerUrl;
function authority(p: Product, fields: string[]): string[] { return fields.filter((field) => !documented(p, field)); }
export function validateConfigurations(value:unknown,c:Catalog):string[] {
  if (!value || typeof value!=="object") return ["Configuration catalogue is missing."];
  const data=value as ConfigurationCatalog;
  if (data.schemaVersion!==1 || !Array.isArray(data.configurations)) return ["Invalid configuration schema."];
  const errors:string[]=[],ids=new Set<string>();
  for(const config of data.configurations) {
    if (!config || typeof config.id!=="string" || !/^[a-z][a-z0-9-]{2,59}$/.test(config.id) || ids.has(config.id)) {errors.push("Invalid or duplicate configuration identity.");continue;}
    ids.add(config.id);
    if(!["portable","compact","full"].includes(config.category) || !["verified","review_required"].includes(config.verification) || !Array.isArray(config.components) || !Array.isArray(config.documentation) || !Array.isArray(config.reviewNotes) || typeof config.solarIncluded!=="boolean" || typeof config.requiredEquipmentComplete!=="boolean") {errors.push(`${config.id}: invalid configuration fields`);continue;}
    for(const part of config.components) if(!["unit","inverter","battery","panel","required_equipment"].includes(part.role) || !Number.isInteger(part.quantity) || part.quantity<1 || part.quantity>1000 || part.productId!==null && !c.products.some((p)=>p.id===part.productId)) errors.push(`${config.id}: invalid component identity or quantity`);
    if(config.equipmentRequirements && (!Array.isArray(config.equipmentRequirements) || config.equipmentRequirements.some((line)=>!line.name || !Number.isInteger(line.quantity) || line.quantity<1 || !["fixed","site_assessed"].includes(line.scope) || !line.selectionNote))) errors.push(`${config.id}: invalid required equipment scope`);
    if(new Set(config.components.map((p)=>p.productId).filter(Boolean)).size!==config.components.filter((p)=>p.productId).length) errors.push(`${config.id}: duplicate bill-of-quantities item`);
    if(config.pv && (![config.pv.series,config.pv.parallel].every((n)=>Number.isInteger(n) && n>0 && n<=200))) errors.push(`${config.id}: invalid string configuration`);
    if(config.chargingA!==null && (!Number.isFinite(config.chargingA) || config.chargingA<=0)) errors.push(`${config.id}: invalid configured charging current`);
    if(config.documentation.some((d)=>!official(d.url) || !d.revision)) errors.push(`${config.id}: missing official revision evidence`);
  }
  return errors;
}
function configuredPv(config:SystemConfiguration,inv:Extract<Product,{kind:"inverter"}>,panel:Extract<Product,{kind:"panel"}>,m:ReturnType<typeof loadModel>,request:CalculatorRequest):Stage {
  const i=inv.specs,p=panel.specs,a=request.assumptions;
  // Manufacturer betaVmp is required for engineering screening; the older
  // Picon NOCT estimate may remain visible as historical context but cannot
  // substitute for an unknown module temperature coefficient.
  const vmpCoefficient=p.vmpTempCoefficient;
  const screenVoc=config.researchScreenId && config.screeningVocTolerance!=null && config.screeningColdTempC!=null
    ? seriesVoc(config.pv?.series ?? 0,p.voc, p.vocTempCoefficient, config.screeningVocTolerance, config.screeningColdTempC)
    : null;
  const required=[p.watts,p.voc,p.vmp,p.isc,p.imp,p.vocTempCoefficient,p.maxSystemV,i.maxPvV,i.maxPvW,i.mpptMinV,i.mpptMaxV,i.startV,i.mpptCount];
  if(!config.pv || required.some((n)=>n===null) || !i.inputA || !i.shortCircuitA) return missing("Exact string design / PV electrical or temperature limits are missing.");
  const {series,parallel}=config.pv;
  if(screenVoc!==null && screenVoc>=i.maxPvV!) return failed(`Screening Voc is ${number(screenVoc)} V at ${number(config.screeningColdTempC!)}°C using a generic 3% tolerance; this screen reaches/exceeds the ${number(i.maxPvV!)} V absolute limit. It is not an exact-revision manufacturer tolerance.`);
  if(p.vocTolerance===null) return missing(`Cold-condition Voc screen is ${screenVoc===null ? "unavailable" : `${number(screenVoc)} V`}; the exact panel revision's positive Voc tolerance is unknown, so the ${number(i.maxPvV!)} V absolute maximum cannot be approved.`);
  if(vmpCoefficient===null) return missing("Hot-condition Vmp coefficient/curve is unknown; betaPmax and betaVoc are not substituted.");
  const qty=config.components.find((c)=>c.role==="panel")!.quantity;
  if(qty!==series*parallel*i.mpptCount!) return failed("Panel quantity does not match the reviewed strings and MPPT count.");
  const hotVmp=series*p.vmp!*(1+vmpCoefficient*(a.hotCellC-25));
  const coldVmp=series*p.vmp!*(1+vmpCoefficient*(a.coldC-25));
  const arrayW=qty*p.watts!,pvAccessLimit=i.maxPvAccessW ?? i.maxPvW!;
  const coldVoc=series*p.voc!*(1+p.vocTolerance)*(1+p.vocTempCoefficient!*(a.coldC-25));
  if(coldVoc>Math.min(i.maxPvV!,p.maxSystemV!) || hotVmp<i.mpptMinV! || i.fullLoadMpptMinV!=null && hotVmp<i.fullLoadMpptMinV || coldVmp>i.mpptMaxV! || series*p.voc!<i.startV! || parallel*p.imp!>Math.min(...i.inputA) || parallel*p.isc!*SIZING_POLICY.pvShortCircuitFactor>Math.min(...i.shortCircuitA) || arrayW>pvAccessLimit) return failed("Reviewed PV strings exceed voltage / current / PV access power limits at the selected temperatures.");
  if(qty*p.watts!<m.pvW) return failed("The reviewed array cannot meet the daily energy target.");
  return passed();
}
function seriesVoc(series:number,voc:number|null,beta:number|null,tolerance:number,temp:number):number|null {
  if(!series || voc===null || beta===null || temp>25 || !Number.isFinite(tolerance)) return null;
  return series*voc*(1+beta*(temp-25))*(1+tolerance);
}
function dynamicConfigurations(c:Catalog,base:ConfigurationCatalog,m:ReturnType<typeof loadModel>,request:CalculatorRequest):ConfigurationCatalog {
  const generated:SystemConfiguration[]=[];
  // Product records are the candidate pool. Historical package/configuration
  // records are retained for audit and assessment compatibility, but never
  // seed current recommendations.
  for(const product of c.products.filter((p)=>p.kind==="portable"||p.kind==="compact")) {
    const docs=(product.technicalEvidence??[]).filter((e)=>manufacturerUrl(e.url)&&e.revision).map((e)=>({url:e.url,revision:e.revision}));
    if(!docs.length)continue;
    generated.push({id:`dynamic-${product.kind}-${product.id}`,category:product.kind,verification:"review_required",documentation:docs,reviewNotes:["Candidate generated from this request and raw product specifications; suitability is recalculated for each submission."],components:[{role:"unit",productId:product.id,quantity:1}],pv:null,chargingA:null,bmsProtocol:null,solarIncluded:false,requiredEquipmentComplete:true});
  }
  for(const inv of c.products.filter((p):p is Extract<Product,{kind:"inverter"}>=>p.kind==="inverter")) for(const bat of c.products.filter((p):p is Extract<Product,{kind:"battery"}>=>p.kind==="battery")) {
    if(!c.approvedPairs.some((pair)=>pair.inverterId===inv.id&&pair.batteryId===bat.id))continue;
    const protocols=inv.specs.communication?.filter((v)=>bat.specs.communication?.includes(v))??[];
    if(!protocols.length)continue;
    const evidence=[inv,bat].flatMap((p)=>p.technicalEvidence??[]);
    if(!evidence.length||[inv,bat].some((p)=>!p.technicalEvidence?.length))continue;
    const reference={id:"dynamic-sizing",category:"full" as const,verification:"review_required" as const,documentation:[],reviewNotes:[],components:[{role:"battery" as const,productId:bat.id,quantity:1}],pv:null,chargingA:null,bmsProtocol:null,solarIncluded:true,requiredEquipmentComplete:false};
    const energy=systemEnergy(bat,reference,{peakW:m.peakW,backupWh:m.backupWh,backupHours:request.assumptions.backupHours,powerFactor:request.assumptions.powerFactor},inv);
    if(!energy.usableAcWh||!bat.specs.dischargeA||!bat.specs.minV||!energy.efficiency||!bat.specs.parallelMax)continue;
    const moduleContinuousW=Math.min(bat.specs.dischargeA*bat.specs.minV,bat.specs.continuousW??Number.POSITIVE_INFINITY)*energy.efficiency;
    const continuousCount=Math.ceil(m.peakW/moduleContinuousW);
    const modulePeakW=bat.specs.peakDischargeA&&bat.specs.minV&&bat.specs.peakSeconds&&bat.specs.peakSeconds>=request.assumptions.surgeSeconds
      ? bat.specs.peakDischargeA*bat.specs.minV*energy.efficiency : null;
    const peakCount=m.startingW!==null&&m.startingW>moduleContinuousW&&modulePeakW!==null
      ? Math.ceil(m.startingW/modulePeakW) : 1;
    const quantity=Math.max(1,Math.ceil(m.backupWh/energy.usableAcWh),continuousCount,peakCount);
    if(quantity>bat.specs.parallelMax)continue;
    for(const panel of c.products.filter((p):p is Extract<Product,{kind:"panel"}>=>p.kind==="panel")) {
      if(!(panel.technicalEvidence?.length))continue;
      const pv=pvConfiguration(inv,panel,m.pvW,request.assumptions);
      const signature:SystemConfiguration["components"]=[{role:"inverter",productId:inv.id,quantity:1},{role:"battery",productId:bat.id,quantity},{role:"panel",productId:panel.id,quantity:pv.quantity??Math.max(1,Math.ceil(m.pvW/(panel.specs.watts??Infinity)))}];
      const docs=[...(inv.technicalEvidence??[]),...(bat.technicalEvidence??[]),...(panel.technicalEvidence??[])].map((e)=>({url:e.url,revision:e.revision})).filter((e,index,all)=>manufacturerUrl(e.url)&&all.findIndex((x)=>x.url===e.url&&x.revision===e.revision)===index);
      if(!docs.length)continue;
      const config:SystemConfiguration={id:`dynamic-full-${String(generated.filter((x)=>x.category==="full").length+1).padStart(3,"0")}`,category:"full",verification:"review_required",documentation:docs,reviewNotes:["Dynamically evaluated against this request; not an engineering-approved fixed configuration."],components:signature,pv:pv.status==="verified"&&pv.series&&pv.parallel?{series:pv.series,parallel:pv.parallel}:null,chargingA:inv.specs.maxChargeA&&bat.specs.chargeA?Math.min(inv.specs.maxChargeA,quantity*bat.specs.chargeA):null,bmsProtocol:protocols[0],solarIncluded:true,requiredEquipmentComplete:false};
      generated.push(config);
    }
  }
  return {...base,version:`${base.version}-dynamic`,configurations:generated};
}
function customSizedOption(c:Catalog,m:ReturnType<typeof loadModel>,now:Date,surgeSeconds:number):CustomerOption {
  const nominalWh=m.backupWh/(SIZING_POLICY.energy.lifepo4.depthOfDischarge*SIZING_POLICY.energy.lifepo4.efficiency);
  const inverter=capacityPriceBenchmark(c,"inverter",now,m.minimumInverterW),battery=capacityPriceBenchmark(c,"battery",now,nominalWh),panel=capacityPriceBenchmark(c,"panel",now,600);
  const batteryProduct=battery?.referenceProduct.kind==="battery"?battery.referenceProduct:null;
  const batteryEfficiency=SIZING_POLICY.energy.lifepo4.efficiency;
  const perModuleContinuousW=batteryProduct?.specs.dischargeA&&batteryProduct.specs.minV
    ? Math.min(batteryProduct.specs.dischargeA*batteryProduct.specs.minV,batteryProduct.specs.continuousW??Number.POSITIVE_INFINITY)*batteryEfficiency : null;
  const energyBatteryCount=battery?Math.ceil(nominalWh/battery.referenceSize):1;
  const continuousBatteryCount=perModuleContinuousW?Math.ceil(m.peakW/perModuleContinuousW):1;
  const perModulePeakW=batteryProduct?.specs.peakDischargeA&&batteryProduct.specs.minV&&batteryProduct.specs.peakSeconds&&batteryProduct.specs.peakSeconds>=surgeSeconds
    ? batteryProduct.specs.peakDischargeA*batteryProduct.specs.minV*batteryEfficiency : null;
  const peakBatteryCount=m.startingW!==null&&perModuleContinuousW!==null&&m.startingW>perModuleContinuousW&&perModulePeakW!==null
    ? Math.ceil(m.startingW/perModulePeakW) : 1;
  const batteryCount=Math.max(energyBatteryCount,continuousBatteryCount,peakBatteryCount),panelCount=panel?Math.ceil(m.pvW/panel.referenceSize):1;
  const batteryModuleWh=battery?.referenceSize??nominalWh,panelModuleW=panel?.referenceSize??m.pvW;
  const batteryWh=batteryCount*batteryModuleWh,pvW=panelCount*panelModuleW;
  const supplierLines:{low:number;high:number}[]=[];
  const line=(role:"inverter"|"battery"|"panel",label:string,quantity:number,size:number,benchmark:typeof inverter)=>{
    const raw=benchmark?{low:size*benchmark.lowRate,high:size*benchmark.highRate}:null,unit=raw?applyPiconMarkup(raw):null;
    if(raw)supplierLines.push({low:raw.low*quantity,high:raw.high*quantity});
    const total=unit?{low:Math.round(unit.low*quantity*100)/100,high:Math.round(unit.high*quantity*100)/100}:null;
    return {role,manufacturer:"Market benchmark",model:label,quantity,
      unitPrice:unit,linePrice:total};
  };
  const equipment=[
    line("inverter",`${number(m.minimumInverterW/1000)} kW output class · ${number(m.minimumVA/1000)} kVA`,1,m.minimumInverterW,inverter),
    line("battery",`${number(batteryModuleWh/1000)} kWh / 48V-class module`,batteryCount,batteryModuleWh,battery),
    line("panel",`${number(panelModuleW)} W module equivalent`,panelCount,panelModuleW,panel),
  ];
  const priced=equipment.every((item)=>item.linePrice!==null);
  const supplierTotal=priced?supplierLines.reduce((sum,item)=>({low:sum.low+item.low,high:sum.high+item.high}),{low:0,high:0}):null;
  const total=supplierTotal?applyPiconMarkup(supplierTotal):null;
  const safeTotal=total&&[total.low,total.high].every((n)=>Number.isFinite(n)&&n>0&&n*100<=Number.MAX_SAFE_INTEGER)?total:null;
  const referenceDate=[inverter?.referenceDate,battery?.referenceDate,panel?.referenceDate].filter((x):x is string=>!!x).sort().at(-1)??"";
  const nominalKwh=batteryWh/1000,usableAcKwh=nominalKwh*SIZING_POLICY.energy.lifepo4.depthOfDischarge*SIZING_POLICY.energy.lifepo4.efficiency;
  const requiredCurrentA=m.peakW/(48*SIZING_POLICY.energy.lifepo4.efficiency);
  const requiredStartingCurrentA=m.startingW===null?null:m.startingW/(48*SIZING_POLICY.energy.lifepo4.efficiency);
  const specifications=[
    {label:"Continuous inverter output required",value:`${number(m.minimumInverterW/1000)} kW`},
    {label:"Apparent power required",value:`${number(m.minimumVA/1000)} kVA`},
    {label:"System phase",value:"Single-phase planning configuration; confirm property supply during assessment"},
    {label:"Battery voltage class",value:"48V-class lithium battery bank"},
    {label:"Nominal battery storage",value:`${number(nominalKwh)} kWh (${batteryCount} × ${number(batteryModuleWh/1000)} kWh ${battery?"benchmark modules":"planning capacity"})`},
    {label:"Estimated usable AC energy",value:`${number(usableAcKwh)} kWh (Phase 2D planning factors)`},
    {label:"Battery discharge capability required",value:`At least ${number(requiredCurrentA)} A at the 48V planning reference`},
    {label:"Starting current screen",value:requiredStartingCurrentA===null?"Appliance starting demand is unknown; confirm before equipment selection":`About ${number(requiredStartingCurrentA)} A at the 48V planning reference for the screened starting load`},
    {label:"PV array capacity required",value:`${number(m.pvW/1000)} kWp; ${number(pvW/1000)} kWp ${panel?"module-price equivalent":"planning capacity"}`},
    {label:"PV electrical design",value:"Panel strings, temperature-adjusted voltage and MPPT allocation are set during technical assessment"},
    {label:"Equipment estimate scope",value:"Capacity-based core equipment benchmarks where fresh comparable listings exist. Protection, mounting, cabling, other balance-of-system equipment and installation are confirmed after site design."},
    {label:"Sizing policy",value:SIZING_POLICY.id},
  ];
  return {id:"custom-sized-system",category:"full",title:"Custom-Sized Full Solar System",
    description:"A preliminary equipment specification calculated around your selected peak load, daily energy and backup window.",
    distinction:"Sized to your stated requirements using Picon’s existing Phase 2D planning methodology.",bestFit:true,
    runtimeNote:"Preliminary sizing estimate. Picon confirms the final equipment arrangement and project cost during the technical and site assessment.",
    price:safeTotal===null?null:{...safeTotal,referenceDate},
    priceMethod:"capacity_market_benchmark",
    priceNote:safeTotal===null?"No current price benchmark is available for every required core equipment class. No historical price is used; Picon will confirm pricing during the assessment.":`Preliminary core-equipment estimate from current, seven-day supplier price observations matched by equipment class, with Picon's 2% low-end and 5% high-end markup applied once. It does not claim that the benchmark products form a compatible package. Balance-of-system components and installation are confirmed during Picon’s technical/site assessment.`,
    specifications,equipment};
}
export function recommendSystems(c:Catalog,configurationCatalog:ConfigurationCatalog,request:CalculatorRequest,now=new Date()) {
  const errors=validateInputs(request.loads,request.assumptions);
  if(errors.length) throw new Error(errors.join(" "));
  const baseConfigErrors=validateConfigurations(configurationCatalog,c);
  if(baseConfigErrors.length) throw new Error(baseConfigErrors.join("; "));
  const m=loadModel(request.loads,request.assumptions),evaluatedConfigurations=dynamicConfigurations(c,configurationCatalog,m,request);
  const configErrors=validateConfigurations(evaluatedConfigurations,c);
  if(configErrors.length) throw new Error(configErrors.join("; "));
  const diagnostics:ConfigurationDiagnostic[]=[],suitable:{option:CustomerOption;powerW:number;energyWh:number;score:number;diagnostic:ConfigurationDiagnostic}[]=[],shortRuntimeAlternatives:CustomerOption[]=[];
  for(const config of evaluatedConfigurations.configurations) {
    const parts=config.components.map((part)=>({...part,product:c.products.find((p)=>p.id===part.productId)}));
    const stages:ConfigurationDiagnostic["stages"]={identity:passed(),availability:passed(),technical:missing("Technical evaluation requires exact identified components."),compatibility:missing("System evaluation requires exact identified components."),pricing:passed(),recommendation:passed()};
    const d:ConfigurationDiagnostic={id:config.id,category:config.category,classification:"BLOCKED",energy:null,sizing:{policyId:SIZING_POLICY.id,requiredContinuousW:m.minimumInverterW,requiredVA:m.minimumVA,requiredStartingW:m.startingW,requiredStartingVA:m.startingVA,starting:m.startingEvidence,runtimeHours:null},stages,technicalCompatible:false,priceRefreshDue:false,rankingScore:null};diagnostics.push(d);
    if(!parts.length || parts.some((p)=>!p.product)) stages.identity=missing("Exact component models have not all been identified.");
    const partOffers=parts.map((part)=>c.offers.filter((o)=>o.productId===part.productId && o.identity==="verified" && o.condition==="new"));
    if(partOffers.some((offers)=>!offers.length)) stages.availability=missing("No exact-product, new-condition supplier availability observation.");
    else if(partOffers.some((offers)=>!offers.some((o)=>o.stock==="in_stock" && isCurrent(o,now)))) stages.availability=failed("A required product is out of stock, unknown or its observation has expired.");
    let powerW:number|null=null,acWh:number|null=null,nominalWh:number|null=null;
    let energy:EnergyCalculation|null=null;
    let specs:CustomerOption["specifications"]=[];
    let solarChargingInfo:CustomerOption["solarCharging"],shortRuntimeOnly=false;
    if(config.category==="portable" || config.category==="compact") {
      const unit=parts.find((p)=>p.role==="unit")?.product;
      if(parts.length!==1 || parts[0].quantity!==1 || !unit || unit.kind!==config.category) stages.identity=failed("Self-contained configuration must identify one unit of the correct physical category.");
      else {
        energy=systemEnergy(unit,config,{...m,backupHours:request.assumptions.backupHours,powerFactor:request.assumptions.powerFactor});
        const requiredFields=["continuousW","charging"];
        const pvFields=["solarMaxW","solarMinV","solarMaxV","solarMaxA"];
        const pv=unit.specs;
        if(pvFields.every((field)=>documented(unit,field)) && pv.solarMaxW!=null && pv.solarMaxW>0 && pv.solarMinV!=null && pv.solarMinV>0 && pv.solarMaxV!=null && pv.solarMaxV>=pv.solarMinV && pv.solarMaxA!=null && pv.solarMaxA>0) {
          solarChargingInfo={maxW:pv.solarMaxW,minV:pv.solarMinV,maxV:pv.solarMaxV,maxA:pv.solarMaxA};
        }
        if(unit.specs.apparentVA!=null) requiredFields.push("apparentVA");
        if(unit.specs.batteryModeMinimumW!=null) requiredFields.push("batteryModeMinimumW");
        if(m.startingW!==null && (unit.specs.batteryModeMinimumW ?? unit.specs.continuousW)!==null && m.startingW>(unit.specs.batteryModeMinimumW ?? unit.specs.continuousW)!) requiredFields.push("surgeW","surgeSeconds");
        if(request.solarCharging) requiredFields.push("solarMaxW","solarMinV","solarMaxV","solarMaxA");
        const absent=authority(unit,requiredFields);
        const check=checkPortable(unit,m,request.assumptions,request.solarCharging,energy);
        shortRuntimeOnly=check.status==="incompatible" && check.reasons.length===1 && check.reasons[0]==="Usable AC energy is below the requested backup energy." && !absent.length && energy.usableAcWh!==null;
        stages.technical=check.status==="incompatible" ? failed(...check.reasons) : check.status!=="verified" || absent.length ? missing(...check.reasons,...absent.map((f)=>`Exact manufacturer evidence missing: ${f}`)) : passed();
        stages.compatibility=config.requiredEquipmentComplete && config.documentation.length>0 ? passed() : missing("Integrated unit documentation / required equipment scope is incomplete.");
        if(request.solarCharging && !config.solarIncluded) stages.compatibility=missing("A compatible solar charging kit is not included in this reviewed configuration.");
        powerW=unit.specs.batteryModeMinimumW ?? unit.specs.continuousW;acWh=energy.usableAcWh;nominalWh=energy.nominalWh;
        specs=[{label:"Continuous AC output",value:`${number(powerW??0)} W`}];
        if(unit.specs.surgeW) specs.push({label:"Starting output",value:`${number(unit.specs.surgeW)} W${unit.specs.surgeSeconds ? ` for ${number(unit.specs.surgeSeconds)} s` : ""}`});
        if(unit.kind==="compact" && unit.specs.apparentVA) specs.push({label:"Apparent output",value:`${number(unit.specs.apparentVA/1000)} kVA`});
        if(nominalWh) specs.push({label:"Battery capacity",value:`${number(nominalWh/1000)} kWh`});
        if(acWh) specs.push({label:energy?.basis==="picon_estimate" ? "Estimated usable AC energy" : "Available AC energy",value:`${number(acWh/1000)} kWh`});
        if(unit.specs.solarMaxW) specs.push({label:"Supported solar input",value:`Up to ${number(unit.specs.solarMaxW)} W${config.solarIncluded ? " (charging kit included)" : " (solar kit not included)"}`});
      }
    } else {
      const inv=parts.find((p)=>p.role==="inverter"),bat=parts.find((p)=>p.role==="battery"),panel=parts.find((p)=>p.role==="panel");
      if(inv?.product?.kind!=="inverter" || inv.quantity!==1 || bat?.product?.kind!=="battery" || panel?.product?.kind!=="panel") {
        stages.identity=missing("Full-system inverter, battery and panel identities / quantities are incomplete.");
        if(inv?.product?.kind==="inverter") {
          const known=checkInverter({...inv.product,issues:[]},m,request.assumptions);
          stages.technical=known.status==="incompatible" ? failed(...known.reasons) : missing(...known.reasons,"Remaining component suitability cannot yet be evaluated.");
        }
      }
      else {
        const ip=inv.product,bp=bat.product,pp=panel.product;
        energy=systemEnergy(bp,config,{...m,backupHours:request.assumptions.backupHours,powerFactor:request.assumptions.powerFactor},ip);
        const inverterFields=["continuousW","apparentVA","phase","batteryV","batteryMinV","batteryMaxV","maxChargeA","maxDischargeA","mpptCount","maxPvW","maxPvV","mpptMinV","mpptMaxV","inputA","shortCircuitA",...(ip.specs.maxPvAccessW!=null?["maxPvAccessW"]:[]),...(ip.specs.fullLoadMpptMinV!=null?["fullLoadMpptMinV"]:[])];
        const covered=[...authority(ip,inverterFields),...authority(bp,["nominalV","minV","maxV","dischargeA","chargeA","parallelMax","communication"]),...authority(pp,["watts","voc","vocTolerance","vmp","isc","imp","vocTempCoefficient","maxSystemV"])];
        const inverter=checkInverter({...ip,issues:[]},m,request.assumptions);
        const battery=checkBattery(c,{...ip,specs:{...ip.specs,maxChargeA:config.chargingA},issues:[]},{...bp,issues:[]},bat.quantity,m,energy);
        const pv=configuredPv(config,ip,pp,m,request);
        const rejects=[...inverter.reasons,...battery.reasons,...pv.reasons];
        stages.technical=[inverter,battery].some((v)=>v.status==="incompatible") ? failed(...rejects) : covered.length || inverter.status!=="verified" || battery.status!=="verified" ? missing(...rejects,...covered.map((f)=>`Manufacturer limit not verified: ${f}`)) : passed();
        stages.compatibility=pv.status!=="passed" ? pv : !config.documentation.length || !config.bmsProtocol || !bp.specs.communication?.includes(config.bmsProtocol) || !ip.specs.communication?.includes(config.bmsProtocol) ? missing("Approved BMS pairing / protocol evidence is incomplete.") : passed();
        if(config.chargingA!==null && ip.specs.maxChargeA!==null && config.chargingA>ip.specs.maxChargeA) stages.compatibility=failed("Configured charging current exceeds the inverter setting limit.");
        powerW=ip.specs.continuousW;nominalWh=bp.specs.nominalWh!==null ? bp.specs.nominalWh*bat.quantity : null;
        acWh=energy.usableAcWh;
        specs=[{label:"Inverter continuous output",value:`${number(powerW??0)} W`}];
        if(ip.specs.apparentVA) specs.push({label:"Apparent output",value:`${number(ip.specs.apparentVA/1000)} kVA`});
        if(nominalWh) specs.push({label:"Battery capacity",value:`${number(nominalWh/1000)} kWh`});
        if(bp.specs.usableWh) specs.push({label:"Usable battery energy",value:`${number(bp.specs.usableWh*bat.quantity/1000)} kWh`});
        specs.push({label:"Solar panels",value:`${panel.quantity} × ${number(pp.specs.watts??0)} W`},{label:"Total PV capacity",value:`${number(panel.quantity*(pp.specs.watts??0)/1000)} kWp`});
        if(acWh) specs.push({label:energy?.basis==="picon_estimate" ? "Estimated usable AC energy" : "Available AC energy",value:`${number(acWh/1000)} kWh`});
      }
    }
    d.energy=energy;
    d.technicalCompatible=stages.identity.status==="passed" && stages.technical.status==="passed" && stages.compatibility.status==="passed";
    const boq=parts.filter((p)=>p.productId!==null).map((p)=>({productId:p.productId!,quantity:p.quantity}));
    const priceLines=boq.map((line)=>({ ...line, price:observedProductPrice(c,line.productId,now) }));
    const rawPrice=priceLines.length&&priceLines.every((line)=>line.price) ? {
      low:priceLines.reduce((sum,line)=>sum+line.price!.low*line.quantity,0),
      high:priceLines.reduce((sum,line)=>sum+line.price!.high*line.quantity,0),
      lines:priceLines,
    } : null;
    const customerRange=rawPrice&&applyPiconMarkup(rawPrice);
    const price=rawPrice&&customerRange?{...rawPrice,...customerRange}:null;
    if(!price) stages.pricing=missing("No verified exact-model supplier price observation is available for every listed component.");
    d.priceRefreshDue=partOffers.some((offers)=>offers.some((o)=>priceFreshness(o,now)==="refresh_due"));
    const availableNow=stages.availability.status==="passed";
    const eligible=d.technicalCompatible && availableNow && powerW!==null && acWh!==null;
    stages.recommendation=eligible ? passed() : missing(...Object.entries(stages).filter(([key,stage])=>key!=="pricing" && key!=="recommendation" && stage.status!=="passed").flatMap(([key,stage])=>stage.reasons.map((reason)=>`${key}: ${reason}`)));
    if((!eligible && !shortRuntimeOnly) || !availableNow || powerW===null || acWh===null) continue;
    d.classification=config.verification==="verified" && energy?.basis!=="picon_estimate" && !m.startingEvidence.some((s)=>s.basis!=="explicit_input") && (config.category!=="full" || energy?.efficiencyBasis==="manufacturer_load_relevant") ? "VERIFIED" : "ESTIMATED";
    const runtime=runtimeHours(acWh,m.backupWh,request.assumptions.backupHours);d.sizing.runtimeHours=runtime;
    specs.push({label:"Requested backup window",value:`${number(request.assumptions.backupHours)} hours`},{label:"Estimated backup runtime",value:runtime ? `About ${number(runtime)} hours at your selected average backup load` : "Picon to assess"});
    const observations=price?.lines.flatMap((l)=>l.price?.offers.map((o)=>o.retrievedAt)??[])??[];
    const referenceDate=observations.toSorted().at(-1)?.slice(0,10)??"";
    const equipment=parts.flatMap((part)=>{
      if(!part.product || !part.productId) return [];
      const itemPrice=observedProductPrice(c,part.productId,now);
      const unitPrice=itemPrice ? applyPiconMarkup(itemPrice) : null;
      const linePrice=unitPrice ? {low:Math.round(unitPrice.low*part.quantity*100)/100,high:Math.round(unitPrice.high*part.quantity*100)/100} : null;
      const p=part.product;
      const capacity=p.kind==="portable" || p.kind==="compact" ? [p.specs.nominalWh!=null ? `${number(p.specs.nominalWh)} Wh` : null,p.specs.continuousW!=null ? `${number(p.specs.continuousW)} W output` : null].filter(Boolean).join(" · ") : p.kind==="inverter" ? p.specs.continuousW!=null ? `${number(p.specs.continuousW)} W continuous output` : undefined : p.kind==="battery" ? p.specs.nominalWh!=null ? `${number(p.specs.nominalWh)} Wh nominal storage` : undefined : p.specs.watts!=null ? `${number(p.specs.watts)} W per panel` : undefined;
      return [{role:part.role,manufacturer:p.manufacturer,model:p.model,quantity:part.quantity,capacity,unitPrice,linePrice}];
    });
    const priceNote=price?`Based on the lowest and highest current exact-model supplier observations within seven days. Picon's 2% low-end and 5% high-end pricing adjustment is applied once. Latest observation: ${referenceDate}. Final supplier availability and project pricing are confirmed during assessment.`:undefined;
    const runtimeAlternative:CustomerOption={id:config.id,category:config.category,title:titles[config.category],description:descriptions[config.category],distinction:"This lower-cost option does not meet your selected backup energy requirement.",bestFit:false,meetsRequirements:false,runtimeNote:`Does not meet the requested ${(m.backupWh/1000).toFixed(2)} kWh backup energy. Estimated runtime is about ${runtime?number(runtime):"an undetermined period"} hours at your selected average backup load.`,price:price ? {low:price.low,high:price.high,referenceDate} : null,priceMethod:"exact_model_observations",priceNote,specifications:specs,equipment,solarCharging:solarChargingInfo};
    if(shortRuntimeOnly) { if(price) shortRuntimeAlternatives.push(runtimeAlternative); continue; }
    const option:CustomerOption={...runtimeAlternative,distinction:"The closest balance of output, backup energy and equipment cost for your use.",bestFit:false,meetsRequirements:true,runtimeNote:"Runtime is an estimate and varies with your load, temperature and battery condition."};
    suitable.push({option,powerW,energyWh:acWh,score:0,diagnostic:d});
  }
  if(!suitable.length){const custom=customSizedOption(c,m,now,request.assumptions.surgeSeconds);suitable.push({option:custom,powerW:m.minimumInverterW,energyWh:m.backupWh,score:0,diagnostic:{id:custom.id,category:"full",classification:"ESTIMATED",energy:null,sizing:{policyId:SIZING_POLICY.id,requiredContinuousW:m.minimumInverterW,requiredVA:m.minimumVA,requiredStartingW:m.startingW,requiredStartingVA:m.startingVA,starting:m.startingEvidence,runtimeHours:null},stages:{identity:passed(),availability:{status:"not_applicable",reasons:[]},technical:{status:"insufficient_information",reasons:["Custom equipment class requires final engineering selection."]},compatibility:{status:"insufficient_information",reasons:["No exact product pairing or PV string is claimed for this custom class."]},pricing:custom.price?passed():missing("One or more current comparable equipment prices are unavailable.") ,recommendation:passed()},technicalCompatible:false,priceRefreshDue:false,rankingScore:null}});}
  for(const s of suitable) {
    // Compatibility gates have already removed unsuitable real systems. Among
    // qualifying systems, put total estimated equipment cost first and use
    // oversizing only as a tie-breaker.
    s.score=Math.log(s.powerW/m.minimumInverterW)+Math.log(s.energyWh/m.backupWh);
    s.diagnostic.rankingScore=s.score;
  }
  suitable.sort((a,b)=>{
    const aPrice=a.option.price?(a.option.price.low+a.option.price.high)/2:Number.POSITIVE_INFINITY;
    const bPrice=b.option.price?(b.option.price.low+b.option.price.high)/2:Number.POSITIVE_INFINITY;
    return aPrice-bPrice || a.score-b.score || a.option.id.localeCompare(b.option.id);
  });
  const selected:typeof suitable=[];
  for(const category of ["portable","compact","full"] as const) {
    const group=suitable.filter((s)=>s.option.category===category),priced=group.filter((s)=>s.option.price);
    if(priced.length) {
      const frontier=priced.filter((candidate)=>!priced.some((other)=>other!==candidate&&other.option.price!.high<=candidate.option.price!.low&&other.powerW>=candidate.powerW&&other.energyWh>=candidate.energyWh&&(other.option.price!.high<candidate.option.price!.low||other.powerW>candidate.powerW||other.energyWh>candidate.energyWh)));
      for(const [index,item] of frontier.entries()) {
        item.option.distinction=index===0?"The lowest-priced option that meets your selected requirements.":"More output or stored energy for a higher equipment cost.";
        selected.push(item);
      }
      for(const item of group.filter((s)=>!s.option.price)) selected.push(item);
    } else if(group[0]) selected.push(group[0]);
  }
  const bestId=suitable.find((s)=>s.option.price)?.option.id??suitable[0]?.option.id??null;
  selected.sort((a,b)=>a.option.id===bestId ? -1 : b.option.id===bestId ? 1 : 0);
  for(const s of selected) s.option.bestFit=s.option.id===bestId;
  shortRuntimeAlternatives.sort((a,b)=>(a.price?.low??Number.POSITIVE_INFINITY)-(b.price?.low??Number.POSITIVE_INFINITY)||a.id.localeCompare(b.id));
  const customer:CustomerPlan={energy:{peakW:m.peakW,dailyWh:m.dailyWh,backupWh:m.backupWh,pvW:m.pvW,backupHours:request.assumptions.backupHours},options:selected.map((s)=>s.option),shortRuntimeAlternatives,bestFitId:bestId};
  return {customer,diagnostics};
}
