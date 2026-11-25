import data from "./system-configurations.json";
import { solarCatalog } from "./products";
import { validateConfigurations } from "../solar-calculator/system-recommendations";
import type { ConfigurationCatalog } from "../solar-calculator/recommendation-types";
import delta from "../../../picon_research/catalogue_delta.json";
import { integrateResearchConfigurations } from "./research-integration";

const integrated=integrateResearchConfigurations(data as ConfigurationCatalog,delta);
const errors=validateConfigurations(integrated,solarCatalog);
if(errors.length) throw new Error(`System configurations rejected: ${errors.join("; ")}`);
export const systemConfigurations=integrated as ConfigurationCatalog;
