/* ============================================================
   제주이음 · 검색용 개별 페이지 만들기
   - 데이터 파일(가이드·학교 연계 집·지원 프로그램)을 읽어서
     내용이 HTML 에 미리 적힌 페이지를 만듭니다. 검색엔진(네이버·구글)이 바로 읽을 수 있어요.
       guide/<id>.html, house/<id>.html, program/<id>.html, house/index.html, program/index.html
       sitemap.xml, robots.txt
   - 사이트 주소는 CNAME 파일에서 읽습니다 (도메인을 바꾸면 CNAME 만 고치면 됨).
   - 실행: node scripts/build-pages.mjs   (GitHub Actions 가 데이터가 바뀔 때마다 자동 실행)
   ============================================================ */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const rd = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
const wr = (f, s) => { const p = path.join(ROOT, f); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, s); };

let host = "jejuieum.com";
try { host = rd("CNAME").trim() || host; } catch (e) {}
const SITE = "https://" + host + "/";

/* 데이터 파일을 브라우저처럼 읽기 */
const ctx = { console };
vm.createContext(ctx);
for (const f of ["assets/guide-data.js", "assets/programs-data.js", "assets/school-housing-data.js"]) {
  vm.runInContext(rd(f).replace(/^(\s*)(const|let) /gm, "$1var "), ctx, { filename: f });
}
const { GUIDES, GUIDE_PATH, GUIDE_STAGES, PROGRAMS, PROGRAM_STATUS, PROGRAMS_CHECKED,
        SCHOOL_HOUSES, SCHOOL_HOUSE_STATUS, SCHOOL_HOUSE_SOURCES, SCHOOL_HOUSES_CHECKED } = ctx;

const esc = (s) => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const strip = (s) => String(s || "").replace(/<[^>]+>/g, "");
const cut = (s, n) => { s = strip(s).replace(/\s+/g, " ").trim(); return s.length > n ? s.slice(0, n - 1) + "…" : s; };
const VER = (rd("index.html").match(/style\.css\?v=([\w]+)/) || [])[1] || "1";
const stageLabel = (id) => (GUIDE_STAGES.find((s) => s.id === id) || {}).label || id;

