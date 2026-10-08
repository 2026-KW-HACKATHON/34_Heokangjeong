"use client";
import { MapContainer, TileLayer, Popup, Marker, useMap } from "react-leaflet";
import { useEffect, useState } from "react";
import L from "leaflet";
import Link from "next/link";
import type { GeoPoint, Post } from "@/types";
import { STATUS } from "./StatusBadge";
import { formatDistance, distanceM } from "@/lib/geo";

const COLOR: Record<Post["status"], string> = { open: "#f04452", in_progress: "#ffb331", done: "#2ac769" };

/** 분야별 아이콘. 지도에서 "저 가게가 뭘 부탁했는지" 를 한눈에 알 수 있게 한다 */
const CATEGORY_ICON: Record<string, string> = {
  "디자인": "🎨", "영상": "🎬", "사진": "📷", "SNS홍보": "📣", "웹/앱": "💻", "디지털도움": "📱", "기타": "🙋",
};

/** 카카오맵처럼 아이콘과 이름이 함께 보이는 핀. 상태 색으로 테두리를 준다 */
function postIcon(post: Post, label: string) {
  const color = COLOR[post.status];
  const icon = CATEGORY_ICON[post.category] ?? "🙋";
  const name = label.length > 10 ? `${label.slice(0, 10)}…` : label;
  return L.divIcon({
    className: "",
    html: `<div style="display:flex;flex-direction:column;align-items:center;transform:translateY(-4px)">
      <div style="display:flex;align-items:center;gap:4px;max-width:150px;padding:4px 8px 4px 4px;border-radius:999px;background:#fff;border:2px solid ${color};box-shadow:0 2px 8px rgba(0,0,0,.18)">
        <span style="display:flex;width:22px;height:22px;align-items:center;justify-content:center;border-radius:50%;background:${color}1f;font-size:13px">${icon}</span>
        <span style="font-size:12px;font-weight:700;color:#191f28;white-space:nowrap">${name}</span>
      </div>
      <span style="width:2px;height:8px;background:${color}"></span>
      <span style="width:7px;height:7px;border-radius:50%;background:${color};box-shadow:0 0 0 2px #fff"></span>
    </div>`,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  });
}
const meIcon = L.divIcon({ className: "", html: '<div style="width:16px;height:16px;border-radius:50%;background:#3182f6;border:3px solid white;box-shadow:0 0 0 2px #3182f6"></div>', iconSize: [16, 16], iconAnchor: [8, 8] });

function Recenter({ center, request }: { center: GeoPoint; request: number }) {
  const map = useMap();
  useEffect(() => { map.setView([center.lat, center.lng], map.getZoom()); }, [center.lat, center.lng, request, map]);
  useEffect(() => {
    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(map.getContainer());
    return () => observer.disconnect();
  }, [map]);
  return null;
}

/** OpenStreetMap + Leaflet. API 키 없음. 카카오/네이버 지도로 바꾸려면 이 컴포넌트만 교체. */
export default function MapView({ posts, me, center, recenterRequest = 0, authorName }:
  { posts: Post[]; me?: GeoPoint; center: GeoPoint; recenterRequest?: number; authorName?: (id: string) => string | undefined }) {
  const [tilesFailed, setTilesFailed] = useState(false);
  return (
    <div className="relative h-full w-full">
      <MapContainer center={[center.lat, center.lng]} zoom={16} minZoom={13} className="h-full w-full" scrollWheelZoom
        maxBounds={[[37.58, 127.00], [37.70, 127.14]]} maxBoundsViscosity={0.8}>
        <Recenter center={center} request={recenterRequest} />
        {/* OpenStreetMap 기본 타일 (키 불필요, 한국 지명이 가장 촘촘하다). 색은 globals.css 에서 연하게 보정한다 */}
        <TileLayer
            attribution='&copy; OpenStreetMap'
            url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
            maxZoom={19}
          eventHandlers={{ tileerror: () => setTilesFailed(true), load: () => setTilesFailed(false) }}
        />
        {me && <Marker position={[me.lat, me.lng]} icon={meIcon}><Popup>🔵 현재 위치</Popup></Marker>}
        {posts.map((p) => (
          <Marker key={p.id} position={[p.location.lat, p.location.lng]} icon={postIcon(p, authorName?.(p.authorId) ?? p.title)} zIndexOffset={p.status === "open" ? 100 : 0}>
            <Popup>
              <div className="min-w-[170px] text-sm">
                <div className="text-xs">{STATUS[p.status].dot} {STATUS[p.status].label} · {CATEGORY_ICON[p.category] ?? ""} {p.category}</div>
                <div className="mt-1 font-bold">{p.title}</div>
                {authorName?.(p.authorId) && <div className="mt-0.5 text-xs text-gray-500">{authorName(p.authorId)}</div>}
                {me && <div className="mt-1 text-xs text-gray-500">📍 {formatDistance(distanceM(me, p.location))}</div>}
                <Link href={`/posts/detail?id=${p.id}`} className="mt-2 block font-semibold text-[var(--primary)]">자세히 보기 ›</Link>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
      {tilesFailed && <p role="status" className="absolute left-1/2 top-3 z-[600] w-[calc(100%-2rem)] -translate-x-1/2 rounded-xl bg-white/95 px-3 py-2 text-center text-xs shadow">지도 배경 연결이 원활하지 않아요. 공고 위치 표시는 계속 사용할 수 있어요.</p>}
    </div>
  );
}
