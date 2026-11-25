import { solarCatalog } from "@/lib/solar-catalog/products";
import { systemConfigurations } from "@/lib/solar-catalog/configurations";
import { parseCalculatorRequest } from "@/lib/solar-calculator/calculator-request";
import { recommendSystems } from "@/lib/solar-calculator/system-recommendations";

export const runtime="nodejs";
const MAX_BYTES=48_000;
const reply=(body:unknown,status=200) => Response.json(body,{status,headers:{"Cache-Control":"no-store"}});
export async function POST(request:Request) {
  if(!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) return reply({code:"unsupported_media_type"},415);
  if(Number(request.headers.get("content-length"))>MAX_BYTES) return reply({code:"payload_too_large"},413);
  let value:unknown;
  try {
    const reader=request.body?.getReader();if(!reader)return reply({code:"invalid_request"},400);
    let size=0,text="";const decoder=new TextDecoder();
    for(;;) {const {done,value:chunk}=await reader.read();if(done)break;size+=chunk.byteLength;if(size>MAX_BYTES){await reader.cancel();return reply({code:"payload_too_large"},413);}text+=decoder.decode(chunk,{stream:true});}
    value=JSON.parse(text+decoder.decode());
  } catch {return reply({code:"invalid_json"},400);}
  const parsed=parseCalculatorRequest(value);
  if(!parsed) return reply({code:"invalid_inputs"},422);
  try {
    const {customer}=recommendSystems(solarCatalog,systemConfigurations,parsed);
    // Customer equipment details are returned; supplier offers and rejection diagnostics stay server-side.
    return reply(customer);
  } catch {
    console.error("[solar-calculator] configuration evaluation failed");
    return reply({code:"calculator_unavailable"},503);
  }
}
