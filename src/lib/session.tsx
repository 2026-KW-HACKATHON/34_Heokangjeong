"use client";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { User } from "@/types";
import { repo } from "./repo";
import { supabase } from "./supabase";

/**
 * 현재 사용자.
 * - Supabase 연결 시: 이메일·비밀번호 로그인 + profiles 테이블의 내 프로필
 *   가입은 두 단계지만 계정은 마지막에 만든다: 이메일·비밀번호 입력(메모리에만 보관) → 프로필 입력 → "시작하기" 에서 계정 생성 + 프로필 저장.
 *   중간에 나가면 아무것도 만들어지지 않는다.
 * - 연결 전(mock): 로그인 없이 학생/주민 계정을 골라 화면을 본다
 */
export type ProfileInput = Omit<User, "id"> & Partial<Record<string, unknown>>;
interface Session {
  mode: "mock" | "supabase";
  loading: boolean;
  authId: string | null;         // 로그인한 계정 id (프로필이 아직 없을 수 있음)
  pendingEmail: string | null;   // 가입 진행 중(계정 생성 전)인 이메일
  user: User | null;             // 내 프로필
  users: User[];
  setUserId: (id: string) => void; // mock 전용
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;   // 계정은 아직 만들지 않고 가입 정보만 들고 있는다
  signOut: () => Promise<void>;
  saveProfile: (p: ProfileInput) => Promise<void>;
}
const Ctx = createContext<Session>(null as unknown as Session);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [users, setUsers] = useState<User[]>([]);
  const [id, setId] = useState<string | null>(supabase ? null : "s1");
  const [loading, setLoading] = useState(true);
  // 가입 진행 중인 이메일·비밀번호. 브라우저 메모리에만 둔다 (저장소에 쓰지 않음, 새로고침하면 사라짐)
  const [pending, setPending] = useState<{ email: string; password: string } | null>(null);

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
    pendingEmail: pending?.email ?? null,
    user: users.find((u) => u.id === id) ?? null,
    users,
    setUserId: (v) => { setId(v); try { localStorage.setItem("wolgye-user", v); } catch {} },
    async signIn(email, password) {
      const { error } = await supabase!.auth.signInWithPassword({ email, password });
      if (error) throw new Error(error.message === "Invalid login credentials" ? "이메일 또는 비밀번호가 맞지 않아요" : error.message);
    },
    async signUp(email, password) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("이메일 형식을 확인해 주세요");
      if (password.length < 6) throw new Error("비밀번호는 6자 이상이어야 해요");
      setPending({ email, password });
    },
    async signOut() { setPending(null); await supabase?.auth.signOut(); },
    async saveProfile(p) {
      let uid = id;
      if (!uid) {
        // 가입 마지막 단계: 여기서 계정을 만든다
        if (!pending) throw new Error("가입 정보가 없어요. 처음부터 다시 가입해 주세요");
        const { data, error } = await supabase!.auth.signUp(pending);
        if (error) {
          if (/already registered|already exists/i.test(error.message)) throw new Error("이미 가입된 이메일이에요. ‘다른 계정으로 로그인’을 눌러 로그인해 주세요");
          throw new Error(error.message);
        }
        if (!data.session || !data.user) throw new Error("가입 확인 메일을 보냈어요. 메일의 링크를 누른 뒤 로그인해 주세요.");
        uid = data.user.id;
      }
      const { error } = await supabase!.from("profiles").upsert({
        id: uid, role: p.role, name: p.name, lat: p.location.lat, lng: p.location.lng,
        ...(p.role === "student"
          ? { department: p.department, skills: p.skills, interests: p.interests, available_hours: p.availableHours, max_distance_m: p.maxDistanceM }
          : { kind: p.kind, address: p.address }),
      });
      if (error) throw new Error(error.message); // 계정은 만들어졌으면 로그인 상태라, 다시 "시작하기" 를 누르면 프로필만 저장한다
      setPending(null);
      setId(uid);
      await refresh();
    },
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
export const useSession = () => useContext(Ctx);
