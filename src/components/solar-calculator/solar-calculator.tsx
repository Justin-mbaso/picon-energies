"use client";

import Link from "next/link";
import { useId, useMemo, useRef, useState } from "react";
import type { CalculatorRequest, CustomerPlan } from "@/lib/solar-calculator/recommendation-types";
import { SystemResults } from "./system-results";
import { APPLIANCES, BACKUP_MODEL, DEFAULT_ASSUMPTIONS, suggestAppliance } from "@/lib/solar-calculator/solar-config";
import { parseNumber, validateInputs, type Appliance } from "@/lib/solar-calculator/solar-calculations";
import { assessmentUrl } from "@/lib/solar-calculator/assessment-summary";

type Draft = { id: string; name: string; quantity: string; watts: string; hours: string; startingW: string };
const convert = (d: Draft): Appliance => ({ ...d, quantity: parseNumber(d.quantity), watts: parseNumber(d.watts), hours: parseNumber(d.hours), startingW: d.startingW === "" ? null : parseNumber(d.startingW) });
const labels = ["Choose appliances", "Check your load", "Your solar plan"];
function Icon({ name = "power" }: { name?: string }) {
  const paths: Record<string, string> = {
    light: "M9 18h6m-5 3h4M8 14a6 6 0 1 1 8 0l-1 2H9z", fan: "M12 11C2 5 13-2 14 7l-1 4m0 1c10-6 10 7 2 5l-2-4m-2 0c0 11-11 4-5 0l5-1M12 10v4",
    screen: "M3 4h18v13H3zM8 21h8m-4-4v4", wifi: "M2 8a16 16 0 0 1 20 0M5 12a11 11 0 0 1 14 0m-10 4a5 5 0 0 1 6 0m-3 4h.01",
    phone: "M7 2h10v20H7zM10 18h4", camera: "M3 6h13v12H3zM16 10l5-3v10l-5-3", appliance: "M5 2h14v20H5zM5 9h14M8 5v1m0 6v3",
    water: "M12 2s-8 9-8 14a8 8 0 0 0 16 0c0-5-8-14-8-14zM8 16a4 4 0 0 0 4 4", power: "m13 2-9 12h7l-1 8L21 9h-8z",
  };
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name] ?? paths.power} /></svg>;
}
function NumberField({ label, value, onChange, hint, invalid = false, suffix }: { label: string; value: string; onChange: (v: string) => void; hint?: string; invalid?: boolean; suffix?: string }) {
  const id = useId();
  return <label className="sc-field" htmlFor={id}><span>{label}</span><span className="sc-input-wrap"><input id={id} aria-label={label} aria-describedby={hint ? `${id}-hint` : undefined} type="text" inputMode="decimal" value={value} onChange={(e) => onChange(e.target.value)} aria-invalid={invalid || value !== "" && !/^-?(?:\d+(?:\.\d*)?|\.\d+)$/.test(value) || undefined} /><span aria-hidden="true">{suffix}</span></span>{hint && <small id={`${id}-hint`}>{hint}</small>}</label>;
}

