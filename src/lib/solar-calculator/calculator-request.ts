import { DEFAULT_ASSUMPTIONS } from "./solar-config";
import { validateInputs } from "./solar-calculations";
import type { CalculatorRequest } from "./recommendation-types";

const record=(v:unknown):v is Record<string,unknown> => v!==null && typeof v==="object" && !Array.isArray(v);
export function parseCalculatorRequest(value:unknown):CalculatorRequest|null {
  if(!record(value) || Object.keys(value).sort().join()!=="assumptions,loads,solarCharging" || typeof value.solarCharging!=="boolean" || !Array.isArray(value.loads) || value.loads.length<1 || value.loads.length>100 || !record(value.assumptions)) return null;
  const keys=Object.keys(DEFAULT_ASSUMPTIONS);
  if(Object.keys(value.assumptions).filter((k)=>k!=="simultaneousStarts").sort().join()!==keys.sort().join() || Object.entries(value.assumptions).some(([k,v])=>k==="simultaneousStarts" ? typeof v!=="boolean" : typeof v!=="number" || !Number.isFinite(v))) return null;
  for(const load of value.loads) {
    if(!record(load) || Object.keys(load).filter((k)=>k!=="powerFactor").sort().join()!=="hours,id,name,quantity,startingW,watts" || typeof load.id!=="string" || !/^[\w-]{1,64}$/.test(load.id) || typeof load.name!=="string" || [load.quantity,load.watts,load.hours].some((n)=>typeof n!=="number" || !Number.isFinite(n)) || load.startingW!==null && (typeof load.startingW!=="number" || !Number.isFinite(load.startingW)) || load.powerFactor!==undefined && (typeof load.powerFactor!=="number" || !Number.isFinite(load.powerFactor))) return null;
  }
  const parsed=value as unknown as CalculatorRequest;
  return validateInputs(parsed.loads,parsed.assumptions).length ? null : parsed;
}
