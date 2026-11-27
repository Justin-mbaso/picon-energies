import "./solar-catalog-import.mjs";
import {readFile,writeFile} from "node:fs/promises";
import {resolve} from "node:path";
import {pathToFileURL} from "node:url";
const {recommendSystems}=await import("../src/lib/solar-calculator/system-recommendations.ts");
const {DEFAULT_ASSUMPTIONS}=await import("../src/lib/solar-calculator/solar-config.ts");
const c=JSON.parse(await readFile(new URL("../src/lib/solar-catalog/catalog.json",import.meta.url),"utf8"));
const configurations=JSON.parse(await readFile(new URL("../src/lib/solar-catalog/system-configurations.json",import.meta.url),"utf8"));
const load=(id,name,watts,hours,quantity=1,startingW=watts)=>({id,name,watts,hours,quantity,startingW});
export const scenarios=[
  {id:"A",name:"Small portable requirement",backupHours:3,loads:[load("light","LED lighting",10,6,2),load("router","Router",12,24)]},
  {id:"B",name:"Larger portable requirement",backupHours:4,loads:[load("tv","TV",100,6),load("laptop","Laptop",65,6),load("fan","Fans",60,8,2,180)]},
  {id:"C",name:"Compact integrated requirement",backupHours:6,loads:[load("fridge","Fridge",150,10,1,900),load("fan","Fans",60,8,2,180),load("router","Router",12,24)]},
  {id:"D",name:"Standard full solar requirement",backupHours:6,loads:[load("lights","Lighting",10,6,10),load("fans","Fans",60,8,3,180),load("tv","TV",100,6),load("router","Router",12,24),load("fridge","Fridge",150,10,1,900),load("pump","Water pump",750,1,1,2250)]},
  {id:"E",name:"Higher full solar requirement",backupHours:8,loads:[load("computers","Computers",200,8,10),load("ac","Air conditioning",1300,6,2,3900),load("lighting","Lighting",10,8,20)]},
  {id:"F",name:"Outside catalogue capacity",backupHours:12,loads:[load("plant","Measured facility load",50000,12,1,80000)]},
];
export function diagnoseActualCatalog(now=new Date()) {
  return {generatedAt:now.toISOString(),catalogVersion:c.version,configurationVersion:configurations.version,scenarios:scenarios.map((scenario)=>{
    const request={loads:scenario.loads,assumptions:{...DEFAULT_ASSUMPTIONS,backupHours:scenario.backupHours},solarCharging:false};
    const {customer,diagnostics}=recommendSystems(c,configurations,request,now);
    return {id:scenario.id,name:scenario.name,request,energy:customer.energy,suitableConfigurations:customer.options,bestFit:customer.bestFitId,alternatives:customer.options.filter((o)=>!o.bestFit),diagnostics,installation:"Installation, commissioning and standard installation consumables will be assessed and quoted separately by Picon.",verificationOutcome:customer.options.length ? "SUPPORTED_BY_REVIEWED_CATALOGUE" : "NOT_VERIFIED_FROM_CURRENT_MANUFACTURER_AND_AVAILABILITY_EVIDENCE"};
  })};
}
if(process.argv[1] && import.meta.url===pathToFileURL(resolve(process.argv[1])).href) {
  const report=JSON.stringify(diagnoseActualCatalog(),null,2);
  const outputIndex=process.argv.indexOf("--output");
  if(outputIndex!==-1) {await writeFile(resolve(process.argv[outputIndex+1]),report+"\n");console.log("Internal rejection report written. No catalogue data changed.");}
  else console.log(report);
}
