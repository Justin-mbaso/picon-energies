import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";

export function Hero() {
  return (
    <section className="hero" aria-labelledby="hero-title">
      <figure className="hero-visual">
        <picture>
          <source media="(max-width: 500px)" srcSet="/images/approved/hero-phone-600.webp 600w, /images/approved/hero-phone-900.webp 900w, /images/approved/hero-phone-972.webp 972w" sizes="100vw" />
          <source media="(max-width: 1000px)" srcSet="/images/approved/hero-tablet-1200.webp 1200w, /images/approved/hero-tablet-1800.webp 1800w, /images/approved/hero-tablet-1944.webp 1944w" sizes="100vw" />
          <source media="(max-width: 1300px)" srcSet="/images/approved/hero-balanced-1600.webp 1600w, /images/approved/hero-balanced-2200.webp 2200w, /images/approved/hero-balanced-2592.webp 2592w" sizes="100vw" />
          <source srcSet="/images/approved/hero-1800.webp 1800w, /images/approved/hero-2560.webp 2560w, /images/approved/hero-3840.webp 3840w" sizes="100vw" />
          <Image
            className="hero-photo"
            src="/images/approved/hero-2560.webp"
            alt="Solar panels near modern architecture beneath a warm evening sky"
            fill
            unoptimized
            loading="eager"
            fetchPriority="high"
            sizes="100vw"
          />
        </picture>
        <span className="hero-visual-shade" aria-hidden="true" />
      </figure>

      <Container className="hero-shell">
        <div className="hero-composition">
          <div className="hero-copy">
            <p className="eyebrow hero-eyebrow">PICON ENERGIES</p>
            <h1 className="hero-title" id="hero-title" aria-label="Powering Icons.">
              <span className="hero-title-line" aria-hidden="true"><span className="hero-title-word">Powering</span></span>
              <span className="hero-title-line" aria-hidden="true"><span className="hero-title-word hero-title-accent">Icons.</span></span>
            </h1>
            <p className="hero-description">
              Picon Energies brings together solar power, reliable energy infrastructure and electric mobility through technology-driven solutions.
            </p>
            <div className="hero-actions">
              <Button href="/contact?intent=solar-assessment">
                Get a Solar Assessment
              </Button>
              <Button href="/#ev-lite" variant="secondary">
                Explore EV Lite <span aria-hidden="true">→</span>
              </Button>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
