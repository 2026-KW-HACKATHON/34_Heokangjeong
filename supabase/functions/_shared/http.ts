// Edge Function 공통: CORS, JSON 응답, 로그인 사용자 확인
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";

export const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};
export const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
export class HttpError extends Error { constructor(public status: number, message: string) { super(message); } }

const URL_ = Deno.env.get("SUPABASE_URL")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

/** 요청자의 JWT 로 만든 클라이언트 (RLS 적용) + 사용자 id */
export async function userClient(req: Request): Promise<{ db: SupabaseClient; userId: string }> {
  const auth = req.headers.get("Authorization") ?? "";
  if (!auth.startsWith("Bearer ")) throw new HttpError(401, "로그인이 필요해요");
  const db = createClient(URL_, ANON, { global: { headers: { Authorization: auth } }, auth: { persistSession: false } });
  const { data, error } = await db.auth.getUser(auth.slice(7));
  if (error || !data.user) throw new HttpError(401, "로그인이 필요해요");
  return { db, userId: data.user.id };
}
/** 서버 전용 (RLS 우회). Notion 토큰처럼 앱이 보면 안 되는 데이터에만 쓴다 */
export const serviceClient = () => createClient(URL_, SERVICE, { auth: { persistSession: false } });

/* eslint-disable @typescript-eslint/no-explicit-any */
// 타입 없는 클라이언트라 행은 any 로 받고 rows.ts 가 엔티티로 바꾼다
export function ok({ data, error }: { data: unknown; error: { message: string } | null }): any {
  if (error) throw new HttpError(400, error.message.replace(/^[A-Z_]+: /, ""));
  if (data === null) throw new HttpError(404, "데이터를 찾을 수 없어요");
  return data;
}
