/* 거래 게시판 공용 카드 렌더러 — common.js, seed-trade.js 다음에 로드 */

function escHtml(s) {
  var d = document.createElement("div");
  d.textContent = s || "";
  return d.innerHTML;
}

/* 프리미엄(상위 8개) + 일반 목록을 두 섹션으로 나눠 그립니다.
   opts = { grid: 컨테이너 엘리먼트, list: 게시글 배열, card: function(post, isPremium) -> HTML,
            premiumCount: 8, emptyText: "..." } */
function renderSections(opts) {
  var grid = opts.grid;
  var list = opts.list;
  var n = opts.premiumCount === undefined ? 8 : opts.premiumCount;
  /* 프리미엄 여부는 관리자 설정(isPremium)을 따르고, 없으면 상위 n개 */
  var pmFn = typeof isPremium === "function" ? isPremium : function (p) { return list.indexOf(p) < n; };
  var pm = list.filter(pmFn);
  var gn = list.filter(function (p) { return !pmFn(p); });
  if (typeof byRecent === "function") gn.sort(byRecent);
  var html = "";

  if (!list.length) {
    grid.innerHTML = opts.emptyHtml || ('<p style="color:var(--muted);padding:24px">' + (opts.emptyText || "등록된 글이 없습니다.") + "</p>");
    renderPager(grid, 0);
    return;
  }

  /* 프리미엄 → 일반 순서로 한 줄로 세운 뒤 한 페이지(20개)만 그립니다 */
  var ordered = pm.concat(gn);
  var shown = pageSlice(ordered);
  var pmShown = shown.filter(function (p) { return pm.indexOf(p) > -1; });
  var gnShown = shown.filter(function (p) { return pm.indexOf(p) < 0; });

  if (pmShown.length) {
    html +=
      '<section class="pm-zone"><div class="sec-head"><h2><span class="pm-star">⭐</span>프리미엄 <span class="pm-badge">PREMIUM</span></h2>' +
      '<span class="sec-note">유료 상단 노출</span><span class="line"></span></div>' +
      '<div class="grid-cards">' + pmShown.map(function (p) { return opts.card(p, true); }).join("") + "</div></section>";
  }
  if (gnShown.length) {
    html +=
      '<div class="sec-head' + (pmShown.length ? ' sec-gap' : '') + '"><h2>' + (pm.length ? "일반 등록" : (opts.allLabel || "전체 등록")) + '</h2><span class="sec-note">' + gn.length + "건</span><span class=\"line\"></span></div>" +
      '<div class="grid-cards">' + gnShown.map(function (p) { return opts.card(p, false); }).join("") + "</div>";
  }
  grid.innerHTML = html;
  renderPager(grid, ordered.length);
}

/* ── 페이지 나누기 (한 페이지 20개) ──
   현재 페이지는 주소 끝 #p2 처럼 남겨서, 글을 보고 뒤로 오면 같은 페이지로 돌아옵니다.
   필터를 바꿔 목록이 달라지면 1페이지로 돌아갑니다. */
var LIST_PER = 20;
var LIST_PAGE = (function () { var m = /^#p(\d+)$/.exec(location.hash || ""); return m ? +m[1] : 1; })();
var _listKey = null;

function pageSlice(list) {
  var key = list.map(function (p) { return p.id; }).join(",");
  if (_listKey !== null && key !== _listKey) {
    LIST_PAGE = 1;
    if (location.hash) history.replaceState(null, "", location.pathname + location.search);
  }
  _listKey = key;
  var pages = Math.max(1, Math.ceil(list.length / LIST_PER));
  if (LIST_PAGE > pages) LIST_PAGE = pages;
  if (LIST_PAGE < 1) LIST_PAGE = 1;
  return list.slice((LIST_PAGE - 1) * LIST_PER, LIST_PAGE * LIST_PER);
}

/* 목록(grid) 바로 아래에 페이지 번호를 그립니다 */
function renderPager(grid, total) {
  if (typeof grid === "string") grid = document.getElementById(grid);
  var box = grid.nextElementSibling;
  if (!box || !box.classList.contains("list-pager")) {
    box = document.createElement("div");
    box.className = "pagination list-pager";
    grid.parentNode.insertBefore(box, grid.nextSibling);
  }
  var pages = Math.ceil(total / LIST_PER);
  if (pages <= 1) { box.innerHTML = ""; box.style.display = "none"; return; }
  box.style.display = "";
  var cur = LIST_PAGE, html = "";
  var from = Math.max(1, cur - 2), to = Math.min(pages, from + 4);
  from = Math.max(1, to - 4);
  html += cur > 1 ? '<a href="#p' + (cur - 1) + '" data-pg="' + (cur - 1) + '" aria-label="이전 페이지">‹</a>' : '';
  for (var i = from; i <= to; i++) html += '<a href="#p' + i + '" data-pg="' + i + '"' + (i === cur ? ' class="on" aria-current="page"' : '') + '>' + i + '</a>';
  html += cur < pages ? '<a href="#p' + (cur + 1) + '" data-pg="' + (cur + 1) + '" aria-label="다음 페이지">›</a>' : '';
  box.innerHTML = html;
  box.onclick = function (e) {
    var a = e.target.closest("a[data-pg]");
    if (!a) return;
    e.preventDefault();
    LIST_PAGE = +a.dataset.pg;
    history.replaceState(null, "", LIST_PAGE > 1 ? "#p" + LIST_PAGE : location.pathname + location.search);
    if (typeof render === "function") render();
    var top = document.querySelector(".filter-bar") || grid;
    window.scrollTo({ top: top.getBoundingClientRect().top + window.pageYOffset - 90, behavior: "smooth" });
  };
}

/* 프리미엄 안내 배너 HTML */
function premiumBanner(unitLabel) {
  return '<div class="pm-info">⭐ <b>프리미엄</b>은 유료로 상단에 고정 노출되는 ' + unitLabel +
    '입니다. 같은 조건이면 프리미엄이 항상 먼저 보입니다.' +
    '<a href="#" onclick="alert(\'프리미엄 등록 문의는 광고문의 페이지에서 접수됩니다.\');return false">프리미엄 등록 문의 →</a></div>';
}
