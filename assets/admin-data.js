/* 관리자 변경사항 반영 — 모든 페이지에서 다른 assets 스크립트 맨 뒤에 로드
   관리자 콘솔(admin/)에서 바꾼 내용(수정·삭제·조회수·좋아요·프리미엄·공지)을 사이트 전체에 적용합니다.
   - 기본 글(시드): ji_admin_ov 에 덮어쓸 값 저장
   - 회원 글: ji_posts 를 직접 수정
   - 관리자 공지: ji_notices */

var ALL_BOARDS = ["자유게시판", "질문하기", "최신뉴스", "생활정보", "취미·여행", "교육", "건강웰빙",
  "제주북쪽", "제주동쪽", "제주서쪽", "제주남쪽", "구인구직", "부동산", "중고사고팔기", "제주상점", "동호회", "특가공구", "축제정보"];
/* 부동산·제주상점·특가공구는 초기에는 유료 없이 모두 같은 조건으로 (업체가 많아지면 다시 넣을 예정) */
var PREMIUM_BOARDS = ["중고사고팔기", "동호회", "축제정보"];   // 구인구직도 초기에는 프리미엄 없음
var PREMIUM_DEFAULT_BOARDS = []; /* 관리자가 따로 정하지 않으면 상위 8개가 프리미엄 */
var EDIT_FIELDS = ["title", "content", "head", "price", "loc", "author", "period", "views", "likes", "premium"];
var REMOVED_SEEDS = [];

function adminOv() { return JI.get("admin_ov", {}); }
/* 사이트 코드에 들어 있는 공지들 (지금 공지 n1 + 지난 공지 보관함) */
function builtinNoticeBase() {
  var a = [];
  if (typeof NOTICE !== "undefined") a.push(NOTICE);
  if (typeof NOTICE_ARCHIVE !== "undefined") a = a.concat(NOTICE_ARCHIVE);
  return a;
}
function isBuiltinNotice(id) { return builtinNoticeBase().some(function (n) { return n.id === id; }); }

(function applyAdminOverrides() {
  var ov = adminOv();
  function apply(arr) {
    if (!arr) return;
    for (var i = arr.length - 1; i >= 0; i--) {
      var p = arr[i], o = ov[p.id];
      if (!o) continue;
      if (o.deleted) { if (REMOVED_SEEDS.indexOf(p) < 0) REMOVED_SEEDS.push(p); arr.splice(i, 1); continue; }
      EDIT_FIELDS.forEach(function (k) { if (o[k] !== undefined) p[k] = o[k]; });
    }
  }
  if (typeof SEED_POSTS !== "undefined") apply(SEED_POSTS);
  if (typeof TRADE_SEEDS !== "undefined") apply(TRADE_SEEDS);
  /* 사이트 코드에 넣은 공지(n1 · 지난 공지)에 관리자 콘솔 수정값 적용.
     공지 내용을 새로 바꾸면(rev 변경) 예전에 콘솔에서 고친 제목·본문은 쓰지 않음 */
  builtinNoticeBase().forEach(function (n) {
    var o = ov[n.id]; if (!o) return;
    var keepText = !n.rev || o.rev === n.rev;
    EDIT_FIELDS.concat(["target", "pinned", "off"]).forEach(function (k) {
      if (!keepText && (k === "title" || k === "content" || k === "head" || k === "author")) return;
      if (o[k] !== undefined) n[k] = o[k];
    });
  });
})();

/* ── 공지 ── */
function adminNotices() { return JI.get("notices", []); }
/* 모든 공지 — 공지 해제(off)된 지난 공지까지. 삭제한 것만 빠짐 */
function allNotices() {
  var ov = adminOv();
  var b = builtinNoticeBase().filter(function (n) { return !(ov[n.id] && ov[n.id].deleted); });
  b.forEach(function (n) { n.target = n.target || "커뮤니티"; });
  return adminNotices().concat(b);
}
/* 공지사항 목록용: 최신순 */
function noticeArchive() {
  return allNotices().slice().sort(function (a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : 0; });
}
/* board: 게시판 이름 (없으면 전체 공지만). 공지 해제된 것은 빼고, 고정 공지 먼저, 그다음 최신순 */
function noticesFor(board) {
  var isCommunity = !board || TRADE_BOARDS.indexOf(board) < 0;
  var list = allNotices().filter(function (n) {
    if (n.off) return false;
    return n.target === "전체" || (board && n.target === board) || (n.target === "커뮤니티" && isCommunity);
  });
  return list.sort(function (a, b) {
    if (!!b.pinned !== !!a.pinned) return b.pinned ? 1 : -1;
    return a.date < b.date ? 1 : a.date > b.date ? -1 : 0;
  });
}

/* findPost 가 관리자 공지·삭제된 글도 알도록 */
(function () {
  var base = findPost;
  findPost = function (id) {
    if (!id) return null;
    if (isBuiltinNotice(id) && adminOv()[id] && adminOv()[id].deleted) return null;
    var ns = allNotices();
    for (var i = 0; i < ns.length; i++) if (ns[i].id === id) return ns[i];
    return base(id);
  };
})();

/* ── 좋아요 ── */
(function () {
  var base = typeof likesOf === "function" ? likesOf : function (p) {
    var real = typeof realLikes === "function" ? realLikes(p.id) : 0;
    if (typeof isUserPost === "function" && isUserPost(p)) return real;   // 회원 글: 실제로 누른 수만
    var h = 2166136261, s = "like" + p.id;
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return ((h >>> 0) % 23) + (p.views > 300 ? 4 : 0) + real;
  };
  // 관리자가 숫자를 정한 예시 글은 그 숫자 (회원 글은 항상 실제 숫자)
  likesOf = function (p) { return p && !(typeof isUserPost === "function" && isUserPost(p)) && p.likes !== undefined && p.likes !== null && p.likes !== "" ? +p.likes : base(p); };
})();

