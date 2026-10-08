/* 전시형 포트폴리오 — 스택 전환 프로토타입 (HTML/CSS + GSAP Flip)
 * 레퍼런스(Codrops Stack to Content Layout Transition, MIT · src/js/slideshow.js)에서 따른 것:
 *  - 목록(중앙 좁은 띠 열) ↔ 읽기(오른쪽 넓은 열) 를 같은 DOM 띠로 연결: Flip.getState → 상태 바꿈 → Flip.from(duration 1, ease expo, absoluteOnLeave)
 *  - 열기: 선택 띠가 화면 세로 중앙에 오도록 열(y)을 맞춘다. 큰 제목은 yPercent -101 로 물러나고, 설명은 101 → 0 으로 올라온다. 화살표는 ±150px 에서 들어온다.
 *  - 이전·다음: 열을 위아래로 옮기고(1초 expo), 글은 0.2초에 나가고 0.9초에 들어온다 (줄 마스크 .oh > .oh__inner)
 *  - 닫기: 반대로. 레퍼런스의 Observer(휠·터치로 닫기)는 쓰지 않는다 — 명시적 버튼·Escape 만.
 * 우리 자료에 맞게 바꾼 것: 사진 항목 → 콘텐츠 섹션 순서를 보존하는 가변 단계, 읽기 상태에서 항목 상자를 자료의 원본 비율로(crop 없음),
 * 이미지 없는 단계는 같은 폭·리듬의 타이포그래피 띠, 한국어 제목(전시용 짧은 제목/전체 제목 구분), 빠른 연속 선택 시 타임라인 중단 후 현재 위치에서 재시작.
 * 콘텐츠(window.WOLINK_SAMPLES)는 읽기만 한다. 모든 글은 textContent 로 넣는다. */
