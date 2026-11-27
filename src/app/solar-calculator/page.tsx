import type { Metadata } from "next";
import { SolarCalculator } from "@/components/solar-calculator/solar-calculator";
import { parseCalculatorRequest } from "@/lib/solar-calculator/calculator-request";
import type { CalculatorRequest } from "@/lib/solar-calculator/recommendation-types";
import "./solar-calculator.css";

export const metadata: Metadata = {
  title: "Picon Energies",
  description: "Find a suitable Picon power solution for your appliances and backup needs, with an indicative equipment estimate.",
};
// The shell contains no procurement records; the POST endpoint evaluates current eligibility.
export const dynamic = "force-dynamic";
function assessmentFallback(value: string | string[] | undefined): {request:CalculatorRequest;configurationId:string|null}|undefined {
  if (typeof value !== "string" || value.length>6000) return undefined;
  try {
    const parsed=JSON.parse(value);
    if(parsed?.v!==3 || Object.keys(parsed).sort().join()!=="configurationId,request,v" || parsed.configurationId!==null && typeof parsed.configurationId!=="string")return undefined;
    const request=parseCalculatorRequest(parsed.request);
    return request ? {request,configurationId:parsed.configurationId} : undefined;
  } catch { return undefined; }
}
export default async function SolarCalculatorPage({searchParams}:{searchParams:Promise<{solar?:string|string[]}>}) {
  const {solar}=await searchParams;
  return <main id="main-content" className="solar-calculator-page"><SolarCalculator assessmentFallback={assessmentFallback(solar)} /></main>;
}
