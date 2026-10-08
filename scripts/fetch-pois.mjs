// 월계1동 주변 가게(음식점·카페·미용실 등)를 OpenStreetMap 에서 받아 public/pois.json 으로 저장한다.
// 지도에 가게가 눈에 띄게 보이도록 쓰는 자료다. 발표 중 외부 서버에 기대지 않으려고 파일로 굳혀 둔다.
//   실행: node scripts/fetch-pois.mjs   (가게가 늘거나 범위를 넓힐 때만 다시 돌리면 된다)
import { writeFileSync } from "node:fs";

const BBOX = [37.615, 127.045, 37.635, 127.075];   // 월계1동 + 광운대 주변
const QUERY = `[out:json][timeout:60];
(
  node["amenity"~"^(restaurant|cafe|fast_food|bakery|bar|pub)$"](${BBOX.join(",")});
  node["shop"~"^(convenience|hairdresser|bakery|butcher|supermarket|florist|books|clothes|beauty|laundry|optician|stationery)$"](${BBOX.join(",")});
);
out body 600;`;

// 가게 종류 → 화면에 보여 줄 이름과 아이콘
const KIND = {
  restaurant: ["식당", "🍚"], fast_food: ["분식·패스트푸드", "🍔"], cafe: ["카페", "☕"],
  bakery: ["빵집", "🥐"], bar: ["바", "🍻"], pub: ["주점", "🍻"],
  convenience: ["편의점", "🏪"], supermarket: ["마트", "🛒"], butcher: ["정육점", "🥩"],
  hairdresser: ["미용실", "💇"], beauty: ["뷰티", "💅"], florist: ["꽃집", "💐"],
  books: ["서점", "📚"], clothes: ["옷가게", "👕"], laundry: ["세탁소", "🧺"],
  optician: ["안경점", "👓"], stationery: ["문구점", "✏️"],
};

const servers = ["https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter"];
let data;
for (const url of servers) {
  try {
    const r = await fetch(`${url}?data=${encodeURIComponent(QUERY)}`, { headers: { "User-Agent": "wolgye-talent" } });
    if (!r.ok) { console.error(`${url} → ${r.status}`); continue; }
    data = await r.json();
    break;
  } catch (e) { console.error(`${url} → ${e.message}`); }
}
if (!data) { console.error("가게 정보를 받지 못했어요. 잠시 후 다시 실행해 주세요."); process.exit(1); }

const pois = data.elements
  .filter((e) => e.tags?.name && (KIND[e.tags.amenity] || KIND[e.tags.shop]))
  .map((e) => {
    const [label, icon] = KIND[e.tags.amenity] ?? KIND[e.tags.shop];
    return { id: e.id, name: e.tags.name, kind: label, icon, lat: +e.lat.toFixed(6), lng: +e.lon.toFixed(6) };
  });

writeFileSync(new URL("../public/pois.json", import.meta.url), JSON.stringify(pois));
const counts = pois.reduce((a, p) => ({ ...a, [p.kind]: (a[p.kind] ?? 0) + 1 }), {});
console.log(`public/pois.json 저장: ${pois.length}곳`);
console.log(Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(", "));
