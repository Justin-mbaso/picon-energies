import type { Metadata } from "next";
import { SolarCalculator } from "@/components/solar-calculator/solar-calculator";
import "./solar-calculator.css";

export const metadata: Metadata = {
  title: "Solar Calculator | Picon Energies",
  description: "Find a suitable Picon power solution for your appliances and backup needs, with an indicative equipment estimate.",
};
// The shell contains no procurement records; the POST endpoint evaluates current eligibility.
export const dynamic = "force-dynamic";
export default function SolarCalculatorPage() {
  return <main id="main-content" className="solar-calculator-page"><SolarCalculator /></main>;
}
