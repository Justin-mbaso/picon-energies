import assert from "node:assert/strict";
import test from "node:test";
import {readFile} from "node:fs/promises";
import "../scripts/solar-catalog-import.mjs";
const {recommendSystems,validateConfigurations}=await import("../src/lib/solar-calculator/system-recommendations.ts");
const {parseCalculatorRequest}=await import("../src/lib/solar-calculator/calculator-request.ts");
const {parseAssessmentSummary,assessmentUrl}=await import("../src/lib/solar-calculator/assessment-summary.ts");
const {capacityPriceBenchmark,observedProductPrice,priceFreshness,materialRange}=await import("../src/lib/solar-catalog/pricing.ts");
const {DEFAULT_ASSUMPTIONS}=await import("../src/lib/solar-calculator/solar-config.ts");
const {diagnoseActualCatalog}=await import("../scripts/solar-catalog-diagnostics.mjs");
const catalog=JSON.parse(await readFile(new URL("../src/lib/solar-catalog/catalog.json",import.meta.url),"utf8"));
const actualConfigs=JSON.parse(await readFile(new URL("../src/lib/solar-catalog/system-configurations.json",import.meta.url),"utf8"));
const now=new Date("2026-11-25T01:30:00Z");
const request={loads:[{id:"test",name:"Measured test load",quantity:1,watts:100,hours:4,startingW:100}],assumptions:{...DEFAULT_ASSUMPTIONS,backupHours:2},solarCharging:false};
function unitFixture() {
  // Isolated algorithm fixtures, never supplier data or evidence of real product suitability.
  const c=structuredClone(catalog),base=c.products.find((p)=>p.kind==="portable");c.products=[];c.offers=[];c.packages=[];
  const configs={schemaVersion:1,version:"TEST ONLY",configurations:[]};
  for(const [index,w,wh,price,kind] of [[1,200,300,300000,"portable"],[2,400,600,200000,"portable"],[3,1000,2000,600000,"portable"],[4,1500,2500,900000,"compact"]]) {
    const id=`test-unit-${index}`,specs={...base.specs,continuousW:w,nominalWh:wh+100,usableAcWh:wh,charging:"AC adapter",surgeW:null,surgeSeconds:null,solarMaxW:null,solarMinV:null,solarMaxV:null,solarMaxA:null};
    if(kind==="compact")specs.apparentVA=2000;
    const product={...base,id,model:`TEST-${index}`,kind,specs,issues:["Non-critical product photograph is missing."],technicalEvidence:[{url:"https://www.itel-life.com/test-fixture-not-a-real-datasheet",revision:"SYNTHETIC TEST ONLY",fields:["continuousW","nominalWh","chemistry","usableAcWh","charging","apparentVA"],reviewedAt:now.toISOString()}]};
    c.products.push(product);
    c.offers.push({...catalog.offers.find((o)=>o.productId===base.id),id:`test-offer-${index}`,productId:id,originalModel:product.model,supplierProductId:`test-${index}`,stock:"in_stock",priceNgn:price,retrievedAt:now.toISOString()});
    configs.configurations.push({id:`test-option-${index}`,category:kind,verification:"verified",documentation:[{url:"https://www.itel-life.com/test-fixture-not-a-real-datasheet",revision:"SYNTHETIC TEST ONLY"}],reviewNotes:[],components:[{role:"unit",productId:id,quantity:1}],pv:null,chargingA:null,bmsProtocol:null,solarIncluded:false,requiredEquipmentComplete:true});
  }
  return {c,configs};
}
test("actual catalogue A–F scenarios distinguish preliminary estimates from blocked configurations",()=>{
  const report=diagnoseActualCatalog(now);assert.equal(report.scenarios.length,6);
  for(const scenario of report.scenarios) assert.ok(scenario.diagnostics.length>0);
  const a=report.scenarios[0];
  assert.ok(a.suitableConfigurations.length>0);
  assert.ok(a.suitableConfigurations.every((x)=>x.id.startsWith("dynamic-")||x.id==="custom-sized-system"));
  assert.ok(a.suitableConfigurations.every((x)=>x.runtimeNote.includes("estimate")&&x.specifications.some((s)=>s.label==="Estimated usable AC energy")));
  assert.equal(a.suitableConfigurations[0].bestFit,true);
  for(const scenario of report.scenarios.slice(1)) assert.ok(scenario.suitableConfigurations.length>0,scenario.id);
  const d=report.scenarios[0].diagnostics;
  assert.equal(d.some((entry)=>/^(portable|compact|full)-0/.test(entry.id)),false,"historical configurations are not current candidates");
  const dynamic320=d.find((entry)=>entry.id==="dynamic-portable-itel-iess-320act");
  assert.equal(dynamic320.classification,"ESTIMATED");assert.equal(dynamic320.energy?.basis,"picon_estimate");
});
test("historical fixed Deye preliminary candidate is not returned as a recommendation",()=>{
  const scenario={loads:[{id:"combined",name:"Measured combined load",quantity:1,watts:3280,hours:24080/3280,startingW:3280}],assumptions:{...DEFAULT_ASSUMPTIONS,backupHours:6},solarCharging:false};
  const config=actualConfigs.configurations.find((x)=>x.id==="deye-residential-01");
  assert.deepEqual(config.components.map(({role,productId,quantity})=>({role,productId,quantity})),[
    {role:"inverter",productId:"deye-sun-6k-og01lp1-eu-am2",quantity:1},
    {role:"battery",productId:"deye-se-f5",quantity:8},
    {role:"panel",productId:"jinko-jkm585n-72hl4-bdv",quantity:18},
  ]);
  const {customer,diagnostics}=recommendSystems(catalog,actualConfigs,scenario,now);
  assert.deepEqual([customer.energy.peakW,customer.energy.dailyWh,customer.energy.backupWh], [3280,24080,19680]);
  assert.equal(config.pv.series*config.pv.parallel*2,18);
  assert.ok(Math.abs(config.pv.series*52.7*(1-.0025*(10-25))-492.08625)<1e-9);
  assert.equal(config.pv.parallel*13.29,13.29);
  assert.ok(14.01*1.25<27);
  assert.equal(diagnostics.some((x)=>x.id===config.id),false);
  assert.equal(customer.options.some((o)=>o.id===config.id),false);
  assert.ok(customer.options.some((o)=>o.id==="custom-sized-system"));
  assert.equal(config.equipmentRequirements.length,9);
});
test("configuration validation covers identity, exact physical class, duplicates and reviewed quantities",()=>{
  assert.deepEqual(validateConfigurations(actualConfigs,catalog),[]);
  const bad=structuredClone(actualConfigs);bad.configurations.push(bad.configurations[0]);assert.ok(validateConfigurations(bad,catalog).length);
  const {c,configs}=unitFixture();configs.configurations[0].components[0].quantity=0;assert.ok(validateConfigurations(configs,c).length);
});
test("portable checks do not require hybrid MPPT fields, optional surge data or photographs when irrelevant",()=>{
  const {c,configs}=unitFixture();const {customer,diagnostics}=recommendSystems(c,configs,request,now);
  assert.ok(customer.options.some((o)=>o.category==="portable"));
  assert.ok(customer.options.some((o)=>o.category==="compact"));
  assert.equal(diagnostics[0].technicalCompatible,true);
  assert.equal(customer.options.filter((o)=>o.bestFit).length,1);
});
test("ranking puts the lowest-cost qualifying system first and retains a meaningful alternative",()=>{
  const {c,configs}=unitFixture();const {customer}=recommendSystems(c,configs,request,now);
  assert.equal(customer.bestFitId,"dynamic-portable-test-unit-2");
  assert.ok(customer.options.some((o)=>o.id==="dynamic-portable-test-unit-2"));
  assert.equal(customer.options.filter((o)=>o.category==="portable").length,2,"keep the higher-capacity option when its extra capacity is a meaningful choice");
});
test("the global best fit is first even when systems span portable and compact categories",()=>{
  const {c,configs}=unitFixture(),unit=c.products.find((p)=>p.kind==="compact");
  unit.specs.continuousW=130;unit.specs.usableAcWh=220;c.offers.find((o)=>o.productId===unit.id).priceNgn=300000;
  const plan=recommendSystems(c,configs,request,now).customer;
  assert.equal(plan.options[0].category,"portable");assert.equal(plan.options[0].id,plan.bestFitId);
});
test("pricing is independent: missing prices preserve technically suitable options",()=>{
  const {c,configs}=unitFixture();c.offers.forEach((offer)=>offer.priceNgn=null);
  const {customer,diagnostics}=recommendSystems(c,configs,request,now);
  assert.equal(diagnostics[0].technicalCompatible,true);assert.equal(diagnostics[0].stages.pricing.status,"insufficient_information");
  assert.equal(customer.options.find((o)=>o.id==="dynamic-portable-test-unit-1").price,null);
});
test("out-of-stock exact systems are not offered and missing technical evidence remains blocked",()=>{
  for(const stock of ["out_of_stock","unknown"]) {
    const {c,configs}=unitFixture();c.offers[0].stock=stock;
    const result=recommendSystems(c,{...configs,configurations:[configs.configurations[0]]},request,now);
    assert.equal(result.customer.options.some((o)=>o.id==="dynamic-portable-test-unit-1"),false);
    assert.notEqual(result.customer.options[0].id,"dynamic-portable-test-unit-1");
    assert.equal(result.diagnostics[0].stages.availability.status,"failed");
  }
  const incompleteFixture=unitFixture();incompleteFixture.c.products[0].technicalEvidence[0].fields.splice(1,3);
  const incomplete=recommendSystems(incompleteFixture.c,incompleteFixture.configs,request,now);
  assert.equal(incomplete.customer.options.some((o)=>o.id==="dynamic-portable-test-unit-1"),false,"a raw product without required evidence cannot generate an exact candidate");
  const estimateFixture=unitFixture();estimateFixture.c.products[0].specs.usableAcWh=null;
  const estimate=recommendSystems(estimateFixture.c,{...estimateFixture.configs,configurations:[estimateFixture.configs.configurations[0]]},request,now).customer.options[0];
  assert.equal(estimate?.runtimeNote.includes("estimate"),true,"documented nominal capacity uses a visibly estimated runtime");
  const largeFixture=unitFixture();assert.equal(recommendSystems(largeFixture.c,largeFixture.configs,{...request,loads:[{...request.loads[0],watts:50000,startingW:50000}]},now).customer.options[0].id,"custom-sized-system");
  largeFixture.configs.configurations.forEach((x)=>x.verification="review_required");
  const estimated=recommendSystems(largeFixture.c,largeFixture.configs,request,now).customer.options;
  assert.ok(estimated.length>0);assert.ok(estimated.every((o)=>!o.bestFit||o.runtimeNote.includes("estimate")));
});
test("solar charging still requires manufacturer limits and an included reviewed charging kit",()=>{
  const {c,configs}=unitFixture();assert.equal(recommendSystems(c,configs,{...request,solarCharging:true},now).customer.options[0].id,"custom-sized-system");
});
test("integrated output VA is checked separately from W; malformed monetary magnitudes never receive a price",()=>{
  const {c,configs}=unitFixture();const config=configs.configurations.find(x=>x.category==="compact");
  const unit=c.products.find(p=>p.kind==="compact");unit.specs.apparentVA=100;
  assert.equal(recommendSystems(c,{...configs,configurations:[config]},request,now).customer.options.some(o=>o.id==="dynamic-compact-test-unit-4"),false);
  const offer={...c.offers[0],priceNgn:1e308};assert.equal(materialRange([offer],now),null);
});
function fullFixture() {
  // The existing Phase 2 engineering fixture, not a real reviewed supplier system.
  const {c}=unitFixture();
  const inv={...catalog.products.find(p=>p.kind==="inverter"),id:"fixture-inverter",model:"FIXTURE-I",kind:"inverter",issues:[],specs:{continuousW:3000,apparentVA:4000,powerFactor:1,surgeVA:6000,surgeSeconds:5,batteryV:48,batteryMinV:40,batteryMaxV:60,phase:1,efficiency:.9,maxDischargeA:100,maxChargeA:50,mpptCount:1,maxPvW:4000,maxPvV:500,mpptMinV:100,mpptMaxV:450,startV:110,inputA:[30],shortCircuitA:[40],chemistry:["LiFePO4"],communication:["CAN"],protection:"IP54"}};
  const bat={...catalog.products.find(p=>p.kind==="battery"),id:"fixture-battery",model:"FIXTURE-B",kind:"battery",issues:[],specs:{nominalV:51.2,minV:44.8,maxV:58.4,ah:100,nominalWh:5120,usableWh:4000,dischargeA:100,chargeA:100,continuousW:4480,peakDischargeA:200,peakSeconds:5,cycleLife:4000,parallelMax:4,chemistry:"LiFePO4",communication:["CAN"],compatibleInverters:["FIXTURE-I"]}};
  const panel={...catalog.products.find(p=>p.kind==="panel"),id:"fixture-panel",model:"FIXTURE-P",kind:"panel",issues:[],specs:{watts:400,voc:45,vmp:36,isc:12,imp:11.12,vocTolerance:.03,vocTempCoefficient:-.003,vmpTempCoefficient:-.0045,maxSystemV:1000,efficiency:.2,dimensionsMm:[1700,1000,30],technology:"Test"}};
  c.products=[inv,bat,panel];c.offers=c.products.map((p,i)=>({...c.offers[0],id:`fixture-offer-${i}`,supplierProductId:`fixture-${i}`,productId:p.id,originalModel:p.model,priceNgn:[500000,800000,120000][i]}));
  const doc="https://www.itel-life.com/test-fixture-not-a-real-datasheet";
  c.approvedPairs=[{inverterId:inv.id,batteryId:bat.id,sourceUrl:doc}];
  for(const p of c.products)p.technicalEvidence=[{url:doc,revision:"SYNTHETIC TEST ONLY",fields:Object.keys(p.specs),reviewedAt:now.toISOString()}];
  const config={id:"fixture-full",category:"full",verification:"verified",documentation:[{url:doc,revision:"SYNTHETIC TEST ONLY"}],reviewNotes:[],components:[{role:"inverter",productId:inv.id,quantity:1},{role:"battery",productId:bat.id,quantity:1},{role:"panel",productId:panel.id,quantity:4}],pv:{series:4,parallel:1},chargingA:50,bmsProtocol:"CAN",solarIncluded:true,requiredEquipmentComplete:true};
  return {c,configs:{schemaVersion:1,version:"TEST ONLY",configurations:[config]}};
}
test("documented full-system algorithm validates a request-specific BOQ / string layout and uses observed prices",()=>{
  const {c,configs}=fullFixture();const result=recommendSystems(c,configs,request,now);
  assert.equal(result.customer.options[0].category,"full");
  assert.equal(result.customer.options[0].price.low,1815600);assert.equal(result.customer.options[0].price.high,1869000);
  assert.equal(result.diagnostics[0].technicalCompatible,true);
  assert.ok(result.customer.options[0].specifications.some(s=>s.label==="Solar panels" && s.value==="4 × 400 W"));
});
test("dynamic full-system candidate needs documented pairing and PV data; legacy config metadata is ignored",()=>{
  for(const mutate of [(c)=>c.approvedPairs=[],(c)=>c.products[2].specs.vocTempCoefficient=null]) {
    const {c,configs}=fullFixture();mutate(c);const options=recommendSystems(c,configs,request,now).customer.options;
    assert.equal(options.some((o)=>o.category==="full"&&o.id.startsWith("dynamic-full-")),false);
    assert.ok(options.some((o)=>o.id==="custom-sized-system"));
  }
  const {c,configs}=fullFixture();configs.configurations[0].pv.series=100;
  assert.ok(recommendSystems(c,configs,request,now).customer.options.some((o)=>o.category==="full"&&o.id.startsWith("dynamic-full-")));
});
test("historical and out-of-stock exact prices are excluded from current estimates and benchmarks",()=>{
  const c=structuredClone(catalog),battery=c.offers.find((o)=>o.productId==="itel-ipl-51314h");
  assert.equal(battery.stock,"out_of_stock");
  battery.retrievedAt="2026-10-01T00:00:00.000Z";
  const exact=observedProductPrice(c,battery.productId,now);
  assert.equal(exact,null);
  const market=capacityPriceBenchmark(c,"battery",now);
  assert.equal(market?.evidence.some((x)=>x.model==="IPL-51314H")??false,false);
});
test("prices flag refresh after 24 hours, suppress after seven days and retain exact raw observations",()=>{
  const o={...catalog.offers[0],retrievedAt:now.toISOString()};
  assert.equal(priceFreshness(o,now),"current");
  assert.equal(priceFreshness(o,new Date(now.getTime()+25*3600000)),"refresh_due");
  assert.equal(priceFreshness(o,new Date(now.getTime()+7*86400000+1)),"expired");
  assert.equal(materialRange([o],new Date(now.getTime()+7*86400000+1)),null);
  assert.equal(o.retrievedAt,now.toISOString());
});
test("customer response exposes equipment models but not suppliers, URLs or internal rejection reasons",()=>{
  const {c,configs}=unitFixture();const customer=recommendSystems(c,configs,request,now).customer;const json=JSON.stringify(customer);
  assert.doesNotMatch(json,/nikade|visibility|https:|diagnostic|productId/i);
  assert.match(json,/Portable Power System/);assert.match(json,/referenceDate/);
  const option=customer.options.find((o)=>o.id===customer.bestFitId);
  assert.ok(option.equipment.some((item)=>item.manufacturer&&item.model));
  assert.ok(option.price.low>0);assert.ok(option.price.high>=option.price.low);
});
test("strict API request boundary rejects extra fields, unsupported values and malformed appliance data",()=>{
  assert.ok(parseCalculatorRequest(request));
  for(const value of [null,{...request,secret:1},{...request,solarCharging:"yes"},{...request,loads:[{...request.loads[0],watts:"100"}]},{...request,loads:[{...request.loads[0],hours:25}]},{...request,assumptions:{...request.assumptions,powerFactor:0}},{...request,loads:[{...request.loads[0],id:"<script>"}]}])assert.equal(parseCalculatorRequest(value),null);
});
test("assessment v2 handoff accepts only bounded metrics and a known reviewed configuration; prices are server-reconstructed",()=>{
  const {c,configs}=unitFixture(),summary={v:2,peakW:100,dailyWh:400,backupWh:200,backupHours:2,configurationId:"test-option-1"};
  const url=new URL(assessmentUrl(summary),"https://picon.test");const message=parseAssessmentSummary(url.searchParams.get("solar"),c,configs,now);
  assert.match(message,/Portable Power System/);assert.match(message,/306,000–₦315,000/);assert.doesNotMatch(message,/TEST-\d\b|itel|visibility/i);
  assert.equal(parseAssessmentSummary(JSON.stringify({...summary,configurationId:"made-up"}),c,configs,now),"");
  assert.equal(parseAssessmentSummary(JSON.stringify({...summary,priceLow:1}),c,configs,now),"");
  assert.ok(parseAssessmentSummary(JSON.stringify({...summary,configurationId:null}),catalog,actualConfigs,now));
});
test("assessment v3 handoff validates the bounded calculator request and reconstructs the selected estimate server-side",()=>{
  const {c,configs}=unitFixture();
  const selected=recommendSystems(c,configs,request,now).customer.options.find((option)=>option.category==="portable");
  const payload={v:3,request:{...request,loads:[{...request.loads[0],startingW:null,name:"LED light"}]},configurationId:selected.id};
  const url=new URL(assessmentUrl(payload),"https://picon.test");
  const message=parseAssessmentSummary(url.searchParams.get("solar"),c,configs,now);
  assert.match(message,/Preliminary Picon sizing estimate/);assert.match(message,/Portable Power System/);
  assert.doesNotMatch(message,/TEST-\d\b|itel|visibility|https:|diagnostic/i);
  assert.equal(parseAssessmentSummary(JSON.stringify({...payload,request:{...payload.request,secret:"bad"}}),c,configs,now),"");
});
