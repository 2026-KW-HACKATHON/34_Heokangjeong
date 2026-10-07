"use client";
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
  signOut: () => Promise<void>;
  saveProfile: (p: ProfileInput) => Promise<void>;
  refreshUsers: () => Promise<void>;
}
const Ctx = createContext<Session>(null as unknown as Session);

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
    async signOut() { await supabase?.auth.signOut(); },
    async saveProfile(p) {
      const base: Record<string, unknown> = {
        id, role: p.role, name: p.name, lat: p.location.lat, lng: p.location.lng,
        ...(p.role === "student"
          ? { department: p.department, skills: p.skills, interests: p.interests, available_hours: p.availableHours, max_distance_m: p.maxDistanceM }
          : { kind: p.kind, address: p.address }),
      };
      const details: Record<string, unknown> = p.role === "student" ? { school: p.school ?? null, age: p.age ?? null, phone: p.phone ?? null } : {};
      let { error } = await supabase!.from("profiles").upsert({ ...base, ...details });
      // 새 프로필 컬럼 배포 전에도 가입 자체는 막히지 않게 기존 스키마로 한 번 재시도한다.
      if (error && /school|age|phone|schema cache/i.test(error.message)) ({ error } = await supabase!.from("profiles").upsert(base));
      if (error) throw new Error(error.message);
      await refresh();
    },
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
export const useSession = () => useContext(Ctx);
