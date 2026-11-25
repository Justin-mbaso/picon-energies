import type { Catalog, Offer, Product } from "./types";

export const PRICE_POLICY = { refreshAfterHours: 24, suppressAfterDays: 7, lowMarkup: 0.02, highMarkup: 0.05 };
export const PRICE_MAX_AGE_DAYS = PRICE_POLICY.suppressAfterDays;
export const INSTALLATION_NOTE = "Every property has different installation requirements. Picon will assess your site, confirm the equipment arrangement, and determine the installation and commissioning requirements before finalising your project cost.";
export function applyPiconMarkup(price: { low: number; high: number }) {
  const low=Math.round(price.low*(1+PRICE_POLICY.lowMarkup)*100)/100;
  const high=Math.round(price.high*(1+PRICE_POLICY.highMarkup)*100)/100;
  if(![low,high].every((n)=>Number.isFinite(n)&&n>0&&n*100<=Number.MAX_SAFE_INTEGER))return null;
  return {low,high};
}
export function priceFreshness(offer: Offer, now = new Date()) {
  if (!isCurrent(offer,now)) return "expired";
  return now.getTime() - Date.parse(offer.retrievedAt) > PRICE_POLICY.refreshAfterHours * 3_600_000 ? "refresh_due" : "current";
}
export function isCurrent(offer: Offer, now = new Date()): boolean {
  const age = now.getTime() - Date.parse(offer.retrievedAt);
  return Number.isFinite(age) && age >= -300_000 && age <= PRICE_MAX_AGE_DAYS * 86_400_000;
}
export function eligibleOffer(offer: Offer, now = new Date()): boolean {
  return offer.identity === "verified" && offer.condition === "new" &&
    offer.stock === "in_stock" && isCurrent(offer, now) && offer.priceNgn !== null && offer.priceNgn > 0 && Number.isSafeInteger(Math.round(offer.priceNgn*100));
}
export function materialRange(offers: Offer[], now = new Date()) {
  const usable = offers.filter((o) => eligibleOffer(o, now) && o.priceBasis === "materials");
  if (!usable.length) return null;
  // A caller must select one exact product/configuration; never pool unrelated prices.
  const identity = (o: Offer) => JSON.stringify([o.productId ?? [o.supplier, o.parentId, o.supplierProductId], Object.entries(o.variant).sort()]);
  if (new Set(usable.map(identity)).size !== 1) return null;
  const low = Math.min(...usable.map((o) => o.priceNgn!));
  const high = Math.max(...usable.map((o) => o.priceNgn!));
  return { low, high, defaultOffer: usable.find((o) => o.supplier === "nikade") ?? usable[0], offers: usable };
}
export function productPrice(catalog: Catalog, productId: string, now = new Date()) {
  const price=observedProductPrice(catalog,productId,now);
  const customerPrice=price&&applyPiconMarkup(price);
  return price&&customerPrice?{...price,...customerPrice}:null;
}
/** Recent public observations; recommendation eligibility separately requires a current in-stock offer. */
export function observedProductPrice(catalog: Catalog, productId: string, now = new Date()) {
  const observations = catalog.offers.filter((o) => o.productId === productId && o.identity === "verified" && o.condition === "new" && o.priceBasis === "materials" && o.currency === "NGN" && o.priceNgn !== null && o.priceNgn > 0 && isCurrent(o, now));
  // The same public URL can be imported more than once. Keep distinct current
  // listings from one supplier, but do not count duplicate copies twice.
  const unique = new Map<string, Offer>();
  for (const offer of observations) {
    const key = JSON.stringify([offer.supplier, offer.url, Object.entries(offer.variant).sort()]);
    const previous = unique.get(key);
    if (!previous || Date.parse(offer.retrievedAt) > Date.parse(previous.retrievedAt)) unique.set(key, offer);
  }
  const offers = [...unique.values()];
  if (!offers.length) return null;
  const low = Math.min(...offers.map((o) => o.priceNgn!)), high = Math.max(...offers.map((o) => o.priceNgn!));
  return { low, high, offers };
}
export function capacityPriceBenchmark(catalog: Catalog, kind: "inverter" | "battery" | "panel", now = new Date(), targetCapacity?: number) {
  const capacity = (product: Product) => product.kind === "inverter" && kind === "inverter" ? product.specs.continuousW
    : product.kind === "battery" && kind === "battery" ? product.specs.nominalWh
      : product.kind === "panel" && kind === "panel" ? product.specs.watts : null;
  const comparableClass = (product: Product) => {
    if (kind === "inverter") return product.kind === "inverter" && product.specs.phase === 1 && product.specs.batteryMinV !== null && product.specs.batteryMinV <= 48 && product.specs.batteryMaxV !== null && product.specs.batteryMaxV >= 48;
    if (kind === "battery") return product.kind === "battery" && product.specs.chemistry?.toLowerCase().replaceAll("₄", "4").includes("lifepo4") === true && product.specs.nominalV !== null && product.specs.nominalV >= 40 && product.specs.nominalV <= 60;
    return product.kind === "panel" && product.specs.watts !== null && product.specs.watts >= 400 && !!product.specs.technology;
  };
  let comparableProducts = catalog.products.filter((p) => p.kind === kind && comparableClass(p));
  if (kind === "panel") {
    const topcon = comparableProducts.filter((p) => p.kind === "panel" && p.specs.technology?.toLowerCase().includes("topcon"));
    if (topcon.length) comparableProducts = topcon;
    else {
      const frequency = new Map<string,number>();
      for (const product of comparableProducts) if (product.kind === "panel") {
        const technology=product.specs.technology!.toLowerCase();
        frequency.set(technology,(frequency.get(technology)??0)+1);
      }
      const commonClass=[...frequency].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]))[0]?.[0];
      comparableProducts=comparableProducts.filter((p)=>p.kind==="panel"&&p.specs.technology?.toLowerCase()===commonClass);
    }
  }
  const points = comparableProducts.flatMap((product) => {
    const size = capacity(product);
    const price = observedProductPrice(catalog, product.id, now);
    if (!size || !price) return [];
    return price.offers.map((offer) => ({ product, size, rate: offer.priceNgn! / size, offer }));
  });
  if (!points.length) return null;
  const rates = points.map((p) => p.rate);
  const lowRate=Math.min(...rates),highRate=Math.max(...rates);
  const referencePool=targetCapacity===undefined?points:points.filter((p)=>p.size>=targetCapacity).toSorted((a,b)=>a.size-b.size||a.rate-b.rate);
  if(!referencePool.length&&targetCapacity!==undefined)referencePool.push(...points.toSorted((a,b)=>b.size-a.size||a.rate-b.rate));
  const referenceProductId=referencePool[0].product.id;
  const reference = points.filter((p)=>p.product.id===referenceProductId).sort((a, b) => Date.parse(b.offer.retrievedAt) - Date.parse(a.offer.retrievedAt))[0];
  return { lowRate, highRate, referenceProduct: reference.product, referenceSize: reference.size,
    referencePrice: reference.offer.priceNgn!, referenceDate: new Date(Math.max(...points.map((p)=>Date.parse(p.offer.retrievedAt)))).toISOString().slice(0,10),
    statistic: "supplier_range", sampleCount: rates.length,
    evidence: points.map(({ product, offer }) => ({ model: product.model, source: offer.url, observedAt: offer.retrievedAt, valueNgn: offer.priceNgn, stock: offer.stock })) };
}
export function priceBillOfMaterials(catalog: Catalog, lines: { productId: string; quantity: number }[], now = new Date()) {
  if (!lines.length || new Set(lines.map((l) => l.productId)).size !== lines.length) return null;
  const priced = lines.map((line) => ({ ...line, price: productPrice(catalog, line.productId, now) }));
  if (priced.some((l) => !l.price || !Number.isInteger(l.quantity) || l.quantity < 1)) return null;
  const baseLow = priced.reduce((s, l) => s + l.price!.offers.reduce((min,o)=>Math.min(min,o.priceNgn!),Number.POSITIVE_INFINITY) * l.quantity, 0);
  const baseHigh = priced.reduce((s, l) => s + l.price!.offers.reduce((max,o)=>Math.max(max,o.priceNgn!),0) * l.quantity, 0);
  const total=applyPiconMarkup({low:baseLow,high:baseHigh});
  if(!total) return null;
  return { ...total, lines: priced };
}
export function pricePackage(catalog: Catalog, packageId: string, now = new Date()) {
  const pack = catalog.packages.find((p) => p.id === packageId);
  const offer = pack && catalog.offers.find((o) => o.id === pack.offerId);
  if (!pack || !offer || offer.identity!=="verified" || offer.condition!=="new" || offer.priceBasis!=="materials" || offer.currency!=="NGN" || offer.priceNgn===null || offer.priceNgn<=0 || !isCurrent(offer,now)) return null;
  // Package components are descriptive, never added again to its published price.
  const materials=applyPiconMarkup({low:offer.priceNgn,high:offer.priceNgn});
  return { pack, offer, materials };
}
/** Non-binding subtotal from exact-model public listing observations only.
 * Unresolved battery, panel and site-defined BoS lines are counted but never
 * priced by proxy. Amounts are computed as integer kobo. */
