const URL = process.env.KV_REST_API_URL, TOKEN = process.env.KV_REST_API_TOKEN;
const AI_KEY = process.env.ANTHROPIC_API_KEY;

const HIDDEN = ["torres","gundel"];

async function redis(cmd){
  const r = await fetch(URL,{ method:"POST", headers:{ Authorization:"Bearer "+TOKEN, "Content-Type":"application/json" }, body: JSON.stringify(cmd) });
  return (await r.json()).result;
}
const strip = s => (s||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
const hits = (text,list) => { const n=strip(text); return list.filter(w=>{const x=strip(w).trim(); return x && n.includes(x);}); };

async function negativeAboutFamily(text){
  if (!AI_KEY) return false;
  const sys = "Analizá esta nota de un diario ciudadano. ¿Habla de forma negativa, crítica o acusatoria sobre Lucas Torres, Luca, o cualquier integrante de las familias Torres o Gundel? Una mención neutral, positiva o ajena no cuenta. Respondé solo con la palabra true o la palabra false.";
  try {
    const prompt = sys + " Nota: " + text;
    const r = await fetch("https://api.anthropic.com/v1/messages",{
      method:"POST",
      headers:{ "Content-Type":"application/json", "x-api-key":AI_KEY, "anthropic-version":"2023-06-01" },
      body: JSON.stringify({ model:"claude-sonnet-4-6", max_tokens:10, messages:[{role:"user", content: prompt }] })
    });
    const d = await r.json();
    const t = (d.content||[]).map(i=>i.text||"").join(" ").toLowerCase();
    return t.includes("true");
  } catch { return true; }
}

export default async function handler(req,res){
  if (req.method!=="POST") return res.status(405).end();
  try {
    const { category, title, body, author, isPseudonym } = req.body || {};
    if (!body || body.trim().length<3) return res.status(400).json({ error:"Nota vacía" });
    const finalTitle = (title&&title.trim()) || body.trim().slice(0,60) + (body.length>60?"…":"");
    const note = {
      id: Date.now().toString(36)+Math.random().toString(36).slice(2,6),
      category: category||"noticia", title: finalTitle, body: body.trim(),
      author: (author&&author.trim()) || "Vecino anónimo",
      isPseudonym: !!isPseudonym, ts: Date.now()
    };
    const combined = body + " " + finalTitle;

    const blocklist = JSON.parse((await redis(["GET","epn:blocklist"])) || "[]");
    const visible = hits(combined, blocklist);

    let status, held = false, payload = note;
    if (visible.length>0) { held=true; payload={ ...note, reasonType:"words", flaggedWords:visible }; }
    else if (hits(combined, HIDDEN).length>0) { held=true; payload={ ...note, reasonType:"editorial" }; }
    else if (await negativeAboutFamily(combined)) { held=true; payload={ ...note, reasonType:"editorial" }; }

    if (held) {
      const arr = JSON.parse((await redis(["GET","epn:held"])) || "[]");
      await redis(["SET","epn:held", JSON.stringify([payload, ...arr])]);
      status = "held";
    } else {
      const arr = JSON.parse((await redis(["GET","epn:notes"])) || "[]");
      await redis(["SET","epn:notes", JSON.stringify([payload, ...arr])]);
      status = "published";
    }
    res.status(200).json({ status });
  } catch(e){ res.status(500).json({ error:String(e) }); }
}
