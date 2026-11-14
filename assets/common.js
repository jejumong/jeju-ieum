/* ============================================================
   제주이음 공통 스크립트 (레이아웃 + 데이터 + 인증)
   서버 없이 localStorage로 동작하는 프로토타입입니다.
   ============================================================ */

/* ── 사이트 설정 (여기만 고치면 사이트 전체에 반영) ──
   contactEmail : 상담·문의 메일을 받을 주소 (비워 두면 메일 버튼이 숨겨짐)
   kakaoChannel : 카카오톡 채널 주소 (예: https://pf.kakao.com/_xxxx)
   inquiryEndpoint : Formspree·구글 Apps Script 같은 폼 수신 주소.
                     비워 두면 신청서는 이 브라우저에만 저장됩니다(관리자 콘솔에서 확인). */
var SITE_CFG = {
  name: "제주이음",
  contactEmail: "",
  kakaoChannel: "",
  inquiryEndpoint: "",
  /* samples : 화면 구성을 보여 주려고 넣어 둔 예시 게시글을 어떻게 할지
       "label" = 보여 주되 '예시' 안내를 붙임 (지금)
       "hide"  = 모두 숨김 (정식 오픈 때 이걸로 바꾸세요) */
  samples: "hide",
  /* 무료 자동 알림 (브라우저 푸시) — OneSignal 무료 요금제의 App ID 를 넣으면 켜집니다.
     비워 두면 '관심 목록'(이 브라우저에 저장, 방문할 때 바뀐 점 표시)만 동작합니다.
     사이트가 jejumong.github.io/저장소이름/ 처럼 하위 폴더에 있으면 onesignalPath 에 "/저장소이름/" 을 넣으세요.
     자체 도메인(예: jejuieum.com) 맨 앞에 두면 "/" 그대로 두면 됩니다. */
  onesignalAppId: "c7fd4d45-3d1b-4157-9230-d29e4676f659",
  onesignalPath: "/",
  /* 카카오맵 JavaScript 키 — 카카오 디벨로퍼스 '제주이음' 앱. 플랫폼 → Web 에 사이트 도메인을 등록해야 지도가 열립니다. */
  /* 카페24 서버 주소 (회원·글·동호회 가입 신청·알림) — 비워 두면 예전처럼 브라우저 저장 방식으로만 동작 */
  apiUrl: "https://andend07.mycafe24.com/jeju/api/",
  kakaoJsKey: "e8daa949540834b55af58b73b1a279ef",
  youtube: "https://www.youtube.com/@Jejumong",
  tools: {
    tide: "/tide/",
    calendar: "/calendar/",
    near: "/near/",
    home: "https://jejumong.github.io/"
  }
};

/* ── 저장소 헬퍼 ── */
/* ── 공유하기 (머리글 ↗ 공유 버튼) ──
   카카오톡: SITE_CFG.kakaoJsKey 로 카카오 공유 SDK 사용 (카카오 디벨로퍼스 '제주이음' 앱에 jejuieum.com 도메인 등록 필요)
   안 되면 휴대폰 기본 공유 창 → 그것도 안 되면 링크 복사로 대신합니다. */
