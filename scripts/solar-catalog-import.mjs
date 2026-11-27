import { readFile, writeFile, rename, copyFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { resolve, dirname } from "node:path";
import { registerHooks } from "node:module";
import { existsSync } from "node:fs";

// Native Node 24 TypeScript support; the application keeps Next's extensionless imports.
registerHooks({ resolve(specifier, context, nextResolve) {
  if (specifier.startsWith(".") && context.parentURL) {
    const url = new URL(`${specifier}.ts`, context.parentURL);
    if (existsSync(url)) return nextResolve(url.href, context);
  }
  return nextResolve(specifier, context);
} });
const { assertCatalog, offerChange } = await import("../src/lib/solar-catalog/catalog-validation.ts");
const { PRICE_MAX_AGE_DAYS } = await import("../src/lib/solar-catalog/pricing.ts");

export function parseCsv(text) {
  const rows = []; let row = [], cell = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') { if (quoted && text[i + 1] === '"') { cell += '"'; i++; } else if (!quoted && cell) throw new Error("Malformed CSV quoting."); else quoted = !quoted; }
    else if (!quoted && (c === "," || c === "\n")) { row.push(cell.replace(/\r$/, "")); cell = ""; if (c === "\n") { if (row.some(Boolean)) rows.push(row); row = []; } }
    else cell += c;
  }
  if (quoted) throw new Error("Unclosed CSV quote.");
  if (cell || row.length) { row.push(cell.replace(/\r$/, "")); rows.push(row); }
  if (rows.length < 2) throw new Error("CSV requires a header and at least one reviewed offer.");
  const headers = rows.shift();
  if (new Set(headers).size !== headers.length) throw new Error("Duplicate CSV headers.");
  return rows.map((values) => { if (values.length !== headers.length) throw new Error("CSV column count mismatch."); return Object.fromEntries(headers.map((h,i) => [h, values[i]])); });
}
export function applyReviewedOffers(catalog, rows, reviewer, now = new Date()) {
  assertCatalog(catalog);
  if (!reviewer?.trim() || rows.length === 0) throw new Error("Reviewer and reviewed rows are required.");
  const next = structuredClone(catalog), changes = [], seen = new Set();
  const columns = ["id","supplier","supplierProductId","parentId","originalModel","variantJson","priceNgn","currency","stock","retrievedAt","sourceUrl","verification"];
  for (const row of rows) {
    if (columns.some((k) => !(k in row)) || Object.keys(row).some((k) => !columns.includes(k))) throw new Error("Use the exact documented CSV columns.");
    if (seen.has(row.id)) throw new Error("Duplicate import row."); seen.add(row.id);
    const previous = next.offers.find((o) => o.id === row.id);
    if (!previous) throw new Error("New products and identity mappings require a separate technical JSON review.");
    if (previous.supplier !== row.supplier || previous.supplierProductId !== row.supplierProductId || (previous.parentId ?? "") !== row.parentId || (previous.originalModel ?? "") !== row.originalModel || previous.url !== row.sourceUrl || JSON.stringify(Object.entries(previous.variant).sort()) !== JSON.stringify(Object.entries(JSON.parse(row.variantJson)).sort())) throw new Error(`Identity or variant changed: ${row.id}`);
    if (!/^\d+(?:\.\d{1,2})?$/.test(row.priceNgn) || row.currency !== "NGN") throw new Error("Price must be naira with at most two decimals, not kobo or formatted currency.");
    const retrieved = Date.parse(row.retrievedAt);
    if (!Number.isFinite(retrieved) || retrieved < Date.parse(previous.retrievedAt) || retrieved > now.getTime() + 300_000 || now.getTime() - retrieved > PRICE_MAX_AGE_DAYS * 86_400_000) throw new Error("Retrieval must be current and cannot regress.");
    const updated = { ...previous, priceNgn: Number(row.priceNgn), currency: row.currency, stock: row.stock, retrievedAt: row.retrievedAt, verification: row.verification };
    if (!updated.verification.trim()) throw new Error("Each updated row needs a verification note.");
    changes.push(offerChange(previous,updated)); Object.assign(previous,updated);
  }
  next.version = now.toISOString(); next.reviewedAt = now.toISOString(); next.reviewer = reviewer.trim();
  assertCatalog(next);
  return { catalog: next, changes };
}
export async function importCatalog({ catalogPath, csvPath, reviewer, apply = false, now = new Date() }) {
  const original = await readFile(catalogPath,"utf8");
  const result = applyReviewedOffers(JSON.parse(original),parseCsv(await readFile(csvPath,"utf8")),reviewer,now);
  if (apply) {
    const backup = `${catalogPath}.${now.toISOString().replace(/[:.]/g,"-")}.bak`;
    const temporary = `${catalogPath}.pending-${process.pid}`;
    // Validation happens before either write. Retain the exact previous approved bytes.
    await copyFile(catalogPath,backup);
    await writeFile(temporary,`${JSON.stringify(result.catalog,null,2)}\n`,{ flag: "wx" });
    await rename(temporary,catalogPath);
  }
  return { applied: apply, changes: result.changes, warning: "Review supplier price differences, unknown stock, VAT, delivery and installation before publishing." };
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const args = process.argv.slice(2), get = (name) => args[args.indexOf(name) + 1];
  try {
    if (!args.includes("--file") || !args.includes("--reviewer")) throw new Error('Usage: node scripts/solar-catalog-import.mjs --file reviewed.csv --reviewer "Name" [--apply]');
    console.log(JSON.stringify(await importCatalog({ catalogPath: resolve(dirname(fileURLToPath(import.meta.url)),"../src/lib/solar-catalog/catalog.json"), csvPath: resolve(get("--file")), reviewer: get("--reviewer"), apply: args.includes("--apply") }),null,2));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
