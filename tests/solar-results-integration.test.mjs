import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import "../scripts/solar-catalog-import.mjs";

const require = createRequire(import.meta.url);
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const ts = require("typescript");
const { diagnoseActualCatalog } = await import("../scripts/solar-catalog-diagnostics.mjs");
const { assessmentUrl, parseAssessmentSummary } = await import("../src/lib/solar-calculator/assessment-summary.ts");
const { recommendSystems } = await import("../src/lib/solar-calculator/system-recommendations.ts");
const { DEFAULT_ASSUMPTIONS } = await import("../src/lib/solar-calculator/solar-config.ts");
const { integrateResearchCatalog, integrateResearchConfigurations } = await import("../src/lib/solar-catalog/research-integration.ts");
const delta = JSON.parse(await readFile(new URL("../picon_research/catalogue_delta.json", import.meta.url), "utf8"));
const catalog = JSON.parse(await readFile(new URL("../src/lib/solar-catalog/catalog.json", import.meta.url), "utf8"));
const configurations = JSON.parse(await readFile(new URL("../src/lib/solar-catalog/system-configurations.json", import.meta.url), "utf8"));
const integratedCatalog=integrateResearchCatalog(catalog,delta);
const integratedConfigurations=integrateResearchConfigurations(configurations,delta);
const now = new Date("2026-11-25T01:30:00Z");

