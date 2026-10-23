import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";

export function Hero() {
  return (
    <section className="hero" aria-labelledby="hero-title">
      <figure className="hero-visual">
        <Image
          className="hero-photo"
          src="/images/solar-array.jpg"
          alt="A field of solar panels catching the late afternoon light"
          fill
          priority
          sizes="(max-width: 42rem) 100vw, (max-width: 58rem) 47vw, 52vw"
        />
        <span className="hero-visual-shade" aria-hidden="true" />
      </figure>

      <Container className="hero-shell">
        <div className="hero-composition">
          <div className="hero-copy">
            <p className="eyebrow hero-eyebrow">PICON ENERGIES</p>
            <h1 className="hero-title" id="hero-title">
              <span>POWERING</span>
              <span className="hero-emphasis">INTELLIGENT</span>
              <span>ENERGY &amp; MOBILITY.</span>
            </h1>
            <p className="hero-description">
              Reliable, affordable and intelligent energy solutions for homes,
              businesses and the infrastructure around them.
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