/* ── 프리미엄 ── */
var _defaultPm = null;
function _defaultPremiumIds() {
  if (_defaultPm) return _defaultPm;
  _defaultPm = {};
  PREMIUM_DEFAULT_BOARDS.forEach(function (b) {
    var raw = localPosts().filter(function (p) { return p.board === b; })
      .concat((typeof TRADE_SEEDS !== "undefined" ? TRADE_SEEDS : []).filter(function (p) { return p.board === b; }));
    raw.slice(0, 8).forEach(function (p) { _defaultPm[p.id] = 1; });
  });
  return _defaultPm;
}
function isPremium(p) {
  if (!p || PREMIUM_BOARDS.indexOf(p.board) < 0) return false;
  var o = p.db ? adminOv()[p.id] : null;   // 서버 글의 프리미엄은 관리자 설정(admin_ov)에 저장
  if (o && o.premium !== undefined && o.premium !== null) return !!o.premium;
  if (p.premium !== undefined && p.premium !== null) return !!p.premium;
  return !!_defaultPremiumIds()[p.id];
}
/* 최신 글 먼저 (날짜 + 시각) */
function byRecent(a, b) {
  var x = (a.date || "") + (a.time || ""), y = (b.date || "") + (b.time || "");
  return x < y ? 1 : x > y ? -1 : 0;
}
/* 프리미엄 글을 앞으로 (순서는 그대로 유지) */
function premiumFirst(list) {
  return list.filter(isPremium).concat(list.filter(function (p) { return !isPremium(p); }));
}

/* ── 거래 게시판 상단 공지 띠 ── */
var PAGE_BOARD = { jobs: "구인구직", realestate: "부동산", market: "중고사고팔기", shops: "제주상점",
  clubs: "동호회", deals: "특가공구", festivals: "축제정보" };
function _escA(s) { var d = document.createElement("div"); d.textContent = s || ""; return d.innerHTML; }
function noticeStripHtml(n) {
  return '<div class="notice-strip"><span class="badge">공지</span>' +
    '<a href="view.html?id=' + encodeURIComponent(n.id) + '">' + _escA(n.title) + '</a>' +
    '<time>' + fmtDate(n.date) + '</time></div>';
}
(function () {
  var b = PAGE_BOARD[document.body.dataset.active || ""];
  if (!b) return;
  var main = document.querySelector("main.wrap");
  if (!main) return;
  var ns = noticesFor(b);
  if (ns.length) main.insertAdjacentHTML("afterbegin", ns.slice(0, 3).map(noticeStripHtml).join(""));
})();

/* ── 예시 게시글 처리 (SITE_CFG.samples) ──
   시드(SEED_POSTS·TRADE_SEEDS)는 화면 구성을 보여 주려고 넣은 예시 글입니다.
   "label": 커뮤니티·거래 화면 위에 안내를 붙이고, 글 보기에 '예시' 표시
   "hide" : 사이트 화면에서 모두 숨김 (관리자 콘솔에서는 계속 보임) */
(function () {
  var mode = (typeof SITE_CFG !== "undefined" && SITE_CFG.samples) || "label";
  if (typeof SEED_POSTS === "undefined") return;
  var sampleIds = {};
  SEED_POSTS.forEach(function (p) { p.sample = true; sampleIds[p.id] = 1; });
  if (typeof TRADE_SEEDS !== "undefined") TRADE_SEEDS.forEach(function (p) { p.sample = true; sampleIds[p.id] = 1; });
  var isAdmin = document.body && document.body.hasAttribute("data-admin");

  if (mode === "hide") {   // 예시 글을 사이트·관리자 콘솔 모두에서 지움 (운영자가 확인한 실제 정보 keep 만 남김)
    var keep = function (p) { return p.keep; };
    var a = SEED_POSTS.filter(keep); SEED_POSTS.length = 0; Array.prototype.push.apply(SEED_POSTS, a);
    if (typeof TRADE_SEEDS !== "undefined") { var b = TRADE_SEEDS.filter(keep); TRADE_SEEDS.length = 0; Array.prototype.push.apply(TRADE_SEEDS, b); }
    SEED_POSTS.forEach(function (p) { delete p.sample; });
    return;
  }
  if (isAdmin) return;
  if (mode !== "label") return;

  var BOARD_PAGES = ["home", "community", "trade", "jobs", "realestate", "market", "shops", "clubs", "deals", "festivals"];
  var active = document.body.dataset.active || "";
  var strip = function (msg) {
    return '<div class="sample-note" role="note"><span class="sn-b">미리보기</span><span>' + msg + '</span></div>';
  };
  function run() {
    var main = document.querySelector("main.wrap");
    if (!main) return;
    if (BOARD_PAGES.indexOf(active) > -1) {
      var msg = "정식 오픈 전이에요. 지금 보이는 게시글은 화면 구성을 보여 드리기 위한 <b>예시 글</b>이며 실제 매물·공고·가게가 아닙니다.";
      var anchor = active === "home" ? document.querySelector(".home-grid") : main.firstElementChild;
      if (anchor) anchor.insertAdjacentHTML("beforebegin", strip(msg));
    }
    if (/view\.html$/.test(location.pathname)) {
      var id = new URLSearchParams(location.search).get("id");
      if (id && sampleIds[id]) main.insertAdjacentHTML("afterbegin", strip("이 글은 화면 구성을 보여 드리기 위한 <b>예시 글</b>입니다. 실제 정보가 아니에요."));
    }
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", run); else run();
})();