function page({ file, title, desc, active, body, jsonld, extraScripts = "", ogType = "article" }) {
  const url = SITE + file;
  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<base href="../">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${url}">
<meta property="og:type" content="${ogType}">
<meta property="og:site_name" content="제주이음">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${SITE}assets/og-image.png">
<meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta property="og:locale" content="ko_KR">
<link rel="stylesheet" as="style" crossorigin href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css">
<link rel="manifest" href="manifest.webmanifest">
<meta name="theme-color" content="#1f74d0">
<link rel="apple-touch-icon" href="assets/icons/apple-touch-icon.png">
<link rel="icon" type="image/png" href="assets/icons/icon-192.png">
<link rel="stylesheet" href="assets/style.css?v=${VER}">
${jsonld ? `<script type="application/ld+json">${JSON.stringify(jsonld).replace(/</g, "\\u003c")}</script>` : ""}
</head>
<body data-active="${active}">
<!-- 이 파일은 scripts/build-pages.mjs 가 데이터에서 자동으로 만듭니다. 직접 고치지 말고 데이터 파일을 고치세요. -->
${body}
<script src="assets/common.js?v=${VER}"></script>
<script src="assets/db.js?v=${VER}"></script>
<script src="assets/notify.js?v=${VER}"></script>
${extraScripts}
</body>
</html>
`;
}

/* ───────── 가이드 ───────── */
function guideStatic(g) {
  const body = (g.sections || []).map((s, i) => {
    let h = `<h2 id="sec${i}">${esc(s.h)}</h2>`;
    (s.p || []).forEach((t) => { h += `<p>${esc(t)}</p>`; });
    if (s.table) h += `<div class="tbl-scroll"><table class="cmp"><thead><tr>${s.table.head.map((c) => `<th>${esc(c)}</th>`).join("")}</tr></thead><tbody>` +
      s.table.rows.map((r) => `<tr>${r.map((c, j) => (j === 0 ? `<th>${esc(c)}</th>` : `<td>${esc(c)}</td>`)).join("")}</tr>`).join("") + `</tbody></table></div>`;
    if (s.list) h += `<ul class="dots">${s.list.map((t) => `<li>${t}</li>`).join("")}</ul>`;
    return h;
  }).join("");
  return `<header class="art-head"><div class="chips"><span class="chip region">${esc(g.cat)}</span>${(g.stage || []).map((s) => `<span class="chip stage">${esc(stageLabel(s))}</span>`).join("")}</div>
<h1>${esc(g.title)}</h1><p class="lead">${esc(g.lead)}</p>
<div class="art-meta"><span class="by">제주이음</span><span class="upd">✓ ${g.updated.replace(/-/g, ".")} 내용 확인</span><span>${g.min}분 읽기</span></div></header>
<div class="art-sum"><h4>3줄 요약</h4><ul>${(g.summary || []).map((t) => `<li>${esc(t)}</li>`).join("")}</ul></div>
<div class="art-body">${body}${g.tip ? `<div class="callout"><span class="ci">💡</span><div><b>운영자 메모</b><p>${esc(g.tip)}</p></div></div>` : ""}</div>
<div class="src-box"><h4>출처 · 참고</h4><ul>${(g.sources || []).map((s) => `<li><a href="${esc(s[1])}">${esc(s[0])}</a></li>`).join("")}</ul></div>`;
}
const articleTpl = rd("article.html");
const artScript = (articleTpl.match(/<script>\n\(function\(\)\{[\s\S]*?<\/script>/) || [""])[0];
for (const g of GUIDES) {
  const file = `guide/${g.id}.html`;
  const html = page({
    file, title: `${g.title} — 제주이음`, desc: cut(g.lead, 150), active: "article",
    jsonld: { "@context": "https://schema.org", "@type": "Article", headline: g.title, description: strip(g.lead), dateModified: g.updated,
      author: { "@type": "Organization", name: "제주이음" }, publisher: { "@type": "Organization", name: "제주이음" }, mainEntityOfPage: SITE + file, inLanguage: "ko" },
    body: `<main class="wrap" style="padding-top:28px">
  <div class="crumb" id="crumb"><a href="index.html">홈</a> › <a href="guide.html">제주살이 가이드</a></div>
  <div class="art-wrap">
    <article class="art" id="art">${guideStatic(g)}</article>
    <aside class="art-side" id="art-side"></aside>
  </div>
  <section class="related" id="related"></section>
</main>`,
    extraScripts: `<script src="assets/guide-data.js?v=${VER}"></script>\n<script>var FORCE_ID = ${JSON.stringify(g.id)};</script>\n${artScript}`
  });
  wr(file, html);
}

/* ───────── 학교 연계 집 ───────── */
const areaText = (h) => (h.area_m2 ? h.area_m2 + "㎡" + (h.area_py ? " (약 " + h.area_py + "평)" : "") : (h.area_py ? "약 " + h.area_py + "평" : ""));
const srcList = (arr) => (arr || []).map((s) => {
  if (typeof s === "string") { const o = SCHOOL_HOUSE_SOURCES[s]; return o ? [o.label, o.url] : null; }
  return s;
}).filter(Boolean);
const srcHtml = (arr) => `<ul>${srcList(arr).map((s) => (s[1] ? `<li><a href="${esc(s[1])}" target="_blank" rel="noopener">${esc(s[0])}</a></li>` : `<li>${esc(s[0])}</li>`)).join("")}</ul>`;
const row = (k, v) => (v ? `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>` : "");

for (const h of SCHOOL_HOUSES) {
  const file = `house/${h.id}.html`, st = SCHOOL_HOUSE_STATUS[h.status] || ["확인 필요", "wait"];
  const addr = h.address || ("제주 " + h.village);
  const mapQ = h.lat ? `https://map.kakao.com/link/map/${encodeURIComponent(h.name)},${h.lat},${h.lng}` : `https://map.kakao.com/?q=${encodeURIComponent(addr)}`;
  const size = [h.units, areaText(h), h.built ? h.built + "년 준공" : ""].filter(Boolean).join(" · ");
  const others = SCHOOL_HOUSES.filter((x) => x.id !== h.id && x.city === h.city).slice(0, 6);
  const title = `${h.name} — ${h.school}${/초$/.test(h.school) ? "등학교" : ""} 학교 연계 주택 (${h.city} ${h.village})`;
  const desc = cut(`${h.city} ${h.village} ${h.school} 학교 연계 ${h.kind}. ${h.rule || ""} ${h.cost ? "비용: " + h.cost : ""}`, 150);
  wr(file, page({
    file, title: title + " — 제주이음", desc, active: "school",
    jsonld: { "@context": "https://schema.org", "@type": "Residence", name: h.name, description: desc,
      address: { "@type": "PostalAddress", streetAddress: addr, addressRegion: "제주특별자치도", addressCountry: "KR" },
      ...(h.lat ? { geo: { "@type": "GeoCoordinates", latitude: h.lat, longitude: h.lng } } : {}) },
    body: `<main class="wrap" style="padding-top:28px;max-width:880px">
  <div class="crumb"><a href="index.html">홈</a> › <a href="school.html">학교 연계 집</a> › <a href="house/index.html">전체 목록</a></div>
  <article class="hp">
    <div class="hr-top"><span class="hst ${st[1]}">${esc(st[0])}</span><span class="hr-sc">🏫 ${esc(h.school)}</span><span class="hr-city">${esc(h.city)} · ${esc(h.village)}</span></div>
    <h1>${esc(h.name)}</h1>
    <p class="hp-lead">${esc(h.school)} 학생 가정을 위한 ${esc(h.kind)}${h.near ? " — " + esc(h.near) : ""}</p>
    <dl class="hr-dl hp-dl">
      ${row("주소", addr)}${row("규모", size)}${row("입주 조건", h.rule)}${row("거주 기간", h.stay)}${row("비용", h.cost)}${row("문의", h.tel ? h.tel + (h.telLabel ? " (" + h.telLabel + ")" : "") : "")}
    </dl>
    ${h.note ? `<div class="callout"><span class="ci">📝</span><div><b>알아 둘 점</b><p>${esc(h.note)}</p></div></div>` : ""}
    <div class="hp-btns">
      <a class="btn primary" href="school.html?house=${h.id}">🔔 빈자리 알림 · 지도 보기</a>
      <a class="btn ghost" href="${mapQ}" target="_blank" rel="noopener">🗺️ 카카오맵</a>
      ${h.tel ? `<a class="btn ghost" href="tel:${h.tel.replace(/[^0-9]/g, "")}">📞 전화 문의</a>` : ""}
    </div>
    <p class="hp-note">현황은 마을마다 수시로 바뀝니다. 입주 전에는 꼭 리사무소에 직접 확인해 주세요. 마지막 확인: ${SCHOOL_HOUSES_CHECKED}</p>
    <div class="src-box"><h4>출처 · 참고</h4>${srcHtml(h.src)}
      <div class="fix">바뀐 내용이 있나요?<a class="btn soft" href="contact.html?type=${encodeURIComponent("정보 정정 요청")}&ref=${encodeURIComponent(h.name)}">정보 정정 요청</a></div></div>
  </article>
  ${others.length ? `<section class="hp-more"><h2>${esc(h.city)}의 다른 학교 연계 집</h2><ul>${others.map((x) => `<li><a href="house/${x.id}.html"><b>${esc(x.name)}</b><span>${esc(x.school)} · ${esc(x.village)}</span></a></li>`).join("")}</ul>
  <a class="more" href="house/index.html">전체 목록 보기 →</a></section>` : ""}
</main>`
  }));
}
wr("house/index.html", page({
  file: "house/index.html", ogType: "website",
  title: "제주 학교 연계 주택·마을 공동주택 전체 목록 — 제주이음",
  desc: `제주시·서귀포시 작은학교 살리기 마을 공동주택과 학교 연계 주택 ${SCHOOL_HOUSES.length}곳의 주소, 입주 조건, 비용, 문의처를 정리했습니다.`,
  active: "school",
  body: `<main class="wrap" style="padding-top:28px;max-width:880px">
  <div class="crumb"><a href="index.html">홈</a> › <a href="school.html">학교 연계 집</a> › 전체 목록</div>
  <h1 class="hp-h1">제주 학교 연계 주택 전체 목록</h1>
  <p class="hp-lead">작은학교를 살리려고 마을이 지은 공동주택과 학교 연계 주택 ${SCHOOL_HOUSES.length}곳이에요. 마지막 확인: ${SCHOOL_HOUSES_CHECKED}</p>
  ${["제주시", "서귀포시"].map((c) => `<section class="hp-more"><h2>${c}</h2><ul>${SCHOOL_HOUSES.filter((x) => x.city === c).map((x) => `<li><a href="house/${x.id}.html"><b>${esc(x.name)}</b><span>${esc(x.school)} · ${esc(x.village)}${x.units ? " · " + esc(x.units) : ""}</span></a></li>`).join("")}</ul></section>`).join("")}
  <p style="margin-top:20px"><a class="btn primary" href="school.html">필터·지도·빈자리 알림으로 보기 →</a></p>
</main>`
}));

