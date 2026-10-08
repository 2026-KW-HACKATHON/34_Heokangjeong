"use client";
import { MapContainer, TileLayer, CircleMarker, Popup, Marker, useMap } from "react-leaflet";
import { useEffect, useState } from "react";
import L from "leaflet";
import Link from "next/link";
import type { GeoPoint, Post } from "@/types";
import { STATUS } from "./StatusBadge";
import { formatDistance, distanceM } from "@/lib/geo";

const COLOR: Record<Post["status"], string> = { open: "#f04452", in_progress: "#ffb331", done: "#2ac769" };
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
export default function MapView({ posts, me, center, recenterRequest = 0 }: { posts: Post[]; me?: GeoPoint; center: GeoPoint; recenterRequest?: number }) {
  const [tilesFailed, setTilesFailed] = useState(false);
  return (
    <div className="relative h-full w-full">
      <MapContainer center={[center.lat, center.lng]} zoom={15} className="h-full w-full" scrollWheelZoom>
        <Recenter center={center} request={recenterRequest} />
        {/* 한국 지명·골목이 가장 촘촘한 OpenStreetMap 기본 타일. 키가 필요 없다.
            (CARTO·Esri 는 각각 API 키 요구·한국 데이터 없음으로 쓸 수 없었다) */}
        <TileLayer
          attribution='&copy; OpenStreetMap'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={19}
          eventHandlers={{ tileerror: () => setTilesFailed(true), load: () => setTilesFailed(false) }}
        />
        {me && <Marker position={[me.lat, me.lng]} icon={meIcon}><Popup>🔵 현재 위치</Popup></Marker>}
        {posts.map((p) => (
          <CircleMarker key={p.id} center={[p.location.lat, p.location.lng]} radius={11} pathOptions={{ color: "white", weight: 2, fillColor: COLOR[p.status], fillOpacity: 0.95 }}>
            <Popup>
              <div className="min-w-[160px] text-sm">
                <div className="text-xs">{STATUS[p.status].dot} {STATUS[p.status].label} · {p.category}</div>
                <div className="mt-1 font-bold">{p.title}</div>
                {me && <div className="mt-1 text-xs text-gray-500">📍 {formatDistance(distanceM(me, p.location))}</div>}
                <Link href={`/posts/detail?id=${p.id}`} className="mt-2 block font-semibold text-[var(--primary)]">자세히 보기 ›</Link>
              </div>
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>
      {tilesFailed && <p role="status" className="absolute left-1/2 top-3 z-[600] w-[calc(100%-2rem)] -translate-x-1/2 rounded-xl bg-white/95 px-3 py-2 text-center text-xs shadow">지도 배경 연결이 원활하지 않아요. 공고 위치 표시는 계속 사용할 수 있어요.</p>}
    </div>
  );
}
