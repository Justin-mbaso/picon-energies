import { Hero } from "@/components/sections/hero";
import { Capabilities } from "@/components/sections/capabilities";
import { Solar } from "@/components/sections/solar";
import { EvInfrastructure } from "@/components/sections/ev-infrastructure";
import { EvLite } from "@/components/sections/ev-lite";
import { SolutionPaths } from "@/components/sections/solution-paths";
import { ContactFrame } from "@/components/sections/contact-frame";

export default function Home() {
  return (
    <main className="site-main" id="main-content">
      <Hero />
      <Capabilities />
      <Solar />
      <EvInfrastructure />
      <EvLite />
      <SolutionPaths />
      <ContactFrame />
    </main>
  );
}
