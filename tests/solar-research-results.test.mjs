import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";
import "../scripts/solar-catalog-import.mjs";
const require=createRequire(import.meta.url),React=require("react"),{renderToStaticMarkup}=require("react-dom/server"),ts=require("typescript");
const {readFile}=await import("node:fs/promises");
const {integrateResearchCatalog,integrateResearchConfigurations}=await import("../src/lib/solar-catalog/research-integration.ts");
const delta=JSON.parse(await readFile(new URL("../picon_research/catalogue_delta.json",import.meta.url),"utf8"));
const solarCatalog=integrateResearchCatalog(JSON.parse(await readFile(new URL("../src/lib/solar-catalog/catalog.json",import.meta.url),"utf8")),delta);
const systemConfigurations=integrateResearchConfigurations(JSON.parse(await readFile(new URL("../src/lib/solar-catalog/system-configurations.json",import.meta.url),"utf8")),delta);
const {recommendSystems}=await import("../src/lib/solar-calculator/system-recommendations.ts");
const {DEFAULT_ASSUMPTIONS}=await import("../src/lib/solar-calculator/solar-config.ts");
const source=await import("node:fs/promises").then(({readFile})=>readFile(new URL("../src/components/solar-calculator/system-results.tsx",import.meta.url),"utf8"));
const compiled=ts.transpileModule(source,{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
const componentModule={exports:{}};const componentRequire=(id)=>id==="next/link"?{__esModule:true,default:({href,children,...props})=>React.createElement("a",{href,...props},children)}:id==="@/lib/solar-catalog/pricing"?{INSTALLATION_NOTE:"Installation separately assessed.",naira:(n)=>`₦${n.toLocaleString("en-NG")}`} : require(id);
new Function("require","module","exports",compiled)(componentRequire,componentModule,componentModule.exports);
const {SystemResults}=componentModule.exports;
const now=new Date("2026-11-25T01:30:00Z");

test("5.68 kW scenario returns a custom-sized, capacity-priced recommendation without promoting unsupported products",()=>{
  const request={loads:[{id:"critical",name:"Critical loads",quantity:1,watts:5410,hours:5240/5410,startingW:5410},{id:"other",name:"Other loads",quantity:1,watts:270,hours:12,startingW:270}],assumptions:{...DEFAULT_ASSUMPTIONS,backupHours:6},solarCharging:false};
  const result=recommendSystems(solarCatalog,systemConfigurations,request,now),plan=result.customer;
  assert.deepEqual([plan.energy.peakW,plan.energy.dailyWh,plan.energy.backupWh,plan.energy.backupHours],[5680,8480,6860,6]);
  assert.ok(plan.options.some((option)=>option.id==="custom-sized-system"&&option.priceMethod==="capacity_market_benchmark"&&option.price?.low>0));
  assert.equal(result.diagnostics.some(({id})=>/^(portable|compact|full)-\d/.test(id)),false);
  assert.ok(result.diagnostics.some(({id})=>id.startsWith("dynamic-full-")));
  const markup=renderToStaticMarkup(React.createElement(SystemResults,{plan,selectedId:null,onSelect:()=>{},assessmentHref:"/contact?intent=solar-assessment"}));
  assert.match(markup,/Custom-Sized Full Solar System/);
  assert.match(markup,/Estimated core equipment cost/);
  assert.match(markup,/₦/);
  assert.doesNotMatch(markup,/Let’s find the right fit together|526,830|630,000|incomplete materials/i);
  assert.match(markup,/Request a Solar Assessment/);
  assert.match(markup,/property, installation requirements, equipment arrangement and site-specific needs before confirming the project cost/);
  assert.doesNotMatch(markup,/SolarVillage|Sygnite|deye-6k-og|research-offer|https:/i);
});

test("Scenario A retains the two existing portable recommendations after the delta merge",()=>{
  const request={loads:[{id:"light",name:"LED lighting",quantity:2,watts:10,hours:6,startingW:10},{id:"router",name:"Router",quantity:1,watts:12,hours:24,startingW:12}],assumptions:{...DEFAULT_ASSUMPTIONS,backupHours:3},solarCharging:false};
  const plan=recommendSystems(solarCatalog,systemConfigurations,request,now).customer;
  assert.deepEqual([plan.energy.peakW,plan.energy.dailyWh,plan.energy.backupWh],[32,408,96]);
  assert.deepEqual(plan.options.filter((x)=>x.category==="portable").map((x)=>x.id),["dynamic-portable-itel-iess-320act","dynamic-portable-itel-iess-05k10n","dynamic-portable-itel-iess-1k20n"]);
  for(const [id,model,price] of [["dynamic-portable-itel-iess-320act","IESS-320ACT",145200],["dynamic-portable-itel-iess-05k10n","IESS-05K10N",308000]]){
    const option=plan.options.find(x=>x.id===id);assert.equal(option.equipment[0].model,model);assert.deepEqual(option.equipment[0].linePrice,{low:Math.round(price*1.02),high:Math.round(price*1.05)});
  }
  const markup=renderToStaticMarkup(React.createElement(SystemResults,{plan,selectedId:"dynamic-portable-itel-iess-320act",onSelect:()=>{},assessmentHref:"/contact?intent=solar-assessment"}));
  assert.match(markup,/itel Energy IESS-320ACT/);assert.match(markup,/₦148,104–₦152,460/);
  assert.match(markup,/itel Energy IESS-05K10N/);assert.match(markup,/₦314,160–₦323,400/);
  assert.match(markup,/Estimated equipment price/);
});

test("the 170 W / 1.14 kWh small-home load selects a portable unit that meets the full backup requirement",()=>{
  const request={loads:[
    {id:"bulbs",name:"LED bulbs",quantity:1,watts:10,hours:6,startingW:10},
    {id:"fan",name:"Standing fan",quantity:1,watts:60,hours:8,startingW:60},
    {id:"tv",name:"LED TV",quantity:1,watts:100,hours:6,startingW:100},
  ],assumptions:{...DEFAULT_ASSUMPTIONS,backupHours:12},solarCharging:false};
  const plan=recommendSystems(solarCatalog,systemConfigurations,request,now).customer;
  assert.deepEqual([plan.energy.peakW,plan.energy.dailyWh,plan.energy.backupWh],[170,1140,1140]);
  const fullBackup=plan.options.find((option)=>option.equipment?.some((item)=>item.model==="IESS-1K20N"));
  assert.ok(fullBackup,"IESS-1K20N should remain eligible for its estimated AC energy above the 1.14 kWh requirement");
  assert.ok(fullBackup.equipment[0].linePrice?.low>0);
  assert.doesNotMatch(fullBackup.runtimeNote,/guarantee/i);
  assert.equal(plan.options.some((option)=>option.equipment?.some((item)=>item.model==="IESS-320ACT")),false,
    "200 W / 320 Wh unit must not be presented as meeting 212.5 W headroom and 1.14 kWh backup requirements");
});
