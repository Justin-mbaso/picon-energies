import Link from "next/link";
import { Container } from "@/components/ui/container";

const solutionPaths = [
  {
    label: "Solar",
    title: "Solar assessment",
    description: "Start with how you use power, then shape a system around your needs and budget.",
    href: "/contact?intent=solar-assessment",
    icon: "solar",
  },
  {
    label: "Energy storage",
    title: "More reliable power",
    description: "Battery and inverter solutions designed to make power more reliable.",
    href: "/#capability-storage",
    icon: "storage",
  },
  {
    label: "EV infrastructure",
    title: "Infrastructure for electric mobility",
    description: "Charging equipment procurement, deployment and infrastructure partnerships.",
    href: "/#capability-ev-infrastructure",
    icon: "mobility",
  },
] as const;

function PathIcon({ kind }: { kind: (typeof solutionPaths)[number]["icon"] }) {
  return (
    <svg
      className="solution-path-icon"
      viewBox="0 0 40 40"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {kind === "solar" && (
        <>
          <circle cx="20" cy="20" r="6" />
          <path d="M20 3.5v5M20 31.5v5M3.5 20h5M31.5 20h5M8.3 8.3l3.6 3.6m16.2 16.2 3.6 3.6m0-23.4-3.6 3.6m-16.2 16.2-3.6 3.6" />
        </>
      )}
      {kind === "storage" && (
        <>
          <rect x="10" y="8" width="20" height="27" rx="2.5" />
          <path d="M16 8V5h8v3m-4 7-4 7h4l-1 6 5-8h-4l1-5" />
        </>
      )}
      {kind === "mobility" && (
        <>
          <path d="M15 5v10m10-10v10m-15-4h20v4a10 10 0 0 1-10 10v10m0-10a10 10 0 0 1-10-10z" />
        </>
      )}
    </svg>
  );
}

export function SolutionPaths() {
  return (
    <section className="solution-paths" aria-labelledby="solution-paths-title">
      <Container>
        <header className="solution-paths-heading">
          <p className="eyebrow">Find your starting point</p>
          <h2 id="solution-paths-title">Choose a place to begin.</h2>
        </header>
        <div className="solution-paths-grid">
          {solutionPaths.map((path, index) => (
            <Link className="solution-path" href={path.href} key={path.label}>
              <span className="solution-path-icon-wrap">
                <PathIcon kind={path.icon} />
              </span>
              <span className="solution-path-content">
                <span className="eyebrow"><span>0{index + 1}</span> / {path.label}</span>
                <span className="solution-path-title">{path.title}</span>
                <span className="solution-path-description">{path.description}</span>
              </span>
              <span className="solution-path-arrow" aria-hidden="true">→</span>
            </Link>
          ))}
        </div>
      </Container>
    </section>
  );
}
