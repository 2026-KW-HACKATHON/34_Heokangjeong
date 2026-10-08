"use client";
import { nicknameError } from "@/lib/nickname";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { User } from "@/types";
import { repo } from "./repo";
import { supabase } from "./supabase";

/**
 * 현재 사용자.
 * - Supabase 연결 시: 이메일·비밀번호 로그인 + profiles 테이블의 내 프로필
 * - 연결 전(mock): 로그인 없이 학생/주민 계정을 골라 화면을 본다
 */
export type ProfileInput = Omit<User, "id"> & Partial<Record<string, unknown>>;
interface Session {
  mode: "mock" | "supabase";
  loading: boolean;
  authId: string | null;         // 로그인한 계정 id (프로필이 아직 없을 수 있음)
  user: User | null;             // 내 프로필
  users: User[];
  setUserId: (id: string) => void; // mock 전용
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signInWithKakao: () => Promise<void>;
  signOut: () => Promise<void>;
  saveProfile: (p: ProfileInput) => Promise<void>;
  refreshUsers: () => Promise<void>;
}
const Ctx = createContext<Session>(null as unknown as Session);

/** 이 프로젝트에서 켜져 있는 소셜 로그인 확인 (한 번만 조회하고 기억한다) */
let providerCache: Record<string, boolean> | null = null;
async function providerEnabled(name: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.NEXT_PUBLIC_SUPABASE_KEY;
  if (!url || !key) return false;
  if (!providerCache) {
    try {
      const r = await fetch(`${url}/auth/v1/settings`, { headers: { apikey: key } });
      providerCache = (await r.json()).external ?? {};
    } catch { providerCache = {}; }
  }
  return !!providerCache?.[name];
}

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [users, setUsers] = useState<User[]>([]);
  const [id, setId] = useState<string | null>(supabase ? null : "s1");
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => { try { setUsers(await repo.listUsers()); } finally { setLoading(false); } }, []);

  useEffect(() => {
    if (!supabase) {
      try { const s = localStorage.getItem("wolgye-user"); if (s) setId(s); } catch {}
      refresh();
      return;
    }
    supabase.auth.getSession().then(({ data }) => { setId(data.session?.user.id ?? null); refresh(); });
    const { data } = supabase.auth.onAuthStateChange((_e, s) => { setId(s?.user.id ?? null); refresh(); });
    return () => data.subscription.unsubscribe();
  }, [refresh]);

  const value: Session = {
    mode: supabase ? "supabase" : "mock",
    loading,
    authId: id,
    user: users.find((u) => u.id === id) ?? null,
    users,
    refreshUsers: refresh,
    setUserId: (v) => { setId(v); try { localStorage.setItem("wolgye-user", v); } catch {} },
    async signIn(email, password) {
      const { error } = await supabase!.auth.signInWithPassword({ email, password });
      if (error) throw new Error(error.message === "Invalid login credentials" ? "이메일 또는 비밀번호가 맞지 않아요" : error.message);
    },
    async signUp(email, password) {
      const { data, error } = await supabase!.auth.signUp({ email, password });
      if (error) throw new Error(error.message);
      if (!data.session) throw new Error("가입 확인 메일을 보냈어요. 메일의 링크를 누른 뒤 로그인해 주세요.");
    },
    // 카카오 로그인. Supabase 대시보드에서 Kakao 공급자를 켜 두어야 쓸 수 있다 (docs/SUPABASE.md 참고)
    // 켜져 있는지 먼저 확인한다. 바로 이동시키면 Supabase 가 돌려주는 날것의 JSON 오류 화면이 보인다.
    async signInWithKakao() {
      if (!supabase) throw new Error("서버(Supabase)를 연결하면 쓸 수 있어요");
      if (!(await providerEnabled("kakao"))) throw new Error("카카오 로그인은 준비 중이에요. 이메일로 로그인해 주세요.");
      const { error } = await supabase.auth.signInWithOAuth({ provider: "kakao", options: { redirectTo: window.location.origin } });
      if (error) throw new Error(/provider/i.test(error.message) ? "카카오 로그인은 준비 중이에요. 이메일로 로그인해 주세요." : error.message);
    },
    async signOut() { await supabase?.auth.signOut(); },
    async saveProfile(p) {
      const base: Record<string, unknown> = {
        id, role: p.role, name: p.name, nickname: p.nickname ?? null, lat: p.location.lat, lng: p.location.lng,
        ...(p.role === "student"
          ? { department: p.department, skills: p.skills, interests: p.interests, available_hours: p.availableHours, max_distance_m: p.maxDistanceM }
          : { kind: p.kind, address: p.address }),
      };
      const details: Record<string, unknown> = p.role === "student" ? { school: p.school ?? null, college: p.college ?? null, age: p.age ?? null, phone: p.phone ?? null } : {};
      let { error } = await supabase!.from("profiles").upsert({ ...base, ...details });
      // 새 프로필 컬럼 배포 전에도 가입 자체는 막히지 않게 기존 스키마로 한 번 재시도한다.
      if (error && /school|age|phone|schema cache/i.test(error.message)) ({ error } = await supabase!.from("profiles").upsert(base));
      if (error) throw new Error(nicknameError(error.message));
      await refresh();
    },
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
export const useSession = () => useContext(Ctx);
/** 로그인 화면에서 카카오 버튼을 보여 줄지 판단 */
export const isKakaoEnabled = () => providerEnabled("kakao");
