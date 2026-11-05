/* ============================================================
   제주이음 · Supabase 연결 (회원·동호회·가입 신청·알림)
   - SITE_CFG.supabaseUrl / supabaseKey 가 비어 있으면 아무것도 하지 않고,
     예전처럼 브라우저 저장 방식으로만 동작합니다.
   - 로그인 상태는 JI 'session' 에도 같이 적어 두어, 기존 화면 코드(currentUser)가 그대로 동작합니다.
   ============================================================ */
var JIDB = (function () {
  var cfg = window.SITE_CFG || {};
  var enabled = !!(cfg.supabaseUrl && cfg.supabaseKey);
  var client = null, ready;

  function loadLib() {
    return new Promise(function (resolve, reject) {
      if (window.supabase && window.supabase.createClient) return resolve();
      var s = document.createElement("script");
      s.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js";
      s.onload = function () { resolve(); };
      s.onerror = function () { reject(new Error("supabase load failed")); };
      document.head.appendChild(s);
    });
  }

  /* 로그인 상태를 JI session 과 맞추기 */
  function syncSession(session) {
    var cur = JI.get("session", null);
    if (!session) {
      if (cur && cur.id) { JI.set("session", null); return true; }      // DB 계정이 로그아웃됨
      if (cur && !cur.id) { JI.set("session", null); return true; }     // 예전 브라우저 전용 계정은 정리
      return false;
    }
    return client.from("profiles").select("nick,region").eq("id", session.user.id).maybeSingle().then(function (r) {
      var p = r.data || {};
      var meta = session.user.user_metadata || {};
      var next = { id: session.user.id, email: session.user.email, nick: p.nick || meta.nick || "이웃", region: p.region || meta.region || "" };
      var changed = !cur || cur.id !== next.id || cur.nick !== next.nick || cur.region !== next.region;
      if (changed) JI.set("session", next);
      return changed;
    });
  }

  if (enabled) {
    ready = loadLib().then(function () {
      client = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseKey, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
      });
      return client.auth.getSession();
    }).then(function (r) {
      return Promise.resolve(syncSession(r.data.session)).then(function (changed) {
        // 다른 탭·기기에서 로그인 상태가 바뀌었으면 화면을 한 번 새로 그림
        if (changed && !sessionStorage.getItem("ji_resync")) { sessionStorage.setItem("ji_resync", "1"); location.reload(); return; }
        sessionStorage.removeItem("ji_resync");
        afterReady();
        return true;
      });
    }).catch(function (e) { console.warn("[JIDB]", e); return false; });
  } else {
    ready = Promise.resolve(false);
  }

  function me() { var u = JI.get("session", null); return u && u.id ? u : null; }
  function need() { if (!client) throw new Error("데이터베이스에 연결되지 않았어요"); }
  function err(r) { if (r.error) throw r.error; return r.data; }
  function isUuid(s) { return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s || ""); }

  /* DB 글 → 화면에서 쓰는 글 모양으로 */
  function toPost(r) {
    return {
      id: r.id, board: r.board, head: r.head || "", title: r.title, content: r.content || "", loc: r.loc || "", meta: r.meta || "",
      price: r.price || "", author: r.author_nick, authorId: r.author, date: (r.created_at || "").slice(0, 10),
      time: new Date(r.created_at).toTimeString().slice(0, 5), views: 0, db: true, extra: r.extra || {}
    };
  }

  /* ── 회원 ── */
  function signUp(email, pw, nick, region) {
    need();
    return client.from("profiles").select("id").eq("nick", nick).maybeSingle().then(function (r) {
      if (r.data) throw new Error("이미 사용 중인 닉네임입니다.");
      return client.auth.signUp({ email: email, password: pw, options: { data: { nick: nick, region: region }, emailRedirectTo: location.origin + "/login.html" } });
    }).then(function (r) {
      if (r.error) throw r.error;
      return { needConfirm: !r.data.session };
    });
  }
  function signIn(email, pw) {
    need();
    return client.auth.signInWithPassword({ email: email, password: pw }).then(function (r) {
      if (r.error) throw r.error;
      return syncSession(r.data.session);
    });
  }
  function signOut() {
    JI.set("session", null);
    if (!client) return Promise.resolve();
    try { if (window.OneSignal && OneSignal.logout) OneSignal.logout(); } catch (e) {}
    return client.auth.signOut().catch(function () {});
  }
  function updateProfile(fields) {
    need(); var u = me(); if (!u) return Promise.reject(new Error("로그인이 필요해요"));
    return client.from("profiles").update(fields).eq("id", u.id).then(err).then(function () {
      var s = JI.get("session", {}); Object.keys(fields).forEach(function (k) { s[k] = fields[k]; }); JI.set("session", s);
    });
  }

  /* ── 글 ── */
  function createPost(p) {
    need(); var u = me(); if (!u) return Promise.reject(new Error("로그인이 필요해요"));
    return client.from("posts").insert({
      board: p.board, head: p.head || "", title: p.title, content: p.content || "", loc: p.loc || "", meta: p.meta || "",
      price: p.price || "", extra: p.extra || {}, author: u.id, author_nick: u.nick
    }).select().single().then(err).then(toPost);
  }
  function updatePost(id, p) {
    need();
    return client.from("posts").update({ head: p.head, title: p.title, content: p.content, loc: p.loc, meta: p.meta, price: p.price, updated_at: new Date().toISOString() })
      .eq("id", id).select().single().then(err).then(toPost);
  }
  function deletePost(id) { need(); return client.from("posts").delete().eq("id", id).then(err); }
  function getPost(id) {
    if (!isUuid(id)) return Promise.resolve(null);
    return ready.then(function () { if (!client) return null; return client.from("posts").select("*").eq("id", id).maybeSingle().then(err).then(function (r) { return r ? toPost(r) : null; }); });
  }
  function listPosts(board) {
    return ready.then(function () {
      if (!client) return [];
      return client.from("posts").select("*").eq("board", board).order("created_at", { ascending: false }).limit(200).then(err).then(function (rows) { return rows.map(toPost); });
    });
  }

  /* ── 동호회 가입 신청 ── */
  function myJoin(clubId) {
    var u = me(); if (!client || !u) return Promise.resolve(null);
    return client.from("club_joins").select("*").eq("club_id", clubId).eq("applicant", u.id).maybeSingle().then(err);
  }
  function requestJoin(club, message) {
    need(); var u = me(); if (!u) return Promise.reject(new Error("로그인이 필요해요"));
    return client.from("club_joins").insert({
      club_id: club.id, club_title: club.title, owner: club.authorId, applicant: u.id, applicant_nick: u.nick, message: message || ""
    }).select().single().then(err);
  }
  function cancelJoin(joinId) { need(); return client.from("club_joins").delete().eq("id", joinId).then(err); }
  function receivedJoins() {
    var u = me(); if (!client || !u) return Promise.resolve([]);
    return client.from("club_joins").select("*").eq("owner", u.id).order("created_at", { ascending: false }).then(err);
  }
  function sentJoins() {
    var u = me(); if (!client || !u) return Promise.resolve([]);
    return client.from("club_joins").select("*").eq("applicant", u.id).order("created_at", { ascending: false }).then(err);
  }
  function decideJoin(joinId, status) { need(); return client.from("club_joins").update({ status: status }).eq("id", joinId).select().single().then(err); }
  function joinCount(clubId) {
    if (!client) return Promise.resolve(null);
    return client.from("club_joins").select("id", { count: "exact", head: true }).eq("club_id", clubId).eq("status", "pending").then(function (r) { return r.count || 0; });
  }

  /* ── 알림함 ── */
  function notifications() {
    var u = me(); if (!client || !u) return Promise.resolve([]);
    return client.from("notifications").select("*").eq("user_id", u.id).order("created_at", { ascending: false }).limit(50).then(err);
  }
  function unreadCount() {
    var u = me(); if (!client || !u) return Promise.resolve(0);
    return client.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", u.id).eq("read", false).then(function (r) { return r.count || 0; });
  }
  function markAllRead() {
    var u = me(); if (!client || !u) return Promise.resolve();
    return client.from("notifications").update({ read: true }).eq("user_id", u.id).eq("read", false).then(err);
  }

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
    // 이 기기에서 이미 알림을 허용했다면 회원 계정과 연결
    try { if (window.JINotify && JINotify.accountPushOn && JINotify.accountPushOn()) JINotify.linkAccount(); } catch (e) {}
  }

  return {
    enabled: enabled, ready: ready, isUuid: isUuid, me: me, client: function () { return client; },
    signUp: signUp, signIn: signIn, signOut: signOut, updateProfile: updateProfile,
    createPost: createPost, updatePost: updatePost, deletePost: deletePost, getPost: getPost, listPosts: listPosts,
    myJoin: myJoin, requestJoin: requestJoin, cancelJoin: cancelJoin, receivedJoins: receivedJoins, sentJoins: sentJoins,
    decideJoin: decideJoin, joinCount: joinCount,
    notifications: notifications, unreadCount: unreadCount, markAllRead: markAllRead
  };
})();