export function SolarCalculator() {
  const [step,setStep] = useState(0), [drafts,setDrafts] = useState<Draft[]>([]);
  const [customName,setCustomName] = useState(""), [customW,setCustomW] = useState(""), [customH,setCustomH] = useState("");
  const [customError,setCustomError] = useState(""), [errors,setErrors] = useState<string[]>([]);
  const [settings,setSettings] = useState(Object.fromEntries(Object.entries(DEFAULT_ASSUMPTIONS).map(([k,v]) => [k,String(v)])));
  const [result,setResult] = useState<CustomerPlan | null>(null);
  const [selectedId,setSelectedId] = useState<string|null>(null);
  const [calculatedRequest,setCalculatedRequest] = useState<CalculatorRequest|null>(null);
  const [isCalculating,setIsCalculating] = useState(false);
  const calculation = useRef<AbortController|null>(null);
  const heading = useRef<HTMLHeadingElement>(null), customId = useRef(0);
  const loads = useMemo(() => drafts.map(convert),[drafts]);
  const validLoads = loads.filter((l) => !validateInputs([l],DEFAULT_ASSUMPTIONS).length);
  const livePeak = validLoads.reduce((s,l) => s + l.quantity*l.watts,0);
  const liveDaily = validLoads.reduce((s,l) => s+l.quantity*l.watts*l.hours,0);
  function navigate(next: number) {
    if(next!==2) { calculation.current?.abort(); calculation.current=null; setIsCalculating(false); }
    setStep(next); setErrors([]);
    requestAnimationFrame(() => {
      heading.current?.focus({ preventScroll:true });
      heading.current?.scrollIntoView({ block:"start", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
    });
  }
  function toggle(id: string) {
    const item = APPLIANCES.find((a) => a[0] === id)!;
    setDrafts((current) => current.some((d) => d.id === id) ? current.filter((d) => d.id !== id) : [...current,{ id,name:item[1],quantity:"1",watts:String(item[2]),hours:String(item[3]),startingW:"" }]);
  }
  function update(id: string, key: keyof Draft, value: string) { setDrafts((current) => current.map((d) => d.id === id ? { ...d,[key]:value } : d)); }
  function addCustom() {
    const candidate = { id:`custom-${++customId.current}`,name:customName,quantity:1,watts:parseNumber(customW),hours:parseNumber(customH),startingW:null };
    const invalid = validateInputs([candidate],DEFAULT_ASSUMPTIONS);
    if (invalid.length || drafts.length >= 100) { setCustomError(invalid[0] ?? "Use up to 100 appliance rows."); return; }
    setDrafts((current) => [...current,{ ...candidate,quantity:"1",watts:customW,hours:customH,startingW:"" }]);
    setCustomName("");setCustomW("");setCustomH("");setCustomError("");
  }
  async function runCalculation() {
    if(calculation.current)return;
    const a = Object.fromEntries(Object.entries(settings).map(([k,v]) => [k,parseNumber(v)])) as typeof DEFAULT_ASSUMPTIONS;
    a.coldC = /^-?(?:\d+(?:\.\d*)?|\.\d+)$/.test(settings.coldC) ? Number(settings.coldC) : NaN;
    const invalid = validateInputs(loads,a);
    if (invalid.length) { setErrors(invalid); return; }
    // Keep the legacy API field for old assessment summaries; conventional PV is always sized by the recommendation engine.
    const request: CalculatorRequest = {loads,assumptions:a,solarCharging:false};
    const controller=new AbortController();calculation.current=controller;setIsCalculating(true);setErrors([]);
    const timeout=setTimeout(()=>controller.abort(),20000);
    try {
      const response=await fetch("/api/solar-calculator",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(request),signal:controller.signal});
      const data=await response.json();
      if(!response.ok || !data.energy || !Array.isArray(data.options))throw new Error("Calculation unavailable");
      if(calculation.current!==controller)return;
      setCalculatedRequest(request);
      setResult(data);setSelectedId(data.bestFitId??data.options[0]?.id??null);
      navigate(2);
    } catch {
      if(calculation.current===controller)setErrors(["We couldn’t complete your plan right now. Your appliances are still here; please try again."]);
    } finally {
      clearTimeout(timeout);
      if(calculation.current===controller){calculation.current=null;setIsCalculating(false);}
    }
  }
  const suggested = suggestAppliance(customName);
  const handoff = result && calculatedRequest ? assessmentUrl({v:3,request:calculatedRequest,configurationId:selectedId}) : "/contact?intent=solar-assessment";

  return <div className="sc-shell">
    <header className="sc-intro"><p className="eyebrow"><span className="sc-dash" /> Picon Energies / Plan your power</p><h1>Solar <span>Calculator.</span></h1><p>Understand your energy needs, find a suitable Picon power solution and explore equipment costs for your solar system.</p><div className="sc-intro-meta"><span>01 — Your appliances</span><span>02 — Your requirements</span><span>03 — A clearer next step</span></div></header>
    <noscript><p className="sc-alert">The interactive calculator needs JavaScript. <Link href="/contact?intent=solar-assessment">Request a Solar Assessment</Link> and we can help with your load plan.</p></noscript>
    <nav aria-label="Calculator progress" className="sc-progress"><ol>{labels.map((label,i) => <li key={label}><button type="button" aria-current={step === i ? "step" : undefined} disabled={i > step && (i === 2 || !drafts.length)} onClick={() => navigate(i)}><span>0{i+1}</span>{label}<b aria-hidden="true">{step > i ? "✓" : ""}</b></button></li>)}</ol></nav>
    <div className={`sc-workspace ${step === 2 ? "sc-workspace-results" : ""}`}>
      <section className="sc-panel" aria-labelledby="sc-step-heading" key={step} aria-busy={isCalculating || undefined}>
        <div className="sc-panel-heading"><div><p className="sc-kicker">STEP 0{step+1}</p><h2 id="sc-step-heading" ref={heading} tabIndex={-1}>{["What would you like to power?","Make it your own.","Your power, in perspective."][step]}</h2></div>{step < 2 && <span className="sc-count">{drafts.length} selected</span>}</div>
        {step === 0 && <>
          <p className="sc-muted">Choose your appliances. The wattages and hours below are typical editable estimates. Use the nameplate or measured consumption where possible.</p>
          <div className="sc-appliance-grid">{APPLIANCES.map(([id,name,w,h,icon]) => { const selected=drafts.some((d) => d.id === id); return <button type="button" className="sc-appliance" aria-pressed={selected} key={id} onClick={() => toggle(id)}><span className="sc-appliance-top"><Icon name={icon} /><span className="sc-toggle-mark" aria-hidden="true">{selected ? "✓" : "+"}</span></span><strong>{name}</strong><small>{w} W <span>·</span> {h} h/day</small></button>; })}</div>
          <div className="sc-custom"><h3>Something else?</h3><p className="sc-muted">Add a custom appliance. Recognised names suggest editable starting values.</p><div className="sc-custom-fields"><label className="sc-field"><span>Appliance name</span><input value={customName} maxLength={100} placeholder="e.g. Blender" onChange={(e) => { const name=e.target.value;setCustomName(name);const s=suggestAppliance(name);if(s){setCustomW(String(s.watts));setCustomH(String(s.hours));} }} /></label><NumberField label="Watts" value={customW} onChange={setCustomW} suffix="W" /><NumberField label="Hours per day" value={customH} onChange={setCustomH} suffix="h" /><button className="sc-button sc-button-outline" type="button" onClick={addCustom}>Add appliance <span aria-hidden="true">+</span></button></div>{suggested && <p className="sc-small">Suggested values for “{customName}”; check your actual appliance.</p>}{customError && <p className="sc-error" role="alert">{customError}</p>}</div>
          <div className="sc-step-actions"><span className="sc-small">Your plan stays in this tab.</span><button className="sc-button" type="button" disabled={!drafts.length} onClick={() => navigate(1)}>Check your load <span aria-hidden="true">→</span></button></div>
        </>}
        {step === 1 && <fieldset className="sc-step-fields" disabled={isCalculating}>
          <div className="sc-review-tools"><p className="sc-muted">Edit each appliance to reflect your actual use. Starting watts are optional. Leave them blank to use preliminary estimates for recognised appliances.</p><button className="sc-text-button" type="button" onClick={() => { setDrafts([]);navigate(0); }}>Clear all</button></div>
          <div className="sc-loads">{drafts.map((d,index) => { const rowErrors=validateInputs([convert(d)],DEFAULT_ASSUMPTIONS);return <fieldset className="sc-load" key={d.id}><legend>Appliance {index+1}</legend><div className="sc-load-top"><label className="sc-field"><span>Appliance name</span><input aria-label={`Appliance ${index+1} name`} value={d.name} maxLength={100} onChange={(e) => update(d.id,"name",e.target.value)} /></label><button type="button" className="sc-remove" aria-label={`Remove ${d.name}`} onClick={() => setDrafts((current) => current.filter((l) => l.id !== d.id))}>×</button></div><div className="sc-load-fields"><label className="sc-field"><span>Quantity</span><span className="sc-quantity"><button type="button" aria-label={`Decrease ${d.name} quantity`} disabled={!Number.isInteger(parseNumber(d.quantity)) || parseNumber(d.quantity)<=1} onClick={() => update(d.id,"quantity",String(parseNumber(d.quantity)-1))}>−</button><input inputMode="numeric" value={d.quantity} aria-label={`${d.name} quantity`} onChange={(e) => update(d.id,"quantity",e.target.value)} /><button type="button" aria-label={`Increase ${d.name} quantity`} disabled={!Number.isInteger(parseNumber(d.quantity)) || parseNumber(d.quantity)>=999} onClick={() => update(d.id,"quantity",String(parseNumber(d.quantity)+1))}>+</button></span></label><NumberField label="Running watts" value={d.watts} onChange={(v) => update(d.id,"watts",v)} suffix="W" /><NumberField label="Daily hours" value={d.hours} onChange={(v) => update(d.id,"hours",v)} suffix="h" /><NumberField label="Starting watts" value={d.startingW} onChange={(v) => update(d.id,"startingW",v)} hint="Optional; blank uses an appliance screening estimate." suffix="W" /></div>{rowErrors.length>0 && <p className="sc-error">{rowErrors[0]}</p>}</fieldset>; })}</div>
          <button type="button" className="sc-text-button" onClick={() => navigate(0)}>+ Add more appliances</button>
          <div className="sc-config"><h3>How long do you need backup?</h3><NumberField label="Backup window" value={settings.backupHours} onChange={(v) => setSettings({...settings,backupHours:v})} suffix="hours" /><p className="sc-small">{BACKUP_MODEL}</p></div>
          <details className="sc-details"><summary>Planning assumptions <span>Review before calculating</span></summary><p className="sc-small">Preliminary Picon planning inputs, not a site survey or runtime guarantee. PV sizing is a daily energy target before electrical validation.</p><div className="sc-assumption-grid">{([['headroom','Inverter headroom','0.25–1; minimum 25%'],['powerFactor','Load power factor','0–1; used for VA, not W'],['peakSunHours','Peak sun hours','Location / season dependent'],['pvPerformance','PV performance ratio','0–1; heat / wiring / system loss'],['coldC','Minimum site temperature','°C; for cold Voc'],['hotCellC','Maximum cell temperature','°C; for hot Vmp'],['surgeSeconds','Starting surge duration','seconds; verify appliance data']] as const).map(([key,label,hint]) => <NumberField key={key} label={label} value={settings[key]} hint={hint} onChange={(v) => setSettings({...settings,[key]:v})} />)}</div><p className="sc-small">One motor is screened as starting at a time while the other appliances run. A qualified designer must verify actual starting behaviour and any solar wiring, protection and site conditions.</p></details>
          {errors.length>0 && <div className="sc-alert sc-error" role="alert"><strong>Check these details before continuing.</strong><ul>{errors.map((e,i) => <li key={`${i}-${e}`}>{e}</li>)}</ul></div>}
          <div className="sc-step-actions"><button type="button" className="sc-text-button" onClick={() => navigate(0)}>← Appliances</button><button type="button" className="sc-button" onClick={runCalculation}>{isCalculating ? "Finding suitable systems…" : "Calculate my solar needs"} <span aria-hidden="true">→</span></button></div>
        </fieldset>}
        {step === 2 && result && <>
          <p className="sc-muted sc-results-announcement" role="status">Your energy plan is ready.</p>
          <SystemResults plan={result} selectedId={selectedId} onSelect={setSelectedId} assessmentHref={handoff} />
          <div className="sc-step-actions"><button type="button" className="sc-text-button" onClick={() => navigate(1)}>← Edit my load</button></div>
        </>}
      </section>
      {step < 2 && <aside className="sc-summary" aria-label="Your load summary"><div className="sc-summary-icon"><Icon /></div><p className="sc-kicker">Your energy picture</p><h2>A considered plan<br/>starts here.</h2><div className="sc-summary-stat"><span>Running load</span><strong>{livePeak.toLocaleString("en-NG")} <small>W</small></strong></div><div className="sc-summary-stat"><span>Daily consumption</span><strong>{(liveDaily/1000).toFixed(2)} <small>kWh</small></strong></div><p className="sc-small" role="status">{drafts.length} appliance types selected.{validLoads.length !== loads.length ? " Invalid rows excluded from this preview; correct them before calculating." : ""}</p><div className="sc-summary-note"><span className="sc-dash"/><p>Built around your use.<br/>Checked against real equipment.<br/>Finished with a human assessment.</p></div></aside>}
    </div>
  </div>;
}
