import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import "../scripts/solar-catalog-import.mjs";
const { loadModel, checkInverter } = await import("../src/lib/solar-calculator/solar-calculations.ts");
const { DEFAULT_ASSUMPTIONS } = await import("../src/lib/solar-calculator/solar-config.ts");
const { recommendSystems } = await import("../src/lib/solar-calculator/system-recommendations.ts");
const { integrateResearchCatalog, integrateResearchConfigurations } = await import("../src/lib/solar-catalog/research-integration.ts");
const { preliminaryResearchBudget, eligibleOffer } = await import("../src/lib/solar-catalog/pricing.ts");
const screen = await import("../src/lib/solar-calculator/research-screening.ts");
const delta = JSON.parse(await readFile(new URL("../picon_research/catalogue_delta.json", import.meta.url), "utf8"));
const base = JSON.parse(await readFile(new URL("../src/lib/solar-catalog/catalog.json", import.meta.url), "utf8"));
const baseConfigs = JSON.parse(await readFile(new URL("../src/lib/solar-catalog/system-configurations.json", import.meta.url), "utf8"));
const cases = JSON.parse(await readFile(new URL("../picon_research/validation_cases.json", import.meta.url), "utf8")).cases;
const catalog = integrateResearchCatalog(base, delta);
const configurations = integrateResearchConfigurations(baseConfigs, delta);
const now = new Date("2026-11-24T18:00:00Z");

test("research delta preserves baseline and merges all reviewed records without approving them", () => {
  assert.equal(base.products.length, 16); assert.equal(base.offers.length, 43); assert.equal(baseConfigs.configurations.length, 7);
  assert.equal(catalog.products.length, 21); assert.equal(catalog.offers.length, 63); assert.equal(catalog.researchDelta.sources.length, 32);
  assert.equal(catalog.researchDelta.accessory_price_leads.length, 32); assert.equal(catalog.researchDelta.conflicts.length, 8);
  assert.equal(delta.products.length, 14); assert.equal(configurations.configurations.length, 10);
  assert.deepEqual(catalog.researchDelta.idMappings["jinko-585-f2-us"], "jinko-jkm585n-72hl4-bdv-f2-us");
  assert.deepEqual(catalog.researchDelta.idMappings["jinko-585-f9-en"], "jinko-jkm585n-72hl4-bdv");
  assert.ok(configurations.configurations.filter((c) => c.researchScreenId).every((c) => c.verification === "review_required" && !c.requiredEquipmentComplete));
  assert.equal(catalog.offers.filter((o) => o.research).every((o) => !o.research.procurementEligible), true);
});

