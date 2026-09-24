// Gemini 호출 (서버 전용, 키는 secret GEMINI_API_KEY). 붐비거나 한도 초과면 다음 모델로 넘어간다.
const KEY = Deno.env.get("GEMINI_API_KEY");
const MODELS = (Deno.env.get("GEMINI_MODELS") ?? "gemini-3.8-flash,gemini-3.6-flash,gemini-3.5-flash,gemini-3.5-flash-lite").split(",").map((m) => m.trim()).filter(Boolean);

export class AiUnavailable extends Error {}

/** budgetMs 는 모델 여러 개를 시도하는 전체 시간 한도다 (모델마다가 아님) */
export async function geminiJson(system: string, user: string, schema: unknown, budgetMs = 45_000, opts: { preferLite?: boolean; thinking?: "minimal" | "low" | "medium" | "high" } = {}): Promise<{ data: unknown; model: string }> {
  if (!KEY) throw new AiUnavailable("서버에 GEMINI_API_KEY 가 설정되지 않았어요");
  const body = JSON.stringify({
    systemInstruction: { parts: [{ text: system }] },
    contents: [{ role: "user", parts: [{ text: user }] }],
    generationConfig: { responseMimeType: "application/json", responseSchema: schema, temperature: 0.4, ...(opts.thinking ? { thinkingConfig: { thinkingLevel: opts.thinking } } : {}) },
  });
  let last = "";
  const deadline = Date.now() + budgetMs;
  // 짧은 응답(후속 질문)은 가벼운 모델부터
  const order = opts.preferLite ? [...MODELS.filter((m) => m.includes("lite")), ...MODELS.filter((m) => !m.includes("lite"))] : MODELS;
  for (const model of order) {
    const started = Date.now();
    const left = deadline - Date.now();
    if (left < 1500) { last = last || "시간 초과"; break; }
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), left);
    try {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": KEY }, body, signal: ctl.signal,
      });
      if (!r.ok) {
        last = `${model} ${r.status}`;
        console.error("gemini", model, r.status, (await r.text()).slice(0, 300));
        if ([400, 404, 429, 500, 503].includes(r.status)) continue; // 400: 모델마다 지원 옵션(thinkingLevel)이 달라 다음 모델로
        break;
      }
      const d = await r.json();
      console.log("gemini ok", model, `${Date.now() - started}ms`);
      return { data: JSON.parse(d.candidates[0].content.parts[0].text), model };
    } catch (e) {
      last = `${model} ${(e as Error).name}`;
      console.error("gemini fail", model, `${Date.now() - started}ms`);
      console.error("gemini", model, (e as Error).message);
    } finally { clearTimeout(t); }
  }
  throw new AiUnavailable(`AI 응답을 받지 못했어요 (${last})`);
}
