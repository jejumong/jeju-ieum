/* 제주 오일장 장날 데이터 — 오일장 달력(jangnal.html)과 메인 화면(오늘의 제주)이 함께 씀
   장날 = 날짜 끝자리. 마지막 확인 2026-11-06 (출처는 jangnal.html 아래쪽) */
(function(){
  var M = [
    { k:"jeju",   n:"제주시 민속오일장",   s:"제주시", d:[2,7], c:"#1a6fcb", addr:"제주시 오일장서길 26 (도두일동 1212)", tel:"064-743-5985", q:"제주시민속오일시장" },
    { k:"hamdeok",n:"함덕 민속오일장",     s:"제주시 동쪽", d:[1,6], c:"#0f9d8a", addr:"제주시 조천읍 함덕리 1004-5 일대", tel:"", q:"함덕오일장" },
    { k:"sehwa",  n:"세화 민속오일장",     s:"제주시 동쪽", d:[5,10], c:"#7a4fd6", addr:"제주시 구좌읍 세평항로 68 (세화리 1500-5)", tel:"064-782-0520", q:"세화민속오일시장" },
    { k:"hallim", n:"한림 민속오일장",     s:"제주시 서쪽", d:[4,9], c:"#d4552b", addr:"제주시 한림읍 한림상로 55 (대림리 1698-4)", tel:"064-796-8830", q:"한림민속오일시장" },
    { k:"sgp",    n:"서귀포 향토오일장",   s:"서귀포시", d:[4,9], c:"#e08a00", addr:"서귀포시 중산간동로7894번길 18-5 (동홍동)", tel:"064-763-0965", q:"서귀포향토오일시장" },
    { k:"jungmun",n:"중문 향토오일장",     s:"서귀포 서쪽", d:[3,8], c:"#c2389a", addr:"서귀포시 천제연로188번길 17 (중문동)", tel:"", q:"중문향토오일시장" },
    { k:"daejeong",n:"대정 오일장",       s:"서귀포 서쪽", d:[1,6], c:"#5b7a1e", addr:"서귀포시 대정읍 하모리 1089-15", tel:"", q:"대정오일시장" },
    { k:"pyoseon",n:"표선 민속오일장",     s:"서귀포 동쪽", d:[2,7], c:"#2b8ce6", addr:"서귀포시 표선면 표선리 1001-1", tel:"064-760-4471", q:"표선민속오일시장" },
    { k:"goseong",n:"고성 오일장 (성산)", s:"서귀포 동쪽", d:[4,9], c:"#8a5a2b", addr:"서귀포시 성산읍 고성오조로 80 (고성리)", tel:"064-760-4281", q:"고성오일시장" }
  ];
  function state(m, dt){
    var day = dt.getDate(), last = day % 10, dim = new Date(dt.getFullYear(), dt.getMonth()+1, 0).getDate();
    if (day === 31) return m.d.indexOf(1) > -1 ? 2 : 0;
    if (m.d.indexOf(10) > -1 && dim < 30 && day === dim) return 2;   // 2월 말 5·10일장
    var hit = m.d.some(function(x){ return x % 10 === last; });
    return hit ? 1 : 0;
  }
  window.JANG_MARKETS = M;
  window.jangState = state;   // 0 없음, 1 열림, 2 확인 필요
  window.jangTodayKST = function(){ var n = new Date(Date.now() + 9*3600e3); return new Date(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate()); };
})();