"use strict";
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const hasGsap = !!(window.gsap && window.Flip);
  if (hasGsap) gsap.registerPlugin(Flip); else document.documentElement.classList.add("no-gsap");

  const CLAIM_LABEL = { workPerformed: "학생이 실제로 작업함", roleConfirmed: "기록된 역할이 맞음", deliverableReceived: "결과물을 전달받음", completionCriteriaMet: "완료 기준을 충족함", actuallyUsed: "실제로 사용되고 있음" };
  const EVIDENCE_LABEL = { BEFORE_IMAGE: "Before", AFTER_IMAGE: "After", DELIVERABLE_FILE: "결과물", DELIVERABLE_URL: "결과물 링크", PROCESS_IMAGE: "과정", DOCUMENT: "문서", VIDEO: "영상", TEST_RECORD: "테스트 기록", METRIC: "측정 자료", CLIENT_FEEDBACK: "의뢰인 피드백", USAGE_PROOF: "사용 증빙" };
  // 커버는 표현용 자산이며 증빙(items)에 포함하지 않는다.
  const COVER_PHOTOS = [
    "unsplash-eSMxl4dPnFs-hannam-alley.jpg",
    "unsplash-jQteagM9KEo-hannam-street.jpg",
    "unsplash-LsD49KuenuM-street-shops.jpg",
    "unsplash-N_vcns6YVO4-narrow-pathway.jpg",
    "unsplash-TMoq1a7OKVY-sunset-alley.jpg",
  ];
  function coverFor(sample, section, index) {
    const replacement = sample.content.imageOverrides?.[`stage-${section.key}`];
    const custom = replacement ? {...replacement, source: "학생이 교체한 표시 사진"} : sample.sectionCovers?.[section.key];
    const url = safeUrl(custom?.url || `./photos/${COVER_PHOTOS[index % COVER_PHOTOS.length]}`);
    return { id: `cover-${section.key}`, kind: "image", type: "EDITORIAL_COVER", label: "연출 커버 · 실제 증빙 아님", url,
      caption: custom?.caption || `${section.title} · 공간과 일상의 분위기 이미지`,
      source: custom?.source || "Unsplash · 사진 출처: photos/SOURCES.md", decorative: true,
      focus: custom?.focus || "50% 50%", gain: 1, ratio: 1.5 };
  }
  const reducedMq = matchMedia("(prefers-reduced-motion: reduce)");
  const mobileMq = matchMedia("(max-width: 880px)");
  const isMobile = () => mobileMq.matches;
  const EASE = "expo", DUR = 1;
  const veilOf = (el) => parseFloat(getComputedStyle(el, "::after").opacity) || 0; // 현재 베일 값 (::after 의 실제 opacity)
  const cssNum = (name) => parseFloat(getComputedStyle(document.documentElement).getPropertyValue(name)) || 0;

  const state = { sampleId: "menu", model: null, view: "list", current: -1, motion: true, tl: null, strips: [], detail: null, reader: false, docMode: false, lastFocus: null };
  window.addEventListener("message", (event) => {
    if (!window.WOLINK_EDITOR?.editing || event.source !== parent || event.data?.type !== "wolink-image-update" || !state.model) return;
    state.model.content.imageOverrides = event.data.images || {};
    state.model.stages.forEach((st, i) => {
      const image = event.data.images?.[`stage-${st.id}`];
      if (!image || !safeUrl(image.url)) return;
      st.asset = {...coverFor(state.model.sample, {key:st.id,title:st.title}, i), url:safeUrl(image.url),caption:image.caption};
      const img = state.strips[i]?.querySelector("img"); if (img) img.src = st.asset.url;
    });
    if(state.view === "read") layoutRead();
  });

  // ── 도우미 ──────────────────────────────────────────────────────────────
  function h(tag, attrs, ...children) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) { if (v == null || v === false) continue; if (k === "class") el.className = v; else if (k === "text") el.textContent = v; else if (k.startsWith("on")) el.addEventListener(k.slice(2), v); else el.setAttribute(k, v === true ? "" : v); }
    for (const c of children.flat(Infinity)) if (c != null && c !== false) el.append(c.nodeType ? c : document.createTextNode(String(c)));
    return el;
  }
  const safeUrl = (u) => (typeof u === "string" && /^(https?:\/\/|data:image\/(?:png|jpeg|webp);base64,|\.{1,2}\/|\/)/i.test(u) && !/^javascript:/i.test(u) ? u : "");
  const sentences = (t) => String(t || "").split(/(?<=[.!?。]|다\.|요\.)\s+/).map((s) => s.trim()).filter(Boolean);
  const first = (t) => sentences(t)[0] || "";
  const rest = (t) => sentences(t).slice(1).join(" ");
  const paragraphs = (t) => String(t).split(/\n+/).filter(Boolean).map((x) => h("p", { text: x }));
  const uniq = (l) => l.filter((a, i) => a && l.indexOf(a) === i);
  const motionOn = () => hasGsap && state.motion && !isMobile();
  const vh = () => innerHeight / 100, vw = () => innerWidth / 100;

  // ── 모델: 콘텐츠 → 가변 섹션 목록 (실제 자료 우선, 연출 커버 보완) ───────────────────────
  function buildModel(sample) {
    const { content, page, sectionRoles = {} } = sample;
    const items = (page.evidence || []).map((e) => { const url = safeUrl(e.url); const isImage = !!url && /^image\//.test(e.mimeType || ""); return { id: e.id, type: e.type, label: EVIDENCE_LABEL[e.type] || e.type, kind: isImage ? "image" : "note", url, caption: e.description || "", meaning: e.linkedClaim || "", client: e.source === "CLIENT", fileName: e.fileName || "", focus: e.focus || "50% 40%", gain: e.gain || 1, ratio: 1.5 }; });
    const byId = new Map(items.map((a) => [a.id, a]));
    const images = items.filter((a) => a.kind === "image");
    const sections = (content.sections || []).filter((s) => s.body && s.body.trim()).map((s) => ({ ...s, role: sectionRoles[s.key] || "context", items: (s.evidenceIds || []).map((id) => byId.get(id)).filter(Boolean) }));
    const deliverable = items.find((a) => a.kind === "image" && ["DELIVERABLE_FILE", "DELIVERABLE_URL", "AFTER_IMAGE"].includes(a.type)) || images[0];
    const stages = sections.map((section, index) => {
      const linked = section.items.find((a) => a.kind === "image");
      const replacement = content.imageOverrides?.[`stage-${section.key}`];
      const asset = (replacement ? {...coverFor(sample, section, index), url: safeUrl(replacement.url), caption: replacement.caption, source: "학생이 교체한 표시 사진"} : null) || (sample.sectionCovers?.[section.key]?.preferred ? coverFor(sample, section, index) : null) || linked || (section.key === "overview" ? deliverable : null) || coverFor(sample, section, index);
      return { id: section.key, no: String(index + 1).padStart(2, "0"), label: section.title,
        title: section.heading || section.title, sections: [section], asset,
        statement: first(section.body), body: rest(section.body), related: section.items,
        outcomes: section.role === "result" ? page.outcomes || [] : [] };
    });
    if (page.verification || page.review) {
      const existing = stages.find((st) => st.id === "feedback" || st.id === "evaluation");
      if (existing) Object.assign(existing, { verification: page.verification, review: page.review });
      else {
        const section = { key: "evaluation", title: "평가와 검증" };
        stages.push({ id: section.key, no: String(stages.length + 1).padStart(2, "0"), label: section.title,
          title: section.title, sections: [], related: [], asset: coverFor(sample, section, stages.length),
          statement: page.review?.comment || "의뢰인의 확인 내역", body: "",
          verification: page.verification, review: page.review });
      }
    }
    // 같은 이미지가 두 단계에 쓰이면 뒤 단계는 띠 미리보기 초점을 달리한다 (개요=상단, 결과=중앙). 원본은 그대로.
    return { sample, content, page, items, images, sections, stages };
  }

  // ── 띠 만들기 ─────────────────────────────────────────────────────────────
  function buildStrips(model) {
    const stack = $("#stack"); stack.replaceChildren(); state.strips = []; stack.style.setProperty("--n", String(model.stages.length));
    model.stages.forEach((st, i) => {
      let inner;
      if (st.asset && st.asset.kind === "image") {
        const img = h("img", { src: st.asset.url, alt: `${st.asset.decorative ? "연출 커버" : "대표 자료"}: ${st.asset.caption}`, decoding: "async", draggable: "false" });
        img.style.setProperty("--focus", i === 0 && st.asset === model.stages.find((s) => s.id === "result")?.asset ? "50% 18%" : st.asset.focus);
        img.style.setProperty("--gain", String(st.asset.gain));
        img.addEventListener("load", () => { if (img.naturalWidth) { st.asset.ratio = img.naturalWidth / img.naturalHeight; if (state.view === "read" && !state.tl) layoutRead(); } });
        inner = img;
      } else {
        const text = st.asset ? st.asset.caption : st.statement;
        inner = h("div", { class: "strip-type" }, h("span", { class: "k", text: st.asset ? st.asset.label : st.label }), h("span", { class: "t", text }));
      }
      const el = h("button", { type: "button", class: "strip", role: "listitem", "data-index": i, "aria-label": `${st.no} ${st.label}: ${st.title}`, onclick: () => (state.view === "list" ? open(i) : i !== state.current && navigateTo(i)) }, inner, h("span", { class: "strip-label" }, h("b", { text: st.no }), st.label));
      stack.append(el); state.strips.push(el);
    });
  }

  // ── 읽기 상태 배치: 항목 상자는 자료의 원본 비율, 열은 현재 항목이 세로 중앙 ──
  function readSizes() {
    const css = getComputedStyle(document.documentElement);
    const W = vw() * parseFloat(css.getPropertyValue("--slides-w")) || innerWidth * .47;
    const HP = vh() * (parseFloat(css.getPropertyValue("--slide-h-portrait")) || 72), HL = vh() * (parseFloat(css.getPropertyValue("--slide-h-landscape")) || 60);
    return state.model.stages.map((st) => {
      const r = st.asset && st.asset.kind === "image" ? st.asset.ratio || 1.5 : 1.45;
      if (r < 1) { let hh = HP, w = hh * r; if (w > W) { w = W; hh = w / r; } return { w, h: hh }; } // 세로: 높이 기준, 원본 비율
      let w = W, hh = w / r; if (hh > HL) { hh = HL; w = hh * r; } return { w, h: hh };            // 가로·문서·글 상자: 열 폭 기준
    });
  }
  function layoutRead({ animateY = false } = {}) {
    const sizes = readSizes(); const gap = vh() * 2;
    state.strips.forEach((el, i) => { el.style.width = `${sizes[i].w}px`; el.style.height = `${sizes[i].h}px`; });
    // 현재 항목의 중심을 화면 세로 중앙에
    let top = 0; for (let i = 0; i < state.current; i++) top += sizes[i].h + gap;
    const y = innerHeight / 2 - (top + sizes[state.current].h / 2);
    placeArrows(sizes[state.current].h, gap);
    if (animateY && motionOn()) return gsap.to($("#stack"), { x: 0, y, duration: DUR, ease: EASE });
    gsap.set($("#stack"), { x: 0, y }); return null;
  }
  /** 화살표를 현재 항목 위·아래에 남은 미리보기 영역 안에 맞춘다 (고정 높이 없음) */
  function placeArrows(curH, gap) {
    const top = innerHeight / 2 - curH / 2, bottom = innerHeight / 2 + curH / 2;
    const room = Math.max(0, top - gap); const pad = Math.min(vh() * 1.5, room * .15); const hh = Math.max(36, room - pad * 2);
    const prev = $("#arrow-prev"), next = $("#arrow-next");
    prev.style.top = `${pad}px`; prev.style.height = `${hh}px`;
    next.style.top = `${bottom + gap + pad}px`; next.style.height = `${hh}px`;
  }
  function layoutList() { state.strips.forEach((el) => { el.style.width = ""; el.style.height = ""; }); const st = $("#stack"); if (isMobile()) { gsap?.set(st, { clearProps: "transform" }); return; } const hh = st.offsetHeight; const limit = innerHeight * .92; state.listScroll = hh > limit ? { min: innerHeight - hh - vh() * 4, max: vh() * 4, y: Math.max(innerHeight - hh - vh() * 4, Math.min(vh() * 4, state.listScroll?.y ?? vh() * 4)) } : null; gsap.set(st, { x: 0, y: state.listScroll ? state.listScroll.y : Math.max(0, (innerHeight - hh) / 2) }); }
  function scrollListBy(dy) { if (!state.listScroll || state.view !== "list") return; const s = state.listScroll; s.y = Math.max(s.min, Math.min(s.max, s.y - dy)); gsap.to($("#stack"), { y: s.y, duration: .5, ease: "power3" }); }

  // ── 글 ──────────────────────────────────────────────────────────────────
  function splitLines(el, text, cls = "oh") {
    el.replaceChildren();
    const words = text.split(/\s+/);
    const probe = h("span", {}, words.map((w, i) => h("span", { text: w + (i < words.length - 1 ? " " : "") })));
    el.append(probe);
    const lines = []; let top = null, cur = [];
    for (const s of probe.children) { const t = s.offsetTop; if (top === null || Math.abs(t - top) < 4) { cur.push(s.textContent); top = top ?? t; } else { lines.push(cur); cur = [s.textContent]; top = t; } }
    if (cur.length) lines.push(cur);
    el.replaceChildren(...lines.map((ws) => h("span", { class: cls }, h("span", { class: "oh__inner", text: ws.join("").trim() }))));
    return $$(".oh__inner", el);
  }
  function fillTitle() {
    const { content, page } = state.model;
    const main = $("#title-main"); main.textContent = state.model.sample.displayTitle || content.displayTitle || content.title;
    // 전시용 제목이 길면 한 줄이 화면을 넘지 않도록 두 줄로 (너비 측정)
    // 제목은 한 줄이 화면 폭의 62% 를 넘지 않게 줄인다(최소 5.5vw). 그래도 넘치면 두 줄로 나눈다.
    main.style.fontSize = ""; main.style.whiteSpace = "nowrap"; main.style.maxWidth = "";
    const limit = innerWidth * .62; const base = parseFloat(getComputedStyle(main).fontSize);
    if (main.scrollWidth > limit) { const fs = Math.max(vw() * 5.5, base * limit / main.scrollWidth); main.style.fontSize = `${fs}px`; }
    if (main.scrollWidth > limit + 2) { main.style.whiteSpace = "normal"; main.style.maxWidth = `${limit}px`; splitLines(main, main.textContent); }
    else main.replaceChildren(h("span", { class: "oh" }, h("span", { class: "oh__inner", text: main.textContent })));
    $("#title-sub").textContent = `${page.info.period} · ${state.model.stages.length}단계`;
    $("#author-name").textContent = content.author?.name || state.model.sample.author?.name || page.studentName || "";
    $("#author-field").textContent = state.model.sample.author?.field || state.model.sample.domainLabel || "";
  }
  function fillContent(i) {
    const st = state.model.stages[i]; const { page } = state.model;
    $("#c-no").textContent = `${st.no} / ${String(state.model.stages.length).padStart(2, "0")} — ${st.label}`;
    const titleEl = $("#c-title"); titleEl.classList.toggle("is-short", st.title.replace(/\s/g, "").length <= 4); splitLines(titleEl, st.title);
    // 메타: 역할별 두 줄 (주: 자료 종류·캡션 / 부: 기간·출처 메모). 캡션의 " — " 뒤는 출처·테스트 메모로 분리
    const [capMain, capNote] = st.asset ? String(st.asset.caption).split(/\s+—\s+/) : ["", ""];
    const main = st.id === "overview" ? state.model.content.title : st.asset ? `${st.asset.label} · ${capMain}` : "자료 없음 · 기록 문장";
    const sub = [page.info.period, capNote].filter(Boolean).join("  ·  ");
    $("#c-meta").replaceChildren(h("span", { class: "meta-main", text: main }), sub && h("span", { class: "meta-sub", text: sub }));
    const text = $("#c-text"); text.replaceChildren(...paragraphs(st.statement), ...(st.body ? [h("p", { text: sentences(st.body).slice(0, 2).join(" ") })] : []));
    if (st.outcomes?.length) text.append(outcomeList(st.outcomes));
    if (st.verification || st.review) { text.append(claimsBlock(st.verification)); const q = reviewQuote(st.review); if (q) text.append(q); }
    const actions = $("#c-actions"); actions.replaceChildren(h("button", { type: "button", class: "link-btn", onclick: () => openReader(i), text: "상세 읽기 →" }));
    if (window.WOLINK_EDITOR?.editing) {
      const send = (data) => parent.postMessage({type: "wolink-stage-edit", key: st.id, ...data}, "*");
      if (st.sections.length) {
        const input = document.createElement("textarea"); input.value = st.sections[0].body; input.rows = 7; input.setAttribute("aria-label", "이 단계 본문 편집");
        input.style.cssText = "width:100%;padding:12px;border:1px solid #bbb;border-radius:8px;font:inherit;line-height:1.7;resize:vertical";
        input.oninput = () => {st.sections[0].body = input.value; send({body:input.value});};
        $("#c-text").replaceChildren(input);
        titleEl.contentEditable = "true"; titleEl.setAttribute("aria-label", "이 단계 제목 편집");
        titleEl.oninput = () => {const title = titleEl.textContent; st.title = title; st.sections[0].title = title; send({title});};
      } else {
        titleEl.contentEditable = "false"; titleEl.oninput = null;
      }
      const label = document.createElement("label"); label.textContent = "이 단계 사진 교체"; label.style.cssText = "display:block;padding:12px;border:1px solid #aaa;border-radius:8px;cursor:pointer";
      const file = document.createElement("input"); file.type = "file"; file.accept = "image/jpeg,image/png,image/webp"; file.setAttribute("aria-label", "이 단계 사진 교체");
      file.onchange = () => {if(file.files[0]) send({file:file.files[0]});}; label.append(file); actions.prepend(label);
    }
    if (st.asset && st.asset.kind === "image") actions.append(h("button", { type: "button", class: "link-btn", onclick: () => openDetail(st.asset.id), text: st.asset.decorative ? "커버 크게 보기" : "원본 크게 보기" }));
    if (st.related.length > 1 || (st.related.length === 1 && st.related[0] !== st.asset)) actions.append(h("button", { type: "button", class: "link-btn", onclick: () => openReader(i), text: `이 단계의 자료 ${st.related.length}개` }));
  }
  function outcomeList(outcomes) { return h("ul", { class: "outcomes" }, outcomes.slice(0, 3).map((o) => o.measured ? h("li", { class: "outcome" }, h("span", { class: "name", text: o.metricName }), h("div", { class: "value" }, o.baseline != null && h("span", { class: "from", text: `${o.baseline}${o.unit} →` }), `${o.value}`, h("small", { text: o.unit })), h("span", { class: `flag ${o.verified ? "ok" : ""}`, text: o.verified ? "의뢰인 확인" : "수치 미확인" })) : h("li", { class: "outcome unmeasured" }, h("span", { class: "name", text: o.metricName }), h("div", { class: "value", text: o.qualitativeDescription || "측정하지 않음" }), h("span", { class: "flag", text: "미측정 · 정성 기록" })))); }
  function claimsBlock(v) { if (!v) return h("p", { class: "notice", text: "의뢰인 검증 전입니다. 확인된 항목이 없어 검증으로 표시하지 않습니다." }); return h("ul", { class: "claims" }, Object.keys(CLAIM_LABEL).map((k) => h("li", { class: v[k] ? "yes" : "no" }, h("span", { class: "mark", text: v[k] ? "✓" : "–" }), CLAIM_LABEL[k]))); }
  function reviewQuote(r) { if (!r?.comment) return null; return h("figure", { class: "quote" }, h("blockquote", { text: `“${r.comment}”` }), h("figcaption", { text: `의뢰인 평가 원문 · 만족도 ${r.satisfaction}/5 · 기한 ${r.deadline}/5 · 소통 ${r.communication}/5 · 인계 ${r.handoff}/5` })); }

  // ── 상태 A → B: 열기 ───────────────────────────────────────────────────
  function killTl() { if (state.tl) { state.tl.kill(); state.tl = null; } if (hasGsap) gsap.killTweensOf([$("#stack"), ...state.strips, ...$$("#content .oh__inner"), ...$$("#title .oh__inner"), $("#btn-back"), $("#arrow-prev"), $("#arrow-next")]); }
  function setCurrent(i) { state.current = i; state.strips.forEach((el, j) => { el.classList.toggle("is-current", j === i); el.setAttribute("aria-current", j === i ? "true" : "false"); }); $("#arrow-prev").disabled = i <= 0; $("#arrow-next").disabled = i >= state.strips.length - 1; }
  function open(i, { push = true } = {}) {
    if (state.view === "read" && state.current === i) return;
    if (state.view === "read") return navigateTo(i, { push });
    state.lastFocus = state.strips[i];
    killTl(); closeReader();
    const flip = motionOn() ? Flip.getState(state.strips) : null;
    const veilFrom = state.strips.map(veilOf);
    state.view = "read"; document.body.dataset.view = "read"; setCurrent(i); if (push) pushUrl();
    const content = $("#content"), nav = $("#slide-nav"); content.hidden = false; nav.hidden = false;
    fillContent(i);
    if (isMobile() || !motionOn()) { layoutRead(); layoutMobileRead(); gsap?.set([...$$("#content .oh__inner")], { yPercent: 0 }); gsap?.set([$("#btn-back"), $("#arrow-prev"), $("#arrow-next")], { opacity: 1, y: 0 }); $("#title").style.visibility = "hidden"; $("#btn-back").focus(); return; }
    layoutRead();
    const tl = gsap.timeline({ onComplete: () => { state.tl = null; $("#btn-back").focus({ preventScroll: true }); } });
    tl.add(Flip.from(flip, { duration: DUR, ease: EASE, absoluteOnLeave: true, nested: true }), 0);
    tl.fromTo(state.strips, { "--veil": (j) => veilFrom[j] }, { "--veil": (j) => (j === i ? 0 : 1 - cssNum("--neighbor-dim")), duration: DUR, ease: EASE, clearProps: "--veil" }, 0);
    tl.to($$("#title .oh__inner"), { yPercent: -101, duration: .9, ease: EASE, stagger: .04, onComplete: () => { $("#title").style.visibility = "hidden"; } }, 0);
    tl.fromTo($$("#content .oh__inner"), { yPercent: 101 }, { yPercent: 0, duration: DUR, ease: EASE, stagger: .05 }, 0);
    tl.fromTo($("#btn-back"), { opacity: 0 }, { opacity: 1, duration: DUR }, 0);
    tl.fromTo($("#arrow-prev"), { opacity: 0, y: -150 }, { opacity: i > 0 ? 1 : 0, y: 0, duration: DUR, ease: EASE }, 0);
    tl.fromTo($("#arrow-next"), { opacity: 0, y: 150 }, { opacity: i < state.strips.length - 1 ? 1 : 0, y: 0, duration: DUR, ease: EASE }, 0);
    state.tl = tl;
  }

  // ── 상태 B 안에서 이전·다음 ─────────────────────────────────────────────
  function navigateTo(i, { push = true } = {}) {
    if (i < 0 || i >= state.strips.length || i === state.current) return;
    const dir = i > state.current ? 1 : -1;
    killTl(); closeReader();
    setCurrent(i); if (push) pushUrl();
    const inner = $$("#content .oh__inner");
    if (isMobile() || !motionOn()) { fillContent(i); layoutRead(); layoutMobileRead(); gsap?.set($$("#content .oh__inner"), { yPercent: 0 }); return; }
    const tl = gsap.timeline({ onComplete: () => { state.tl = null; } });
    tl.add(layoutRead({ animateY: true }), 0);
    tl.to(state.strips, { "--veil": (j) => (j === i ? 0 : 1 - cssNum("--neighbor-dim")), duration: DUR, ease: EASE, clearProps: "--veil" }, 0);
    tl.to(inner, { yPercent: -101 * dir, duration: .2, ease: "power1", onComplete: () => fillContent(i) }, 0);
    tl.add(() => { gsap.set($$("#content .oh__inner"), { yPercent: 101 * dir }); }, .2);
    tl.add(() => gsap.to($$("#content .oh__inner"), { yPercent: 0, duration: .9, ease: EASE, stagger: .04 }), .22);
    tl.to($("#arrow-prev"), { opacity: i > 0 ? 1 : 0, duration: .4 }, 0);
    tl.to($("#arrow-next"), { opacity: i < state.strips.length - 1 ? 1 : 0, duration: .4 }, 0);
    state.tl = tl;
  }

  // ── 상태 B → A: 닫기 ───────────────────────────────────────────────────
  function close({ push = true } = {}) {
    if (state.view !== "read") return;
    killTl(); closeReader();
    const was = state.current;
    const flip = motionOn() ? Flip.getState(state.strips) : null;
    const veilFrom = state.strips.map(veilOf);
    state.view = "list"; document.body.dataset.view = "list"; if (push) pushUrl();
    state.strips.forEach((el) => { el.classList.remove("is-current"); el.setAttribute("aria-current", "false"); });
    layoutList();
    const content = $("#content"), nav = $("#slide-nav"), title = $("#title");
    title.style.visibility = "";
    const done = () => { state.tl = null; content.hidden = true; nav.hidden = true; state.current = -1; (state.strips[was] || state.strips[0])?.focus({ preventScroll: true }); };
    if (!flip) { gsap?.set($$("#title .oh__inner"), { yPercent: 0 }); done(); return; }
    const tl = gsap.timeline({ onComplete: done });
    tl.add(Flip.from(flip, { duration: DUR, ease: EASE, absoluteOnLeave: true, nested: true }), 0);
    tl.fromTo(state.strips, { "--veil": (j) => veilFrom[j] }, { "--veil": (j) => (state.strips[j].querySelector(".strip-type") ? .3 : 1 - cssNum("--strip-dim")), duration: DUR, ease: EASE, clearProps: "--veil" }, 0);
    tl.fromTo($$("#title .oh__inner"), { yPercent: 101 }, { yPercent: 0, duration: DUR, ease: EASE, stagger: .04 }, 0);
    tl.to($$("#content .oh__inner"), { yPercent: -101, duration: .6, ease: EASE, stagger: .03 }, 0);
    tl.to([$("#btn-back"), $("#arrow-prev"), $("#arrow-next")], { opacity: 0, duration: .5 }, 0);
    state.tl = tl;
  }
  function layoutMobileRead() { if (!isMobile()) return; state.strips.forEach((el) => { el.style.width = ""; el.style.height = ""; }); gsap?.set($("#stack"), { clearProps: "transform" }); }

  // ── 상세 읽기 · 원본 상세 · 문서형 ───────────────────────────────────────
  function openReader(i) {
    const st = state.model.stages[i]; const { model } = state; const body = $("#reader-body"); const nodes = [];
    if (st.id === "overview") nodes.push(h("h2", { text: "전체 제목" }), h("div", { class: "body" }, h("p", { text: model.content.title })), h("h2", { text: "요약" }), h("div", { class: "body" }, paragraphs(model.content.summary)));
    for (const s of st.sections) nodes.push(h("h2", { text: s.title }), h("div", { class: "body" }, paragraphs(s.body)));
    if (st.id === "overview") nodes.push(h("h2", { text: "역할 · 의뢰인 · 도구" }), h("dl", { class: "facts" }, [["역할", model.page.info.roleLabel], ["의뢰인", `${model.page.info.clientName} (${model.page.info.clientType})`], ["기간", model.page.info.period]].map(([k, v]) => [h("dt", { text: k }), h("dd", { text: v })])), h("div", { class: "chips" }, model.content.tools.map((t) => h("span", { class: "chip" }, h("b", { text: t.name }), t.why ? ` · ${t.why}` : "")), model.content.skills.map((s) => h("span", { class: "chip", text: s }))));
    if (st.outcomes?.length) nodes.push(h("h2", { text: "실제 성과" }), outcomeList(st.outcomes));
    if (st.verification || st.review) nodes.push(h("h2", { text: "의뢰인 검증" }), claimsBlock(st.verification), reviewQuote(st.review));
    if (st.related.length) nodes.push(h("h2", { text: "이 단계의 자료" }), h("div", { class: "records" }, st.related.map((a) => h("div", { class: "record" }, h("span", { class: "kind", text: a.label }), h("span", {}, a.kind === "image" ? h("button", { type: "button", class: "link-btn", onclick: () => openDetail(a.id), text: a.caption }) : a.caption), a.client && h("span", { class: "client", text: "의뢰인 제공" })))));
    body.replaceChildren(...nodes.filter(Boolean));
    $("#reader-eyebrow").textContent = `${st.no} — ${st.label} · 상세 읽기`;
    const r = $("#reader"); r.hidden = false; state.reader = true;
    if (motionOn()) gsap.fromTo(r, { x: 40, opacity: 0 }, { x: 0, opacity: 1, duration: .4, ease: "power3.out" });
    $("#reader-close").focus();
  }
  function closeReader() { const r = $("#reader"); if (r.hidden) return; r.hidden = true; state.reader = false; }
  function openDetail(id) {
    const list = [...state.model.items, ...state.model.stages.map((st) => st.asset).filter((a) => a?.decorative)].filter((a) => a.kind === "image" || a.kind === "note"); const idx = list.findIndex((a) => a.id === id); if (idx < 0) return;
    state.detail = { list, idx, opener: document.activeElement }; $("#detail").hidden = false; showDetail(); $("#detail-close").focus();
  }
  function showDetail() {
    const { list, idx } = state.detail; const a = list[idx];
    const node = a.kind === "image" ? h("img", { src: a.url, alt: a.caption }) : h("div", { class: "note-detail", text: a.caption });
    $("#detail-media").replaceChildren(node);
    $("#detail-kind").textContent = a.label + (a.client ? " · 의뢰인 제공" : ""); $("#detail-title").textContent = a.caption; $("#detail-meaning").textContent = a.meaning ? `↳ 뒷받침: ${a.meaning}` : "";
    $("#detail-source").textContent = a.decorative ? `${a.source} · 연출 이미지이며 작업·성과의 증거가 아닙니다` : a.kind === "image" ? `원본 파일 ${a.fileName} · 원본 비율 그대로` : "기록 원문";
    $("#detail-count").textContent = `${idx + 1} / ${list.length}`; $("#detail-prev").disabled = idx === 0; $("#detail-next").disabled = idx === list.length - 1;
    if (motionOn()) gsap.fromTo(node, { opacity: 0, scale: .96 }, { opacity: 1, scale: 1, duration: .5, ease: "power3.out" });
  }
  function closeDetail() { if (!state.detail) return; const { opener } = state.detail; $("#detail").hidden = true; state.detail = null; opener?.focus?.({ preventScroll: true }); }
  function stepDetail(d) { const s = state.detail; if (!s) return; const n = s.idx + d; if (n < 0 || n >= s.list.length) return; s.idx = n; showDetail(); }
  function renderDocument(model) {
    const { content, page, sample, sections } = model; const doc = $("#document");
    const figs = (items) => items.length ? h("div", { class: "doc-figs" }, items.map((a) => a.kind === "image" ? h("figure", {}, h("img", { src: a.url, alt: a.caption, loading: "lazy" }), h("figcaption", { text: `${a.label} · ${a.caption}` })) : h("div", { class: "record" }, h("span", { class: "kind", text: a.label }), h("span", { text: a.caption })))) : null;
    const sec = (no, title, ...body) => h("section", { class: "doc-section" }, h("h2", {}, h("span", { text: no }), title), h("div", {}, body));
    doc.replaceChildren(...[
      h("header", { class: "doc-head" }, h("p", { class: "eyebrow", text: `${sample.domainLabel} · ${page.info.period}${sample.sample ? ` · ${sample.sampleNote}` : ""}` }), h("h1", { text: content.title }), h("p", { text: content.summary })),
      sec("", "프로젝트 정보", h("dl", { class: "facts" }, [["기간", page.info.period], ["분야", sample.domainLabel], ["역할", page.info.roleLabel], ["의뢰인", `${page.info.clientName} (${page.info.clientType})`]].map(([k, v]) => [h("dt", { text: k }), h("dd", { text: v || "-" })]))),
      sections.map((s, i) => sec(String(i + 1).padStart(2, "0"), s.title, h("div", { class: "body" }, paragraphs(s.body)), figs(s.items))),
      page.review?.comment && sec("", "의뢰인 평가", reviewQuote(page.review)),
      (content.tools.length || content.skills.length) && sec("", "사용 도구와 역량", h("div", { class: "chips" }, content.tools.map((t) => h("span", { class: "chip" }, h("b", { text: t.name }), t.why ? ` · ${t.why}` : "")), content.skills.map((s) => h("span", { class: "chip", text: s })))),
      (page.outcomes || []).length && sec("", "성과", outcomeList(page.outcomes)),
      sec("", "의뢰인 검증", claimsBlock(page.verification)),
      model.items.length && sec("", "증빙·링크", figs(model.items)),
      h("footer", { class: "doc-foot" }, "WOLINK · 의뢰인 검증 포트폴리오 · 스택 전환 템플릿 프로토타입. 모션: GSAP 3.15 + Flip (GSAP Standard License). 구도·전환 원리: Codrops “Stack to Content Layout Transition” (MIT) — 코드는 새로 구현. 글꼴: Noto Serif KR / Noto Sans KR (SIL OFL 1.1)."),
    ].flat(Infinity).filter((n) => n && n.nodeType));
  }
  function setDocMode(on) { state.docMode = on; document.body.classList.toggle("doc-mode", on); $("#document").hidden = !on; const db = $("#btn-doc"); if (db) { db.setAttribute("aria-pressed", String(on)); db.textContent = on ? "전시로" : "전체 내용"; } closeReader(); if (on) window.scrollTo(0, 0); }

  // ── URL · 샘플 ──────────────────────────────────────────────────────────
  function stageIndex(id) {
    const exact = state.model.stages.findIndex((s) => s.id === id);
    if (exact >= 0) return exact;
    const alias = { result: "deliverable", verify: "evaluation" }[id];
    return state.model.stages.findIndex((s) => s.id === alias);
  }
  function pushUrl() { const f = document.body.dataset.font; const u = `#sample=${state.sampleId}&view=${state.view}${state.view === "read" ? `&stage=${state.model.stages[state.current].id}` : ""}${f && f !== "brush" ? `&font=${f}` : ""}${document.body.dataset.theme === "dark" ? "&theme=dark" : ""}${state.motion ? "" : "&motion=off"}`; if (location.hash !== u) history.pushState(null, "", u); }
  function parseHash() { const p = new URLSearchParams(location.hash.replace(/^#/, "")); return { sample: p.get("sample"), view: p.get("view"), stage: p.get("stage"), font: p.get("font"), theme: p.get("theme") }; }
  function imagesReady(timeout) { const imgs = $$("#stack img").filter((i) => !i.complete); if (!imgs.length) return Promise.resolve(); return new Promise((res) => { let n = imgs.length; const done = () => { if (--n <= 0) res(); }; imgs.forEach((i) => { i.addEventListener("load", done, { once: true }); i.addEventListener("error", done, { once: true }); }); setTimeout(res, timeout); }); }
  function loadSample(id, { view = "list", stage = null, push = true } = {}) {
    const sample = window.WOLINK_SAMPLES?.[id]; if (!sample) return;
    killTl(); closeReader(); if (state.detail) closeDetail();
    state.sampleId = id; state.model = buildModel(sample); state.view = "list"; state.current = -1; document.body.dataset.view = "list";
    $$(".sample-switch button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.sample === id)));
    const badge = $("#sample-badge"); if (badge) { badge.hidden = !sample.sample; badge.textContent = sample.sampleNote || "샘플"; }
    document.title = `${sample.content.title} — 전시형 포트폴리오`;
    $("#content").hidden = true; $("#slide-nav").hidden = true; $("#title").style.visibility = "";
    buildStrips(state.model); renderDocument(state.model); fillTitle(); layoutList();
    const token = (state.loadToken = (state.loadToken || 0) + 1);
    Promise.all([imagesReady(700), document.fonts?.ready ?? Promise.resolve()]).then(() => {
      if (token !== state.loadToken) return;
      fillTitle(); // 실제 글꼴로 다시 측정 (대체 글꼴로 잰 폭 때문에 열 때마다 제목 크기가 달라지던 문제)
      const idx = stageIndex(stage);
      if (view === "read" && idx >= 0) { const m = state.motion; state.motion = false; open(idx, { push }); state.motion = m; return; }
      if (push) pushUrl();
      if (motionOn()) { const tl = gsap.timeline({ onComplete: () => { state.tl = null; } }); tl.from(state.strips, { y: 40, opacity: 0, duration: .9, ease: EASE, stagger: .05 }, 0).from($$("#title .oh__inner"), { yPercent: 101, duration: 1, ease: EASE, stagger: .06 }, .25).from($(".frame-author"), { opacity: 0, duration: .6 }, .4); state.tl = tl; }
    });
  }
  function setMotion(on, { persist = true } = {}) { state.motion = on && hasGsap; document.body.dataset.motion = state.motion ? "on" : "off"; const b = $("#btn-motion"); if (b) { b.setAttribute("aria-pressed", String(state.motion)); b.textContent = state.motion ? "모션 켜짐" : "모션 꺼짐"; } if (persist) { try { localStorage.setItem("wolink-stack-motion", state.motion ? "on" : "off"); } catch { /* 무시 */ } } if (!state.motion && state.tl) { state.tl.progress(1); state.tl = null; } }

  // ── 시작 ─────────────────────────────────────────────────────────────────
  function init() {
    let stored = null; try { stored = localStorage.getItem("wolink-stack-motion"); } catch { /* 무시 */ }
    const urlMotion = new URLSearchParams(location.hash.replace(/^#/, "")).get("motion");
    setMotion(urlMotion ? urlMotion === "on" : stored ? stored === "on" : !reducedMq.matches, { persist: false });
    // 도구 막대는 화면에서 뺐다. 모션은 prefers-reduced-motion 과 URL(#motion=off), 샘플은 URL(#sample=…), 전체 내용은 인쇄(문서형)로.
    if ($("#btn-motion")) $("#btn-motion").onclick = () => setMotion(!state.motion);
    if ($("#btn-doc")) $("#btn-doc").onclick = () => setDocMode(!state.docMode);
    $("#btn-back").onclick = () => close();
    $("#arrow-prev").onclick = () => navigateTo(state.current - 1); $("#arrow-next").onclick = () => navigateTo(state.current + 1);
    $("#reader-close").onclick = closeReader; $("#detail-close").onclick = closeDetail; $("#detail-backdrop").onclick = closeDetail; $("#detail-prev").onclick = () => stepDetail(-1); $("#detail-next").onclick = () => stepDetail(1);
    $$(".sample-switch button").forEach((b) => (b.onclick = () => loadSample(b.dataset.sample)));
    document.addEventListener("keydown", (e) => {
      if (state.detail) { if (e.key === "Escape") { e.preventDefault(); closeDetail(); } else if (e.key === "ArrowLeft") stepDetail(-1); else if (e.key === "ArrowRight") stepDetail(1); else if (e.key === "Tab") { const f = $$("#detail button:not(:disabled)"); const a = f[0], z = f[f.length - 1]; if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); } else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); } } return; }
      if (state.reader) { if (e.key === "Escape") closeReader(); return; }
      if (state.view === "read") { if (e.key === "Escape") close(); else if (e.key === "ArrowUp") { e.preventDefault(); navigateTo(state.current - 1); } else if (e.key === "ArrowDown") { e.preventDefault(); navigateTo(state.current + 1); } }
      else if (state.view === "list" && (e.key === "ArrowUp" || e.key === "ArrowDown")) { const i = state.strips.indexOf(document.activeElement); if (i >= 0) { e.preventDefault(); state.strips[Math.max(0, Math.min(state.strips.length - 1, i + (e.key === "ArrowDown" ? 1 : -1)))].focus(); } }
    });
    $("#scene").addEventListener("wheel", (e) => { if (state.view === "list" && state.listScroll) { e.preventDefault(); scrollListBy(e.deltaY); } }, { passive: false });
    window.addEventListener("popstate", () => { const { sample, view, stage } = parseHash(); if (sample && sample !== state.sampleId && window.WOLINK_SAMPLES[sample]) { loadSample(sample, { view, stage, push: false }); return; } const idx = stageIndex(stage); if (view === "read" && idx >= 0) open(idx, { push: false }); else close({ push: false }); });
    let rt = 0; window.addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(() => { if (state.tl) return; fillTitle(); if (state.view === "read") { layoutRead(); layoutMobileRead(); } else layoutList(); }, 120); });
    const { sample, view, stage, font, theme } = parseHash();
    if (theme === "dark") document.body.dataset.theme = "dark"; // 비교용 어두운 테마
    document.body.dataset.font = ["serif", "brush", "display"].includes(font) ? font : "brush"; // 기본 송명. 비교용 serif(명조)·display(검은고딕)
    loadSample(window.WOLINK_SAMPLES[sample] ? sample : "menu", { view: view || "list", stage, push: false });
    window.__stackReady = true;
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
