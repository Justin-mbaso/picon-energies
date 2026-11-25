import Image from "next/image";
import { Container } from "@/components/ui/container";

type SolutionIconName = "storage" | "charging" | "mobility";

function SolutionIcon({ name }: { name: SolutionIconName }) {
  if (name === "storage") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M9 3h6v2h3a1 1 0 0 1 1 1v15H5V6a1 1 0 0 1 1-1h3z" />
        <path d="M12 8 9.5 13h2.8l-.3 4 2.5-5h-2.8z" />
      </svg>
    );
  }

  if (name === "charging") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M6 3h10v18H6zM9 6h4M9 17h4M16 7h2l2 2v5h-2v3h-2" />
        <path d="m11 9-1.5 3h2.2l-.3 3 2-4h-2z" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3 7h12v11H3zM15 11h3l3 3v4h-6z" />
      <circle cx="7" cy="19" r="1.8" />
      <circle cx="18" cy="19" r="1.8" />
      <path d="M17 11v3h4" />
    </svg>
  );
}

function MobilityAreaIcon({ index }: { index: number }) {
  if (index === 0) {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 7h16v11H4zM7 4h13v3M7 18v2m10-2v2M8 11h5m-2.5-2.5v5" />
        <circle cx="18" cy="15" r="2" />
      </svg>
    );
  }

  if (index === 1) {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="9" />
        <path d="M15.2 8.2c-.6-.8-1.7-1.3-3.1-1.3-1.8 0-3 .9-3 2.2 0 3 5.8 1.2 5.8 4.3 0 1.4-1.3 2.4-3.2 2.4-1.5 0-2.8-.6-3.5-1.6M12 5v14" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m12 3 2 .8 2.1-.8 1.7 1.7L17 7l.8 2 2.1 1v2.2l-2.1 1-.8 2 1 2.1-1.7 1.6-2.1-.8-2 .8-1-.8-2.1.8-1.7-1.6 1-2.1-.8-2-2.1-1V10l2.1-1 .8-2-1-2.1L7.1 3.2 9.2 4z" />
      <circle cx="12" cy="11" r="2.4" />
    </svg>
  );
}

const solutions = [
  {
    id: "capability-storage",
    image: "/images/energy-storage-modular.jpg",
    alt: "A modular solar inverter and battery storage system",
    eyebrow: "Energy storage",
    title: "More reliable power.",
    detail: "Scalable battery and inverter solutions designed to make power more reliable.",
    icon: "storage",
  },
  {
    id: "capability-ev-infrastructure",
    image: "/images/ev-infrastructure-card.jpg",
    alt: "A public electric vehicle charging station with two charging cables",
    eyebrow: "EV infrastructure",
    title: "Infrastructure for electric mobility.",
    detail: "Charging equipment procurement, deployment and infrastructure partnerships supporting electric mobility.",
    icon: "charging",
  },
  {
    id: "capability-green-mobility",
    image: "/images/green-mobility.jpg",
    alt: "An electric bus charging beneath a station canopy",
    eyebrow: "Green Mobility",
    titleLines: ["Fleet Electrification", "Monetization models", "Monitoring and maintenance"],
    icon: "mobility",
  },
] as const;

const mobilityAreas = [
  {
    title: "Fleet Electrification",
    detail: "Planning the shift from conventional fleets to electric vehicles, with charging and operational requirements in view.",
  },
  {
    title: "Monetization models",
    detail: "Exploring practical commercial models for deploying and using electric mobility infrastructure.",
  },
  {
    title: "Monitoring and maintenance",
    detail: "Supporting ongoing oversight and maintenance needs across vehicles and charging infrastructure.",
  },
] as const;

export function EvInfrastructure() {
  return (
    <section
      className="ev-infrastructure"
      id="ev-infrastructure"
      aria-labelledby="ev-infrastructure-title"
    >
      <Container>
        <header className="solutions-heading">
          <span className="solutions-heading-mark" aria-hidden="true">
            <span className="solutions-heading-mark-dot" />
            <span className="solutions-heading-mark-bar solutions-heading-mark-bar-one" />
            <span className="solutions-heading-mark-bar solutions-heading-mark-bar-two" />
            <span className="solutions-heading-mark-bar solutions-heading-mark-bar-three" />
          </span>
          <div className="solutions-heading-copy">
            <p className="eyebrow">Solutions</p>
            <h2 id="ev-infrastructure-title">
              Solutions for reliable power <span className="solutions-title-line">and <span className="solutions-title-accent">electric mobility.</span></span>
            </h2>
          </div>
        </header>

        <div className="solutions-grid">
          {solutions.map((solution) => (
            <article className="solution-card" id={solution.id} key={solution.id}>
              <figure className={`solution-photo solution-photo-${solution.icon}`}>
                <Image
                  src={solution.image}
                  alt={solution.alt}
                  fill
                  sizes="(max-width: 42rem) 100vw, (max-width: 58rem) 50vw, 33vw"
                />
              </figure>
              <div className={`solution-copy${"titleLines" in solution ? " solution-copy-mobility" : ""}`}>
                <span className="solution-icon"><SolutionIcon name={solution.icon} /></span>
                <div className="solution-copy-main">
                  <p className="eyebrow">{solution.eyebrow}</p>
                  <h3 className={"titleLines" in solution ? "solution-title-lines" : undefined}>
                    {"titleLines" in solution
                      ? solution.titleLines.map((line) => <span key={line}>{line}</span>)
                      : solution.title}
                  </h3>
                  {"detail" in solution && <p>{solution.detail}</p>}
                </div>
              </div>
            </article>
          ))}
        </div>

        <ul className="mobility-line-areas" aria-label="Green mobility services">
          {mobilityAreas.map((area, index) => (
            <li key={area.title}>
              <span className="mobility-line-icon"><MobilityAreaIcon index={index} /></span>
              <span className="mobility-line-divider" aria-hidden="true" />
              <div>
                <h3>{area.title}</h3>
                <p>{area.detail}</p>
              </div>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}
