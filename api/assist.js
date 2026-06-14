const AI_KEY = process.env.ANTHROPIC_API_KEY;
export default async function handler(req,res){
  if (req.method!=="POST") return res.status(405).end();
  if (!AI_KEY) return res.status(503).json({ error:"IA no configurada" });
  try {
    const { body, category } = req.body || {};
    const sys = "Sos editor del diario ciudadano La Voz Popular. Recibís una nota cruda de un vecino. (1) Reescribila en castellano rioplatense claro y periodístico SIN cambiar su mensaje ni su voz, solo puliéndola; (2) proponé un titular breve y potente; (3) detectá riesgo legal (acusaciones sin prueba, difamación, datos de terceros, insultos) con una advertencia breve o cadena vacía. Respondé SOLO con un objeto JSON sin markdown con las claves improved, title, risk.";
    const userMsg = sys + " Categoria: " + category + " Nota: " + body;
    const r = await fetch("https://api.anthropic.com/v1/messages",{
      method:"POST",
      headers:{ "Content-Type":"application/json", "x-api-key":AI_KEY, "anthropic-version":"2023-06-01" },
      body: JSON.stringify({ model:"claude-sonnet-4-6", max_tokens:1000, messages:[{ role:"user", content: userMsg }] })
    });
    const d = await r.json();
    let t = (d.content||[]).map(i=>i.text||"").join(" ");
    const a = t.indexOf("{"); const b = t.lastIndexOf("}");
    if (a>=0 && b>=0) t = t.slice(a,b+1);
    res.status(200).json(JSON.parse(t));
  } catch(e){ res.status(500).json({ error:String(e) }); }
}