const source = await readFile(new URL("../src/components/solar-calculator/system-results.tsx", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText;
const componentModule = { exports: {} };
const componentRequire = (specifier) => {
  if (specifier === "next/link") {
    const Link = ({ href, children, ...props }) => React.createElement("a", { href, ...props }, children);
    return { __esModule: true, default: Link };
  }
  if (specifier === "@/lib/solar-catalog/pricing") {
    return { INSTALLATION_NOTE: "Every property has different installation requirements. Picon will assess your site, confirm the equipment arrangement, and determine the installation and commissioning requirements before finalising your project cost.", naira: (value) => `₦${value.toLocaleString("en-NG")}` };
  }
  return require(specifier);
};
new Function("require", "module", "exports", compiled)(componentRequire, componentModule, componentModule.exports);
const { SystemResults } = componentModule.exports;

test("Scenario A catalogue options reach SystemResults, render, select, and retain the assessment handoff", () => {
  const scenario = diagnoseActualCatalog(now).scenarios.find(({ id }) => id === "A");
  const plan = { energy: scenario.energy, options: scenario.suitableConfigurations, bestFitId: scenario.bestFit };

  assert.equal(plan.energy.peakW, 32);
  assert.equal(plan.energy.dailyWh, 408);
  assert.equal(plan.energy.backupWh, 96);
  const portable=plan.options.filter(({category})=>category==="portable");
  assert.deepEqual(portable.map(({ id }) => id), ["dynamic-portable-itel-iess-320act", "dynamic-portable-itel-iess-05k10n", "dynamic-portable-itel-iess-1k20n"]);

  const selectedId=portable[1].id;
  const href = assessmentUrl({ v: 3, request: scenario.request, configurationId: selectedId });
  const markup = renderToStaticMarkup(React.createElement(SystemResults, {
    plan, selectedId, onSelect: () => {}, assessmentHref: href, onAssessmentNavigate:()=>{},
  }));

  assert.match(markup, /value="dynamic-portable-itel-iess-320act"/);
  assert.match(markup, /value="dynamic-portable-itel-iess-05k10n"[^>]*checked=""|checked=""[^>]*value="dynamic-portable-itel-iess-05k10n"/);
  assert.match(markup, /148,104–₦152,460/);
  assert.match(markup, /314,160–₦323,400/);
  assert.match(markup, /Portable Power Systems/);
  assert.doesNotMatch(markup, /Adjust your backup duration|Choose how long you want your selected loads/);
  assert.match(markup, new RegExp(`<strong>${plan.energy.backupHours} hours</strong><span>Backup window</span>`));
  assert.doesNotMatch(markup, /sc-backup-controls|EST\. BACKUP TIME|If running at max load without sun|aria-label="(?:Decrease|Increase) estimated backup time/);
  const standard=plan.options.find(({id})=>id==="dynamic-portable-itel-iess-320act"),tank=plan.options.find(({id})=>id==="dynamic-portable-itel-iess-05k10n");
  assert.deepEqual(standard.solarCharging,{maxW:100,minV:11,maxV:24,maxA:5});
  assert.deepEqual(tank.solarCharging,{maxW:400,minV:11,maxV:60,maxA:13.5});
  assert.match(markup,/Want to recharge using sunlight\?/);
  assert.doesNotMatch(markup,/Confirm panel selection against the documented input range/);
  assert.match(markup,/itel Energy IESS-05K10N/);
  assert.doesNotMatch(markup,/<img|sc-equipment-image|representative illustration|Exact product image unavailable/);
  assert.match(markup,/itel Energy IESS-05K10N/);
  assert.equal((markup.match(/148,104/g)??[]).length,1,"single-item equipment cost is shown only in the system price");
  assert.match(markup,/Every property has different installation requirements/);
  assert.doesNotMatch(markup, /Let’s find the right fit together/);
  assert.match(markup, /href="\/contact\?intent=solar-assessment&amp;solar=/);

  const selected = [];
  let assessmentNavigated=0;
  const tree = SystemResults({ plan, selectedId: null, onSelect: (id) => selected.push(id), assessmentHref: href, onAssessmentNavigate:()=>assessmentNavigated++ });
  const inputs = [];
  const visit = (node) => {
    if (Array.isArray(node)) return node.forEach(visit);
    if (!React.isValidElement(node)) return;
    if (typeof node.type === "function") return visit(node.type(node.props));
    if (node.type === "input" && node.props.type === "radio") inputs.push(node);
    visit(node.props.children);
  };
  visit(tree);
  assert.ok(inputs.length >= 2);
  inputs.find(({props})=>props.value===selectedId).props.onChange();
  assert.deepEqual(selected, [selectedId]);
  assert.doesNotMatch(markup, /<button\b|<input[^>]*type="(?:button|number)"/i);
  const links=[];
  const findLinks=(node)=>{if(Array.isArray(node))return node.forEach(findLinks);if(!React.isValidElement(node))return;if(node.type==="a"){links.push(node);return;}if(typeof node.type==="function")return findLinks(node.type(node.props));findLinks(node.props.children);};
  findLinks(tree); links.find(({props})=>props.href===href).props.onClick(); assert.equal(assessmentNavigated,1);

  const handoff = new URL(href, "https://picon.test");
  const summary = parseAssessmentSummary(handoff.searchParams.get("solar"), catalog, configurations, now);
  assert.match(summary, /Selected system: Portable Power System/);
  assert.match(summary, new RegExp(`Configuration reference: ${selectedId}`));
});

test("the original calculator retains backup-duration selection and submits it for recommendation sizing", async () => {
  const source = await readFile(new URL("../src/components/solar-calculator/solar-calculator.tsx", import.meta.url), "utf8");

  assert.match(source, /<NumberField label="Backup window" value=\{settings\.backupHours\} onChange=\{\(v\) => setSettings\(\{\.\.\.settings,backupHours:v\}\)\}/);
  assert.match(source, /void calculateRequest\(\{loads,assumptions:a,solarCharging:false\}\)/);
  assert.match(source, /<SystemResults plan=\{result\} selectedId=\{selectedId\}/);
  assert.doesNotMatch(source, /function changeBackupDuration/);
});

test("the screenshot-scale demand receives a priced custom system and renders the assessment path", () => {
  const request = {
    loads: [{ id: "combined", name: "Measured combined load", quantity: 1, watts: 3280, hours: 24080 / 3280, startingW: 3280 }],
    assumptions: { ...DEFAULT_ASSUMPTIONS, backupHours: 6 },
    solarCharging: false,
  };
  const { customer: plan, diagnostics } = recommendSystems(integratedCatalog, integratedConfigurations, request, now);

  assert.deepEqual([plan.energy.peakW, plan.energy.dailyWh, plan.energy.backupWh, plan.energy.backupHours], [3280, 24080, 19680, 6]);
  assert.equal(plan.options.length, 1);
  assert.equal(plan.options[0].id,"custom-sized-system");
  assert.ok(plan.options[0].price.low>0);
  assert.equal(diagnostics.some(({ id }) => /^(portable|compact|full)-\d/.test(id)),false,"legacy assembled configurations are not evaluated as current candidates");
  assert.equal(plan.options[0].id,"custom-sized-system");

  const markup = renderToStaticMarkup(React.createElement(SystemResults, {
    plan, selectedId: null, onSelect: () => {}, assessmentHref: "/contact?intent=solar-assessment",
  }));
  assert.match(markup, /Custom-Sized Full Solar System/);
  assert.match(markup, /Estimated core equipment cost/);
  assert.deepEqual(plan.options[0].equipment.map(({role})=>role),["inverter","battery","panel"]);
  assert.doesNotMatch(markup,/<img|sc-equipment-image|representative illustration|Exact product image unavailable/);
  assert.doesNotMatch(markup, /Let’s find the right fit together/);
  assert.match(markup, /Request a Solar Assessment/);
  assert.doesNotMatch(markup, /No current system recommendation matches/);
});
