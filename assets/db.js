/* ============================================================
   제주이음 · 카페24 서버 연결 (회원·글·동호회 가입 신청·알림)
   - SITE_CFG.apiUrl 이 비어 있으면 아무것도 하지 않고 예전처럼 브라우저 저장 방식으로만 동작
   - 로그인 상태는 JI 'session' 에도 같이 적어 두어, 기존 화면 코드(currentUser)가 그대로 동작
   - 로그인 토큰은 JI 'auth' 에 보관
   ============================================================ */
var JIDB = (function () {
  var cfg = window.SITE_CFG || {};
  var API = (cfg.apiUrl || "").replace(/\/?$/, "/");
  var enabled = !!cfg.apiUrl;

  function token() { return JI.get("auth", "") || ""; }

  /* 서버 호출: text/plain 으로 보내 브라우저 사전 확인(OPTIONS)을 건너뜀 */
  function call(action, body) {
    if (!enabled) return Promise.reject(new Error("서버가 연결되지 않았어요"));
    body = body || {}; var t = token(); if (t) body._t = t;
    return fetch(API + "?a=" + action, {
      method: "POST", headers: { "Content-Type": "text/plain;charset=UTF-8" }, body: JSON.stringify(body)
    }).then(function (r) {
      return r.json().catch(function () { throw new Error("서버 응답을 읽지 못했어요 (" + r.status + ")"); });
    }, function () { throw new Error("서버에 연결하지 못했어요. 인터넷 연결을 확인해 주세요."); })
      .then(function (j) {
        if (!j.ok) {
          if (j.error === "로그인이 필요해요" && t) { JI.set("auth", ""); JI.set("session", null); }
          throw new Error(j.error || "요청을 처리하지 못했어요");
        }
        return j.data;
      });
  }

  /* 로그인 상태를 JI session 과 맞추기 → 바뀌었으면 true */
  function setUser(u) {
    var cur = JI.get("session", null);
    if (!u) { JI.set("auth", ""); if (cur) { JI.set("session", null); return true; } return false; }
    var next = { id: u.id, email: u.email, nick: u.nick, region: u.region || "", role: u.role || "user" };
    var changed = !cur || cur.id !== next.id || cur.nick !== next.nick || cur.region !== next.region || cur.role !== next.role;
    if (changed) JI.set("session", next);
    return changed;
  }

  var ready;
  if (enabled) {
    var cur = JI.get("session", null);
    if (cur && !token()) { JI.set("session", null); cur = null; }   // 예전 방식(Supabase·브라우저 전용) 로그인 정리
    ready = (token() ? call("me").then(setUser, function () { return false; })   /* 일시적인 연결 오류면 로그인 유지 (만료는 call 안에서 정리) */ : Promise.resolve(setUser(null)))
      .then(function (changed) {
        // 다른 탭·기기에서 로그인 상태가 바뀌었으면 화면을 한 번 새로 그림
        if (changed && cur && !sessionStorage.getItem("ji_resync")) { sessionStorage.setItem("ji_resync", "1"); location.reload(); return new Promise(function () {}); }
        sessionStorage.removeItem("ji_resync");
        afterReady();
        return true;
      }).catch(function (e) { console.warn("[JIDB]", e); return false; });
  } else {
    ready = Promise.resolve(false);
  }

  function me() { var u = JI.get("session", null); return u && u.id && token() ? u : null; }
  function isUuid(s) { return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s || ""); }

  /* 서버 글 → 화면에서 쓰는 글 모양으로 */
  function toPost(r) {
    var d = new Date(r.created_at);
    return {
      id: r.id, board: r.board, head: r.head || "", title: r.title, content: r.content || "", loc: r.loc || "", meta: r.meta || "",
      price: r.price || "", author: r.author_nick, authorId: r.author, date: (r.created_at || "").slice(0, 10),
      time: ("0" + d.getHours()).slice(-2) + ":" + ("0" + d.getMinutes()).slice(-2), views: r.views || 0, db: true, extra: r.extra || {}
    };
  }

  /* ── 회원 ── */
  function signUp(email, pw, nick, region) {
    return call("signup", { email: email, pw: pw, nick: nick, region: region }).then(function (r) {
      JI.set("auth", r.token); setUser(r.user); linkPush(); return { needConfirm: false };
    });
  }
  function signIn(email, pw) {
    return call("login", { email: email, pw: pw }).then(function (r) { JI.set("auth", r.token); setUser(r.user); linkPush(); return true; });
  }
  function signOut() {
    var p = token() ? call("logout").catch(function () {}) : Promise.resolve();
    JI.set("auth", ""); JI.set("session", null);
    try { if (window.OneSignal && OneSignal.logout) OneSignal.logout(); } catch (e) {}
    return p;
  }
  function updateProfile(fields) {
    return call("profile_update", fields).then(function (r) {
      var s = JI.get("session", {}); s.nick = r.nick; s.region = r.region; JI.set("session", s);
    });
  }

  /* ── 글 ── */
  function createPost(p) {
    return call("post_create", { board: p.board, head: p.head || "", title: p.title, content: p.content || "", loc: p.loc || "",
      meta: p.meta || "", price: p.price || "", extra: p.extra || {} }).then(toPost);
  }
  function updatePost(id, p) {
    var b = { id: id }; ["head", "title", "content", "loc", "meta", "price", "extra"].forEach(function (k) { if (p[k] !== undefined) b[k] = p[k]; });
    return call("post_update", b).then(toPost);
  }
  function deletePost(id) { return call("post_delete", { id: id }); }
  function getPost(id, countView) {
    if (!isUuid(id) || !enabled) return Promise.resolve(null);
    return ready.then(function () { return call("post_get", { id: id, view: !!countView }); }).then(function (r) { return r ? toPost(r) : null; });
  }
  function listPosts(board) {
    if (!enabled) return Promise.resolve([]);
    return ready.then(function () { return call("post_list", { board: board }); }).then(function (rows) { return rows.map(toPost); });
  }

  /* ── 동호회 가입 신청 ── */
  function myJoin(clubId) { return me() ? call("join_my", { club_id: clubId }) : Promise.resolve(null); }
  function requestJoin(club, message) { return call("join_request", { club_id: club.id, message: message || "" }); }
  function cancelJoin(joinId) { return call("join_cancel", { id: joinId }); }
  function receivedJoins() { return me() ? call("joins_received") : Promise.resolve([]); }
  function sentJoins() { return me() ? call("joins_sent") : Promise.resolve([]); }
  function decideJoin(joinId, status) { return call("join_decide", { id: joinId, status: status }); }
  function joinCount(clubId) { return enabled ? call("join_count", { club_id: clubId }).catch(function () { return null; }) : Promise.resolve(null); }

  /* ── 모임 공지 · 회원 목록 ── */
  function clubNotices(clubId) { return me() ? call("notices", { club_id: clubId }) : Promise.resolve([]); }
  function addNotice(club, body) { return call("notice_add", { club_id: club.id, body: body }); }
  function deleteNotice(id) { return call("notice_delete", { id: id }); }
  function clubMembers(clubId) { return me() ? call("club_members", { club_id: clubId }) : Promise.resolve([]); }

  /* ── 상점·공구 승인 요청 (관리자만 봄) ── */
  function sendSellerRequest(board, details, message) { return call("seller_request", { board: board, details: details, message: message || "" }); }

  /* ── 알림함 ── */
  function notifications() { return me() ? call("notis") : Promise.resolve([]); }
  function unreadCount() { return me() ? call("noti_unread").catch(function () { return 0; }) : Promise.resolve(0); }
  function markAllRead() { return me() ? call("noti_read_all") : Promise.resolve(); }

  function linkPush() { try { if (window.JINotify && JINotify.accountPushOn && JINotify.accountPushOn()) JINotify.linkAccount(); } catch (e) {} }

  /* 준비되면: 위쪽에 알림 종, 휴대폰 알림 계정 연결 */
  function afterReady() {
    var u = me(); if (!u) return;
    var acts = document.querySelector(".header-actions");
    if (acts && !document.getElementById("hd-bell")) {
      var a = document.createElement("a");
      a.id = "hd-bell"; a.href = "activity.html"; a.className = "hd-bell"; a.title = "알림"; a.setAttribute("aria-label", "알림");
      a.innerHTML = '<span aria-hidden="true">🔔</span><b class="hd-bell-n" hidden></b>';
      acts.insertBefore(a, acts.firstChild);
    }
    unreadCount().then(function (n) {
      var b = document.querySelector(".hd-bell-n"); if (!b) return;
      if (n > 0) { b.textContent = n > 99 ? "99+" : n; b.hidden = false; } else b.hidden = true;
    });
    linkPush();
  }

  return {
    enabled: enabled, ready: ready, isUuid: isUuid, me: me, call: call,
    signUp: signUp, signIn: signIn, signOut: signOut, updateProfile: updateProfile,
    createPost: createPost, updatePost: updatePost, deletePost: deletePost, getPost: getPost, listPosts: listPosts,
    myJoin: myJoin, requestJoin: requestJoin, cancelJoin: cancelJoin, receivedJoins: receivedJoins, sentJoins: sentJoins,
    decideJoin: decideJoin, joinCount: joinCount,
    clubNotices: clubNotices, addNotice: addNotice, deleteNotice: deleteNotice, clubMembers: clubMembers,
    sendSellerRequest: sendSellerRequest,
    notifications: notifications, unreadCount: unreadCount, markAllRead: markAllRead
  };
})();