for (const fixture of cases) test(`${fixture.id} supplied engineering validation case`, () => {
  const i = fixture.input, e = fixture.expected;
  switch (fixture.id) {
    case "T01": case "T02": {
      const model = loadModel([{ id:"aggregate",name:"Measured aggregate",quantity:1,watts:i.running_w,hours:i.hours,startingW:i.running_w }], {...DEFAULT_ASSUMPTIONS,backupHours:i.hours});
      assert.equal(model.backupWh / 1000, e.backup_kwh); break;
    }
    case "T03": { const x=screen.screenBatteryEnergy(i.modules,i.module_kwh,i.dod,i.modules*i.module_kwh); assert.equal(x.nominalKwh,e.nominal_kwh);assert.equal(x.usableAcKwh,e.dod_limited_dc_kwh);break; }
    case "T04": {
      const request={loads:[{id:"case",name:"Measured aggregate",quantity:1,watts:3280,hours:24080/3280,startingW:3280}],assumptions:{...DEFAULT_ASSUMPTIONS,backupHours:6},solarCharging:false};
      const {diagnostics}=recommendSystems(catalog,configurations,request,now);
      assert.ok(Math.abs(i.audit_usable_ac_kwh-i.required_ac_kwh-e.margin_kwh)<1e-9);
      assert.equal(diagnostics.some((d)=>d.id==="deye-residential-01"),false,"legacy fixed recommendations are not evaluated");
      assert.ok(diagnostics.some((d)=>d.id.startsWith("dynamic-full-")&&d.energy?.usableAcWh>=i.required_ac_kwh*1000),"current Deye pairing is independently resized to satisfy the request without using the legacy eight-module configuration");break;
    }
    case "T05": case "T06": { const x=screen.screenBatteryEnergy(i.modules,i.module_kwh,i.effective_fraction,i.required_ac_kwh);assert.equal(x.usableAcKwh,e.usable_ac_kwh);assert.equal(x.passesEnergy,e.energy_screen==="pass");break; }
    case "T07": { const x=screen.screenBatteryPower(i.battery_min_v,i.inverter_discharge_a,i.efficiency,i.ac_request_w);assert.equal(x.availableW,e.max_battery_only_ac_w);assert.equal(x.passes,e.power_screen==="pass");break; }
    case "T08": { const x=screen.screenBatteryPower(i.battery_min_v,i.inverter_discharge_a,i.efficiency,i.inverter_rated_w,i.inverter_rated_w);assert.equal(x.availableW,e.battery_only_ac_w_capped);break; }
    case "T09": case "T10": case "T11": { const x=screen.screenColdVoc(i.series,i.voc_stc_v,i.beta_voc,i.min_temp_c,i.positive_tolerance,i.absolute_limit_v);assert.ok(Math.abs(x.vocV-e.voc_v)<1e-6);assert.equal(x.passesAbsoluteLimit,e.absolute_voltage_screen==="pass");break; }
    case "T12": case "T13": { const x=screen.screenPvArray(i.module_w,i.panel_count,i.input_limit_w,i.access_limit_w);assert.equal(x.arrayW,e.array_w);if("oversizing_review" in e)assert.equal(x.oversizingReview,e.oversizing_review);break; }
    case "T14": assert.ok(Math.abs(screen.screenPvYield(i.array_kwp,i.modelled_ac_yield)-e.daily_ac_kwh)<1e-9);break;
    case "T15": assert.equal(screen.exactBatteryVoltageCompatible(i.battery_nominal_v,i.inverter_battery_v_range),false);break;
    case "T16": assert.equal(screen.directPhaseCompatible(i.inverter_phase,i.site_phase),false);break;
    case "T17": assert.equal(screen.independentTrackersFit(i.mppt_count,i.proposed_independent_trackers),false);break;
    case "T18": { const x=screen.screenPvCurrent(i.mppt_operating_limit_a,i.parallel_strings,i.imp_a,27,14.43,1.25);assert.equal(x.operatingA,e.operating_current_a);assert.equal(x.passes,false);break; }
    case "T19": {
      const configs=integrateResearchConfigurations(baseConfigs,delta);const c=configs.configurations.find((x)=>x.researchScreenId==="deye-8s2-f2-us");
      assert.equal(c.suppliedEngineeringStatus,"pending_engineering");assert.equal(c.verification,"review_required");assert.equal(c.requiredEquipmentComplete,false);break;
    }
    case "T20": { const o=catalog.offers.find((x)=>x.research?.offerId==="o07");assert.equal(eligibleOffer(o,now),false);break; }
    case "T21": { const b=preliminaryResearchBudget(catalog.researchDelta,now);assert.equal(b.pricedLines,1);assert.equal(b.missingLines,11);assert.equal(b.low,516500);assert.equal(b.high,600000);assert.equal(b.lineCount,12);break; }
    case "T22": assert.equal(screen.physicalStackFits(i.stacked_modules,i.max_physical_stack),false);break;
    case "T23": assert.equal(screen.screenColdVoc(1,i.voc_corrected_v,0,25,0,i.absolute_limit_v).passesAbsoluteLimit,false);break;
    case "T24": assert.throws(()=>screen.screenBatteryEnergy(1,i.nominal_kwh,i.effective_fraction,i.required_ac_kwh));break;
    case "T25": assert.equal(screen.hasPairingEvidence(i.bms_pairing_evidence),false);break;
    case "T26": {
      const m=loadModel([{id:"va",name:"measured",quantity:1,watts:i.running_w,hours:1,startingW:i.running_w,powerFactor:i.pf}],{...DEFAULT_ASSUMPTIONS,powerFactor:i.pf});
      const inverter={issues:[],specs:{continuousW:i.inverter_w,apparentVA:i.inverter_va,phase:1,surgeW:null,surgeVA:null,surgeSeconds:null}};
      assert.equal(m.minimumVA,5000*1.25);assert.equal(checkInverter(inverter,m,DEFAULT_ASSUMPTIONS).status,"incompatible");break;
    }
    case "T27": assert.equal(screen.quoteCurrent(i.quote_valid_until,i.as_of),false);break;
    case "T28": assert.equal(screen.approvalSurvivesRevisionChange(i.product_revision_changed,i.prior_approval),false);break;
    default: assert.fail(`No implementation for ${fixture.id}`);
  }
});
