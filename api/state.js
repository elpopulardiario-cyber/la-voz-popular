const URL = process.env.KV_REST_API_URL, TOKEN = process.env.KV_REST_API_TOKEN;
async function redis(cmd){
  const r = await fetch(URL,{ method:"POST", headers:{ Authorization:`Bearer ${TOKEN}`, "Content-Type":"application/json" }, body: JSON.stringify(cmd) });
  return (await r.json()).result;
}
export default async function handler(req,res){
  try {
    const notes = JSON.parse((await redis(["GET","epn:notes"])) || "[]");
    res.status(200).json({ notes });
  } catch(e){ res.status(500).json({ notes:[], error:String(e) }); }
}