/* ───────── 지원 프로그램 ───────── */
for (const p of PROGRAMS) {
  if (!p.id) continue;
  const file = `program/${p.id}.html`, st = PROGRAM_STATUS[p.status] || ["확인", "ask"];
  const same = PROGRAMS.filter((x) => x.id && x.id !== p.id && x.cat === p.cat).slice(0, 6);
  const desc = cut(`${p.org} · ${p.who || ""} · ${p.what || ""}`, 150);
  wr(file, page({
    file, title: `${p.name} — 제주 ${p.cat} 지원 프로그램 — 제주이음`, desc, active: "stay",
    jsonld: { "@context": "https://schema.org", "@type": "GovernmentService", name: p.name, description: desc,
      provider: { "@type": "Organization", name: p.org }, areaServed: "제주특별자치도", ...(p.url ? { url: p.url } : {}) },
    body: `<main class="wrap" style="padding-top:28px;max-width:880px">
  <div class="crumb"><a href="index.html">홈</a> › <a href="stay.html">한달살기·이주</a> › <a href="program/index.html">지원 프로그램</a></div>
  <article class="hp">
    <div class="hr-top"><span class="pst ${st[1]}">${esc(st[0])}</span><span class="hr-sc">${esc(p.cat)}</span>${(p.tags || []).map((t) => `<span class="chip stage">${esc(t)}</span>`).join("")}</div>
    <h1>${esc(p.name)}</h1>
    <p class="hp-lead">${esc(p.org)}</p>
    <dl class="hr-dl hp-dl">${row("대상", p.who)}${row("지원 내용", p.what)}${row("조건", p.cond)}${row("일정", p.when)}${row("문의", p.contact)}</dl>
    <div class="hp-btns">
      ${p.url ? `<a class="btn primary" href="${esc(p.url)}" target="_blank" rel="noopener">공고·안내 보기 ↗</a>` : ""}
      <a class="btn ghost" href="stay.html#programs-top">🔔 새 공고 알림 받기</a>
    </div>
    <p class="hp-note">공고 내용은 해마다 바뀝니다. 신청 전에 꼭 공식 안내를 확인해 주세요. 마지막 확인: ${PROGRAMS_CHECKED}</p>
    <div class="src-box"><h4>출처 · 참고</h4><ul>${(p.src || []).map((s) => `<li><a href="${esc(s[1])}" target="_blank" rel="noopener">${esc(s[0])}</a></li>`).join("")}</ul>
      <div class="fix">바뀐 내용이 있나요?<a class="btn soft" href="contact.html?type=${encodeURIComponent("정보 정정 요청")}&ref=${encodeURIComponent(p.name)}">정보 정정 요청</a></div></div>
  </article>
  ${same.length ? `<section class="hp-more"><h2>같은 분류의 다른 프로그램</h2><ul>${same.map((x) => `<li><a href="program/${x.id}.html"><b>${esc(x.name)}</b><span>${esc(x.org)}</span></a></li>`).join("")}</ul>
  <a class="more" href="program/index.html">전체 목록 보기 →</a></section>` : ""}
</main>`
  }));
}
const cats = [...new Set(PROGRAMS.map((p) => p.cat))];
wr("program/index.html", page({
  file: "program/index.html", ogType: "website",
  title: "제주 한달살기·이주·정착 지원 프로그램 전체 목록 — 제주이음",
  desc: `제주 체류 체험, 워케이션, 귀농·귀촌, 정착 지원 프로그램 ${PROGRAMS.length}개의 대상·지원 내용·일정·문의처를 정리했습니다.`,
  active: "stay",
  body: `<main class="wrap" style="padding-top:28px;max-width:880px">
  <div class="crumb"><a href="index.html">홈</a> › <a href="stay.html">한달살기·이주</a> › 지원 프로그램</div>
  <h1 class="hp-h1">제주 장기체류·정착 지원 프로그램</h1>
  <p class="hp-lead">매일 아침 새 공고를 확인해 갱신합니다. 마지막 확인: ${PROGRAMS_CHECKED}</p>
  ${cats.map((c) => `<section class="hp-more"><h2>${esc(c)}</h2><ul>${PROGRAMS.filter((x) => x.cat === c && x.id).map((x) => `<li><a href="program/${x.id}.html"><b>${esc(x.name)}</b><span>${esc((PROGRAM_STATUS[x.status] || [""])[0])} · ${esc(x.org)}</span></a></li>`).join("")}</ul></section>`).join("")}
  <p style="margin-top:20px"><a class="btn primary" href="stay.html#programs-top">필터·알림으로 보기 →</a></p>
</main>`
}));

