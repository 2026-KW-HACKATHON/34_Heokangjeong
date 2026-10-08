# 전시형 포트폴리오 — 스택 전환 프로토타입 (레퍼런스 충실 버전)

Codrops “Stack to Content Layout Transition”(2022, MIT)의 두 상태와 전환 사이클을 WOLINK 포트폴리오 자료(5단계)에 맞춰 HTML/CSS + GSAP Flip 으로 구현했다. 앱 코드는 건드리지 않았고 이 폴더만으로 실행된다.

## 실행

```powershell
cd C:\Users\USER\Documents\Codex\2026-10-08\c-users-wolgye-hackathon-hjw-main\wolgye_hackathon
node prototype/exhibition-template/serve.mjs
```

- 목록(상태 A): http://localhost:3005/prototype/exhibition-stack/
- 읽기(상태 B, 결과 단계): http://localhost:3005/prototype/exhibition-stack/#sample=menu&view=read&stage=result
- 샘플 B(이미지 1장·긴 글): http://localhost:3005/prototype/exhibition-stack/#sample=real2sim&view=list
- 모션 끄기: 주소 끝에 `&motion=off` (또는 OS 의 prefers-reduced-motion). 전체 내용(문서형)은 인쇄 미리보기에서 출력된다. 화면에는 도구 막대를 두지 않는다.

포트 3005가 이미 쓰이고 있으면 `netstat -ano | findstr :3005` 로 어떤 프로세스인지 확인한다(이 서버는 `serve.mjs`, 저장소 루트를 서빙). 외부 네트워크 요청 없음: GSAP 3.15 core + Flip 은 `vendor/`, 이미지는 `../../public/portfolio-samples` 상대 경로, 글꼴은 시스템 설치분.

## 두 상태

**A. 전체 단계 목록** — 검정 배경. 중앙 38vw 열에 8vh 높이의 띠 5개(간격 2vh), 밝기 42%. 띠는 각 단계의 대표 자료를 `object-fit: cover` + 자료별 `focus` 로 잘라 보여 주는 ‘입구’다(원본은 손대지 않는다). 왼쪽 위 작성자 이름(명조)과 분야, 오른쪽 아래 흰색 명조 대제목(전시용 짧은 제목, 8.6vw, 열 경계를 넘어 확장) + 기간·단계 수. hover/포커스에서 띠가 밝아지고 단계 번호·이름이 뜬다. 클릭·터치·Enter 로 진입, ↑↓ 로 띠 사이 이동.

