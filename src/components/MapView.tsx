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
    html: `<div style="display:flex;flex-direction:column;align-items:center;transform:translate(-16px,-34px)">
      <span style="display:flex;width:32px;height:32px;align-items:center;justify-content:center;border-radius:50% 50% 50% 4px;transform:rotate(-45deg);background:${color};box-shadow:0 2px 6px rgba(0,0,0,.3)">
        <span style="transform:rotate(45deg);font-size:15px">${icon}</span>
      </span>
      <span style="margin-top:3px;max-width:110px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px;font-weight:800;color:${color};text-shadow:${HALO}">${name}</span>
    </div>`,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  });
}
const meIcon = L.divIcon({ className: "", html: '<div style="width:16px;height:16px;border-radius:50%;background:#3182f6;border:3px solid white;box-shadow:0 0 0 2px #3182f6"></div>', iconSize: [16, 16], iconAnchor: [8, 8] });

interface Poi { id: number; name: string; kind: string; icon: string; lat: number; lng: number }

/** 업종별 색. 카카오맵처럼 색으로 업종을 구분하고, 이름도 같은 색으로 적는다 */
// 채도를 낮춘 색. 가게가 많아도 지도가 어지럽지 않게, 공고 마커만 또렷하게 보이도록 한다
const SHOP_COLOR: Record<string, string> = {
  "식당": "#b5805c", "분식·패스트푸드": "#b5805c", "주점": "#b5805c", "바": "#b5805c",
  "카페": "#9c8574", "빵집": "#9c8574",
  "편의점": "#7d93ad", "마트": "#7d93ad", "정육점": "#7d93ad",
  "미용실": "#a383a0", "뷰티": "#a383a0",
  "서점": "#88a080", "옷가게": "#88a080", "꽃집": "#88a080",
};
const HALO = "0 1px 2px #fff,0 -1px 2px #fff,1px 0 2px #fff,-1px 0 2px #fff";

/** 업종 도형. 지도에서 흔히 쓰는 모양(수저·컵·가위 등)을 흰 선으로 그린다 */
const SHOP_GLYPH: Record<string, string> = {
  "식당": '<path d="M5 2v7m0 0v11M5 9a2 2 0 0 0 2-2V2M3 2v5a2 2 0 0 0 2 2m14-7c-2 1-3 3-3 6s1 4 3 4v9"/>',
  "분식·패스트푸드": '<path d="M3 12h18M4 12a8 8 0 0 1 16 0M5 16h14a2 2 0 0 1-2 3H7a2 2 0 0 1-2-3Z"/>',
  "주점": '<path d="M7 3h10l-1 7a4 4 0 0 1-8 0ZM12 14v6M9 21h6"/>',
  "바": '<path d="M7 3h10l-1 7a4 4 0 0 1-8 0ZM12 14v6M9 21h6"/>',
  "카페": '<path d="M4 5h13v7a5 5 0 0 1-10 0ZM17 7h2a2 2 0 0 1 0 5h-2M3 20h16"/>',
  "빵집": '<path d="M4 12c0-3 2-5 4-5s3 1 4 2 2-2 4-2 4 2 4 5-2 6-4 6H8c-2 0-4-3-4-6Z"/>',
  "편의점": '<path d="M4 7h16l-1 12H5ZM9 7V5a3 3 0 0 1 6 0v2"/>',
  "마트": '<path d="M3 4h2l2 11h11l2-7H6M9 20h.01M17 20h.01"/>',
  "정육점": '<path d="M6 10a6 6 0 1 1 12 0c0 4-3 6-3 9H9c0-3-3-5-3-9ZM12 10a2 2 0 0 0 0 4"/>',
  "미용실": '<path d="M6 4l12 12M18 4L6 16M7 19a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM17 19a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z"/>',
  "뷰티": '<path d="M9 3h6l1 6H8ZM8 9h8v10a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2Z"/>',
  "서점": '<path d="M4 4h7v16H4ZM13 4h7v16h-7M7 8h1M16 8h1"/>',
  "옷가게": '<path d="M9 3 5 6l2 3 2-1v12h6V8l2 1 2-3-4-3-2 2h-2Z"/>',
  "꽃집": '<path d="M12 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM12 10a3 3 0 1 1 6 0 3 3 0 0 1-6 0ZM12 10a3 3 0 1 0-6 0 3 3 0 0 0 6 0ZM12 13v8"/>',
};
const glyphSvg = (kind: string) =>
  `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${SHOP_GLYPH[kind] ?? '<circle cx="12" cy="12" r="5"/>'}</svg>`;

/** 동네 가게 마커: 작은 색 원 + 같은 색 이름. 흰 알약을 없애 지도가 덜 답답하다 */
function shopIcon(poi: Poi, withLabel: boolean) {
  const color = SHOP_COLOR[poi.kind] ?? "#6b7280";
  // 이름은 색을 빼고 회색으로. 색이 많으면 지도가 혼잡해 보인다
  const label = withLabel
    ? `<span style="margin-top:2px;max-width:76px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px;font-weight:600;color:#5b6472;text-shadow:${HALO}">${poi.name}</span>`
    : "";
  return L.divIcon({
    className: "",
    html: `<div style="display:flex;flex-direction:column;align-items:center;transform:translate(-11px,-11px)">
      <span style="display:flex;width:20px;height:20px;align-items:center;justify-content:center;border-radius:50%;background:${color};opacity:.88;box-shadow:0 1px 2px rgba(0,0,0,.18);line-height:0">${glyphSvg(poi.kind)}</span>
      ${label}
    </div>`,
    iconSize: [0, 0], iconAnchor: [0, 0],
  });
}

/** 가게 목록을 한 번만 불러온다 (앱에 포함된 파일이라 외부 서버에 기대지 않는다) */
function useShops(enabled: boolean) {
  const [shops, setShops] = useState<Poi[]>([]);
  useEffect(() => {
    if (!enabled || shops.length) return;
    fetch("/pois.json").then((r) => r.json()).then(setShops).catch(() => {});
  }, [enabled, shops.length]);
  return shops;
}

/** 지도를 많이 줄이면 가게 마커는 감춘다 (글자가 뭉쳐 보이지 않게) */
function useZoom() {
  const map = useMap();
  const [zoom, setZoom] = useState(map.getZoom());
  useEffect(() => {
    const onZoom = () => setZoom(map.getZoom());
    map.on("zoomend", onZoom);
    return () => { map.off("zoomend", onZoom); };
  }, [map]);
  return zoom;
}

function ShopLayer() {
  const zoom = useZoom();
  const shops = useShops(zoom >= 16);
  if (zoom < 16) return null;
  const withLabel = zoom >= 17;      // 많이 확대했을 때만 이름까지 (글자가 뭉치지 않게)
  return <>{shops.map((poi) => (
    <Marker key={poi.id} position={[poi.lat, poi.lng]} icon={shopIcon(poi, withLabel)} zIndexOffset={-500}>
      <Popup><div className="text-sm"><b>{poi.name}</b><div className="text-xs text-gray-500">{poi.kind}</div></div></Popup>
    </Marker>
  ))}</>;
}

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
        <ShopLayer />
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
