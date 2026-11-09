/* OneSignal 웹 푸시용 서비스 워커 — 사이트 맨 위 폴더에 그대로 두세요 */
importScripts("https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js");

/* 홈 화면 앱 아이콘 숫자(배지)
   알림이 도착하면 숫자를 1 올리고, 사이트를 열면 실제 안 읽은 수로 다시 맞춥니다 (assets/db.js).
   아이폰(iOS 16.4+ 홈 화면 앱)·PC 크롬/엣지 설치 앱에서 숫자가 보이고,
   안드로이드는 휴대폰이 알림 점(dot)을 자동으로 붙입니다. */
function jiBadgeDb() {
  return new Promise(function (res, rej) {
    var r = indexedDB.open("ji-badge", 1);
    r.onupgradeneeded = function () { r.result.createObjectStore("kv"); };
    r.onsuccess = function () { res(r.result); }; r.onerror = function () { rej(r.error); };
  });
}
function jiBadgeGet(db) { return new Promise(function (res) { var q = db.transaction("kv").objectStore("kv").get("n"); q.onsuccess = function () { res(+q.result || 0); }; q.onerror = function () { res(0); }; }); }
function jiBadgeSet(db, n) { return new Promise(function (res) { var t = db.transaction("kv", "readwrite"); t.objectStore("kv").put(n, "n"); t.oncomplete = res; t.onerror = res; }); }
self.addEventListener("push", function (e) {
  if (!self.navigator || !self.navigator.setAppBadge) return;
  e.waitUntil(jiBadgeDb().then(function (db) {
    return jiBadgeGet(db).then(function (n) { n += 1; return jiBadgeSet(db, n).then(function () { return self.navigator.setAppBadge(n); }); });
  }).catch(function () { return self.navigator.setAppBadge(); }));
});
