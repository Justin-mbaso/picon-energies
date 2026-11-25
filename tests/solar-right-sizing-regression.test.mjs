import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import "../scripts/solar-catalog-import.mjs";

const require=createRequire(import.meta.url),React=require("react"),{renderToStaticMarkup}=require("react-dom/server"),ts=require("typescript");
const {integrateResearchCatalog,integrateResearchConfigurations}=await import("../src/lib/solar-catalog/research-integration.ts");
const {recommendSystems}=await import("../src/lib/solar-calculator/system-recommendations.ts");
const {assessmentUrl,parseAssessmentSummary}=await import("../src/lib/solar-calculator/assessment-summary.ts");
const {capacityPriceBenchmark}=await import("../src/lib/solar-catalog/pricing.ts");
const {DEFAULT_ASSUMPTIONS}=await import("../src/lib/solar-calculator/solar-config.ts");
const catalogSource=JSON.parse(await readFile(new URL("../src/lib/solar-catalog/catalog.json",import.meta.url),"utf8"));
const configurationsSource=JSON.parse(await readFile(new URL("../src/lib/solar-catalog/system-configurations.json",import.meta.url),"utf8"));
const delta=JSON.parse(await readFile(new URL("../picon_research/catalogue_delta.json",import.meta.url),"utf8"));
const catalog=integrateResearchCatalog(catalogSource,delta),configurations=integrateResearchConfigurations(configurationsSource,delta);
const now=new Date("2026-11-25T01:30:00Z");
const source=await readFile(new URL("../src/components/solar-calculator/system-results.tsx",import.meta.url),"utf8");
const compiled=ts.transpileModule(source,{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
const componentModule={exports:{}};
new Function("require","module","exports",compiled)((id)=>id==="next/link"?{__esModule:true,default:({href,children,...props})=>React.createElement("a",{href,...props},children)}:id==="@/lib/solar-catalog/pricing"?{INSTALLATION_NOTE:"Installation is assessed separately.",naira:(n)=>`₦${n.toLocaleString("en-NG")}`}:require(id),componentModule,componentModule.exports);
const {SystemResults}=componentModule.exports;
const render=(plan,href="/contact?intent=solar-assessment")=>renderToStaticMarkup(React.createElement(SystemResults,{plan,selectedId:plan.bestFitId,onSelect:()=>{},assessmentHref:href}));
const load=(id,name,watts,hours)=>({id,name,quantity:1,watts,hours,startingW:watts});
const request=(loads,backupHours=6)=>({loads,assumptions:{...DEFAULT_ASSUMPTIONS,backupHours},solarCharging:false});

test("135 W / 930 Wh / 810 Wh load returns a dynamically chosen full match plus explicit shorter-runtime alternatives",()=>{
  const submitted=request([load("bulb","LED bulb",10,6),load("fan","Standing fan",60,8),load("laptop","Laptop",65,6)]);
  const {customer:plan,diagnostics}=recommendSystems(catalog,configurations,submitted,now);
  assert.deepEqual([plan.energy.peakW,plan.energy.dailyWh,plan.energy.backupWh,plan.energy.backupHours],[135,930,810,6]);
  const full=plan.options.find(({bestFit})=>bestFit);
  assert.ok(full);
  assert.equal(full.category,"portable");
  assert.equal(full.equipment[0].model,"IESS-1K20N");
  assert.equal(full.equipment[0].capacity,"2,009.6 Wh · 1,000 W output");
  assert.deepEqual({low:full.price.low,high:full.price.high},{low:641580,high:660660});
  assert.ok(full.specifications.some(({label,value})=>label==="Estimated usable AC energy"&&value==="1.2 kWh"));
  assert.ok(full.specifications.some(({label,value})=>label==="Estimated backup runtime"&&value.includes("8.86")));
  assert.ok(!plan.options.some(({equipment=[]})=>equipment.some(({model})=>model==="IESS-3K680N")));
  const smaller=plan.shortRuntimeAlternatives??[];
  assert.deepEqual(smaller.map(({equipment})=>equipment[0].model),["IESS-320ACT","IESS-05K10N"]);
  assert.ok(smaller.every((option)=>option.meetsRequirements===false));
  assert.ok(smaller.every((option)=>option.runtimeNote.includes("Does not meet the requested 0.81 kWh")));
  assert.ok(smaller.find(({equipment})=>equipment[0].model==="IESS-320ACT").runtimeNote.includes("1.41"));
  assert.ok(smaller.find(({equipment})=>equipment[0].model==="IESS-05K10N").runtimeNote.includes("4.43"));
  const html=render(plan);
  assert.match(html,/Your suitable systems/);
  assert.match(html,/itel Energy IESS-1K20N/);
  assert.match(html,/Shorter-runtime alternatives/);
  assert.match(html,/itel Energy IESS-320ACT/);
  assert.match(html,/itel Energy IESS-05K10N/);
  assert.doesNotMatch(html,/IESS-3K680N|Confirm panel selection against the documented input range/);
  assert.ok(diagnostics.some(({id})=>id==="dynamic-portable-itel-iess-1k20n"));

  const chosen=plan.bestFitId;
  const handoff=new URL(assessmentUrl({v:3,request:submitted,configurationId:chosen}),"https://picon.test");
  const summary=parseAssessmentSummary(handoff.searchParams.get("solar"),catalog,configurations,now);
  assert.match(summary,/Selected system: Portable Power System/);
  assert.match(summary,new RegExp(`Configuration reference: ${chosen}`));
  assert.match(summary,/Equipment estimate: ₦641,580–₦660,660/);
});

test("135 W / 930 Wh / 12-hour backup selects the lowest-cost fully supported current system",()=>{
  const submitted=request([load("bulbs","LED bulbs",10,6),load("fan","Standing fan",60,8),load("laptop","Laptop",65,6)],12);
  const {customer:plan}=recommendSystems(catalog,configurations,submitted,now);
  assert.deepEqual([plan.energy.peakW,plan.energy.dailyWh,plan.energy.backupWh,plan.energy.backupHours],[135,930,930,12]);
  const full=plan.options.find(({bestFit})=>bestFit);
  assert.equal(full.equipment[0].model,"IESS-1K20N");
  assert.equal(full.price.low,641580);assert.equal(full.price.high,660660);
  assert.ok(full.specifications.some(({label,value})=>label==="Estimated usable AC energy"&&value==="1.2 kWh"));
  assert.ok(full.specifications.some(({label,value})=>label==="Estimated backup runtime"&&value.includes("15.43")));
  assert.deepEqual(plan.shortRuntimeAlternatives.map(({equipment})=>equipment[0].model),["IESS-320ACT","IESS-05K10N"]);
  assert.ok(plan.shortRuntimeAlternatives.every((item)=>item.meetsRequirements===false));
  assert.ok(full.priceNote.includes("2% low-end and 5% high-end"));
});

test("5.40 kW / 34.14 kWh / 32.40 kWh request receives a custom specification sized to all requirements",()=>{
  const submitted=request([load("main","Main load",5000,6),load("other","Other load",400,10.35)]);
  const {customer:plan}=recommendSystems(catalog,configurations,submitted,now),custom=plan.options.find(({id})=>id==="custom-sized-system");
  assert.deepEqual([plan.energy.peakW,plan.energy.dailyWh,plan.energy.backupWh],[5400,34140,32400]);
  assert.ok(custom);
  const continuous=custom.specifications.find(({label})=>label==="Continuous inverter output required");
  const usable=custom.specifications.find(({label})=>label==="Estimated usable AC energy");
  assert.equal(continuous.value,"6.75 kW");
  const battery=custom.equipment.find(({role})=>role==="battery");
  assert.ok(battery.quantity*Number.parseFloat(battery.model)>=32.4/(0.70*0.85));
  assert.ok(Number.parseFloat(usable.value)>=32.4);
  assert.equal(custom.priceMethod,"capacity_market_benchmark");
  assert.match(render(plan),/Custom-Sized Full Solar System/);
});

test("5.68 kW / 8.48 kWh / 6.86 kWh request is independently sized without promoting a legacy package",()=>{
  const submitted=request([load("critical","Critical loads",5410,5240/5410),load("other","Other loads",270,12)]);
  const {customer:plan}=recommendSystems(catalog,configurations,submitted,now),custom=plan.options.find(({id})=>id==="custom-sized-system");
  assert.deepEqual([plan.energy.peakW,plan.energy.dailyWh,plan.energy.backupWh],[5680,8480,6860]);
  assert.ok(custom);
  assert.equal(custom.specifications.find(({label})=>label==="Continuous inverter output required").value,"7.1 kW");
  assert.ok(Number.parseFloat(custom.specifications.find(({label})=>label==="Estimated usable AC energy").value)>=6.86);
  assert.ok(!plan.options.some(({equipment=[]})=>equipment.some(({model})=>model==="IESS-3K680N")));
  assert.match(render(plan),/Custom-Sized Full Solar System/);
});

test("custom high-output banks size battery quantity for documented continuous discharge current",()=>{
  const submitted=request([load("workshop","Workshop load",20000,1)]);
  const {customer:plan}=recommendSystems(catalog,configurations,submitted,now),custom=plan.options.find(({id})=>id==="custom-sized-system");
  assert.ok(custom);
  const battery=custom.equipment.find(({role})=>role==="battery");
  const batteryBenchmark=capacityPriceBenchmark(catalog,"battery",now,20000/(0.70*0.85))?.referenceProduct;
  assert.ok(batteryBenchmark);
  const piconEfficiency=0.85;
  const modulesRequiredForRunningCurrent=Math.ceil(20000/(Math.min(batteryBenchmark.specs.dischargeA*batteryBenchmark.specs.minV,batteryBenchmark.specs.continuousW??Number.POSITIVE_INFINITY)*piconEfficiency));
  assert.ok(battery.quantity>=modulesRequiredForRunningCurrent);
  assert.ok(custom.specifications.some(({label,value})=>label==="Starting current screen"&&value.includes("A")));
});
