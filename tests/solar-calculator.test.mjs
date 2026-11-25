import assert from "node:assert/strict";
import test from "node:test";
import { readFile, writeFile, mkdtemp, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
// Also installs the native TypeScript resolution hook used by the offline importer.
import { parseCsv, applyReviewedOffers, importCatalog } from "../scripts/solar-catalog-import.mjs";
const { validateCatalog, exactModelMatches } = await import("../src/lib/solar-catalog/catalog-validation.ts");
const { productPrice, materialRange, priceBillOfMaterials, pricePackage, eligibleOffer, isCurrent } = await import("../src/lib/solar-catalog/pricing.ts");
const { loadModel, validateInputs, calculateSolar, checkInverter, checkBattery, batteryQuantity, pvConfiguration, checkPortable, monthlyFuelCost, parseNumber } = await import("../src/lib/solar-calculator/solar-calculations.ts");
const { DEFAULT_ASSUMPTIONS: a, suggestAppliance, APPLIANCES } = await import("../src/lib/solar-calculator/solar-config.ts");
const { SIZING_POLICY, estimatedAcEnergy, runtimeHours, startingEstimate, systemEnergy } = await import("../src/lib/solar-calculator/sizing-policy.ts");
const { assessmentUrl, parseAssessmentSummary } = await import("../src/lib/solar-calculator/assessment-summary.ts");
const c = JSON.parse(await readFile(new URL("../src/lib/solar-catalog/catalog.json",import.meta.url),"utf8"));
const now = new Date("2026-11-21T21:00:00Z");
const loads = [{ id:"load",name:"Measured appliance",quantity:2,watts:500,hours:1,startingW:800 }];
function fixture() {
  // SYNTHETIC engineering fixtures. These are not itel specifications or customer offers.
  const inv = { id:"test-inverter",model:"TEST-I",name:"Test inverter",manufacturer:"Test only",kind:"inverter",evidence:[],issues:[],warranty:null,specs:{ continuousW:3000,apparentVA:4000,powerFactor:1,surgeVA:6000,surgeSeconds:5,batteryV:48,batteryMinV:40,batteryMaxV:60,phase:1,efficiency:.9,maxDischargeA:100,maxChargeA:50,mpptCount:1,maxPvW:4000,maxPvV:500,mpptMinV:100,mpptMaxV:450,startV:110,inputA:[30],shortCircuitA:[40],chemistry:["LiFePO4"],communication:["CAN"],protection:"IP54" } };
  const bat = { id:"test-battery",model:"TEST-B",name:"Test battery",manufacturer:"Test only",kind:"battery",evidence:[],issues:[],warranty:null,specs:{ nominalV:51.2,minV:44.8,maxV:58.4,ah:100,nominalWh:5120,usableWh:4000,dischargeA:100,chargeA:100,continuousW:4480,peakDischargeA:200,peakSeconds:5,cycleLife:4000,parallelMax:4,chemistry:"LiFePO4",communication:["CAN"],compatibleInverters:["TEST-I"] } };
  const panel = { id:"test-panel",model:"TEST-P",name:"Test panel",manufacturer:"Test only",kind:"panel",evidence:[],issues:[],warranty:null,specs:{ watts:400,voc:45,vmp:36,isc:12,imp:11.12,vocTolerance:.03,vocTempCoefficient:-.003,vmpTempCoefficient:-.0045,maxSystemV:1000,efficiency:.2,dimensionsMm:[1700,1000,30],technology:"Test" } };
  const base = c.offers.find((o) => o.id === "visibility-6398");
  const offers = [inv,bat,panel].map((p,index) => ({ ...base,id:`test-${index}`,supplierProductId:`test-${index}`,productId:p.id,originalModel:p.model,priceNgn:[500000,800000,120000][index],variant:{},retrievedAt:now.toISOString() }));
  return { ...structuredClone(c),products:[inv,bat,panel],offers,packages:[],approvedPairs:[{ inverterId:inv.id,batteryId:bat.id,sourceUrl:"https://example.com/test-only-approval" }] };
}
test("expanded catalogue preserves source separation, all 23 unmapped primary listings and quarantine", () => {
  assert.deepEqual(validateCatalog(c),[]);
  assert.equal(c.offers.filter((o) => o.supplier==="nikade" && o.identity==="unmapped").length,23);
  assert.deepEqual(c.approvedPairs.map(({inverterId,batteryId,evidenceType})=>({inverterId,batteryId,evidenceType})),[
    {inverterId:"deye-sun-6k-og01lp1-eu-am2",batteryId:"deye-se-f5",evidenceType:undefined},
    {inverterId:"itel-ipv-12k48u",batteryId:"itel-ipl-51314h",evidenceType:"supplier_listing"},
  ]);
  assert.equal(eligibleOffer(c.offers.find((o) => o.id==="visibility-8684"),now),false);
  assert.equal(eligibleOffer(c.offers.find((o) => o.id==="visibility-12503"),now),false);
});

test("Deye SE-F5 is captured as an exact current supplier item without converting it into a complete system quote", () => {
  const inverter=c.products.find((p)=>p.id==="deye-sun-6k-og01lp1-eu-am2");
  const battery=c.products.find((p)=>p.id==="deye-se-f5");
  const offer=c.offers.find((o)=>o.id==="cdcare-se-f5-20261121");
  const observedAt=new Date(offer.retrievedAt);
  assert.equal(inverter.specs.continuousW,6000);
  assert.equal(inverter.specs.powerFactor,null);
  assert.equal(battery.specs.usableWh,null);
  assert.deepEqual(battery.specs.compatibleInverters,[inverter.model]);
  assert.equal(eligibleOffer(offer,observedAt),true);
  assert.deepEqual(materialRange([offer],observedAt),{
    low:975862.07,
    high:975862.07,
    defaultOffer:offer,
    offers:[offer],
  });
  assert.equal(c.offers.some((o)=>o.productId===inverter.id),false,"no stale/conflicting inverter quote was retained");
});

test("the newly observed integrated-system listing keeps its price and stock evidence but stays excluded while condition is unknown", () => {
  const offer=c.offers.find((o)=>o.id==="winboost-709d14eb-20261121");
  assert.equal(offer.priceNgn,2049700);
  assert.equal(offer.stock,"in_stock");
  assert.equal(offer.condition,"unknown");
  assert.equal(eligibleOffer(offer,new Date(offer.retrievedAt)),false);
  assert.equal(materialRange([offer],new Date(offer.retrievedAt)),null);
});
test("source appliance catalogue and editable suggestions retain all original defaults", () => {
  assert.equal(APPLIANCES.length,18);
  assert.deepEqual(suggestAppliance("Rice cooker"),{watts:700,hours:1});
  assert.deepEqual(suggestAppliance("LED lamps"),{watts:15,hours:6});
  assert.deepEqual(suggestAppliance("Desktop computer"),{watts:200,hours:6});
  assert.equal(suggestAppliance("backpack"),null); assert.equal(suggestAppliance("unknown widget"),null);
});
test("central policy distinguishes evidence, chemistry estimates, starting screening and runtime",()=>{
  assert.equal(SIZING_POLICY.powerHeadroom,.25);assert.equal(SIZING_POLICY.peakSunHours,4.5);assert.equal(SIZING_POLICY.pvPerformance,.75);
  assert.equal(estimatedAcEnergy(1000,"LiFePO4").usableAcWh,595);
  assert.equal(estimatedAcEnergy(1000,"lead acid").usableAcWh,425);
  assert.equal(estimatedAcEnergy(1000,"unknown"),null);
  assert.equal(runtimeHours(600,100,2),12);assert.equal(runtimeHours(null,100,2),null);
  assert.equal(startingEstimate({id:"fan",name:"Standing fan",watts:60,startingW:null}).watts,120);
  assert.equal(startingEstimate({id:"custom",name:"Mystery device",watts:60,startingW:null}).watts,null);
  assert.equal(startingEstimate({id:"custom",name:"Mystery device",watts:60,startingW:80}).basis,"explicit_input");
});
test("portable energy follows evidence priority and exact usable battery DC receives only AC conversion",()=>{
  const p=structuredClone(c.products.find((x)=>x.id==="itel-iess-320act"));
  const config={id:"test-portable",category:"portable",verification:"verified",documentation:[],reviewNotes:[],components:[{role:"unit",productId:p.id,quantity:1}],pv:null,chargingA:null,bmsProtocol:null,solarIncluded:false,requiredEquipmentComplete:true};
  const demand={peakW:100,backupWh:200,backupHours:2,powerFactor:.8};
  assert.equal(systemEnergy(p,config,demand).usableAcWh,190.4);
  const withDc={...p,kind:"compact",specs:{...p.specs,nominalWh:8038,chemistry:"LiFePO4",usableBatteryWh:7235},technicalEvidence:[{...p.technicalEvidence[0],fields:[...p.technicalEvidence[0].fields,"usableBatteryWh"]}]};
  const compactConfig={...config,id:"test-compact",category:"compact",components:[{role:"unit",productId:p.id,quantity:1}]};
  const converted=systemEnergy(withDc,compactConfig,demand);
  assert.equal(converted.usableAcWh,7235*.85);assert.equal(converted.depthOfDischarge,null);assert.equal(converted.basis,"picon_estimate");
  const exact={...withDc,specs:{...withDc.specs,usableAcWh:6000},technicalEvidence:[{...withDc.technicalEvidence[0],fields:[...withDc.technicalEvidence[0].fields,"usableAcWh"]}],energyEvidence:[{kind:"picon_measured",usableAcWh:5000,scope:{minLoadW:1,maxLoadW:1000,minPowerFactor:.5},source:{url:"https://picon.test/test",revision:"TEST ONLY"},approval:{reviewer:"Test reviewer",approvedAt:now.toISOString()}}]};
  assert.equal(systemEnergy(exact,compactConfig,demand).usableAcWh,6000);
});
test("peak, daily, backup, headroom, VA and PV are separate dimensions; schedule is capped consistently", () => {
  const m = loadModel(loads,a);
  assert.equal(m.peakW,1000);assert.equal(m.dailyWh,1000);assert.equal(m.backupWh,1000);
  assert.equal(m.minimumInverterW,1250);assert.equal(m.minimumVA,1562.5);assert.equal(m.startingW,1300);
  assert.equal(loadModel(loads,{...a,simultaneousStarts:true}).startingW,1600);
  assert.equal(m.pvW,1000/(4.5*.75));
  assert.equal(loadModel([{...loads[0],hours:24}],{...a,backupHours:6}).backupWh,6000);
  assert.equal(loadModel([{...loads[0],hours:.3}],a).dailyWh,300);
});
test("all appliance / assumption validation boundaries reject malformed values without zero coercion", () => {
  for (const patch of [{name:" "},{quantity:0},{quantity:-1},{quantity:1.2},{watts:0},{watts:-1},{watts:Infinity},{watts:NaN},{hours:0},{hours:24.1},{hours:-1},{startingW:499}]) assert.ok(validateInputs([{...loads[0],...patch}],a).length,JSON.stringify(patch));
  assert.ok(validateInputs([],a).length);
  for (const patch of [{backupHours:0},{backupHours:25},{powerFactor:0},{pvPerformance:1.1},{peakSunHours:NaN},{headroom:-1},{coldC:100}]) assert.ok(validateInputs(loads,{...a,...patch}).length);
  for (const value of [""," ","1,200","abc","-1","1.2.3","Infinity","1e3"]) assert.ok(Number.isNaN(parseNumber(value)),value);
  assert.equal(parseNumber("0.25"),.25); assert.equal(parseNumber(".5"),.5);
});
test("actual catalogue cannot silently confirm an unsupported combination or invent a price", () => {
  const result = calculateSolar(c,loads,a,now);
  assert.equal(result.verifiedSystems.length,0);
  assert.ok(result.systems.length>0);
  assert.ok(result.systems.every((s) => s.price===null));
  assert.ok(result.portable.every((s) => s.check.status!=="verified"));
});
test("documented synthetic system is sized, string-validated and priced using actual product units", () => {
  const f=fixture(), m=loadModel(loads,a), [inv,bat,panel]=f.products;
  assert.equal(checkInverter(inv,m,a).status,"verified");
  assert.equal(batteryQuantity(inv,bat,m),1);
  assert.equal(checkBattery(f,inv,bat,1,m).status,"verified");
  const pv=pvConfiguration(inv,panel,m.pvW,a);
  assert.equal(pv.status,"verified"); assert.equal(pv.quantity,4);assert.equal(pv.series,4);assert.equal(pv.parallel,1);
  const result=calculateSolar(f,loads,a,now);assert.equal(result.verifiedSystems.length,1);
  const price=result.verifiedSystems[0].price;assert.equal(price.low,1815600);assert.equal(price.high,1869000);
});
test("inverter rejects running / apparent load, phase and starting-surge overload; unknown surge blocks verification", () => {
  const f=fixture(), inv=f.products[0], m=loadModel(loads,a);
  for (const specs of [{continuousW:900},{apparentVA:1000},{phase:3}]) assert.equal(checkInverter({...inv,specs:{...inv.specs,...specs}},m,a).status,"incompatible");
  assert.equal(checkInverter(inv,{...m,startingW:null},a).status,"insufficient_information");
  assert.equal(checkInverter({...inv,specs:{...inv.specs,surgeVA:4000}},{...m,startingW:3500},a).status,"insufficient_information");
  assert.equal(checkInverter({...inv,specs:{...inv.specs,surgeSeconds:1}},{...m,startingW:3500},a).status,"insufficient_information");
});
test("battery rejects voltage, current, energy, parallel and BMS conflicts; similar voltages alone never suffice", () => {
  const f=fixture(), [inv,bat]=f.products, m=loadModel(loads,a);
  assert.equal(checkBattery({...f,approvedPairs:[]},inv,bat,1,m).status,"insufficient_information");
  for (const specs of [{nominalV:25.6},{maxV:65},{parallelMax:1},{usableWh:100},{dischargeA:1},{communication:["RS232"]},{compatibleInverters:["OTHER"]}]) {
    const q=specs.parallelMax ? 2 : 1;
    assert.equal(checkBattery(f,inv,{...bat,specs:{...bat.specs,...specs}},q,m).status,"incompatible",JSON.stringify(specs));
  }
  assert.equal(batteryQuantity(inv,{...bat,specs:{...bat.specs,usableWh:null}},m),null);
});
test("PV respects cold Voc, hot Vmp, current, maximum power and missing coefficients", () => {
  const [inv,,panel]=fixture().products;
  for (const specs of [{maxPvV:110},{inputA:[5]},{shortCircuitA:[5]},{maxPvW:500}]) assert.equal(pvConfiguration({...inv,specs:{...inv.specs,...specs}},panel,1000,a).status,"incompatible");
  assert.equal(pvConfiguration(inv,{...panel,specs:{...panel.specs,vocTempCoefficient:null}},1000,a).status,"insufficient_information");
  assert.equal(pvConfiguration(inv,panel,100000,a).status,"incompatible");
});
test("portable uses actual usable AC Wh / W and the same backup energy; charging gaps remain explicit", () => {
  const m=loadModel(loads,a),p={...fixture().products[0],kind:"portable",specs:{nominalWh:1500,usableAcWh:1200,continuousW:1500,surgeW:2000,surgeSeconds:5,solarMaxW:400,solarMinV:12,solarMaxV:60,solarMaxA:15,chemistry:"LiFePO4",charging:"AC adapter",ports:null,expansion:null}};
  const energy={usableAcWh:1200,nominalWh:1500,basis:"manufacturer",policyId:"test",depthOfDischarge:null,efficiency:null,efficiencyBasis:null,sources:[],assumptions:[],reasons:[]};
  assert.equal(checkPortable(p,m,a,false,energy).status,"verified");
  assert.equal(checkPortable({...p,specs:{...p.specs,usableAcWh:900}},m,a,false,{...energy,usableAcWh:900}).status,"incompatible");
  assert.equal(checkPortable({...p,specs:{...p.specs,solarMaxA:null}},m,a,true).status,"insufficient_information");
});
test("exact model matching does not merge PRO/non-PRO, capacity aliases or panel suffixes", () => {
  assert.equal(exactModelMatches(c,"IPV-6K48U Pro")[0].id,"itel-ipv-6k48u-pro");
  assert.equal(exactModelMatches(c,"IPV-6K48U")[0].id,"itel-ipv-6k48u");
  assert.equal(exactModelMatches(c,"6kW Inverter").length,0);
  assert.notEqual(exactModelMatches(c,"ISP-620W")[0].id,exactModelMatches(c,"ISP-620Wp")[0].id);
});
test("price reconciliation retains distinct supplier endpoints and applies Picon markup once", () => {
  const f=fixture(),o=f.offers[0], secondary={...o,supplier:"visibility",priceNgn:2000000},primary={...o,supplier:"nikade",priceNgn:2200000};
  const range=materialRange([secondary,primary],now);
  assert.equal(range.defaultOffer.supplier,"nikade");assert.equal(range.low,2000000);assert.equal(range.high,2200000);
  assert.equal(range.low,2000000);assert.equal(range.high,2200000);
  assert.equal(primary.priceNgn,2200000);
  assert.equal(materialRange([secondary],now).high,2000000);
  const c=fixture();c.offers=[secondary,primary];
  const customer=productPrice(c,o.productId,now);
  assert.deepEqual({low:customer.low,high:customer.high},{low:2040000,high:2310000});
});
test("prices exclude stock, stale, unverified, used, missing and conflicting exact variants", () => {
  const o=fixture().offers[0];
  for (const patch of [{stock:"out_of_stock"},{stock:"unknown"},{identity:"unmapped"},{condition:"used"},{priceBasis:"mixed"},{priceBasis:"unknown"},{retrievedAt:"2026-09-01T00:00:00Z"}]) assert.equal(materialRange([{...o,...patch}],now),null,JSON.stringify(patch));
  assert.equal(isCurrent({...o,retrievedAt:"2030-01-01T00:00:00Z"},now),false);
  assert.equal(productPrice(fixture(),"missing",now),null);
  const visible=fixture();visible.offers=[{...o,stock:"unknown"}];
  const visiblePrice=productPrice(visible,o.productId,now);
  assert.deepEqual({low:visiblePrice.low,high:visiblePrice.high},{low:510000,high:525000});
  assert.equal(materialRange([o,{...o,variant:{Panel:"6 units"}}],now),null);
});
test("package variants sharing SKU retain exact parent + child + option identities and kobo precision", () => {
  const x=c.offers.find((o) => o.id==="visibility-14032"),y=c.offers.find((o) => o.id==="visibility-14036");
  assert.equal(x.originalModel,y.originalModel);assert.notEqual(x.supplierProductId,y.supplierProductId);
  assert.equal(x.variant.Panel,"No Panel");assert.equal(y.variant.Panel,"620W 6unit");
  assert.equal(x.priceNgn,1017700);assert.equal(y.priceNgn,1974977.8);
  assert.equal(pricePackage(c,"visibility-kit-14032",now)?.materials??null,null);
});
test("package materials and services are separate; installation/accessories included is never added twice", () => {
  const f=fixture(),o=f.offers[0];
  f.packages=[{id:"pack",offerId:o.id,name:"Fixture only",components:[{productId:f.products[1].id,name:"already included",quantity:1}],accessories:["included cable"],protection:[],issues:[],description:"",warranty:null}];
  o.installation="included";o.accessories="included";o.priceBasis="mixed";
  assert.equal(pricePackage(f,"pack",now)?.materials??null,null);
  o.installation="excluded";o.priceBasis="materials";
  assert.equal(pricePackage(f,"pack",now).materials.low,o.priceNgn*1.02);
  assert.equal(pricePackage(f,"pack",now).materials.high,o.priceNgn*1.05);
  assert.equal(o.vat,"unknown");assert.equal(o.delivery,"unknown");
  assert.equal(priceBillOfMaterials(f,[{productId:o.productId,quantity:1},{productId:o.productId,quantity:1}],now),null);
});
test("generator estimate comes only from user measurements and accepts zero / decimal values", () => {
  assert.equal(monthlyFuelCost({fuel:"petrol",pricePerLitre:1000,litresPerHour:1.5,hoursPerDay:4}),180000);
  assert.equal(monthlyFuelCost({fuel:"diesel",pricePerLitre:0,litresPerHour:0,hoursPerDay:0}),0);
  assert.throws(() => monthlyFuelCost({fuel:"petrol",pricePerLitre:-1,litresPerHour:2,hoursPerDay:4}));
  assert.throws(() => monthlyFuelCost({fuel:"petrol",pricePerLitre:1000,litresPerHour:NaN,hoursPerDay:25}));
});
function csvRow(offer) { return {id:offer.id,supplier:offer.supplier,supplierProductId:offer.supplierProductId,parentId:offer.parentId??"",originalModel:offer.originalModel??"",variantJson:JSON.stringify(offer.variant),priceNgn:String(offer.priceNgn),currency:"NGN",stock:offer.stock,retrievedAt:now.toISOString(),sourceUrl:offer.url,verification:"Reviewed exact model, price basis and stock on supplier source."}; }
function csv(rows) { const keys=Object.keys(rows[0]);return keys.join(",")+"\n"+rows.map((r) => keys.map((k) => '"'+r[k].replaceAll('"','""')+'"').join(",")).join("\n"); }
test("offline CSV import validates identity, precision, stock, variants and reports changes", () => {
  const row=csvRow(c.offers.find((o) => o.id==="visibility-14036"));row.priceNgn="2000000.25";
  const result=applyReviewedOffers(c,parseCsv(csv([row])),"Test reviewer",now);
  assert.equal(result.catalog.offers.find((o) => o.id===row.id).priceNgn,2000000.25);
  assert.equal(result.changes[0].priceBefore,1974977.8);assert.equal(c.offers.find((o) => o.id===row.id).priceNgn,1974977.8);
  for (const patch of [{id:"missing"},{priceNgn:"123.456"},{currency:"USD"},{stock:"available"},{variantJson:'{"Panel":"4 panels"}'},{originalModel:"wrong"},{retrievedAt:"2026-01-01"},{verification:""}]) assert.throws(() => applyReviewedOffers(c,[{...row,...patch}],"Test",now));
  assert.throws(() => parseCsv('id,price\n"unclosed,12'));
  assert.throws(() => applyReviewedOffers(c,[row,row],"Test",now));
});
test("failed import leaves previous approved bytes intact; successful apply creates a byte-exact backup", async () => {
  const dir=await mkdtemp(join(tmpdir(),"picon-solar-test-")),path=join(dir,"catalog.json"),file=join(dir,"review.csv");
  const original=JSON.stringify(c);await writeFile(path,original);const row=csvRow(c.offers[0]);
  await writeFile(file,csv([{...row,priceNgn:"invalid"}]));
  await assert.rejects(importCatalog({catalogPath:path,csvPath:file,reviewer:"Test",apply:true,now}));
  assert.equal(await readFile(path,"utf8"),original);assert.equal((await readdir(dir)).length,2);
  await writeFile(file,csv([row]));await importCatalog({catalogPath:path,csvPath:file,reviewer:"Test",apply:true,now});
  const backup=(await readdir(dir)).find((n) => n.endsWith(".bak"));assert.ok(backup);assert.equal(await readFile(join(dir,backup),"utf8"),original);
});
test("catalogue rejects duplicate records, model changes, malformed unit values and unsupported variants", () => {
  const f=fixture();assert.deepEqual(validateCatalog(f),[]);
  for (const mutate of [(x) => x.offers.push(x.offers[0]),(x) => x.offers[0].originalModel="WRONG",(x) => x.products[0].specs.continuousW=-1,(x) => delete x.products[0].specs.apparentVA,(x) => x.products[0].specs.inputA=["30 A"],(x) => {x.offers[0].parentId="parent";x.offers[0].variant={};},(x) => x.offers[0].productId="missing"]) {const x=structuredClone(f);mutate(x);assert.ok(validateCatalog(x).length);}
});
test("assessment handoff reconstructs bounded plain text, ignores fabricated quote text and rejects invalid payloads", () => {
  const summary={v:1,peakW:1000,dailyWh:6000,backupHours:6,productIds:[]};
  const url=new URL(assessmentUrl(summary),"https://picon.test");assert.equal(url.searchParams.get("intent"),"solar-assessment");
  const text=parseAssessmentSummary(url.searchParams.get("solar"),c);assert.match(text,/1000 W/);assert.match(text,/6.00 kWh/);assert.match(text,/not a verified system or quotation/);
  for (const value of ["broken",JSON.stringify({...summary,quote:1}),JSON.stringify({...summary,productIds:["<script>"]}),JSON.stringify({...summary,backupHours:25}),JSON.stringify({...summary,peakW:"1000"}),"x".repeat(1201)]) assert.equal(parseAssessmentSummary(value,c),"");
});
