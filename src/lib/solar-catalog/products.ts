import data from "./catalog.json";
import { assertCatalog } from "./catalog-validation";
import type { Catalog } from "./types";
import delta from "../../../picon_research/catalogue_delta.json";
import { integrateResearchCatalog } from "./research-integration";

const integrated = integrateResearchCatalog(data as Catalog, delta);
assertCatalog(integrated);
export const solarCatalog = integrated;