**B. 선택 단계 읽기** — 열이 오른쪽 51vw 로 이동하고 폭 47vw 로 넓어진다. 현재 항목은 원본 비율 상자(높이 ≤50vh)에 밝게, 이전·다음은 위·아래에 38% 밝기로 일부 노출. 이웃 미리보기 가운데에 가늘고 긴 위/아래 화살표(100×267 비율), 미리보기 자체도 클릭 대상. 첫/마지막 단계에서 해당 화살표는 비활성(순환 없음). 왼쪽: 단계 번호/전체, 따뜻한 구리색(#c87e4f) 명조 제목, 굵은 보조 정보 한 줄, 320px 폭의 흰 본문(요약 + 두 문장), 결과 단계의 성과, 검증 단계의 확인 항목·평가 원문, ‘상세 읽기 →’(원문 전체)·‘원본 크게 보기’·‘이 단계의 자료 n개’. ‘← 전체 단계’는 왼쪽 영역 상단 오른쪽. Esc = 전체 단계, ↑↓ = 이전·다음.

## 전환 사이클 (stack.js)

| 전환 | 구현 |
|---|---|
| A → B | `Flip.getState(띠들)` → `data-view="read"`·현재 표시·상자 크기(원본 비율)·열 y(현재 항목을 세로 중앙에) 적용 → `Flip.from(duration 1, ease expo, absoluteOnLeave)`. 같은 타임라인에서 띠 밝기(42% → 100%/38%), 대제목 줄 마스크 `yPercent -101`(0.9s), 설명 줄 `101 → 0`(1s, 0.05 간격), Back 페이드, 화살표 `y ±150 → 0` |
| B 안에서 이전·다음 | 열 y 이동(1s expo) + 밝기 교체 + 글 줄 `∓101` 로 퇴장(0.2s power1) → 내용 교체 → `±101 → 0` 등장(0.9s expo). 방향에 따라 글이 위/아래로 흐른다 |
| B → A | `Flip.getState` → `data-view="list"`·상자 크기 제거·y 복원 → `Flip.from`; 대제목 `101 → 0`, 설명 `-101`, Back·화살표 페이드. 마지막으로 보던 띠에 포커스 복귀 |
| 빠른 연속 선택 | 모든 입력이 `killTl()` 로 진행 중 타임라인과 관련 트윈을 끊고 현재 위치에서 새 타임라인을 시작 → 누적·순간이동 없이 마지막 선택 상태에 도착(자동 점검 포함) |

레퍼런스와 같은 값: Flip 1초 expo, 글 퇴장 0.2s/등장 0.9s, 화살표 ±150, 띠 8vh·간격 2vh·열 38vw, 읽기 열 50vh 기준. 레퍼런스의 휠/터치로 닫기(Observer)는 쓰지 않았다(명시적 버튼·Esc 만).

## 우리 자료에 맞게 바꾼 것

- 사진 10장 → 단계 5개(개요·문제·판단과 과정·결과·검증과 회고), 한 프로젝트의 자료만.
- 읽기 상자는 `cover` 가 아니라 자료의 원본 비율(세로 메뉴판은 높이 50vh 에 맞춘 좁은 상자, 가로 화면은 폭 47vw). 늘이거나 찌그러뜨리지 않는다. 작은 글자는 ‘원본 크게 보기’로 확대.
- 이미지가 없는 단계(과정 기록·사용 증빙·문제 문장)는 같은 폭·리듬의 타이포그래피 띠(기록 종류 + 기록 원문 두 줄) → 읽기에서는 큰 명조 인용 상자. 없는 자료를 만들지 않는다.
- 같은 결과물 이미지가 개요와 결과에 쓰일 때 띠 초점만 다르게(개요 상단, 결과 중앙).
- 한국어 제목: 대제목은 전시용 짧은 제목(`displayTitle`, 샘플 데이터의 템플릿 전용 선택 필드)이고, 전체 제목·요약·원문은 개요 읽기의 보조 정보·상세 읽기·문서형 보기에 보존된다. 한 줄이 화면 폭 62% 를 넘으면 글자 크기를 줄이고(최소 5.5vw), 그래도 넘치면 줄 마스크를 유지한 채 두 줄로 나눈다.
- 글꼴: 제목 Noto Serif KR, 본문 Noto Sans KR (둘 다 SIL OFL 1.1; 이 PC 에 설치된 가변 글꼴 사용). 없으면 바탕/맑은 고딕으로 대체. 앱 통합 시 서브셋 내장 여부를 결정한다.
- 모바일(≤880px): 현재 자료 → 전체 단계 → 제목 → 설명 → 이전/다음 버튼 순서의 세로 구성. 목록은 전체 폭 띠(11vh).
- 인쇄: 문서형 보기(5단계 원문·자료·검증·평가)가 정적으로 출력된다.

## 파일

| 파일 | 역할 |
|---|---|
| `index.html` · `stack.css` · `stack.js` | 템플릿 (구조 · 변수와 규칙 · 모델/배치/전환) |
| `data/samples.js` | 콘텐츠 (앱 `PortfolioContent` + `PortfolioPage` 모양 + 템플릿 전용 선택 필드 `displayTitle`·`author`·`focus`) |
| `tools/shoot.mjs` | 1440×900 · 1920×1080 · 모바일 · reduced-motion · 인쇄 촬영과 31개 자동 점검 (`shots/`) |
| `tools/record.mjs` · `tools/compare.mjs` · `tools/sheet.mjs` · `tools/grab-video-frames.mjs` | 녹화 · 레퍼런스 나란히 비교 · 프레임 시트 · 레퍼런스 프레임 추출 |
| `ref/` | 레퍼런스 영상 사본, 추출 프레임(0.5초, 19장 모두 다름), 캡처 2장, Codrops MIT 원문 |
| `shots/` | `d1440-*`·`d1920-*`·`m-*` 정지 화면, `sheet-open/next/close.png`, `compare-*.png`, `transition.webm` |

## 검증

- `tools/shoot.mjs` 31/31: 목록 기하(열 38vw 중앙·띠 8vh·제목 오른쪽 아래, 화면 밖 없음), 읽기 상태(현재 항목 세로 중앙·100%·열 51vw·설명 줄 제자리·본문 ≤320px·대제목 숨김), 다음/이전·끝 단계 화살표 비활성, ↑↓ 키, 70ms 간격 4연타 후 정확한 도착, 복귀 후 목록·포커스 복원, Enter 진입, 상세 읽기 원문, 원본 보기 포커스, 샘플 B(타이포그래피 띠 2개), 모바일 가로 넘침 없음·현재만 표시, prefers-reduced-motion, 인쇄 문서, 콘솔 오류 없음 (1440×900 · 1920×1080).
- 시각 비교 `shots/compare-*.png`: 열 위치·폭·띠 높이·간격·제목 위치는 레퍼런스와 같은 비율. 차이: 띠 5개라 열이 짧다(레퍼런스는 화면을 넘침), 세로 자료는 열 전체 폭을 채우지 않는다(원본 비율 유지), 우리 자료가 덜 선명해 띠 밝기를 42% 로 올렸다.

## 남은 한계

- 레퍼런스 영상은 재생 캡처로 19 프레임 모두 다른 것을 확인했고 흐름(0–2 목록, 2–2.5 열 이동·확장, 2.5–4 읽기, 4–6.5 이전·다음, 8.5–9 복귀)을 대조했다. 레퍼런스의 세부 이징 값은 영상이 아니라 공개 소스에서 가져왔다.
- 단계당 자료가 여러 개인 경우 ‘이 단계의 자료 n개’ 로 상세 읽기에서 목록·원본 보기를 제공할 뿐, 열 안에서 추가 이미지를 넘기는 별도 화살표는 아직 없다.
- 띠가 화면보다 길어지는(단계 8개 이상) 경우의 목록 내부 스크롤은 미구현.
- headless Edge 촬영이라 프레임 간격이 고르지 않다. 실제 브라우저에서 더 매끄럽다.

## 출처·라이선스

- Codrops *Stack to Content Layout Transition* — https://github.com/codrops/ContentLayoutTransition (MIT, `ref/LICENSE-codrops.txt`). 구조·타이밍을 참고해 코드는 새로 작성.
- GSAP 3.15 core + Flip — GSAP Standard License(무료·상업 사용) https://gsap.com/standard-license
- Noto Serif KR · Noto Sans KR — SIL Open Font License 1.1 (시스템 설치분 사용, 파일 미포함)
- 이미지 — 저장소 `public/portfolio-samples` 데모 샘플

## 사진 샘플(디자인 테스트)과 제목 글꼴 비교 (2026-10-09 추가)

- 보존본: 사진·글꼴 추가 전 버전은 `prototype/exhibition-stack-v1-20261009/` 에 그대로 두었다.
- 사진 샘플 `#sample=photo`: Unsplash 사진 5장(서울 골목·저녁빛, 세로 2 + 가로 3, 긴 변 1800px). **시각 디자인 비교용**이며 실제 프로젝트 증빙이 아니다. 화면(작성자 아래 “디자인 테스트”, 캡션의 “Unsplash · 작가 · 디자인 테스트용”)과 데이터(`sampleNote`)에 명시. 출처·조건: `photos/SOURCES.md` (Unsplash License, Unsplash+ 제외). Codrops 데모 사진(600px)은 쓰지 않았다.
- 제목 글꼴 3종 (`&font=` 파라미터, 본문은 Noto Sans KR 고정): `serif` 명조 Noto Serif KR(현재, 시스템) · `brush` 송명 Song Myung(붓 흐름이 있는 정제된 명조, `fonts/SongMyung-Regular.ttf`, OFL 1.1) · `display` 검은고딕 Black Han Sans(개성 있는 디스플레이, `fonts/BlackHanSans-Regular.ttf`, OFL 1.1). 라이선스 원문은 `fonts/*-OFL.txt`. 글꼴별로 굵기·자간을 변수로 맞췄다(`--title-weight`, `--title-tracking`).
- 촬영: `node prototype/exhibition-stack/tools/fonts.mjs` → `shots/fonts/{serif,brush,display}-{list,read}.png`, 나란히 비교 `shots/compare-fonts-list.png`·`compare-fonts-read.png`. 스크립트가 `document.fonts` 상태(로컬 글꼴 loaded)와 폭 측정으로 실제 적용을 확인한다.
- 주소: `#sample=photo&view=list&font=brush` 처럼 조합한다.

## 시각 수정 v2 (2026-10-09) — 이미지 존재감 · 제목 편집 · 화면 밀도

수정 전 화면은 `shots/before/`, 전후 비교는 `shots/before-after-list.png`·`before-after-read.png`, 가로 사진 읽기는 `shots/p-1440-03-read-landscape.png` (1920 은 `p-1920-*`). 녹화: `shots/transition-photo.webm`(사진 샘플), `shots/transition.webm`(메뉴판).

| 항목 | 전 | 후 | 이유 |
|---|---|---|---|
| 목록 띠 높이 | 8vh 고정 | `(80vh − (n−1)·2vh) / n`, 최소 7vh → 5개면 14.4vh. 열이 화면 높이의 80% 를 쓴다 | 다섯 항목이 가운데 작은 묶음으로 보이지 않게. 항목이 많아 열이 92vh 를 넘으면 휠로 열을 움직인다 |
| 띠 밝기 | 전체 42% | 기본 55% + 자료별 `gain`(밝기 필터, 원본 불변: 사진 3·4·5 에 1.12/1.18/1.35) | 어두운 사진이 배경에 묻히지 않게. hover 85%, 현재 100% 대비 유지 |
| 읽기 현재 항목 | 모두 높이 50vh | 세로(비율<1): 높이 72vh · 가로/문서/글 상자: 폭 47vw, 최대 60vh | 세로 사진이 주인공으로 보이도록. 원본 비율 유지, 크롭 없음 |
| 이웃 노출 | ~23vh | 세로일 때 ~12vh, 가로일 때 ~18~23vh | 현재 항목에 시선 집중 |
| 화살표 | 고정 높이 계산 | 현재 항목 위·아래 남은 영역을 JS 가 계산해 top/height 배치 | 항목 높이가 달라도 미리보기 안에 들어간다 |
| 제목 글꼴 | 명조 | 송명 기본(`font=serif/display` 로 비교 가능). 대제목 9.8vw(최대 160px)·자간 −.012em·행간 .96, 단계 제목 5.2vw(최대 84px)·자간 −.01em·행간 1.08, 4자 이하 짧은 제목은 7.2vw | 송명은 획이 가늘고 폭이 좁아 명조 수치로는 작게 보인다 |
| 단계명 / 핵심 제목 | 단계명이 큰 제목 | 작은 표시 `04 / 05 — 결과` + 큰 핵심 제목(섹션의 선택 필드 `heading`, 본문 문장에서 뽑은 말. 없으면 섹션 제목을 짧은 제목 규칙으로) | 레퍼런스의 대형 제목·여백 긴장감 |
| 제목 줄 구성 | 둘째 줄 강제 들여쓰기 | `text-wrap: balance`, 최대 폭 11em, 들여쓰기 없음. 마스크 패딩 상하 .04/.14em | 1~2줄 의미 단위, 전환 후 글자 잘림 없음 |
| 메타·본문 | 굵은 한 줄(날짜·종류·캡션·출처) | 메타 두 줄(자료 종류·캡션 / 기간·출처 메모, 캡션의 " — " 뒤를 분리) 400 굵기, 제목↓30px, 메타↓18px, 본문 15px·행간 1.7·최대 340px | 역할 분리, 본문보다 두드러지지 않게. 출처·디자인 테스트 표시는 보존 |

검증: `tools/shoot.mjs` 31/31(메뉴판·활동 기록·모바일·reduced-motion·인쇄), `tools/photo-shots.mjs` 수치(1440: 열 80vh·띠 14.4vh, 세로 현재 72vh·이웃 12vh·화살표 영역 안, 가로 현재 50vh·폭 47vw; 1920 동일 규칙).
남은 한계: 가로 사진은 열 폭이 상한이라 1920 에서도 56vh 정도다(더 키우려면 열 폭 규칙 변경 필요). heading 은 사람이 적은 값이며, 앱에서는 AI 초안의 선택 필드로 두고 본문 문장에서만 뽑도록 검사해야 한다.

## 밝은 테마 (2026-10-09)

기본 배경을 흰색(#fff), 글을 짙은 차콜(#161411)로 바꿨다. 강조색은 밝은 배경용 구리색 #b4532c. 띠·이웃의 ‘어둡게’는 opacity 그대로이지만(흰 배경에서는 희게 눌림) 값은 띠 72%·hover 96%·이웃 50% 로 조정. 띠 바탕 #ebe8e2, 글 띠 #f3f1ec, 읽기 여백 #f4f2ee, 화살표 검정. 어두운 테마는 주소에 `&theme=dark` 로 비교할 수 있다(토큰만 바뀜).


## 가변 섹션과 연출 커버
본문 sections의 순서와 key를 보존한다. 메뉴 샘플은 본문 8개와 평가·검증 1개다. 평가/피드백 섹션이 이미 있으면 검증 정보를 그 섹션에 연결하고 중복 추가하지 않는다.
실제 연결 이미지 > 개요의 대표 결과물 > 연출 커버 순으로 선택한다. 연출 커버는 증빙 배열과 성과 검증에 포함하지 않는다.
현재 커버 폴백은 photos/SOURCES.md에 기록된 기존 Unsplash 공간 사진 세트다. 분야별 이미지 생성 서비스는 아직 연결하지 않았다. 프로젝트별 sectionCovers[sectionKey] = {url, caption, source, focus}로 준비된 커버를 지정할 수 있다. 커버 선택은 섹션 순서 기준으로 결정적이며 새로고침마다 바뀌지 않는다.
검증: node prototype/exhibition-stack/tools/check-model.mjs
이 변경은 독립 프로토타입에 적용되며 앱의 webHtml 내보내기에는 아직 연결되지 않는다.
