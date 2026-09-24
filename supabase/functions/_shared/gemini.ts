// Gemini 호출 (서버 전용, 키는 secret GEMINI_API_KEY). 붐비거나 한도 초과면 다음 모델로 넘어간다.
const KEY = Deno.env.get("GEMINI_API_KEY");
const MODELS = (Deno.env.get("GEMINI_MODELS") ?? "gemini-3.8-flash,gemini-3.6-flash,gemini-3.5-flash,gemini-3.5-flash-lite").split(",").map((m) => m.trim()).filter(Boolean);

export class AiUnavailable extends Error {}

export async function geminiJson(system: string, user: string, schema: unknown, timeoutMs = 45_000): Promise<{ data: unknown; model: string }> {
  if (!KEY) throw new AiUnavailable("서버에 GEMINI_API_KEY 가 설정되지 않았어요");
  const body = JSON.stringify({
    systemInstruction: { parts: [{ text: system }] },
    contents: [{ role: "user", parts: [{ text: user }] }],
    generationConfig: { responseMimeType: "application/json", responseSchema: schema, temperature: 0.4 },
  });
  let last = "";
  for (const model of MODELS) {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), timeoutMs);
    try {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": KEY }, body, signal: ctl.signal,
      });
      if (!r.ok) {
        last = `${model} ${r.status}`;
        console.error("gemini", model, r.status, (await r.text()).slice(0, 300));
        if ([404, 429, 500, 503].includes(r.status)) continue;
        break;
      }
      const d = await r.json();
      return { data: JSON.parse(d.candidates[0].content.parts[0].text), model };
    } catch (e) {
      last = `${model} ${(e as Error).name}`;
      console.error("gemini", model, (e as Error).message);
    } finally { clearTimeout(t); }
  }
  throw new AiUnavailable(`AI 응답을 받지 못했어요 (${last})`);
}
