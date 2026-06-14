const URL = process.env.KV_REST_API_URL, TOKEN = process.env.KV_REST_API_TOKEN;
const PIN = process.env.EDITOR_PIN || "Teo.230913";
async function redis(cmd){
  const r = await fetch(URL,{ method:"POST", headers:{ Authorization:"Bearer "+TOKEN, "Content-Type":"application/json" }, body: JSON.stringify(cmd) });
  return (await r.json()).result;
}
const get = async k => JSON.parse((await redis(["GET",k])) || "[]");
const set = (k,v) => redis(["SET",k, JSON.stringify(v)]);

export default async function handler(req,res){
  if (req.method!=="POST") return res.status(405).end();
  const { pin, action, id, word, words } = req.body || {};
  if (pin !== PIN) return res.status(401).json({ error:"PIN incorrecto" });
  try {
    let notes = await get("epn:notes"), held = await get("epn:held"), blocklist = await get("epn:blocklist");

    if (action==="approve") {
      const n = held.find(h=>h.id===id);
      if (n){ held = held.filter(h=>h.id!==id); notes = [{...n, heldApproved:true}, ...notes]; await set("epn:held",held); await set("epn:notes",notes); }
    } else if (action==="discard") {
      held = held.filter(h=>h.id!==id); await set("epn:held",held);
    } else if (action==="delete") {
      notes = notes.filter(n=>n.id!==id); await set("epn:notes",notes);
    } else if (action==="addWords") {
      blocklist = Array.from(new Set([...blocklist, ...(words||[]).map(w=>w.toLowerCase())])); await set("epn:blocklist",blocklist);
    } else if (action==="removeWord") {
      blocklist = blocklist.filter(w=>w!==word); await set("epn:blocklist",blocklist);
    }
    res.status(200).json({ notes, held, blocklist });
  } catch(e){ res.status(500).json({ error:String(e) }); }
}
