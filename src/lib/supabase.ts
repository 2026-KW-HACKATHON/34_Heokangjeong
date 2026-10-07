import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Supabase 대시보드 → Project Settings → API 의 Project URL 과 publishable(anon) 키.
// 이 키는 앱에 들어가도 되는 공개 키다(데이터 보호는 DB 의 RLS 가 한다). 비밀 키(service_role)는 절대 넣지 않는다.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_KEY;
const demoMode = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

export const supabase: SupabaseClient | null = !demoMode && url && key ? createClient(url, key) : null;