export function preliminaryResearchBudget(delta: NonNullable<Catalog["researchDelta"]>, now = new Date()) {
  const candidates = delta.offers.filter((raw): raw is Record<string, unknown> => !!raw && typeof raw === "object").filter((o) =>
    o.research_product_id === "deye-6k-og" && o.match_status === "exact_model_label" && typeof o.price_ngn === "number" && Number.isFinite(o.price_ngn) && o.price_ngn > 0 &&
    typeof o.observed_on === "string" && isCurrent({ retrievedAt: `${o.observed_on}T00:00:00.000Z` } as Offer, now)
  );
  if (!candidates.length) return null;
  const amounts = candidates.map((o) => Math.round(Number(o.price_ngn) * 100));
  const lowMinor = Math.min(...amounts), highMinor = Math.max(...amounts);
  const roundKobo = (amount: number) => Math.round(amount);
  const lineCount = 12; // inverter, battery bank, panels, plus nine site/BOS requirements
  return {
    low: roundKobo(lowMinor) / 100,
    high: roundKobo(highMinor) / 100,
    pricedLines: 1,
    missingLines: lineCount - 1,
    lineCount,
    referenceDate: delta.as_of,
    note: "Partial public-listing materials subtotal for one exact-model inverter line only. Battery, panels and nine balance-of-system lines remain unpriced or site-assessed; this is not a complete system price or recommendation. Installation and commissioning are separate.",
  };
}
export function naira(value: number) {
  return new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format(value);
}
