"use client";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import TopBar from "@/components/TopBar";
import { repo } from "@/lib/repo";
import { useSession } from "@/lib/session";
import { WOLGYE_CENTER } from "@/lib/geo";
import type { GeoPoint, Post } from "@/types";

// Leaflet 은 브라우저 전용이라 서버 렌더링을 끈다.
const MapView = dynamic(() => import("@/components/MapView"), { ssr: false, loading: () => <div className="sub p-6 text-center text-sm">지도를 불러오는 중…</div> });

/** ② 위치 기반 MAP: 주변 공고와 상태(🔴🟡🟢), 내 위치에서의 거리·도보 시간 */
export default function MapPage() {
  const { user } = useSession();
  const [posts, setPosts] = useState<Post[]>([]);
  const [hideDone, setHideDone] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<GeoPoint | null>(null);
  const [locationMessage, setLocationMessage] = useState("");
  const [locating, setLocating] = useState(false);
  const [recenterRequest, setRecenterRequest] = useState(0);
  const [loadError, setLoadError] = useState("");
  const locationPending = useRef(false);
  useEffect(() => {
    repo.listPosts().then(setPosts).catch((error: Error) => setLoadError(error.message || "공고를 불러오지 못했어요."));
  }, []);

  const findCurrentLocation = useCallback(() => {
    if (locationPending.current) return;
    if (!navigator.geolocation) {
      setLocationMessage("이 브라우저는 현재 위치를 지원하지 않아요.");
      return;
    }
    setLocationMessage("현재 위치를 확인하는 중…");
    locationPending.current = true;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setCurrentLocation({ lat: coords.latitude, lng: coords.longitude });
        setRecenterRequest((value) => value + 1);
        locationPending.current = false;
        setLocating(false);
        setLocationMessage("현재 위치를 지도에 표시했어요.");
      },
      (error) => {
        locationPending.current = false;
        setLocating(false);
        setLocationMessage(error.code === 1
          ? "브라우저 설정에서 위치 권한을 허용해 주세요."
          : error.code === 3
            ? "위치 확인 시간이 초과됐어요. 다시 시도해 주세요."
            : "위치를 찾을 수 없어요. 기기의 위치 설정을 확인해 주세요.");
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  }, []);
  useEffect(() => { findCurrentLocation(); }, [findCurrentLocation]);

  const shown = hideDone ? posts.filter((p) => p.status !== "done") : posts;
  const mapLocation = currentLocation ?? user?.location;
  return (
    <>
      <TopBar title="주변 프로젝트" right={<label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={hideDone} onChange={(e) => setHideDone(e.target.checked)} />완료 숨김</label>} />
      <div className="sub flex gap-3 px-4 pb-2 text-xs"><span>🔴 모집 중</span><span>🟡 진행 중</span><span>🟢 해결 완료</span><span className="ml-auto">🔵 현재 위치</span></div>
      <p role="status" className="sub min-h-6 px-4 pb-2 text-xs">{locationMessage}</p>
      {loadError && <p role="alert" className="mx-4 mb-2 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{loadError}</p>}
      <div className="relative isolate h-[calc(100dvh-13rem)] min-h-[240px] overflow-hidden rounded-t-3xl">
        <MapView posts={shown} me={currentLocation ?? undefined} center={mapLocation ?? WOLGYE_CENTER} recenterRequest={recenterRequest} />
        <button
          type="button"
          onClick={findCurrentLocation}
          disabled={locating}
          aria-label={locating ? "현재 위치 확인 중" : "현재 위치로 이동"}
          aria-busy={locating}
          title="현재 위치로 이동"
          className="absolute bottom-8 right-4 z-[500] flex h-12 w-12 items-center justify-center rounded-full border border-slate-200 bg-white text-[var(--primary)] shadow-lg transition hover:bg-blue-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 active:scale-95 disabled:cursor-wait disabled:opacity-70"
        >
          {locating ? <span aria-hidden="true" className="h-5 w-5 animate-spin rounded-full border-2 border-blue-100 border-t-blue-600" /> : (
            <svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <circle cx="12" cy="12" r="7" /><circle cx="12" cy="12" r="2.5" fill="currentColor" stroke="none" />
              <path d="M12 2v3m0 14v3M2 12h3m14 0h3" />
            </svg>
          )}
        </button>
      </div>
    </>
  );
}
