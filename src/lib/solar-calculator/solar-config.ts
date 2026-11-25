import { SIZING_POLICY } from "./sizing-policy";

export const DEFAULT_ASSUMPTIONS = {
  backupHours: 6, headroom: SIZING_POLICY.powerHeadroom, powerFactor: SIZING_POLICY.powerFactor, peakSunHours: SIZING_POLICY.peakSunHours, pvPerformance: SIZING_POLICY.pvPerformance,
  coldC: 10, hotCellC: 70, surgeSeconds: SIZING_POLICY.surgeSeconds,
};
export const BACKUP_MODEL = "Each appliance runs for the lesser of its daily operating hours and the backup window. Peak load assumes everything is on together. This is a planning schedule, not a promise of full-load runtime.";
export const APPLIANCES = [
  ["led", "LED bulbs", 10, 6, "light"], ["fan", "Standing fan", 60, 8, "fan"],
  ["tv", "LED TV", 100, 6, "screen"], ["router", "Wi-Fi router", 12, 24, "wifi"],
  ["laptop", "Laptop", 65, 6, "screen"], ["desktop", "Desktop computer", 200, 6, "screen"],
  ["phone", "Phone charger", 10, 3, "phone"], ["cctv", "CCTV set", 50, 24, "camera"],
  ["fridge", "Refrigerator", 150, 10, "appliance"], ["freezer", "Chest freezer", 200, 10, "appliance"],
  ["ac1", "1 HP air conditioner", 900, 6, "fan"], ["ac15", "1.5 HP air conditioner", 1300, 6, "fan"],
  ["pump", "Water pump", 750, 1, "water"], ["wash", "Washing machine", 500, 1, "appliance"],
  ["heater", "Water heater", 2500, 1, "water"], ["micro", "Microwave", 1000, 0.5, "appliance"],
  ["kettle", "Electric kettle", 1500, 0.3, "water"], ["iron", "Pressing iron", 1000, 0.5, "appliance"],
] as const;
const RECOGNITION: [string[], number, number][] = [
  [["rice cooker"],700,1], [["air condition","ac","aircon"],1300,6], [["bulb","lamp","light"],15,6],
  [["fan"],60,8], [["tv","television"],100,6], [["router","wifi","modem"],12,24], [["laptop"],65,6],
  [["desktop","computer","pc","monitor"],200,6], [["phone","charger"],10,3], [["cctv","camera"],50,24],
  [["fridge","refrigerator"],150,10], [["freezer"],200,10], [["pump","borehole"],750,1], [["washing","washer"],500,1],
  [["heater"],2500,1], [["microwave"],1000,0.5], [["kettle"],1500,0.3], [["iron"],1000,0.5],
  [["blender"],400,0.5], [["oven"],2000,1], [["toaster"],800,0.3], [["cooker","stove","hotplate"],1500,1],
  [["dryer"],1800,0.3], [["printer","photocopier"],300,2], [["projector"],250,3], [["speaker"],100,4],
  [["decoder"],20,6], [["dispenser"],100,8], [["radio"],20,4], [["sewing"],100,4],
  [["drill","grinder","saw"],700,1], [["welder"],3000,1], [["compressor"],1500,2], [["clipper","shaver","hair"],60,2],
];
export function suggestAppliance(name: string) {
  const normalized = name.toLowerCase().replace(/[^a-z0-9. ]/g, " ");
  const tokens = normalized.split(/\s+/);
  const found = RECOGNITION.find(([words]) => words.some((word) => word.includes(" ") ? normalized.includes(word) : tokens.some((token) => token === word || token === `${word}s`)));
  return found ? { watts: found[1], hours: found[2] } : null;
}
