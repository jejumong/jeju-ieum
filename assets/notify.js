/* ============================================================
   제주이음 · 무료 자동 알림 (문자·전화 비용 없음)

   ① 브라우저 푸시 알림 — OneSignal 무료 웹 푸시
      - SITE_CFG.onesignalAppId 가 있으면 켜집니다.
      - 구독하면 OneSignal 에 'topic 태그'(예: house_handong=1, programs=1)가 붙습니다.
      - 데이터 파일(school-housing-data.js / programs-data.js)의 status 가 "open" 으로 바뀌어
        GitHub 에 올라가면, GitHub Actions(.github/workflows/notify.yml)가 바뀐 항목을 찾아
        그 태그를 가진 사람에게만 자동으로 알림을 보냅니다. 관리자는 아무것도 하지 않아도 됩니다.
   ② 관심 목록 — 항상 동작 (이 브라우저에 저장)
      - 방문할 때마다 저장해 둔 상태와 지금 상태를 비교해 바뀐 곳을 맨 위에 알려 줍니다.
   ============================================================ */
var JINotify = (function () {
  var cfg = (typeof SITE_CFG !== "undefined") ? SITE_CFG : {};
  var pushReady = null;

  function esc(t) { var d = document.createElement("div"); d.textContent = t == null ? "" : String(t); return d.innerHTML; }
  function getWatch() { return JI.get("watch", {}); }
  function setWatch(w) { JI.set("watch", w); }

  /* OneSignal SDK 불러오기 (설정했을 때만) */
  function loadPush() {
    if (!cfg.onesignalAppId) return Promise.resolve(null);
    if (pushReady) return pushReady;
    pushReady = new Promise(function (resolve) {
      window.OneSignalDeferred = window.OneSignalDeferred || [];
      var s = document.createElement("script");
      s.src = "https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js"; s.defer = true;
      s.onerror = function () { resolve(null); };
      document.head.appendChild(s);
      window.OneSignalDeferred.push(function (OneSignal) {
        var path = cfg.onesignalPath || "/";
        OneSignal.init({
          appId: cfg.onesignalAppId,
          serviceWorkerPath: path.replace(/^\//, "") + "OneSignalSDKWorker.js",
          serviceWorkerParam: { scope: path },
          allowLocalhostAsSecureOrigin: true
        }).then(function () { resolve(OneSignal); }, function () { resolve(null); });
      });
    });
    return pushReady;
  }

  function isIOSBrowser() {
    var ios = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    var standalone = window.navigator.standalone === true || (window.matchMedia && matchMedia("(display-mode: standalone)").matches);
    return ios && !standalone;
  }
  function pushSupported() {
    return !!cfg.onesignalAppId && "Notification" in window && "serviceWorker" in navigator;
  }

  /* 구독: topic = "house_handong" / "programs" 등 */
  function subscribe(topic, label, status) {
    var w = getWatch();
    w[topic] = { label: label, status: status || "", at: new Date().toISOString().slice(0, 10) };
    setWatch(w);
    if (!pushSupported()) return Promise.resolve({ push: false, saved: true });
    return loadPush().then(function (OneSignal) {
      if (!OneSignal) return { push: false, saved: true };
      return OneSignal.Notifications.requestPermission().then(function () {
        if (!OneSignal.Notifications.permission) return { push: false, denied: true, saved: true };
        OneSignal.User.addTag(topic, "1");
        linkAccount();
        return { push: true, saved: true };
      });
    }).catch(function () { return { push: false, saved: true }; });
  }

  /* 로그인한 회원이면 이 기기의 푸시를 회원 계정(external_id)과 연결 → 가입 신청 알림 등을 이 기기로 받음 */
  function linkAccount() {
    var u = (typeof currentUser === "function") ? currentUser() : null;
    if (!u || !u.id || !pushSupported()) return Promise.resolve(false);
    return loadPush().then(function (OneSignal) {
      if (!OneSignal) return false;
      try { OneSignal.login(u.id); } catch (e) {}
      return true;
    }).catch(function () { return false; });
  }
  /* 회원 알림(가입 신청 등)을 이 기기에서 받기 */
  function enableAccountPush() {
    if (!pushSupported()) return Promise.resolve({ push: false });
    return loadPush().then(function (OneSignal) {
      if (!OneSignal) return { push: false };
      return OneSignal.Notifications.requestPermission().then(function () {
        if (!OneSignal.Notifications.permission) return { push: false, denied: true };
        return linkAccount().then(function () { return { push: true }; });
      });
    }).catch(function () { return { push: false }; });
  }
  function accountPushOn() { return pushSupported() && window.Notification && Notification.permission === "granted"; }

  function unsubscribe(topic) {
    var w = getWatch(); delete w[topic]; setWatch(w);
    if (pushSupported()) loadPush().then(function (OneSignal) { if (OneSignal) OneSignal.User.removeTag(topic); });
  }

  function isOn(topic) { return !!getWatch()[topic]; }

  /* 관심 목록에서 상태가 바뀐 항목 찾기: current = { topic: {status, label} } */
  function changes(current) {
    var w = getWatch(), out = [];
    Object.keys(w).forEach(function (t) {
      if (current[t] && current[t].status !== w[t].status) out.push({ topic: t, label: current[t].label || w[t].label, from: w[t].status, to: current[t].status });
    });
    return out;
  }
  function acknowledge(current) {
    var w = getWatch();
    Object.keys(w).forEach(function (t) { if (current[t]) w[t].status = current[t].status; });
    setWatch(w);
  }

  /* 알림 받기 창 */
  function openSheet(o) {
    var on = isOn(o.topic);
    var wrap = document.createElement("div");
    wrap.className = "jn-back";
    wrap.innerHTML = '<div class="jn-sheet" role="dialog" aria-modal="true" aria-label="알림 받기">' +
      '<button class="jn-x" type="button" aria-label="닫기">✕</button>' +
      '<div class="jn-ic">🔔</div><h3>' + esc(o.title) + '</h3><p class="jn-d">' + esc(o.desc) + '</p>' +
      (pushSupported()
        ? '<ul class="jn-pts"><li><b>비용 없음</b> — 문자·전화가 아니라 무료 브라우저 알림이에요</li>' +
          '<li><b>자동</b> — 소식이 사이트에 반영되는 순간 시스템이 바로 보내요 (운영자 손을 거치지 않아요)</li>' +
          '<li><b>언제든 끄기</b> — 이 창이나 브라우저 설정에서 끌 수 있어요</li></ul>'
        : '<ul class="jn-pts"><li><b>비용 없음</b> — 문자·전화를 쓰지 않아요</li>' +
          '<li><b>자동 비교</b> — 다시 방문하면 저장할 때와 바뀐 점을 맨 위에 보여 드려요</li></ul>') +
      (cfg.onesignalAppId && isIOSBrowser()
        ? '<div class="jn-warn"><b>아이폰은 한 단계만 더!</b><br>Safari 아래쪽 <b>공유 버튼(□↑)</b> → <b>홈 화면에 추가</b> → 홈 화면의 제주이음 아이콘으로 열고 이 버튼을 누르면 앱처럼 알림이 와요. (iOS 16.4 이상)</div>'
        : pushSupported() ? '' : '<div class="jn-warn">' + (cfg.onesignalAppId
        ? '이 브라우저는 푸시 알림을 지원하지 않아요. 아이폰은 Safari에서 <b>홈 화면에 추가</b>한 뒤 열면 알림을 받을 수 있어요.'
        : '지금은 <b>관심 목록</b>으로 저장돼요. 다시 방문하면 바뀐 점을 맨 위에 알려 드려요.') + '</div>') +
      '<div class="jn-act">' + (on
        ? '<button class="btn ghost" type="button" data-a="off">알림 끄기</button><button class="btn primary" type="button" data-a="close">확인</button>'
        : '<button class="btn accent block" type="button" data-a="on">' + (pushSupported() ? "무료 알림 켜기" : "관심 목록에 저장") + '</button>') +
      '</div><div class="jn-msg" aria-live="polite"></div></div>';
    document.body.appendChild(wrap);
    function close() { wrap.remove(); if (o.onChange) o.onChange(isOn(o.topic)); }
    wrap.addEventListener("click", function (e) {
      if (e.target === wrap || e.target.closest(".jn-x") || e.target.closest('[data-a="close"]')) return close();
      var b = e.target.closest("[data-a]"); if (!b) return;
      var msg = wrap.querySelector(".jn-msg");
      if (b.dataset.a === "off") { unsubscribe(o.topic); msg.textContent = "알림을 껐어요."; setTimeout(close, 700); }
      if (b.dataset.a === "on") {
        b.disabled = true; b.textContent = "켜는 중…";
        subscribe(o.topic, o.label, o.status).then(function (r) {
          msg.innerHTML = r.push ? "✅ 알림을 켰어요. 소식이 확인되면 이 기기로 바로 알려 드려요."
            : r.denied ? "브라우저에서 알림을 막아 두셨어요. 관심 목록에는 저장했어요."
            : "✅ 관심 목록에 저장했어요. 다시 방문하면 바뀐 점을 알려 드려요.";
          setTimeout(close, 1600);
        });
      }
    });
    document.addEventListener("keydown", function k(e) { if (e.key === "Escape") { close(); document.removeEventListener("keydown", k); } });
  }

  return { linkAccount: linkAccount, enableAccountPush: enableAccountPush, accountPushOn: accountPushOn, isIOSBrowser: isIOSBrowser,
    subscribe: subscribe, unsubscribe: unsubscribe, isOn: isOn, changes: changes, acknowledge: acknowledge, openSheet: openSheet, pushSupported: pushSupported };
})();