var SHARE_ICO = '<svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true"><path d="M12 3v12M7 8l5-5 5 5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/><path d="M5 12v6.5A2.5 2.5 0 0 0 7.5 21h9a2.5 2.5 0 0 0 2.5-2.5V12" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>';
var JIShare = (function () {
  var KAKAO_SDK = "https://t1.kakaocdn.net/kakao_js_sdk/2.8.4/kakao.min.js";
  function isMobile() { return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && /Mac/.test(navigator.platform)); }
  /* 어느 화면에서 누르든 항상 제주이음 메인 주소를 공유 */
  function info() {
    return { title: "제주이음", text: "제주에 사는 우리를 잇는 생활 정보", url: "https://jejuieum.com/", image: "https://jejuieum.com/assets/og-image.png" };
  }
  function e(t) { var d = document.createElement("div"); d.textContent = t == null ? "" : String(t); return d.innerHTML; }
  function close() { var w = document.getElementById("ji-share"); if (w) { w.classList.remove("on"); setTimeout(function () { w.remove(); }, 200); } document.removeEventListener("keydown", esc); }
  function esc(ev) { if (ev.key === "Escape") close(); }
  function toast(t) { var s = document.querySelector("#ji-share .js-msg"); if (s) { s.textContent = t; s.hidden = false; } }
  function copy(url) {
    var done = function () { toast("✅ 링크를 복사했어요. 원하는 곳에 붙여 넣으세요."); };
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(url).then(done, fallback); else fallback();
    function fallback() { var ta = document.createElement("textarea"); ta.value = url; ta.style.cssText = "position:fixed;opacity:0"; document.body.appendChild(ta); ta.select(); try { document.execCommand("copy"); done(); } catch (x) { toast(url); } ta.remove(); }
  }
  function native(i) { if (navigator.share) return navigator.share({ title: i.title, text: i.title, url: i.url }).then(close, function () {}); copy(i.url); }
  function loadKakao(cb) {
    if (window.Kakao && window.Kakao.Share) return cb();
    var s = document.createElement("script"); s.src = KAKAO_SDK; s.crossOrigin = "anonymous";
    s.onload = cb; s.onerror = function () { cb(new Error("sdk")); }; document.head.appendChild(s);
  }
  function kakao(i) {
    if (!SITE_CFG.kakaoJsKey) return native(i);
    loadKakao(function (err) {
      try {
        if (err || !window.Kakao) throw err || new Error("no sdk");
        if (!Kakao.isInitialized()) Kakao.init(SITE_CFG.kakaoJsKey);
        var link = { mobileWebUrl: i.url, webUrl: i.url };
        Kakao.Share.sendDefault({ objectType: "feed",
          content: { title: i.title === "제주이음" ? "제주이음 — 제주에 사는 우리를 잇는 생활 정보" : i.title, description: (i.text || "").slice(0, 100), imageUrl: i.image, link: link },
          buttons: [{ title: "제주이음에서 보기", link: link }] });
        close();
      } catch (x) { native(i); }
    });
  }
  function open() {
    if (document.getElementById("ji-share")) return;
    var i = info();
    var w = document.createElement("div"); w.id = "ji-share"; w.setAttribute("role", "dialog"); w.setAttribute("aria-label", "공유하기");
    w.innerHTML = '<div class="js-dim"></div><div class="js-sheet"><div class="js-grab"></div>' +
      '<div class="js-hd"><h3>공유하기</h3><button type="button" class="js-x" aria-label="닫기">✕</button></div>' +
      '<div class="js-prev"><img src="' + e(i.image) + '" alt=""><div><b>' + e(i.title) + '</b><small>' + e(i.url.replace(/^https?:\/\//, "").slice(0, 60)) + '</small></div></div>' +
      '<div class="js-btns">' +
        '<button type="button" data-k="kakao"><span style="background:#fee500">' + '<svg viewBox="0 0 24 24" width="26" height="26"><path d="M12 4C7 4 3 7.1 3 11c0 2.5 1.7 4.7 4.2 6l-1 3.6c-.1.3.3.6.6.4l4.2-2.8c.3 0 .7.1 1 .1 5 0 9-3.1 9-7s-4-7-9-7z" fill="#3a1d1d"/></svg>' + '</span>카카오톡</button>' +
        (isMobile() ? '<a href="sms:?&body=' + encodeURIComponent((i.title === "제주이음" ? "제주이음" : "[제주이음] " + i.title) + " " + i.url) + '"><span style="background:#e8f7ec">✉️</span>문자</a>' : '') +
        '<button type="button" data-k="copy"><span style="background:var(--sea-50)">🔗</span>링크 복사</button>' +
        (navigator.share ? '<button type="button" data-k="more"><span style="background:#f1f3f6">⋯</span>다른 앱</button>' : '') +
      '</div><p class="js-msg" hidden></p></div>';
    document.body.appendChild(w);
    requestAnimationFrame(function () { w.classList.add("on"); });
    w.querySelector(".js-dim").onclick = close; w.querySelector(".js-x").onclick = close;
    w.querySelector(".js-btns").addEventListener("click", function (ev) {
      var b = ev.target.closest("button"); if (!b) return;
      if (b.dataset.k === "kakao") kakao(i); else if (b.dataset.k === "copy") copy(i.url); else if (b.dataset.k === "more") native(i);
    });
    document.addEventListener("keydown", esc);
  }
  return { open: open, close: close };
})();

var JI = {
  get: function (k, d) {
    try { var v = localStorage.getItem("ji_" + k); return v ? JSON.parse(v) : d; }
    catch (e) { return d; }
  },
  set: function (k, v) {
    try { localStorage.setItem("ji_" + k, JSON.stringify(v)); } catch (e) {}
  }
};

/* ── 인증 ── */
function currentUser() { return JI.get(window.JI_AUTH_NS === "admin" ? "session_admin" : "session", null); }
function logout() {
  var done = function () { JI.set("session", null); alert("로그아웃되었습니다."); location.href = "index.html"; };
  if (window.JIDB && JIDB.enabled) JIDB.signOut().then(done, done); else done();
}
/* ── 프로필 사진 ── */
function myPhoto() {
  var u = currentUser();
  if (!u) return null;
  var photos = JI.get("photos", {});
  return photos[u.email] || null;
}
function setMyPhoto(dataUrl) {
  var u = currentUser();
  if (!u) return;
  var photos = JI.get("photos", {});
  if (dataUrl) photos[u.email] = dataUrl; else delete photos[u.email];
  JI.set("photos", photos);
}
/* 아바타 HTML (사진이 있으면 사진, 없으면 닉네임 첫 글자) */
function avatarHtml(size, cls) {
  var u = currentUser();
  if (!u) return "";
  var ph = myPhoto();
  var s = size || 24;
  var base = "width:" + s + "px;height:" + s + "px;border-radius:50%;flex-shrink:0;object-fit:cover;";
  if (ph) return '<img class="' + (cls || "") + '" src="' + ph + '" alt="" style="' + base + '">';
  return '<span class="' + (cls || "") + '" style="' + base +
    'background:linear-gradient(150deg,#4aa3f0,#1a6cc2);color:#fff;display:inline-flex;align-items:center;' +
    'justify-content:center;font-weight:800;font-size:' + Math.round(s * 0.45) + 'px">' +
    u.nick.charAt(0) + '</span>';
}

function requireLogin(msg) {
  var u = currentUser();
  if (!u) {
    if (confirm((msg || "로그인이 필요한 기능입니다.") + "\n로그인 페이지로 이동할까요?")) {
      location.href = "login.html?next=" + encodeURIComponent(location.pathname.split("/").pop() + location.search);
    }
    return null;
  }
  return u;
}

/* ── 기본 게시글 (커뮤니티) ── */
var SEED_POSTS = [
  { id:"s1", board:"제주동쪽", head:"질문", title:"세화 오일장 요즘 갈치 시세 어때요?", author:"바다바람", date:"2026-08-12", views:312,
    content:"이번 주말에 세화 오일장 가려고 하는데, 요즘 은갈치 시세가 어느 정도인가요? 지난달엔 중치 한 마리에 만오천 원 정도였는데 태풍 이후로 올랐다는 얘기가 있어서요. 다녀오신 분 계시면 공유 부탁드립니다." },
  { id:"s2", board:"제주남쪽", head:"정보", title:"서귀포 소아과 대기 짧은 곳 공유합니다", author:"두아이맘", date:"2026-08-12", views:287,
    content:"아이 둘 키우면서 서귀포 소아과 여러 곳 다녀본 경험 공유해요. 오전 9시 오픈런 기준으로 대기가 가장 짧았던 곳과 주차가 편한 곳을 정리했습니다. 접수 앱을 쓰는 병원은 집에서 순번 확인이 가능해서 한여름에 특히 편했어요." },
  { id:"s3", board:"자유게시판", head:"후기", title:"이주 3년차, 텃세 이렇게 풀었습니다", author:"동쪽사람", date:"2026-08-11", views:956,
    content:"이주 초반엔 마을 분위기에 적응하기 쉽지 않았는데, 마을 청소날에 꾸준히 나가고 부녀회 행사에 음료수라도 들고 참여하면서 조금씩 달라졌어요. 결국 시간과 얼굴도장이 답이더라고요. 비슷한 고민 하시는 분들께 도움이 되길 바랍니다." },
  { id:"s4", board:"제주서쪽", head:"질문", title:"애월 쪽 태풍 대비 창문 보강 어떻게 하세요?", author:"한담해변", date:"2026-08-11", views:204,
    content:"바닷가 가까운 집이라 태풍 때마다 창문이 걱정입니다. 안전필름, 테이프, 셔터 중에 실제로 효과 봤던 방법이 궁금해요. 특히 서쪽 해안 분들 경험담 부탁드립니다." },
  { id:"s5", board:"교육", head:"정보", title:"읍면 지역 중학교 방과후 프로그램 정보 나눠요", author:"함덕댁", date:"2026-08-11", views:178,
    content:"읍면 지역은 학원 선택지가 적은 대신 학교 방과후 프로그램이 알차게 운영되는 곳이 많아요. 저희 아이 학교의 2학기 프로그램 목록과 신청 팁을 정리해봤습니다. 다른 학교 정보도 댓글로 나눠주세요." },
  { id:"s6", board:"건강웰빙", head:"질문", title:"제주시에서 도수치료 잘하는 곳 추천 부탁드려요", author:"오름러버", date:"2026-08-10", views:231,
    content:"오름 다니다가 무릎이 안 좋아져서 도수치료를 받아보려고 합니다. 제주시내에서 실비 청구 가능하고 치료사 선생님이 꼼꼼한 곳 있으면 추천 부탁드려요." },
  { id:"s7", board:"생활정보", head:"정보", title:"도외 택배 추가배송비 없는 쇼핑몰 리스트 (8월 업데이트)", author:"알뜰제주", date:"2026-08-10", views:1102,
    content:"제주 배송비 3천 원 추가가 없는 쇼핑몰들을 직접 주문해보며 확인한 목록입니다. 8월 기준으로 정책이 바뀐 곳이 두 군데 있어서 업데이트했어요. 즐겨찾기 해두시면 유용합니다." },
  { id:"s8", board:"제주북쪽", head:"자유", title:"제주시 연동 저녁 배드민턴 같이 치실 분", author:"셔틀콕", date:"2026-08-10", views:98,
    content:"연동 체육관에서 평일 저녁 8시에 치고 있습니다. 실력 무관, 라켓만 있으면 됩니다. 현재 6명이고 2~3분 더 모시려고 해요. 댓글 남겨주세요." },
  { id:"s9", board:"질문하기", head:"질문", title:"아이 전학 후 적응이 느린데 비슷한 경험 있으신가요", author:"봄날의곶", date:"2026-08-09", views:344,
    content:"봄에 전학 왔는데 한 학기가 지나도 아이가 반에서 겉도는 것 같아 마음이 쓰입니다. 제주로 전학 오신 집들은 아이 적응에 보통 얼마나 걸렸는지, 도움이 됐던 활동이 있었는지 여쭙고 싶어요." },
  { id:"s10", board:"취미·여행", head:"질문", title:"비 갠 뒤 사려니숲길 상태 어떤가요?", author:"숲길산책", date:"2026-08-09", views:156,
    content:"주말에 사려니숲길 가려는데 이번 주 비가 많이 와서 길 상태가 궁금합니다. 진흙 구간이 심한지, 운동화로 가능한지 최근에 다녀오신 분 알려주세요." },
  { id:"s11", board:"최신뉴스", head:"정보", title:"제주 버스 노선 개편안 발표 — 동부권 변경 정리", author:"뉴스지기", date:"2026-08-09", views:874,
    content:"이번에 발표된 버스 노선 개편안 중 동부권(조천·구좌·성산) 관련 변경 사항만 추려서 정리했습니다. 출퇴근에 영향 있는 노선이 몇 개 있으니 해당 지역 분들은 확인해보세요." },
  { id:"s12", board:"제주동쪽", head:"나눔", title:"김녕 텃밭 애호박이 너무 많이 열렸어요 (나눔)", author:"초록손", date:"2026-08-08", views:203,
    content:"텃밭 애호박이 감당이 안 될 만큼 열려서 이웃분들께 나눔합니다. 김녕리 직접 수령 가능하신 분, 댓글 남겨주시면 순서대로 연락드릴게요." }
];

var NOTICE = { id:"n1", board:"공지", head:"공지", title:"제주이음 생활도구가 한곳에 모였어요 — 매일 새로 확인하는 정보 안내", author:"제주이음", date:"2026-11-14",
  content:"안녕하세요, 제주이음입니다. 이번 주에 달라진 점을 알려 드려요.\n\n" +
    "1. 생활도구를 제주이음 안으로 옮겼어요\n열두 달 달력(jejuieum.com/calendar), 제주 물때 시간표(jejuieum.com/tide), 내 근처 찾기(jejuieum.com/near)를 이제 제주이음 주소에서 바로 쓸 수 있어요. 예전 주소로 들어와도 새 주소로 자동으로 이동해요.\n\n" +
    "2. 정보는 매일 새로 확인해요\n축제정보와 열두 달 달력의 마을 행사는 매일 오후, 장기체류·정착 지원 프로그램과 학교 연계 집은 매일 아침과 오후에 새 공고를 확인해 바로 반영해요. 각 페이지 아래에 마지막으로 확인한 날짜가 적혀 있어요.\n\n" +
    "3. 내 근처 찾기에서 가까운 버스정류장을 볼 수 있어요\n내 위치에서 가까운 정류장과 거리, 그 정류장을 지나는 버스 번호를 확인할 수 있어요. 정류장이 멀면 범위를 넓혀 찾아 드려요.\n\n" +
    "일정이나 내용은 바뀔 수 있으니 중요한 일은 출처 안내를 한 번 더 확인해 주세요. 틀린 정보나 알리고 싶은 동네 소식은 문의·제보로 알려 주시면 확인 후 반영할게요." };

/* ── 내 글 · 내 댓글 권한과 수정·삭제 ── */

/* 로그인한 사람이 쓴 글인지 (회원이 작성한 글만 수정·삭제 가능) */
/* 구인구직 급여 표시: "시급 11,000원" */
function payText(p) {
  if (!p || !p.payType) return "";
  if (p.payType === "협의" || !p.pay) return p.payType === "협의" ? "급여 협의" : p.payType + " 협의";
  return p.payType + " " + (+p.pay).toLocaleString() + "원";
}
/* 채용완료 표시 전환 (내 구인 글) */
function toggleJobClosed(id) {
  var dp = dbPosts().filter(function (p) { return p.id === id; })[0];
  if (dp && window.JIDB && JIDB.enabled) {          // 서버 글은 서버에서 바꿈 (Promise 를 돌려줌)
    if (!isMyPost(dp)) return null;
    var closing = dp.head !== "채용완료";
    var extra = Object.assign({}, dp.extra || {}, { headPrev: closing ? (dp.head || "구인") : "" });
    return JIDB.updatePost(id, { head: closing ? "채용완료" : (dp.headPrev || "구인"), extra: extra });
  }
  var posts = JI.get("posts", []);
  for (var i = 0; i < posts.length; i++) if (posts[i].id === id) {
    if (!isMyPost(posts[i])) return null;
    if (posts[i].head === "채용완료") { posts[i].head = posts[i].headPrev || "구인"; delete posts[i].headPrev; }
    else { posts[i].headPrev = posts[i].head || "구인"; posts[i].head = "채용완료"; }
    JI.set("posts", posts); return posts[i];
  }
  return null;
}
var ROLE_LABEL = { user: "일반", realtor: "부동산 중개인", shop: "상점판매자", dealer: "공구판매자", staff: "스텝", admin: "관리자" };
/* 글쓴이 표시: 공인중개사·상점·공구판매자·운영진은 눈에 띄는 표시 */
var ROLE_BADGE = { realtor: ["🏢", "공인중개사", "rb-realtor"], shop: ["🏪", "제주상점", "rb-shop"], dealer: ["🎁", "공구판매", "rb-dealer"],
  admin: ["🍊", "운영진", "rb-staff"], staff: ["🍊", "운영진", "rb-staff"], direct: ["🏠", "직거래", "rb-direct"] };
function authorRoleOf(p) {
  if (!p) return "user";
  var r = _authorRole(p);
  // 부동산: 중개사가 아닌 회원 매물은 '직거래'
  if (p.board === "부동산" && (r === "user" || r === "shop" || r === "dealer")) return "direct";
  return r;
}
function _authorRole(p) {
  if (p.authorRole) return p.authorRole;
  if (p.db) return "user";
  // 예시 글: 게시판·이름으로 추정
  if (p.board === "제주상점") return "shop";
  if (p.board === "특가공구") return "dealer";
  if (p.board === "부동산" && /공인|부동산|중개|토지|하우스/.test(p.author || "")) return "realtor";
  return "user";
}
/* 닉네임 옆 작은 역할 표시 (상점·공구판매자·중개인·운영진) */
function roleMark(p) {
  var r = p && p.db ? (p.authorRole || "user") : authorRoleOf(p);
  var b = ROLE_BADGE[r]; if (!b || r === "direct") return "";
  return ' <span class="role-mark ' + b[2] + '" title="' + b[1] + '">' + b[0] + '</span>';
}
function roleBadgeHtml(p) {
  var b = ROLE_BADGE[authorRoleOf(p)]; if (!b) return "";
  return '<span class="role-badge ' + b[2] + '" title="' + b[1] + ' 회원">' + b[0] + ' ' + b[1] + '</span>';
}
function isMod() { var u = currentUser(); return !!(u && (u.role === "admin" || u.role === "staff")); }
function isMyPost(p) {
  var u = currentUser();
  if (p && p.db) return !!(u && u.id && p.authorId === u.id);
  return !!(u && p && p.id && p.id.charAt(0) === "u" && p.author === u.nick);
}

function deleteMyPost(id) {
  var posts = JI.get("posts", []);
  var target = null;
  for (var i = 0; i < posts.length; i++) if (posts[i].id === id) target = posts[i];
  if (!target || !isMyPost(target)) { alert("삭제 권한이 없습니다."); return false; }
  JI.set("posts", posts.filter(function (p) { return p.id !== id; }));
  // 딸린 댓글도 정리
  var cm = JI.get("comments", {});
  if (cm[id]) { delete cm[id]; JI.set("comments", cm); }
  return true;
}

/* 댓글: postId + index 로 지정 */
function isMyComment(c) {
  var u = currentUser();
  return !!(u && c && c.author === u.nick);
}
function updateMyComment(postId, idx, text) {
  var cm = JI.get("comments", {});
  var list = cm[postId];
  if (!list || !list[idx] || !isMyComment(list[idx])) { alert("수정 권한이 없습니다."); return false; }
  list[idx].text = text;
  list[idx].edited = true;
  JI.set("comments", cm);
  return true;
}
function deleteMyComment(postId, idx) {
  var cm = JI.get("comments", {});
  var list = cm[postId];
  if (!list || !list[idx] || !isMyComment(list[idx])) { alert("삭제 권한이 없습니다."); return false; }
  list.splice(idx, 1);
  if (!list.length) delete cm[postId];
  JI.set("comments", cm);
  return true;
}

/* ── 승인제 게시판 (특가공구·제주상점) ──
   관리자가 admin/ 콘솔에서 요청을 승인하면 ji_approved_sellers 에 이메일이 추가됩니다. */
var RESTRICTED_BOARDS = ["특가공구", "제주상점"];

/* 이 게시판이 승인이 필요한 게시판인지 */
function isRestrictedBoard(board) {
  return RESTRICTED_BOARDS.indexOf(board) > -1;
}

/* 내가 이 게시판에 승인된 판매자/상점 회원인지 */
function isApprovedSeller(board) {
  var u = currentUser();
  if (!u) return false;
  // 서버 역할: 제주상점은 상점판매자, 특가공구는 공구판매자 (관리자·스텝은 모두 가능)
  if (u.role === "admin" || u.role === "staff") return true;
  if (board === "제주상점" && u.role === "shop") return true;
  if (board === "특가공구" && u.role === "dealer") return true;
  var approved = JI.get("approved_sellers", {});
  return (approved[board] || []).indexOf(u.email) > -1;
}

/* 내가 이 게시판에 보낸 가장 최근 요청 (없으면 null) */
function mySellerRequest(board) {
  var u = currentUser();
  if (!u) return null;
  var reqs = JI.get("seller_requests", []);
  var mine = reqs.filter(function (r) { return r.email === u.email && r.board === board; });
  return mine.length ? mine[mine.length - 1] : null;
}

/* 관리자에게 요청 전송 (localStorage에 저장 — 실제 서비스에선 서버로 전달) */
function sendSellerRequest(board, message, details) {
  var u = currentUser();
  if (!u) return null;
  var reqs = JI.get("seller_requests", []);
  var req = {
    id: "req" + Date.now(),
    board: board, email: u.email, nick: u.nick, region: u.region,
    message: message, details: details || null, date: new Date().toISOString().slice(0, 10),
    status: "pending"
  };
  reqs.push(req);
  JI.set("seller_requests", reqs);
  return req;
}

/* ── 게시글 데이터 접근 ── */
/* 회원이 쓴 글: 서버에 저장된 글(캐시) + 예전에 이 브라우저에만 저장된 글 */
function dbPosts() { return JI.get("dbposts", []); }
function localPosts() { return dbPosts().concat(JI.get("posts", [])); }
/* 좋아요: 서버에서 받은 실제 숫자 (window._JL 에 잠깐 보관) */
function _likeCache() { if (!window._JL) window._JL = { n: JI.get("dblikes", {}), mine: JI.get("mylikes", []) }; return window._JL; }
function realLikes(id) { return _likeCache().n[id] || 0; }
function likedByMe(id) { return _likeCache().mine.indexOf(id) > -1; }
function isUserPost(p) { return !!(p && (p.db || (p.id && p.id.charAt(0) === "u"))); }
function allPosts() {
  return localPosts().concat(SEED_POSTS);
}
function findPost(id) {
  if (id === "n1") return NOTICE;
  var all = allPosts();
  for (var i = 0; i < all.length; i++) if (all[i].id === id) return all[i];
  return null;
}
function addViews(id) {
  var v = JI.get("views", {});
  v[id] = (v[id] || 0) + 1;
  JI.set("views", v);
  return v[id];
}
/* ── 빈 게시판 안내 (첫 글 유도) ──
   그 게시판에 글이 하나도 없으면 '첫 글 올리기' 안내, 글은 있는데 필터에 안 맞으면 짧은 안내 */
function _josa(w, a, b) { var c = (w || "").charCodeAt((w || "").length - 1); return (c >= 0xAC00 && c <= 0xD7A3 && (c - 0xAC00) % 28) ? a : b; }
// 말머리별 색 (공지는 빨강 계열이라 겹치지 않게)
var HEAD_CLS = { "h-info": ["정보", "꿀팁", "행정", "쇼핑·택배", "집 관리", "학교", "방과후·학원", "농어촌유학", "병원·약국", "먹거리"],
  "h-ask": ["질문", "집·이사", "아이·학교", "병원·건강", "일·돈", "생활"],
  "h-review": ["후기", "고민", "마음 건강"],
  "h-share": ["나눔", "바다", "오름·숲길", "운동", "체험"],
  "h-free": ["자유", "일상", "인사", "취미"],
  "h-news": ["뉴스", "공고", "날씨·재난", "교통", "동네소식"],
  "h-place": ["맛집·카페", "가볼 만한 곳"],
  "done": ["해결"] };
function headCls(h) { for (var k in HEAD_CLS) if (HEAD_CLS[k].indexOf(h) > -1) return k; return "region"; }
/* 글쓰기 주소 — 승인제 게시판(제주상점·특가공구)은 승인 전이면 '상점 등록·공구 신청' 양식으로 바로 (상단 버튼과 같게) */
function writeHref(board) {
  if (board && typeof isRestrictedBoard === "function" && isRestrictedBoard(board) && !isApprovedSeller(board)) return "seller-request.html?board=" + encodeURIComponent(board);
  return "write.html" + (board ? "?board=" + encodeURIComponent(board) : "");
}
/* 작은 창 (쪽지·알림 내용 보기 등) — 바깥을 눌렀다 뗄 때·Esc 로 닫힘 */
function jiModal(html) {
  jiModalClose();
  var o = document.createElement("div"); o.className = "jm-ov"; o.id = "jm-ov";
  o.innerHTML = '<div class="jm-box" role="dialog" aria-modal="true"><button type="button" class="jm-x" aria-label="닫기" onclick="jiModalClose()">✕</button>' + html + '</div>';
  var down = false;
  o.addEventListener("mousedown", function (e) { down = e.target === o; });
  o.addEventListener("click", function (e) { if (e.target === o && down) jiModalClose(); });
  document.body.appendChild(o); document.body.style.overflow = "hidden";
  return o.querySelector(".jm-box");
}
function jiModalClose() { var o = document.getElementById("jm-ov"); if (o) { o.remove(); document.body.style.overflow = ""; } }
document.addEventListener("keydown", function (e) { if (e.key === "Escape") jiModalClose(); });
function emptyInvite(board, noun) {
  noun = noun || "글";
  var has = board && allPosts().some(function (p) { return p.board === board; });
  if (has) return '<div class="ji-empty f">조건에 맞는 ' + noun + _josa(noun, "이", "가") + ' 없어요. 필터나 검색어를 바꿔 보세요.</div>';
  var href = writeHref(board);
  return '<div class="ji-empty"><span class="je-ico">🌱</span><b>아직 첫 ' + noun + _josa(noun, "이", "가") + ' 없어요</b>' +
    '<p>제주이음은 이제 막 문을 열었어요. 첫 ' + noun + _josa(noun, "을", "를") + ' 올려 주시면 이 자리에 가장 먼저 보여요. 등록은 무료예요.</p>' +
    '<a class="btn primary" href="' + href + '">✏️ 첫 ' + noun + ' 올리기</a></div>';
}
function viewsOf(p) {
  var v = JI.get("views", {});
  return (p.views || 0) + (v[p.id] || 0);
}
function fmtDate(d) { return d ? d.slice(5).replace("-", ".") : ""; }

/* ── 레이아웃 주입 ── */
var LOGOMARK = '<svg class="logomark" viewBox="0 0 120 100" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M30 54.4V74H90V56.8M90 40.8V12H30V38.4" stroke="currentColor" stroke-width="4.4"/><path d="M6 64 C20 58 30 44 44 36 C52 32 56 44 60 52 C64 60 74 60 84 52 C92 46 100 47 114 54" stroke="currentColor" stroke-width="4.6" stroke-linecap="round"/><circle cx="73" cy="29" r="6" fill="#F28A2E"/></svg>';

(function () {
  if (document.body.hasAttribute("data-admin")) return; /* 관리자 콘솔은 사이트 머리·꼬리말 없이 */
  var active = document.body.dataset.active || "";
  var user = currentUser();

  /* 드롭다운 한 묶음: [제목, [[이름, 주소], ...]] */
  function ddGroup(label, links, cls) {
    return '<div class="dd-group"><div class="dd-label">' + label + '</div><div class="dd-grid' + (cls ? " " + cls : "") + '">' +
      links.map(function (l) { return '<a href="' + l[1] + '">' + l[0] + "</a>"; }).join("") + "</div></div>";
  }
  function boardLinks(names) {
    return names.map(function (n) { return [n, "community.html?board=" + encodeURIComponent(n)]; });
  }

  var menus = [
    { id: "guide", label: "제주살이 가이드", href: "guide.html", match: ["guide", "article"],
      dd: ddGroup("상황별로 보기", [["이주 고민 중", "guide.html?stage=고민"], ["한달살기 준비", "guide.html?stage=한달살기"],
            ["막 이사 왔어요", "guide.html?stage=정착"], ["제주 사는 도민", "guide.html?stage=도민"]]) +
          ddGroup("주제별로 보기", [["동네 고르기", "guide.html?cat=동네 고르기"], ["계절 생활", "guide.html?cat=계절 생활"],
            ["집·생활", "guide.html?cat=집·생활"], ["아이랑 제주", "guide.html?cat=아이랑 제주"],
            ["일·돈", "guide.html?cat=일·돈"], ["마을·관계", "guide.html?cat=마을·관계"]]) },
    { id: "stay", label: "한달살기·이주", href: "stay.html" },
    { id: "school", label: "학교 연계 집", href: "school.html" },
    { id: "realestate", label: "부동산", href: "realestate.html",
      dd: ddGroup("부동산", [["매물 보기", "realestate.html"], ["매물 등록", "write.html?board=부동산"]], "auto") },
    { id: "trade", label: "생활·장터", href: "trade.html", match: ["jobs", "market", "shops", "clubs", "deals", "festivals"],
      dd: ddGroup("이웃과 나누기", [["전체 한눈에", "trade.html"], ["구인구직", "jobs.html"], ["중고사고팔기", "market.html"],
            ["제주상점", "shops.html"], ["동호회", "clubs.html"], ["특가공구", "deals.html"], ["축제정보", "festivals.html"]]) },
    { id: "community", label: "동네 커뮤니티", href: "community.html",
      dd: ddGroup("주제 게시판", boardLinks(["자유게시판", "질문하기", "최신뉴스", "생활정보", "취미·여행", "교육", "건강웰빙"])) +
          ddGroup("지역 게시판", boardLinks(["제주북쪽", "제주동쪽", "제주서쪽", "제주남쪽"])) },
    { id: "tools", label: "생활도구", href: "tools.html" },
    { id: "contact", label: "문의·제보", href: "contact.html" }
  ];

  /* 휴대폰 전용 메뉴 5개: 부동산은 생활·장터로, 생활도구·문의제보는 커뮤니티로 묶음 */
  var M_MENU = [
    ["가이드", "guide.html", ["guide", "article"]],
    ["한달살기", "stay.html", ["stay"]],
    ["학교 연계", "school.html", ["school"]],
    ["생활·장터", "trade.html", ["trade", "realestate", "jobs", "market", "shops", "clubs", "deals", "festivals"]],
    ["커뮤니티", "community.html", ["community", "tools", "contact"]]
  ];
  var gnbMobile = '<nav class="gnb-m" aria-label="메뉴">' + M_MENU.map(function (m) {
    var on = m[2].indexOf(active) > -1;
    return '<a href="' + m[1] + '"' + (on ? ' class="on" aria-current="page"' : '') + '>' + m[0] + '</a>';
  }).join("") + '</nav>';
  var gnbItems = menus.map(function (m) {
    var on = active === m.id || (m.match && m.match.indexOf(active) > -1);
    return '<div class="gnb-item' + (on ? " active" : "") + (m.accent ? " accent" : "") + '">' +
      '<a href="' + m.href + '">' + m.label + (m.dd ? ' <span class="caret">▾</span>' : "") + "</a>" +
      (m.dd ? '<div class="dropdown' + (m.dd.indexOf("dd-grid auto") > -1 ? " fit" : "") + '">' + m.dd + "</div>" : "") + "</div>";
  }).join("");

  var util = user
    ? '<a href="profile.html" class="me-link" title="내 정보' + (ROLE_BADGE[user.role] ? ' · ' + ROLE_LABEL[user.role] : '') + '"><span class="me-av">' + avatarHtml(26) + (ROLE_BADGE[user.role] ? '<i class="me-role" title="' + ROLE_LABEL[user.role] + '">' + ROLE_BADGE[user.role][0] + '</i>' : '') + '</span>' +
      '<span class="me-nick">' + user.nick + '</span><span class="me-region">' + user.region + '</span></a>' +
      '<a class="btn soft hb-out" href="#" onclick="logout();return false">로그아웃</a>' +
      '<a class="btn primary hb-write" href="write.html"><span class="hb-ico" aria-hidden="true">✏️</span>글쓰기</a>'
    : '<a class="btn soft" href="login.html">로그인</a><a class="btn primary" href="signup.html">회원가입</a>';

  var top =
    '<header class="site">' +
      '<div class="header-inner">' +
        '<a href="index.html" class="logo" aria-label="제주이음 홈"><img class="logo-img" src="assets/logo-header.png?v=1" alt="제주이음" width="652" height="139"></a>' +
        '<div class="search"><span class="s-ico" aria-hidden="true"><svg viewBox="0 0 20 20" width="17" height="17"><circle cx="8.5" cy="8.5" r="6" fill="none" stroke="currentColor" stroke-width="2"/><path d="m13 13 4.5 4.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></span>' +
          '<input type="text" id="gsearch" placeholder="태풍 대비, 신구간, 소아과… 제주 생활을 찾아보세요"><button type="button" onclick="goSearch()">검색</button></div>' +
        '<div class="header-actions"><button type="button" class="hd-share" onclick="JIShare.open()" aria-label="이 페이지 공유하기" title="공유하기">' + SHARE_ICO + '<span>공유</span></button>' + util + '</div>' +
      '</div>' +
      '<nav class="gnb"><div class="gnb-inner">' + gnbItems + '</div></nav>' +
      gnbMobile +
    '</header>';

  var foot =
    '<footer class="site">' +
      '<div class="footer-top">' +
        '<div class="footer-brand">' +
          '<div class="fb-logo"><img class="fb-img" src="assets/logo-footer.png?v=1" alt="제주이음" width="700" height="139"></div>' +
          '<p>제주에 살고 있거나 살아보려는 사람들을 위한 생활 정보 채널이자 동네 커뮤니티입니다. ' +
          '모든 가이드에는 업데이트 날짜와 출처를 적습니다.</p>' +
          '<a class="fb-yt" href="' + SITE_CFG.youtube + '" target="_blank" rel="noopener">▶ 유튜브 제주몽</a>' +
          '<br><a class="fb-yt fb-about" href="about.html">👋 운영자 소개</a>' +
        '</div>' +
        '<div class="footer-col"><h4>제주살이 정보</h4>' +
          '<a href="guide.html">제주살이 가이드</a>' +
          '<a href="stay.html">한달살기·이주 준비</a>' +
          '<a href="school.html">학교 연계 집</a>' +
          '<a href="tools.html">생활도구</a>' +
          '<a href="festivals.html">축제정보</a>' +
          '<a href="info/index.html">제주 생활 정보 모음</a>' +
          '<a href="community.html">동네 커뮤니티</a>' +
        '</div>' +
        '<div class="footer-col"><h4>부동산·장터</h4>' +
          '<a href="realestate.html">부동산 매물</a>' +
          '<a href="jobs.html">구인구직</a>' +
          '<a href="market.html">중고사고팔기</a>' +
          '<a href="shops.html">제주상점</a>' +
        '</div>' +
        '<div class="footer-col"><h4>참여·안내</h4>' +
          '<a href="contact.html">문의·제보</a>' +
          '<a href="contact.html?type=' + encodeURIComponent("정보 정정 요청") + '">정보 정정 요청</a>' +
          '<a href="contact.html?type=' + encodeURIComponent("입점·제휴 문의") + '">입점·제휴 문의</a>' +
          '<a href="about.html#principles">정보 운영 원칙</a>' +
        '</div>' +
      '</div>' +
      '<div class="footer-bottom"><div class="footer-inner">' +
        '<div>© 2026 제주이음 · 제주특별자치도 제주시</div>' +
        '<div class="footer-links">' +
          '<a href="terms.html">이용약관</a>' +
          '<a href="privacy.html"><b>개인정보처리방침</b></a>' +
          '<a href="contact.html?type=' + encodeURIComponent("입점·제휴 문의") + '">제휴문의</a>' +
        '</div>' +
      '</div></div>' +
    '</footer>';

  document.body.insertAdjacentHTML("afterbegin", top);
  document.body.insertAdjacentHTML("beforeend", foot);

  /* 생활·장터 묶음 페이지: 헤더 아래 탭으로 서로 이동 */
  var TRADE_TABS = [["trade", "전체", "trade.html", "🧺"], ["realestate", "부동산", "realestate.html", "🏡", "m-only"], ["jobs", "구인구직", "jobs.html", "💼"],
    ["market", "중고사고팔기", "market.html", "📦"], ["shops", "제주상점", "shops.html", "🏪"], ["clubs", "동호회", "clubs.html", "🏄"],
    ["deals", "특가공구", "deals.html", "🍊"], ["festivals", "축제정보", "festivals.html", "🎉"]];
  var isTrade = TRADE_TABS.some(function (t) { return t[0] === active; });
  if (isTrade) {
    var sub = '<nav class="subnav' + (active === "realestate" ? " m-only-nav" : "") + '" aria-label="생활·장터 게시판"><div class="subnav-inner"><span class="subnav-l">생활·장터</span>' +
      TRADE_TABS.map(function (t) {
        var cls = [t[0] === active ? "on" : "", t[4] || ""].join(" ").trim();
        return '<a href="' + t[2] + '"' + (cls ? ' class="' + cls + '"' : "") + (t[0] === active ? ' aria-current="page"' : "") + '><span class="sn-i">' + t[3] + "</span>" + t[1] + "</a>";
      }).join("") + "</div></nav>";
    document.querySelector("header.site").insertAdjacentHTML("afterend", sub);
    var on = document.querySelector(".subnav a.on");
    if (on && window.innerWidth < 700) {   // 고른 탭이 화면 밖이면 보이게 (앞쪽 탭이면 맨 앞부터)
      var pn = on.parentNode, rel = on.getBoundingClientRect().left - pn.getBoundingClientRect().left + pn.scrollLeft;
      pn.scrollLeft = rel + on.offsetWidth > pn.clientWidth - 16 ? Math.max(0, rel - 40) : 0;
    }
    var cr = document.querySelector(".page-head .crumb");
    if (cr && active !== "trade" && active !== "realestate") cr.innerHTML = cr.innerHTML.replace('</a> ›', '</a> › <a href="trade.html">생활·장터</a> ›');
  }

  /* 휴대폰: 커뮤니티 묶음(게시판·생활도구·문의제보) 탭 */
  if (["community", "tools", "contact"].indexOf(active) > -1) {
    var CT = [["community", "게시판", "community.html", "💬"], ["tools", "생활도구", "tools.html", "🧰"], ["contact", "문의·제보", "contact.html", "✉️"]];
    document.querySelector("header.site").insertAdjacentHTML("afterend", '<nav class="subnav m-only-nav" aria-label="커뮤니티">' +
      '<div class="subnav-inner">' + CT.map(function (t) {
        return '<a href="' + t[2] + '"' + (t[0] === active ? ' class="on" aria-current="page"' : "") + '><span class="sn-i">' + t[3] + "</span>" + t[1] + "</a>";
      }).join("") + "</div></nav>");
  }

  var gs = document.getElementById("gsearch");
  if (gs) gs.addEventListener("keydown", function (e) { if (e.key === "Enter") goSearch(); });

  // 스크롤 시 헤더에 그림자
  var onScroll = function () {
    document.body.classList.toggle("scrolled", window.scrollY > 4);
  };
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();
})();

/* ── 검색: 커뮤니티 통합검색으로 이동 ── */
function goSearch() {
  var q = (document.getElementById("gsearch").value || "").trim();
  if (!q) { alert("검색어를 입력해주세요."); return; }
  /* 가이드 + 커뮤니티를 함께 보여주는 통합 검색 */
  location.href = "guide.html?q=" + encodeURIComponent(q);
}

/* ── 안내 (정적 페이지 미구현 항목) ── */
function info() {
  alert("준비 중인 페이지입니다.");
  return false;
}

/* ── 필터 칩: 단일 선택 + 카드/행 필터링 ──
   버튼에 data-filter="값", 대상에 data-tags="값1 값2" */
function chipFilter(el, scopeSel) {
  el.parentElement.querySelectorAll(".chip-btn").forEach(function (c) { c.classList.remove("on"); });
  el.classList.add("on");
  var val = el.dataset.filter || "all";
  var items = document.querySelectorAll(scopeSel + " [data-tags]");
  var shown = 0;
  items.forEach(function (it) {
    var ok = val === "all" || (" " + it.dataset.tags + " ").indexOf(" " + val + " ") > -1;
    it.style.display = ok ? "" : "none";
    if (ok) shown++;
  });
  var cnt = document.getElementById("shown-count");
  if (cnt) cnt.textContent = shown;
}

/* ── 지역 select 필터 (카드/행 공용) ── */
function selectFilter(sel, scopeSel) {
  var val = sel.value;
  document.querySelectorAll(scopeSel + " [data-region]").forEach(function (it) {
    it.style.display = (val === "all" || it.dataset.region === val) ? "" : "none";
  });
}

/* ── 동호회 가입 / 공구 참여 토글 ──
   버튼에 data-join="club-xx" data-kind="club|deal" data-on="..." data-off="..." 를 넣으면
   아래 위임 핸들러가 자동으로 처리합니다. (인라인 onclick 불필요) */
var JOIN_KEY = { club: "joined_clubs", deal: "joined_deals" };

function isJoined(kind, id) {
  return JI.get(JOIN_KEY[kind], []).indexOf(id) > -1;
}

function paintJoinBtn(btn) {
  var kind = btn.dataset.kind;
  var on = isJoined(kind, btn.dataset.join);
  btn.textContent = on ? (btn.dataset.on || "완료 ✓") : (btn.dataset.off || "신청");
  btn.classList.remove("primary", "accent", "ghost");
  btn.classList.add(on ? "ghost" : (kind === "deal" ? "accent" : "primary"));
}

/* 화면에 있는 모든 가입/참여 버튼 상태를 저장값에 맞춰 표시 */
function paintAllJoinBtns(root) {
  (root || document).querySelectorAll("[data-join][data-kind]").forEach(paintJoinBtn);
}

/* 클릭 위임: 문서 어디에 있는 버튼이든 동작 */
document.addEventListener("click", function (e) {
  var btn = e.target.closest("[data-join][data-kind]");
  if (!btn) return;
  e.preventDefault();
  e.stopPropagation();

  var kind = btn.dataset.kind;
  var id = btn.dataset.join;
  if (!requireLogin(kind === "club" ? "동호회 가입은 회원만 가능합니다." : "공구 참여는 회원만 가능합니다.")) return;

  var key = JOIN_KEY[kind];
  var list = JI.get(key, []);
  var idx = list.indexOf(id);
  if (idx > -1) list.splice(idx, 1); else list.push(id);
  JI.set(key, list);

  // 같은 항목의 버튼이 여러 곳에 있어도 함께 갱신
  document.querySelectorAll('[data-join="' + id + '"][data-kind]').forEach(paintJoinBtn);
});

/* ── 방문 기록 (관리자 콘솔 '방문 통계'용) ──
   개인정보 없이: 브라우저마다 무작위 번호 하나, 본 페이지, 들어온 곳(검색·SNS 이름), 휴대폰/PC 만 보냄.
   관리자 화면·관리자 계정·로봇·내 컴퓨터 테스트는 세지 않음 */
(function () {
  try {
    var api = (window.SITE_CFG || {}).apiUrl;
    if (!api || /\/admin\//.test(location.pathname) || /^(localhost|127\.)/.test(location.hostname)) return;
    if (navigator.webdriver || /bot|crawl|spider|slurp|headless|preview|lighthouse/i.test(navigator.userAgent)) return;
    var s = JI.get("session", null); if (s && s.role === "admin") return;
    var vid = "", nw = 0;
    try { vid = localStorage.getItem("ji_vid") || ""; } catch (e) {}
    if (!/^[a-z0-9]{16}$/.test(vid)) {
      vid = ""; for (var i = 0; i < 16; i++) vid += "abcdefghijklmnopqrstuvwxyz0123456789"[Math.floor(Math.random() * 36)];
      nw = 1; try { localStorage.setItem("ji_vid", vid); } catch (e) {}
    }
    // 들어온 곳: 이번 방문의 첫 페이지에서만 (사이트 안 이동은 빼고)
    var ua = navigator.userAgent;
    var os = /iPhone|iPad|iPod/.test(ua) ? "iOS" : /Android/.test(ua) ? "Android" : /Windows/.test(ua) ? "Windows" : /Macintosh|Mac OS X/.test(ua) ? "Mac" : "기타";
    var br = /NAVER\(inapp|NAVER/.test(ua) ? "네이버앱" : /KAKAOTALK/i.test(ua) ? "카카오톡" : /Instagram/.test(ua) ? "인스타그램" : /FBAN|FBAV/.test(ua) ? "페이스북" :
      /SamsungBrowser/.test(ua) ? "삼성인터넷" : /Whale/.test(ua) ? "웨일" : /Edg\//.test(ua) ? "엣지" : /Firefox|FxiOS/.test(ua) ? "파이어폭스" :
      /CriOS|Chrome/.test(ua) ? "크롬" : /Safari/.test(ua) ? "사파리" : "기타";
    // 홈 화면에 추가한 아이콘으로 연 경우 (아이폰은 이때 브라우저 이름이 안 붙어요)
    try { if (navigator.standalone || (window.matchMedia && matchMedia("(display-mode: standalone)").matches)) br = "홈 화면 앱"; } catch (e) {}
    var ref = "", kw = "";
    var first = true; try { first = !sessionStorage.getItem("ji_sess"); sessionStorage.setItem("ji_sess", "1"); } catch (e) {}
    if (first) {
      var h = "", RQ = null; try { if (document.referrer) { var RU = new URL(document.referrer); h = RU.hostname.replace(/^www\.|^m\./, ""); RQ = RU.searchParams; } } catch (e) {}
      var P = new URLSearchParams(location.search);
      if (RQ && /naver|google|daum|bing|zum|yahoo/.test(h)) kw = RQ.get("query") || RQ.get("q") || RQ.get("p") || "";
      kw = P.get("utm_term") || kw;
      if (!h && /카카오톡|인스타그램|페이스북/.test(br)) h = br;
      ref = P.get("utm_source") || (!h ? "직접 방문" : /^(카카오톡|인스타그램|페이스북)$/.test(h) ? h : h.indexOf("jejuieum") > -1 || h === location.hostname ? "" :
        /naver/.test(h) ? "네이버" : /google/.test(h) ? "구글" : /daum/.test(h) ? "다음" : /kakao/.test(h) ? "카카오" : /zum/.test(h) ? "줌" :
        /instagram/.test(h) ? "인스타그램" : /facebook|fb\./.test(h) ? "페이스북" : /youtube|youtu\.be/.test(h) ? "유튜브" :
        /band\.us/.test(h) ? "밴드" : /bing/.test(h) ? "빙" : /threads/.test(h) ? "스레드" : h);
    }
    var path = location.pathname.replace(/\/index\.html$/, "/") || "/";
    var id = new URLSearchParams(location.search).get("id"); if (id) path += "?id=" + id.slice(0, 40);
    var body = JSON.stringify({ vid: vid, nw: nw, path: path.slice(0, 120), title: (document.title || "").replace(/\s*[—|-]\s*제주이음\s*$/, "").slice(0, 80),
      ref: ref.slice(0, 40), kw: kw.slice(0, 60), os: os, br: br, dev: /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) ? "m" : "p" });
    setTimeout(function () {
      fetch(api.replace(/\/?$/, "/") + "?a=hit", { method: "POST", headers: { "Content-Type": "text/plain;charset=UTF-8" }, body: body, keepalive: true }).catch(function () {});
    }, 600);
  } catch (e) {}
})();

/* 로그인 안 한 채 '글쓰기'를 누르면 지금 페이지에서 바로 물어보기 — 취소하면 그 자리에 그대로 */
document.addEventListener("click", function (e) {
  var a = e.target.closest && e.target.closest('a[href^="write.html"]');
  if (!a || e.defaultPrevented || e.metaKey || e.ctrlKey) return;
  var u = currentUser(); if (u && u.id) return;
  e.preventDefault();
  if (confirm("글쓰기는 로그인 후 이용할 수 있어요.\n로그인 페이지로 이동할까요?"))
    location.href = "login.html?next=" + encodeURIComponent(a.getAttribute("href"));
});