/* ───────── sitemap.xml · robots.txt ───────── */
const today = new Date().toISOString().slice(0, 10);
const urls = [
  ["", today, "1.0"], ["guide.html", today, "0.9"], ["stay.html", PROGRAMS_CHECKED, "0.9"], ["realestate.html", today, "0.8"],
  ["school.html", SCHOOL_HOUSES_CHECKED, "0.9"], ["tools.html", today, "0.6"], ["jangnal.html", today, "0.7"], ["terms.html", today, "0.2"], ["privacy.html", today, "0.2"], ["trade.html", today, "0.6"],
  ["community.html", today, "0.6"], ["about.html", today, "0.4"], ["contact.html", today, "0.3"],
  ["house/index.html", SCHOOL_HOUSES_CHECKED, "0.8"], ["program/index.html", PROGRAMS_CHECKED, "0.8"],
  ...GUIDES.map((g) => [`guide/${g.id}.html`, g.updated, "0.8"]),
  ...SCHOOL_HOUSES.map((h) => [`house/${h.id}.html`, SCHOOL_HOUSES_CHECKED, "0.7"]),
  ...PROGRAMS.filter((p) => p.id).map((p) => [`program/${p.id}.html`, PROGRAMS_CHECKED, "0.7"])
];
wr("sitemap.xml", `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(([u, d, pr]) => `  <url><loc>${esc(SITE + u)}</loc><lastmod>${/^\d{4}-\d{2}-\d{2}$/.test(d) ? d : today}</lastmod><priority>${pr}</priority></url>`).join("\n")}
</urlset>
`);
wr("robots.txt", `User-agent: *
Allow: /
Disallow: /admin/
Disallow: /write.html
Disallow: /mypage.html

Sitemap: ${SITE}sitemap.xml
`);
/* ───────── 최상위 페이지 링크 미리보기(카카오톡·문자) 태그 ───────── */
{
  const DEF = "제주에 살고 있거나 살아보려는 사람들을 위한 생활 정보와 동네 커뮤니티. 가이드·한달살기·학교 연계 집·부동산·오일장 달력.";
  const NOINDEX = ["write.html", "login.html", "signup.html", "forgot.html", "reset.html", "messages.html", "activity.html", "profile.html", "mypage.html"];
  for (const f of fs.readdirSync(ROOT).filter((x) => x.endsWith(".html"))) {
    let h = fs.readFileSync(path.join(ROOT, f), "utf8");
    const t = (h.match(/<title>([^<]*)<\/title>/) || [])[1]; if (!t) continue;
    const d = (h.match(/<meta name="description" content="([^"]*)"/) || [])[1] || DEF;
    const url = SITE + (f === "index.html" ? "" : f);
    const block = `<!--og--><meta property="og:type" content="website"><meta property="og:site_name" content="제주이음"><meta property="og:title" content="${t}"><meta property="og:description" content="${d}"><meta property="og:url" content="${url}"><meta property="og:image" content="${SITE}assets/og-image.png"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta property="og:locale" content="ko_KR"><meta name="twitter:card" content="summary_large_image">${NOINDEX.includes(f) ? '<meta name="robots" content="noindex">' : ""}<!--/og-->`;
    h = /<!--og-->[\s\S]*?<!--\/og-->/.test(h) ? h.replace(/<!--og-->[\s\S]*?<!--\/og-->/, block) : h.replace(/(<title>[^<]*<\/title>)/, `$1\n${block}`);
    fs.writeFileSync(path.join(ROOT, f), h);
  }
}
console.log(`만든 페이지: 가이드 ${GUIDES.length}, 학교 연계 집 ${SCHOOL_HOUSES.length}, 지원 프로그램 ${PROGRAMS.filter((p) => p.id).length}, 사이트맵 주소 ${urls.length}개 (${SITE})`);
