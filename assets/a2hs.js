/* 제주이음 — 휴대폰 첫 방문 안내 팝업: 홈 화면에 추가하는 방법 + 알림 받기
   · 휴대폰에서만, 홈 화면 앱으로 연 경우·관리자/로그인/글쓰기 화면에서는 띄우지 않음
   · '확인했어요'(1시간 뒤 다시) / '다시 보지 않기'(영구) — 이 기기 브라우저에만 기억 */
(function () {
  var ME = document.currentScript && document.currentScript.src;
  function ls(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } }
  var ua = navigator.userAgent || "";
  var ios = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  var android = /Android/i.test(ua);
  var inApp = /KAKAOTALK|NAVER\(inapp|Instagram|FBAN|FBAV|Line\//i.test(ua);
  var standalone = window.navigator.standalone === true || (window.matchMedia && matchMedia("(display-mode: standalone)").matches);
  var deferred = null;   // 안드로이드 크롬의 '설치' 창
  window.addEventListener("beforeinstallprompt", function (e) { e.preventDefault(); deferred = e; var b = document.getElementById("a2hs-install"); if (b) b.hidden = false; });

  function blocked() {
    if (!(ios || android) || standalone) return true;
    if (/\/admin\/|\/(login|signup|write|find-pw|reset)\.html$/.test(location.pathname)) return true;
    if (ls("ji_a2hs_never") === "1") return true;
    return Date.now() < (+ls("ji_a2hs_until") || 0);
  }

  var SHARE = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v12"/><path d="m8 7 4-4 4 4"/><path d="M6 11H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1"/></svg>';
  var DOTS = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg>';

  var STEPS = {
    ios: '<ol class="a2-st"><li>Safari 아래쪽(또는 위쪽)의 <b>공유 버튼</b> ' + SHARE + ' 을 누르세요.</li><li>목록을 내려 <b>홈 화면에 추가</b>를 누르세요.</li><li>오른쪽 위 <b>추가</b>를 누르면 홈 화면에 제주이음 아이콘이 생겨요.</li></ol>',
    android: '<ol class="a2-st"><li>크롬 오른쪽 위 <b>메뉴</b> ' + DOTS + ' 를 누르세요.</li><li><b>홈 화면에 추가</b> 또는 <b>앱 설치</b>를 누르세요.</li><li><b>설치</b>를 누르면 홈 화면에 제주이음 아이콘이 생겨요.</li></ol>'
  };
  var INAPP = '<ol><li>지금은 카카오톡·네이버 같은 앱 안의 브라우저로 열려 있어요.</li><li>화면 위나 아래의 ' + DOTS + ' 메뉴에서 <b>다른 브라우저로 열기</b>를 눌러 주세요.</li><li>' + (ios ? 'Safari' : '크롬') + '로 열린 뒤 이 안내를 따라 홈 화면에 추가하면 됩니다.</li></ol>';
  /* 아이폰·안드로이드 탭 (지금 쓰는 기기 쪽을 먼저 보여 줌) */
  function steps() {
    var cur = ios ? "ios" : "android";
    return (inApp ? '<div class="a2-warn">' + INAPP + '</div>' : '') +
      '<div class="a2-tabs" role="tablist"><button type="button" role="tab" data-t="ios"' + (cur === "ios" ? ' class="on" aria-selected="true"' : '') + '>아이폰</button><button type="button" role="tab" data-t="android"' + (cur === "android" ? ' class="on" aria-selected="true"' : '') + '>안드로이드</button></div>' +
      '<div class="a2-pane">' + STEPS[cur] + '</div>';
  }

  function show() {
    if (document.getElementById("ji-a2hs") || blocked()) return;
    var st = document.createElement("style");
    st.textContent =
      "#ji-a2hs{position:fixed;inset:0;z-index:9995;display:flex;align-items:flex-end;justify-content:center;background:rgba(10,22,40,.45);animation:a2f .2s ease}" +
      "#ji-a2hs .a2-box{width:100%;max-width:480px;max-height:88vh;overflow:auto;background:#fff;color:#16233a;border-radius:22px 22px 0 0;padding:18px 18px calc(12px + env(safe-area-inset-bottom));box-shadow:0 -10px 40px rgba(10,25,50,.25);animation:a2u .28s ease;font-size:14.5px;line-height:1.55}" +
      "#ji-a2hs .a2-hd{display:flex;align-items:center;gap:12px;margin-bottom:12px}#ji-a2hs .a2-hd img{width:48px;height:48px;border-radius:13px;flex:none;box-shadow:0 2px 8px rgba(0,0,0,.12)}" +
      "#ji-a2hs h2{margin:0;font-size:19px;font-weight:800;letter-spacing:-.03em;line-height:1.35}#ji-a2hs .a2-hd p{margin:2px 0 0;font-size:13.5px;color:#5b6b80}" +
      "#ji-a2hs h3{margin:13px 0 6px;font-size:15px;font-weight:800;color:#0d2440}" +
      "#ji-a2hs .a2-tabs{display:flex;gap:6px;margin:0 0 8px}#ji-a2hs .a2-tabs button{flex:1;padding:9px;border-radius:12px;background:#eef2f6;color:#4a5a70;font-weight:700;font-size:14px}#ji-a2hs .a2-tabs button.on{background:#0d2440;color:#fff}" +
      "#ji-a2hs .a2-warn{margin:0 0 8px;padding:10px 14px;background:#fff1f0;border-radius:14px;font-size:13.5px}#ji-a2hs .a2-warn ol{margin:0;padding-left:18px;list-style:decimal}" +
      "#ji-a2hs .a2-st{margin:0;padding:10px 14px 10px 32px;background:#f3f7fb;border-radius:14px;list-style:decimal}#ji-a2hs .a2-st li{margin:3px 0}#ji-a2hs .a2-st svg{vertical-align:-3px;color:#2f80ed}" +
      "#ji-a2hs .a2-nt{margin:0;padding:10px 14px;background:#fff7ec;border-radius:14px;font-size:14px}#ji-a2hs .a2-nt ul{margin:4px 0 0;padding-left:18px;list-style:disc}#ji-a2hs .a2-nt small{display:block;margin-top:6px;color:#8a6a3d;font-size:12.5px}" +
      "#ji-a2hs .a2-bt{display:flex;flex-direction:column;gap:8px;margin-top:14px}#ji-a2hs button{font:inherit;border:0;border-radius:14px;padding:13px;font-weight:800;cursor:pointer}" +
      "#ji-a2hs .a2-ok{background:#2f80ed;color:#fff}#ji-a2hs .a2-in{background:#0d2440;color:#fff}#ji-a2hs .a2-sub{display:flex;gap:8px}#ji-a2hs .a2-sub button{flex:1;background:#eef2f6;color:#4a5a70;font-weight:700;font-size:14px;padding:11px}" +
      "@keyframes a2f{from{opacity:0}to{opacity:1}}@keyframes a2u{from{transform:translateY(40px)}to{transform:none}}";
    document.head.appendChild(st);
    var icon = ME ? new URL("icons/icon-192.png", ME).href : "assets/icons/icon-192.png";
    var w = document.createElement("div"); w.id = "ji-a2hs"; w.setAttribute("role", "dialog"); w.setAttribute("aria-modal", "true"); w.setAttribute("aria-label", "홈 화면에 추가하는 방법");
    w.innerHTML = '<div class="a2-box">' +
      '<div class="a2-hd"><img src="' + icon + '" alt=""><div><h2>제주이음을 앱처럼 써 보세요</h2><p>홈 화면에 추가하면 아이콘 한 번으로 바로 열려요.</p></div></div>' +
      '<h3>홈 화면에 추가하는 방법</h3>' + steps() +
      '<h3>알림도 받을 수 있어요</h3><div class="a2-nt">알림을 켜 두면 이런 소식을 휴대폰으로 받아요.<ul><li>관심 있는 지원 프로그램의 모집 시작 (한달살기·이주 화면의 🔔 새 공고 알림)</li><li>로그인하면 내 글에 달린 댓글·좋아요와 새 쪽지</li></ul>' +
        (ios ? '<small>아이폰은 홈 화면에 추가한 아이콘으로 열어야 알림을 받을 수 있어요. (iOS 16.4 이상)</small>' : '<small>알림은 언제든 끌 수 있고, 비용은 들지 않아요.</small>') + '</div>' +
      '<div class="a2-bt"><button type="button" class="a2-in" id="a2hs-install" hidden>지금 홈 화면에 추가하기</button><button type="button" class="a2-ok">확인했어요</button>' +
        '<div class="a2-sub"><button type="button" data-k="never">다시 보지 않기</button></div></div></div>';
    document.body.appendChild(w);
    if (deferred) document.getElementById("a2hs-install").hidden = false;
    w.querySelectorAll(".a2-tabs button").forEach(function (b) {
      b.onclick = function () {
        w.querySelectorAll(".a2-tabs button").forEach(function (x) { x.classList.remove("on"); x.removeAttribute("aria-selected"); });
        b.classList.add("on"); b.setAttribute("aria-selected", "true"); w.querySelector(".a2-pane").innerHTML = STEPS[b.dataset.t];
      };
    });
    var close = function (k) {
      if (k === "never") ls("ji_a2hs_never", "1");
      else ls("ji_a2hs_until", String(Date.now() + 3600e3));   // '확인했어요'(바깥 누름 포함)는 1시간 뒤 다시
      if (ios) ls("ji_push_ios", String(Date.now() + 7 * 864e5));   // 아이폰: 같은 내용의 아래쪽 알림 띠는 일주일 쉼
      w.remove();
    };
    w.querySelector(".a2-ok").onclick = function () { close("ok"); };
    w.querySelectorAll(".a2-sub button").forEach(function (b) { b.onclick = function () { close(b.dataset.k); }; });
    w.addEventListener("click", function (e) { if (e.target === w) close("ok"); });
    document.getElementById("a2hs-install").onclick = function () {
      if (!deferred) return; deferred.prompt();
      deferred.userChoice.then(function (r) { deferred = null; if (r && r.outcome === "accepted") { ls("ji_a2hs_never", "1"); w.remove(); } });
    };
  }
  window.JI_A2HS = { show: function () { ls("ji_a2hs_until", "0"); ls("ji_a2hs_never", "0"); show(); } };
  var go = function () { setTimeout(show, 900); };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", go); else go();
})();
