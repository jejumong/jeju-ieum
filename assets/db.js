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
        syncFeed();
        return true;
      }).catch(function (e) { console.warn("[JIDB]", e); return false; });
  } else {
    ready = Promise.resolve(false);
  }

  function me() { var u = JI.get("session", null); return u && u.id && token() ? u : null; }
  function isUuid(s) { return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s || ""); }

  /* 서버 글 → 화면에서 쓰는 글 모양으로 */
  function toPost(r) {
    var d = new Date(r.created_at), x = r.extra || {};
    return {
      id: r.id, board: r.board, head: r.head || "", title: r.title, content: r.content || "", loc: r.loc || "", meta: r.meta || "",
      price: r.price || "", author: r.author_nick, authorId: r.author, authorRole: r.author_role || "user", date: (r.created_at || "").slice(0, 10),
      time: ("0" + d.getHours()).slice(-2) + ":" + ("0" + d.getMinutes()).slice(-2), views: r.views || 0, db: true, extra: r.extra || {},
      // 게시판별 추가 정보 (부동산 집 종류·주소, 구인 급여 등)
      htype: x.htype || "", addr: x.addr || "", payType: x.payType || "", pay: x.pay || "", headPrev: x.headPrev || "", editedAt: r.updated_at !== r.created_at ? (r.updated_at || "").slice(0, 10) : ""
    };
  }

  /* ── 화면용 캐시: 서버의 새 글·댓글 수를 브라우저에 보관 → allPosts() 가 함께 보여 줌 ── */
  function cachePut(p) {
    var list = JI.get("dbposts", []).filter(function (x) { return x.id !== p.id; });
    list.unshift(p); JI.set("dbposts", list);
  }
  function cacheDrop(id) { JI.set("dbposts", JI.get("dbposts", []).filter(function (x) { return x.id !== id; })); }
  function syncFeed() {
    return call("feed").then(function (r) {
      var posts = r.posts.map(toPost), counts = r.counts || {}, site = r.site || {};
      var ov = site.admin_ov || {}, ns = site.notices || [];
      var before = JSON.stringify([JI.get("dbposts", []), JI.get("dbcounts", {}), JI.get("admin_ov", {}), JI.get("notices", [])]);
      JI.set("dbposts", posts); JI.set("dbcounts", counts);
      JI.set("dblikes", r.likes || {}); JI.set("mylikes", r.my_likes || []); window._JL = null;
      // 관리자가 정한 공지·프리미엄·숨김은 모든 방문자에게 같게
      JI.set("admin_ov", Array.isArray(ov) ? {} : ov); JI.set("notices", ns);
      if (before === JSON.stringify([posts, counts, JI.get("admin_ov", {}), ns])) return false;
      // 바뀌었으면 목록을 다시 그림 (페이지가 window.onJIData 를 정해 두었을 때)
      try { if (typeof window.onJIData === "function") window.onJIData(); } catch (e) { console.warn(e); }
      return true;
    }).catch(function (e) { console.warn("[JIDB feed]", e.message); return false; });
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
      meta: p.meta || "", price: p.price || "", extra: p.extra || {} }).then(function (r) { var q = toPost(r); cachePut(q); return q; });
  }
  function updatePost(id, p) {
    var b = { id: id }; ["head", "title", "content", "loc", "meta", "price", "extra"].forEach(function (k) { if (p[k] !== undefined) b[k] = p[k]; });
    return call("post_update", b).then(function (r) { var q = toPost(r); cachePut(q); return q; });
  }
  function deletePost(id) { return call("post_delete", { id: id }).then(function () { cacheDrop(id); }); }
  function getPost(id, countView) {
    if (!isUuid(id) || !enabled) return Promise.resolve(null);
    return ready.then(function () { return call("post_get", { id: id, view: !!countView }); }).then(function (r) { if (!r) { cacheDrop(id); return null; } var q = toPost(r); cachePut(q); return q; });
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

  /* ── 댓글 ── */
  function toCmt(c) { return { id: c.id, author: c.author_nick, authorId: c.author, text: c.text, edited: c.edited, date: (c.created_at || "").slice(0, 10), db: true, likes: c.likes || 0, liked: !!c.liked }; }
  function setCount(postId, n) { var m = JI.get("dbcounts", {}); m[postId] = n; JI.set("dbcounts", m); }
  function comments(postId) {
    if (!enabled) return Promise.resolve([]);
    return call("comments", { post_id: postId }).then(function (l) { var r = l.map(toCmt); setCount(postId, r.length); return r; });
  }
  function addComment(postId, text) { return call("comment_add", { post_id: postId, text: text }).then(toCmt); }
  function updateComment(id, text) { return call("comment_update", { id: id, text: text }).then(toCmt); }
  function deleteComment(id) { return call("comment_delete", { id: id }); }
  function myComments() { return me() ? call("my_comments").then(function (l) { return l.map(function (c) { var o = toCmt(c); o.postId = c.post_id; return o; }); }) : Promise.resolve([]); }
  function changePassword(cur, nw) { return call("password_change", { cur: cur, "new": nw }); }
  function deleteAccount(pw) { return call("account_delete", { pw: pw }).then(function () { return signOut(); }); }

  /* ── 사진 올리기: 브라우저에서 줄인 뒤 multipart 로 보냄 (사전 확인 없는 요청) ── */
  function uploadPhoto(blob, name) {
    if (!enabled) return Promise.reject(new Error("서버가 연결되지 않았어요"));
    var fd = new FormData(); fd.append("_t", token()); fd.append("file", blob, name || "photo.jpg");
    return fetch(API + "?a=upload", { method: "POST", body: fd }).then(function (r) {
      return r.json().catch(function () { throw new Error("서버 응답을 읽지 못했어요 (" + r.status + ")"); });
    }, function () { throw new Error("서버에 연결하지 못했어요."); }).then(function (j) { if (!j.ok) throw new Error(j.error || "올리지 못했어요"); return j.data; });
  }
  /* 사진을 가로·세로 최대 maxPx 로 줄여 JPEG Blob 으로 (위치정보 같은 EXIF 도 빠짐) */
  function shrinkImage(file, maxPx, quality) {
    maxPx = maxPx || 1600; quality = quality || 0.82;
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file), img = new Image();
      img.onload = function () {
        var w = img.naturalWidth, h = img.naturalHeight, k = Math.min(1, maxPx / Math.max(w, h));
        var c = document.createElement("canvas"); c.width = Math.round(w * k); c.height = Math.round(h * k);
        var g = c.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        c.toBlob(function (b) { b ? resolve(b) : reject(new Error("사진을 줄이지 못했어요")); }, "image/jpeg", quality);
      };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error("사진 파일을 읽지 못했어요 (HEIC 사진은 jpg로 바꿔서 올려 주세요)")); };
      img.src = url;
    });
  }

  /* ── 좋아요 ── */
  function toggleLike(postId) {
    return call("like_toggle", { post_id: postId }).then(function (r) {
      var m = JI.get("dblikes", {}); m[postId] = r.count; JI.set("dblikes", m);
      var mine = JI.get("mylikes", []).filter(function (x) { return x !== postId; }); if (r.liked) mine.push(postId); JI.set("mylikes", mine);
      window._JL = null; return r;
    });
  }

  /* ── 쪽지 ── */
  function sendMessage(to, body) { return call("msg_send", JIDB.isUuid(to) ? { to: to, body: body } : { to_nick: to, body: body }); }
  function messages(box) { return me() ? call("msg_list", { box: box || "in" }) : Promise.resolve([]); }
  function readMessage(id) { return call("msg_read", { id: id }); }
  function deleteMessage(id) { return call("msg_delete", { id: id }); }
  function unreadMessages() { return me() ? call("msg_unread").catch(function () { return 0; }) : Promise.resolve(0); }

  /* ── 알림함 ── */
  function notifications() { return me() ? call("notis") : Promise.resolve([]); }
  function unreadCount() { return me() ? call("noti_unread").catch(function () { return 0; }) : Promise.resolve(0); }
  function markAllRead() { return me() ? call("noti_read_all") : Promise.resolve(); }

  function linkPush() { try { if (window.JINotify && JINotify.accountPushOn && JINotify.accountPushOn()) JINotify.linkAccount(); } catch (e) {} }

  /* 준비되면: 위쪽에 알림 종, 휴대폰 알림 계정 연결 */
  function afterReady() {
    var u = me(); if (!u) return;
    refreshUnread();
    linkPush();
  }
  // 쪽지·알림은 머리글 버튼 대신 프로필(내 정보) 안으로 — 안 읽은 수를 프로필 사진에 표시
  function refreshUnread() {
    if (!me()) return;
    Promise.all([unreadMessages(), unreadCount()]).then(function (r) {
      var nm = +r[0] || 0, nn = +r[1] || 0, t = nm + nn;
      window.JI_UNREAD = { msg: nm, noti: nn };
      document.querySelectorAll(".me-link").forEach(function (a) {
        var b = a.querySelector(".me-n");
        if (!b) { b = document.createElement("b"); b.className = "me-n"; a.appendChild(b); }
        b.textContent = t > 99 ? "99+" : t; b.hidden = !t;
        a.title = t ? "내 정보 · 안 읽은 쪽지 " + nm + " · 알림 " + nn : "내 정보";
      });
      document.dispatchEvent(new CustomEvent("ji-unread", { detail: window.JI_UNREAD }));
      setAppBadge(t);
    });
  }
  /* 홈 화면 앱 아이콘 숫자 — 안 읽은 쪽지+알림 수 (서비스 워커와 같은 저장소에 기록) */
  function setAppBadge(n) {
    try {
      if (navigator.setAppBadge) { if (n) navigator.setAppBadge(n).catch(function () {}); else navigator.clearAppBadge().catch(function () {}); }
      var r = indexedDB.open("ji-badge", 1);
      r.onupgradeneeded = function () { r.result.createObjectStore("kv"); };
      r.onsuccess = function () { try { r.result.transaction("kv", "readwrite").objectStore("kv").put(n, "n"); } catch (e) {} };
    } catch (e) {}
  }

  return {
    enabled: enabled, ready: ready, isUuid: isUuid, me: me, call: call,
    signUp: signUp, signIn: signIn, signOut: signOut, updateProfile: updateProfile,
    createPost: createPost, updatePost: updatePost, deletePost: deletePost, getPost: getPost, listPosts: listPosts,
    myJoin: myJoin, requestJoin: requestJoin, cancelJoin: cancelJoin, receivedJoins: receivedJoins, sentJoins: sentJoins,
    decideJoin: decideJoin, joinCount: joinCount,
    clubNotices: clubNotices, addNotice: addNotice, deleteNotice: deleteNotice, clubMembers: clubMembers,
    sendSellerRequest: sendSellerRequest, syncFeed: syncFeed,
    toggleLike: toggleLike, uploadPhoto: uploadPhoto, shrinkImage: shrinkImage, sendMessage: sendMessage, messages: messages, readMessage: readMessage, deleteMessage: deleteMessage, unreadMessages: unreadMessages,
    comments: comments, addComment: addComment, myComments: myComments, changePassword: changePassword, deleteAccount: deleteAccount, updateComment: updateComment, deleteComment: deleteComment,
    notifications: notifications, unreadCount: unreadCount, markAllRead: markAllRead, refreshUnread: refreshUnread
  };
})();
