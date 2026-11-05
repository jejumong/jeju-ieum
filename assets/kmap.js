/* ============================================================
   제주이음 · 카카오맵 표시 도우미
   - SITE_CFG.kakaoJsKey (카카오 디벨로퍼스 JavaScript 키)를 씁니다.
   - 카카오 디벨로퍼스 → 내 애플리케이션 → 플랫폼 → Web 에 사이트 도메인을 등록해야 지도가 열립니다.
   - 키가 없거나 지도를 못 불러오면 '카카오맵에서 보기' 링크만 보여 줍니다.
   ============================================================ */
var JIMap = (function () {
  var waiting = null;

  function load() {
    if (waiting) return waiting;
    waiting = new Promise(function (resolve) {
      var key = (window.SITE_CFG || {}).kakaoJsKey;
      if (!key) return resolve(false);
      if (window.kakao && window.kakao.maps && window.kakao.maps.services) return resolve(true);
      var s = document.createElement("script");
      s.src = "https://dapi.kakao.com/v2/maps/sdk.js?appkey=" + encodeURIComponent(key) + "&libraries=services&autoload=false";
      s.onload = function () {
        try { window.kakao.maps.load(function () { resolve(true); }); } catch (e) { resolve(false); }
      };
      s.onerror = function () { resolve(false); };
      document.head.appendChild(s);
      setTimeout(function () { resolve(!!(window.kakao && window.kakao.maps && window.kakao.maps.services)); }, 8000);
    });
    return waiting;
  }

  /* 주소(또는 장소 이름)를 좌표로 바꾸기 — 주소 검색이 안 되면 장소 검색으로 한 번 더 */
  function find(query) {
    return new Promise(function (resolve) {
      var svc = window.kakao.maps.services;
      new svc.Geocoder().addressSearch(query, function (r, st) {
        if (st === svc.Status.OK && r.length) return resolve({ lat: +r[0].y, lng: +r[0].x, addr: r[0].address_name, exact: !!(r[0].road_address || (r[0].address && r[0].address.main_address_no)) });
        new svc.Places().keywordSearch(query, function (r2, st2) {
          if (st2 === svc.Status.OK && r2.length) return resolve({ lat: +r2[0].y, lng: +r2[0].x, addr: r2[0].road_address_name || r2[0].address_name, exact: false });
          resolve(null);
        });
      });
    });
  }

  function esc(t) { var d = document.createElement("div"); d.textContent = t == null ? "" : String(t); return d.innerHTML; }
  function links(query, pos) {
    var q = encodeURIComponent(query);
    var big = pos ? "https://map.kakao.com/link/map/" + encodeURIComponent(query) + "," + pos.lat + "," + pos.lng : "https://map.kakao.com/?q=" + q;
    return '<div class="km-links"><a href="' + big + '" target="_blank" rel="noopener">🗺️ 카카오맵에서 크게 보기</a>' +
      (pos ? '<a href="https://map.kakao.com/link/to/' + encodeURIComponent(query) + "," + pos.lat + "," + pos.lng + '" target="_blank" rel="noopener">🚗 길찾기</a>' +
             '<a href="https://map.kakao.com/link/roadview/' + pos.lat + "," + pos.lng + '" target="_blank" rel="noopener">👀 로드뷰</a>' : '') + '</div>';
  }

  /* el 안에 지도 그리기. opts.approx = true 이면 정확한 점 대신 반경 원으로 표시 */
  function show(el, query, opts) {
    opts = opts || {};
    if (!el || !query) return Promise.resolve(null);
    el.innerHTML = '<div class="km-box"><div class="km-map km-loading">지도를 불러오는 중…</div></div>';
    return load().then(function (ok) {
      if (!ok) { el.innerHTML = '<div class="km-box"><div class="km-addr">📍 ' + esc(query) + '</div>' + links(query) + '</div>'; return null; }
      return find(query).then(function (pos) {
        if (!pos) {
          el.innerHTML = '<div class="km-box"><div class="km-addr">📍 ' + esc(query) + ' <small>(지도에서 위치를 찾지 못했어요)</small></div>' + links(query) + '</div>';
          return null;
        }
        el.innerHTML = '<div class="km-box"><div class="km-map"></div><div class="km-addr">📍 ' + esc(query) +
          (pos.exact ? '' : ' <small>· 대략적인 위치예요</small>') + '</div>' + links(query, pos) + '</div>';
        var box = el.querySelector(".km-map"), center = new kakao.maps.LatLng(pos.lat, pos.lng);
        var map = new kakao.maps.Map(box, { center: center, level: pos.exact ? 4 : 6 });
        map.addControl(new kakao.maps.ZoomControl(), kakao.maps.ControlPosition.RIGHT);
        if (pos.exact && !opts.approx) new kakao.maps.Marker({ map: map, position: center });
        else new kakao.maps.Circle({ map: map, center: center, radius: 400, strokeWeight: 2, strokeColor: "#2b8ce6", strokeOpacity: .8, fillColor: "#2b8ce6", fillOpacity: .15 });
        map.setZoomable(true);
        return pos;
      });
    });
  }

  return { load: load, find: find, show: show };
})();
