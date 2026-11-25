import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import "../scripts/solar-catalog-import.mjs";

const require=createRequire(import.meta.url),React=require("react"),{renderToStaticMarkup}=require("react-dom/server"),ts=require("typescript");
const {recommendSystems}=await import("../src/lib/solar-calculator/system-recommendations.ts");
const {DEFAULT_ASSUMPTIONS}=await import("../src/lib/solar-calculator/solar-config.ts");
const catalog=JSON.parse(await readFile(new URL("../src/lib/solar-catalog/catalog.json",import.meta.url),"utf8"));
const configs=JSON.parse(await readFile(new URL("../src/lib/solar-catalog/system-configurations.json",import.meta.url),"utf8"));
const now=new Date("2026-11-25T01:30:00Z");
const source=await readFile(new URL("../src/components/solar-calculator/system-results.tsx",import.meta.url),"utf8");
const compiled=ts.transpileModule(source,{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
const componentModule={exports:{}};
new Function("require","module","exports",compiled)((id)=>id==="next/link"?{__esModule:true,default:({href,children,...props})=>React.createElement("a",{href,...props},children)}:id==="@/lib/solar-catalog/pricing"?{INSTALLATION_NOTE:"Installation is assessed separately.",naira:(n)=>`₦${n.toLocaleString("en-NG")}`} :require(id),componentModule,componentModule.exports);
const {SystemResults}=componentModule.exports;
const req=(loads,backupHours=6)=>({loads,assumptions:{...DEFAULT_ASSUMPTIONS,backupHours},solarCharging:false});
const appliance=(id,name,watts,hours)=>({id,name,quantity:1,watts,hours,startingW:watts});
const render=(plan)=>renderToStaticMarkup(React.createElement(SystemResults,{plan,selectedId:plan.bestFitId,onSelect:()=>{},assessmentHref:"/contact?intent=solar-assessment"}));

function fullFixture(){
  const c=structuredClone(catalog),base=c.products.find(p=>p.kind==="portable");
  const inv={...c.products.find(p=>p.kind==="inverter"),id:"fixture-inverter",model:"FIXTURE-I",kind:"inverter",issues:[],specs:{continuousW:3000,apparentVA:4000,powerFactor:1,surgeVA:6000,surgeSeconds:5,batteryV:48,batteryMinV:40,batteryMaxV:60,phase:1,efficiency:.9,maxDischargeA:100,maxChargeA:50,mpptCount:1,maxPvW:4000,maxPvV:500,mpptMinV:100,mpptMaxV:450,startV:110,inputA:[30],shortCircuitA:[40],chemistry:["LiFePO4"],communication:["CAN"],protection:"IP54"}};
  const bat={...c.products.find(p=>p.kind==="battery"),id:"fixture-battery",model:"FIXTURE-B",kind:"battery",issues:[],specs:{nominalV:51.2,minV:44.8,maxV:58.4,ah:100,nominalWh:5120,usableWh:4000,dischargeA:100,chargeA:100,continuousW:4480,peakDischargeA:200,peakSeconds:5,cycleLife:4000,parallelMax:4,chemistry:"LiFePO4",communication:["CAN"],compatibleInverters:["FIXTURE-I"]}};
  const panel={...c.products.find(p=>p.kind==="panel"),id:"fixture-panel",model:"FIXTURE-P",kind:"panel",issues:[],specs:{watts:400,voc:45,vmp:36,isc:12,imp:11.12,vocTolerance:.03,vocTempCoefficient:-.003,vmpTempCoefficient:-.0045,maxSystemV:1000,efficiency:.2,dimensionsMm:[1700,1000,30],technology:"Test"}};
  c.products=[inv,bat,panel];c.offers=c.products.map((p,i)=>({...catalog.offers.find(o=>o.productId===base.id),id:`fixture-${i}`,productId:p.id,originalModel:p.model,supplierProductId:`fixture-${i}`,priceNgn:[500000,800000,120000][i],retrievedAt:now.toISOString()}));
  const doc="https://www.itel-life.com/test-fixture-not-a-real-datasheet";
  c.approvedPairs=[{inverterId:inv.id,batteryId:bat.id,sourceUrl:doc}];
  for(const p of c.products)p.technicalEvidence=[{url:doc,revision:"SYNTHETIC TEST ONLY",fields:Object.keys(p.specs),reviewedAt:now.toISOString()}];
  const configuration={id:"fixture-full",category:"full",verification:"verified",documentation:[{url:doc,revision:"SYNTHETIC TEST ONLY"}],reviewNotes:[],components:[{role:"inverter",productId:inv.id,quantity:1},{role:"battery",productId:bat.id,quantity:1},{role:"panel",productId:panel.id,quantity:4}],pv:{series:4,parallel:1},chargingA:50,bmsProtocol:"CAN",solarIncluded:true,requiredEquipmentComplete:true};
  return {c,configurationCatalog:{schemaVersion:1,version:"TEST ONLY",configurations:[configuration]}};
}

test("A: the 5.40kW / 34.14kWh / 32.40kWh request gets a priced custom system sized from current battery-module evidence",()=>{
  const request=req([appliance("main","Main load",5000,6),appliance("other","Other load",400,10.35)]);
  const {customer}=recommendSystems(catalog,configs,request,now),option=customer.options[0];
  assert.deepEqual([customer.energy.peakW,customer.energy.dailyWh,customer.energy.backupWh],[5400,34140,32400]);
  assert.equal(option.id,"custom-sized-system");assert.ok(option.price.low>0&&option.price.high>=option.price.low);
  const battery=option.equipment.find(x=>x.role==="battery");
  assert.match(battery.model,/kWh \/ 48V-class module/);
  assert.ok(battery.quantity*Number.parseFloat(battery.model)>=32.4/(0.70*0.85));
  const html=render(customer);assert.match(html,/Custom-Sized Full Solar System/);assert.match(html,/Estimated core equipment cost/);assert.match(html,/32\.4/);
});

test("Itel IPV-12K48U / IPL-51314H is enumerated from its documented supplier pairing and manufacturer battery data",()=>{
  const request=req([appliance("main","Main load",5000,6),appliance("other","Other load",400,10.35)]);
  const {diagnostics}=recommendSystems(catalog,configs,request,now);
  const candidates=diagnostics.filter((d)=>d.id.startsWith("dynamic-full-"));
  assert.ok(candidates.length>0,"the market pairing should enter technical screening");
  assert.ok(candidates.some((d)=>d.energy?.nominalWh===64000&&d.energy?.usableAcWh===64000*0.70*0.85),"four 16kWh modules are evaluated with Picon's existing conservative usable-energy factors");
  const itelCandidate=candidates.find((d)=>d.energy?.nominalWh===64000);
  assert.doesNotMatch(itelCandidate.stages.technical.reasons.join(" "),/Battery chemistry/);
  assert.match(itelCandidate.stages.technical.reasons.join(" "),/vocTolerance/);
  const battery=catalog.products.find((p)=>p.id==="itel-ipl-51314h");
  assert.deepEqual([battery.specs.nominalV,battery.specs.nominalWh,battery.specs.dischargeA,battery.specs.communication],[51.2,16000,157,["CAN","RS485"]]);
  assert.ok(battery.technicalEvidence.some((e)=>e.fields.includes("dischargeA")));
});

test("B and C: an energy-heavy request and a load beyond every single catalog inverter receive priced custom specifications",()=>{
  const cases=[
    req([appliance("critical","Critical loads",5410,5240/5410),appliance("other","Other loads",270,12)]),
    req([appliance("large","Large load",20000,4)]),
  ];
  const maxSingle=Math.max(...catalog.products.filter(p=>p.kind==="inverter").map(p=>p.specs.continuousW??0));
  for(const request of cases){
    const {customer}=recommendSystems(catalog,configs,request,now),option=customer.options[0];
    assert.ok(customer.options.length>0&&option.price?.low>0);
    assert.ok(option.specifications.some(s=>s.label==="Continuous inverter output required"));
    const html=render(customer);assert.match(html,/Custom-Sized Full Solar System/);assert.match(html,/Estimated core equipment cost/);
    if(request.loads[0].watts>maxSingle)assert.ok(option.specifications.some(s=>s.label==="Continuous inverter output required"&&parseFloat(s.value)>maxSingle/1000));
  }
});

test("D and E: supplier stock and quotation age block exact candidates and return a custom estimate",()=>{
  for(const change of [(offer)=>offer.stock="out_of_stock",(offer)=>offer.retrievedAt="2026-01-01T00:00:00.000Z"]){
    const {c,configurationCatalog}=fullFixture();change(c.offers[0]);
    const request=req([appliance("small","Small load",100,1)],2),result=recommendSystems(c,configurationCatalog,request,now);
    assert.equal(result.customer.options.some(x=>x.id.startsWith("dynamic-full-")&&x.price?.low>0),false);
    assert.ok(result.customer.options.some(x=>x.id==="custom-sized-system"));
    assert.equal(result.diagnostics[0].technicalCompatible,true);
    const html=render(result.customer);assert.match(html,/Custom-Sized Full Solar System/);assert.match(html,/Estimated core equipment cost/);
  }
});

test("F: when no product pairing is evidenced, the custom benchmark is shown without claiming a compatible model",()=>{
  const request=req([appliance("combined","Measured combined load",3280,24080/3280)]);
  const {customer}=recommendSystems(catalog,configs,request,now),option=customer.options[0];
  assert.equal(option.id,"custom-sized-system");assert.ok(option.price?.low>0);
  assert.match(option.priceNote,/does not claim that the benchmark products form a compatible package/);
  assert.equal(option.equipment.every(x=>x.manufacturer==="Market benchmark"),true);
  assert.match(render(customer),/Custom-Sized Full Solar System/);
});

test("G: both existing Scenario A portable options remain priced and render",()=>{
  const request=req([appliance("light","LED lighting",20,6),appliance("router","Router",12,24)],3);
  const {customer}=recommendSystems(catalog,configs,request,now),portable=customer.options.filter(x=>x.category==="portable");
  assert.deepEqual(portable.map(x=>x.id),["dynamic-portable-itel-iess-320act","dynamic-portable-itel-iess-05k10n","dynamic-portable-itel-iess-1k20n"]);
  assert.ok(portable.every(x=>x.price?.low>0));
  const html=render(customer);assert.match(html,/itel Energy IESS-320ACT/);assert.match(html,/itel Energy IESS-05K10N/);
});
