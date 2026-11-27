"use client";

import Link from "next/link";
import { INSTALLATION_NOTE, naira } from "@/lib/solar-catalog/pricing";
import type { CustomerOption, CustomerPlan } from "@/lib/solar-calculator/recommendation-types";

const groups={portable:"Portable Power Systems",compact:"Compact Power Systems",full:"Full Solar Systems"};
export function SystemResults({plan,selectedId,onSelect,assessmentHref,onAssessmentNavigate}:{plan:CustomerPlan;selectedId:string|null;onSelect:(id:string)=>void;assessmentHref:string;onAssessmentNavigate?:()=>void}) {
  const {energy}=plan;
  const bestCategory=plan.options.find((o)=>o.bestFit)?.category;
  const categories=(["portable","compact","full"] as const).toSorted((a,b)=>a===bestCategory ? -1 : b===bestCategory ? 1 : 0);
  return <>
    <div className="sc-result-stats" aria-label="Your energy requirements">
      <div><strong>{(energy.peakW/1000).toFixed(2)} kW</strong><span>Peak simultaneous load</span></div>
      <div><strong>{(energy.dailyWh/1000).toFixed(2)} kWh</strong><span>Daily energy</span></div>
      <div><strong>{(energy.backupWh/1000).toFixed(2)} kWh</strong><span>Backup energy</span></div>
      <div><strong>{energy.backupHours} hours</strong><span>Backup window</span></div>
    </div>
    <section className="sc-suitable" aria-labelledby="sc-suitable-title">
      <p className="sc-kicker">A solution around your use</p>
      <h3 id="sc-suitable-title">Your suitable systems</h3>
      {plan.options.length ? <>
        <p className="sc-muted">Compare the options that meet your selected requirements. Choose one to include it in your assessment request.</p>
        <fieldset className="sc-system-choice"><legend className="sc-visually-hidden">Select a suitable system</legend>
          {categories.map((category)=>{
            const options=plan.options.filter((o)=>o.category===category);
            if(!options.length)return null;
            return <div className="sc-system-group" key={category}>
              <h4>{groups[category]}</h4>
              <div className="sc-system-grid">{options.map((option)=><OptionCard key={option.id} option={option} selected={selectedId===option.id} onSelect={onSelect} />)}</div>
            </div>;
          })}
          {plan.shortRuntimeAlternatives?.length ? <div className="sc-system-group sc-short-runtime-group"><h4>Shorter-runtime alternatives</h4><p className="sc-muted">These current options do not meet the backup energy you selected. Their estimated runtime is shown on each card.</p><div className="sc-system-grid">{plan.shortRuntimeAlternatives.map((option)=><OptionCard key={option.id} option={option} selected={selectedId===option.id} onSelect={onSelect} />)}</div></div> : null}
        </fieldset>
      </> : <p className="sc-no-match-message" role="status">No current system recommendation matches these load and backup requirements. Picon can review your property and recommend a site-specific solution during an on-site assessment.</p>}
    </section>
    <div className="sc-installation sc-installation-brief">
      <div className="sc-installation-icon" aria-hidden="true">✓</div>
      <div><span className="sc-kicker">Installation &amp; commissioning</span>
      <p>{INSTALLATION_NOTE}</p>
      </div>
    </div>
    <div className="sc-assessment">
      <div><p className="sc-kicker">Your next step</p><h3>Let’s design around you.</h3><p>During an on-site assessment, Picon reviews your property, installation requirements, equipment arrangement and site-specific needs before confirming the project cost.</p></div>
      <Link className="sc-button" href={assessmentHref} onClick={onAssessmentNavigate}>Request a Solar Assessment <span aria-hidden="true">↗</span></Link>
    </div>
  </>;
}

function OptionCard({option,selected,onSelect}:{option:CustomerOption;selected:boolean;onSelect:(id:string)=>void}) {
  const roleLabels={unit:"Power system",inverter:"Inverter",battery:"Battery storage",panel:"Solar panels",required_equipment:"Required equipment"};
  const formatRange=(low:number,high:number)=>low===high?naira(low):`${naira(low)}–${naira(high)}`;
  return <article className={`sc-system-option ${selected ? "is-selected" : ""} ${option.meetsRequirements===false ? "is-short-runtime" : ""}`}>
    <label className="sc-system-select">
      <input type="radio" name="selected-system" value={option.id} checked={selected} onChange={()=>onSelect(option.id)} />
      <span><strong>{option.title}</strong><small>{option.specifications.find((s)=>s.label.includes("output"))?.value}</small></span>
      {option.bestFit && <span className="sc-best-fit">Best fit</span>}
      {option.meetsRequirements===false && <span className="sc-best-fit">Short runtime</span>}
    </label>
    <p className="sc-system-description">{option.description}</p>
    {option.equipment?.length ? <section className="sc-option-equipment" aria-label="Equipment and itemised prices">
      <h5>{option.equipment.length===1 && option.equipment[0].role==="unit" ? "Recommended equipment" : "Equipment included"}</h5>
      <ul>{option.equipment.map((item)=><li key={`${item.role}-${item.model}`}>
        <div className="sc-equipment-copy"><span className="sc-equipment-role">{roleLabels[item.role]}</span><strong>{item.manufacturer} {item.model}</strong><small>{item.quantity} {item.quantity===1 ? "unit" : "units"}{item.capacity ? ` · ${item.capacity}` : ""}{item.unitPrice && option.equipment!.length>1 ? ` · ${formatRange(item.unitPrice.low,item.unitPrice.high)} each` : ""}</small></div>
        {option.equipment!.length>1 && <b>{item.linePrice ? formatRange(item.linePrice.low,item.linePrice.high) : "Price confirmed after assessment"}</b>}
      </li>)}</ul>
    </section> : null}
    {option.solarCharging && <p className="sc-portable-solar-note">Want to recharge using sunlight? Compatible solar panels can be added to this power station and quoted separately by Picon.</p>}
    <p className="sc-small">{option.runtimeNote}</p>
    <p className="sc-system-distinction">{option.distinction}</p>
    <div className="sc-system-price"><span>{option.priceMethod==="capacity_market_benchmark" ? "Estimated core equipment cost" : "Estimated equipment price"}</span><strong>{option.price ? formatRange(option.price.low,option.price.high) : "Confirmed after assessment"}</strong></div>
    <details className="sc-option-details"><summary>System specifications</summary><dl>{option.specifications.map((s)=><div key={s.label}><dt>{s.label}</dt><dd>{s.value}</dd></div>)}</dl></details>
    <details className="sc-option-details"><summary>Price information</summary>
      <p>{option.priceNote ?? (option.price ? `Based on supplier observations dated within seven days. Reference date: ${option.price.referenceDate}.` : "A current equipment price is not available for this option. Picon will confirm it during your assessment.")}</p>
      {option.price && <p>Reference date: {option.price.referenceDate}.</p>}
      <p>Equipment prices may change due to market fluctuations. Final pricing will be confirmed by Picon.</p>
    </details>
  </article>;
}
