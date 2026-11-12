/* ============================================================
   제주이음 · 학교 연계·체류형 집 데이터 (부동산 게시판 상단)

   [기본 출처] 공공데이터포털 공식 목록
   - 제주시 「농어촌지역 소규모학교 육성 주택 지원 현황」 (기준일 2026-08-07)
     https://www.data.go.kr/data/15056196/fileData.do
   - 서귀포시 「소규모학교 육성지원 공동주택 현황」 (기준일 2026-10-15)
     https://www.data.go.kr/data/15049890/fileData.do
   여기에 카카오맵 등록 주소, 언론 보도, 입주자 후기를 덧붙였습니다.

   [항목]
   id        알림 구독에 쓰는 고유 이름 (바꾸지 마세요)
   city      "제주시" / "서귀포시"
   kind      "공동주택" / "빈집 정비" / "공공임대(예정)"
   status    "open"(빈자리·입주자 모집 중) / "wait"(대기 많음) / "check"(현황 확인 필요) / "plan"(건립 예정)
             → status 가 "open" 으로 바뀌면 그 주택 알림을 켠 사람에게 자동으로 브라우저 알림이 갑니다.
   area_m2   한 세대 면적(㎡). 평은 자동 계산
   lat,lng   좌표가 있으면 지도·로드뷰 버튼이 바로 그 위치로 열립니다
   photos    (선택) 운영자가 직접 찍었거나 사용 허락을 받은 사진만. 예: ["assets/houses/handong-1.jpg"]
             사진이 없으면 상세 창에는 지도·로드뷰 버튼만 보입니다 (방문자 사진 제보는 받지 않음)
   ============================================================ */

var SCHOOL_HOUSES_CHECKED = "2026-11-13";

var SCHOOL_HOUSE_SOURCES = {
  jejusi:   { label: "제주시 공공데이터 (2026.8.7 기준)", url: "https://www.data.go.kr/data/15056196/fileData.do" },
  seogwipo: { label: "서귀포시 공공데이터 (2026.10.15 기준)", url: "https://www.data.go.kr/data/15049890/fileData.do" }
};

var SCHOOL_HOUSES = [
  /* ───────── 제주시 (공식 목록 8곳 + 빈집 정비) ───────── */
  { id: "handong", city: "제주시", kind: "공동주택", status: "check",
    school: "한동초", village: "구좌읍 한동리", name: "둔지빌 (한동마을공동주택)", units: "1동 10세대",
    address: "제주시 구좌읍 한동로1길 15 (한동리 1052)", near: "한동초등학교 바로 앞",
    rule: "한동초등학교 전입 가구에 한해 지원",
    stay: "리사무소(종합복지센터) 문의", cost: "리사무소(종합복지센터) 문의",
    tel: "064-783-2619", telLabel: "한동리 종합복지센터",
    note: "학생 수가 줄어 통폐합 대상으로 예고되자 주민들이 지어 학생을 유치, 본교 체제를 지킨 집",
    src: ["jejusi", ["뉴스N제주 「한동초 역사를 만들다」 (2019)", "https://www.newsnjeju.com/news/articleView.html?idxno=7605"], ["한동리 안내문 (운영자 제공)", ""], ["카카오맵 주소", "https://map.kakao.com/?q=%EC%A0%9C%EC%A3%BC%EC%8B%9C%20%EA%B5%AC%EC%A2%8C%EC%9D%8D%20%ED%95%9C%EB%8F%99%EB%A1%9C1%EA%B8%B8%2015"]] },

  { id: "songdang", city: "제주시", kind: "공동주택", status: "check",
    school: "송당초", village: "구좌읍 송당리", name: "당오름빌", units: "2동 12세대",
    address: "제주시 구좌읍 중산간동로 2205 (송당리 1277)",
    rule: "초등학생 이하 자녀가 많은 가구 우선 (2015년 보도)",
    stay: "리사무소 문의", cost: "보증금 100만 원 · 월 관리비 5만 원 (2015년 보도 기준)",
    tel: "064-783-4093", telLabel: "송당리사무소",
    note: "2014년 준공. 사업비 10억 원 중 절반은 도, 절반은 주민 모금",
    src: ["jejusi", ["제주일보 「학교가 살아야 마을이 산다」 10회 (2015)", "http://www.jejunews.com/news/articleView.html?idxno=1885992"], ["카카오맵 주소", "https://map.kakao.com/?q=%EB%8B%B9%EC%98%A4%EB%A6%84%EB%B9%8C"]] },

  { id: "haga", city: "제주시", kind: "공동주택", status: "wait",
    school: "더럭초", village: "애월읍 하가리", name: "하가리 교육 이주주택", units: "4동 20세대",
    address: "", area_py: 30,
    rule: "도외 대도시 거주 가구 · 미취학 포함 자녀 3명 이상 · 가족 전체 전입 · 마을 면접 (2021년 보도) — 입주자 후기로는 자녀 2~3명 이상이면 유리",
    stay: "막내가 초등학교를 졸업할 때까지 (2021년 보도)",
    cost: "보증금 200만 원 · 연 300만 원, 관리비 없음 (30평, 2025년 입주자 후기)",
    tel: "064-799-1598", telLabel: "하가리사무소",
    note: "전입 대기자가 많은 곳으로 알려짐",
    src: ["jejusi", ["보은사람들 — 더럭초 사례 (2021)", "https://www.boeunpeople.com/news/articleView.html?idxno=58316"], ["입주자 후기 블로그 (2025.9)", "https://www.softhearts.co.kr/%EC%95%A0%EC%9B%94%EC%9D%8D-%ED%95%98%EA%B0%80%EB%A6%AC-%ED%95%99%EA%B5%90%EC%82%B4%EB%A6%AC%EA%B8%B0-%EC%A3%BC%ED%83%9D-30%ED%8F%89-%EC%97%B0%EC%84%B8-300%EB%A7%8C%EC%9B%90"]] },

  { id: "nabeup", city: "제주시", kind: "공동주택", status: "check",
    school: "납읍초", village: "애월읍 납읍리", name: "납읍공동주택", units: "4동 24세대 (공식 목록) · 마을 전체로는 1997년부터 약 55세대",
    address: "제주시 애월읍 중산간서로 5518 (납읍리 1730)",
    rule: "초등학생 자녀를 1명 이상 둔 외지 가구 (2011년 보도)",
    stay: "리사무소 문의",
    cost: "18평형 보증금 200만 원 + 연 100만 원 · 13평형 연 50만 원 · 17평형 연 100만 원 (2011년 보도 기준)",
    tel: "064-799-3475", telLabel: "납읍리사무소",
    note: "'학교 살리기 운동' 발상지. 1992년 빈집 무상 임대로 시작",
    src: ["jejusi", ["서울신문 「마을학교 살리려 임대주택 짓는 주민들」 (2011)", "https://m.go.seoul.co.kr/news/2011/12/01/20111201014008"], ["카카오맵 주소", "https://map.kakao.com/?q=%EB%82%A9%EC%9D%8D%EA%B3%B5%EB%8F%99%EC%A3%BC%ED%83%9D"]] },

  { id: "gwakji", city: "제주시", kind: "공동주택", status: "check",
    school: "곽금초", village: "애월읍 곽지리", name: "곽지리 마을 공동주택", units: "3동 24세대",
    address: "", rule: "리사무소 문의", stay: "리사무소 문의", cost: "리사무소 문의",
    tel: "064-799-0202", telLabel: "곽지리사무소", note: "",
    src: ["jejusi"] },

  { id: "bongseong", city: "제주시", kind: "공동주택", status: "check",
    school: "어도초", village: "애월읍 봉성리", name: "봉성문화주택", units: "1동 12세대 (공식 목록) · 1~4차 건립",
    address: "1차 봉성로 85 · 2차 봉성로2길 13 · 3차 중산간서로 5300 · 4차 중산간서로 5298 (제주시 애월읍 봉성리)",
    rule: "리사무소 문의", stay: "리사무소 문의", cost: "리사무소 문의",
    tel: "064-799-0463", telLabel: "봉성리사무소",
    note: "1999년 1차(9세대)부터 차례로 지음. 2015년 사업비 10억 원(도 5억·마을 5억)으로 1동 12세대 추가",
    src: ["jejusi", ["제주일보 — 봉성리 공동주택 건립 (2015)", "https://www.jejunews.com/news/articleView.html?idxno=1933072"], ["카카오맵 주소", "https://map.kakao.com/?q=%EB%B4%89%EC%84%B1%EB%AC%B8%ED%99%94%EC%A3%BC%ED%83%9D"]] },

  { id: "jeoji", city: "제주시", kind: "공동주택", status: "check",
    school: "저청초", village: "한경면 저지리", name: "저지리 마을 공동주택", units: "1동 9세대 + 빈집 정비 4곳",
    address: "", rule: "리사무소 문의", stay: "리사무소 문의", cost: "리사무소 문의",
    tel: "064-773-1948", telLabel: "저지리사무소", note: "",
    src: ["jejusi"] },

  { id: "gwideok", city: "제주시", kind: "공동주택", status: "check",
    school: "귀덕초", village: "한림읍 귀덕1리", name: "귀덕1리 마을 공동주택", units: "1동 8세대",
    address: "", rule: "리사무소 문의", stay: "리사무소 문의", cost: "리사무소 문의",
    tel: "064-796-3438", telLabel: "귀덕1리사무소", note: "농어촌유학 참여 학교",
    src: ["jejusi"] },

  { id: "jongdal", city: "제주시", kind: "빈집 정비", status: "check",
    school: "종달초", village: "구좌읍 종달리", name: "종달리 빈집 정비 주택", units: "1곳",
    address: "", rule: "리사무소 문의", stay: "리사무소 문의", cost: "리사무소 문의",
    tel: "064-783-3216", telLabel: "종달리사무소", note: "마을 빈집을 고쳐 학생 가정에 제공. 농어촌유학 참여 학교",
    src: ["jejusi"] },

  { id: "dongbok", city: "제주시", kind: "공동주택", status: "check",
    school: "김녕초 동복분교장", village: "구좌읍 동복리", name: "동복리 연립주택", units: "4동 29세대",
    address: "", rule: "리사무소 문의", stay: "리사무소 문의", cost: "월 5만 원 (2018년 보도 기준)",
    tel: "", telLabel: "동복리사무소", note: "2017년 2월 주민들이 건립. 학생 13명에서 52명으로 늘어남 (공식 목록에는 없음)",
    src: [["서울신문 「폐교 직전 학교 10여곳 되살린 제주도민의 힘」 (2018)", "https://m.go.seoul.co.kr/news/2018/01/05/20180105014004"]] },

  /* ───────── 서귀포시 (공식 목록: 주소·면적·신축년도·좌표 포함) ───────── */
  { id: "mureung", city: "서귀포시", kind: "공동주택", status: "check",
    school: "무릉초 · 무릉중", village: "대정읍 무릉2리", name: "무릉2리 마을 공동주택", units: "6세대",
    address: "서귀포시 대정읍 무릉리 886-1", area_m2: 73.37, built: 2019, lat: 33.2566557, lng: 126.1904618,
    rule: "리사무소 문의", stay: "리사무소 문의", cost: "리사무소 문의",
    tel: "", telLabel: "무릉2리사무소", note: "농어촌유학 참여 학교(무릉초)", src: ["seogwipo"] },

  { id: "susan", city: "서귀포시", kind: "공동주택", status: "check",
    school: "수산초", village: "성산읍 수산1리", name: "수산1리 마을 공동주택", units: "16세대 (2013년 8 + 2014년 8)",
    address: "서귀포시 성산읍 수산서남로 24-4", area_m2: 59, built: 2013, lat: 33.4467238, lng: 126.8831466,
    rule: "리사무소 문의", stay: "리사무소 문의", cost: "리사무소 문의",
    tel: "064-782-2812", telLabel: "수산1리사무소", note: "농어촌유학 참여 학교", src: ["seogwipo"] },

  { id: "sinsan", city: "서귀포시", kind: "공동주택", status: "check",
    school: "신산초 · 신산중", village: "성산읍 신산리", name: "그등애 주택", units: "6세대 (3층)",
    address: "서귀포시 성산읍 일주동로5154번길 7-2", area_m2: 76, built: 2015, lat: 33.3781306, lng: 126.8729745,
    rule: "리사무소 문의", stay: "리사무소 문의", cost: "리사무소 문의",
    tel: "064-782-3784", telLabel: "신산리사무소",
    note: "마을주민과 신산초 총동문회 성금 + 서귀포시 예산 5억 7,800만 원. 2016년 1월 준공식",
    src: ["seogwipo", ["한국파트신문 — 그등애 주택 준공식 (2016)", "http://www.hapt.co.kr/news/articleView.html?idxno=33247"]] },

  { id: "sinpung", city: "서귀포시", kind: "공동주택", status: "check",
    school: "풍천초", village: "성산읍 신풍리", name: "신풍리 마을 공동주택", units: "6세대",
    address: "서귀포시 성산읍 신풍하동로 54", area_m2: 76.82, built: 2017, lat: 33.3612513, lng: 126.8421315,
    rule: "리사무소 문의", stay: "리사무소 문의", cost: "리사무소 문의",
    tel: "064-782-0311", telLabel: "신풍리사무소", note: "", src: ["seogwipo"] },

  { id: "siheung", city: "서귀포시", kind: "공동주택", status: "check",
    school: "시흥초", village: "성산읍 시흥리", name: "시흥리마을 공동주택", units: "8세대",
    address: "서귀포시 성산읍 일주동로 3916", area_m2: 84.75, built: 2019, lat: 33.4761864, lng: 126.8990943,
    rule: "리사무소 문의", stay: "리사무소 문의", cost: "리사무소 문의",
    tel: "064-782-3180", telLabel: "시흥리사무소", note: "", src: ["seogwipo"] },

  { id: "seongsan", city: "서귀포시", kind: "공동주택", status: "check",
    school: "성산초", village: "성산읍 성산리", name: "성산리 마을 공동주택", units: "8세대",
    address: "서귀포시 성산읍 성산중앙로65번길 7-1", area_m2: 82.64, built: 2020, lat: 33.4648715, lng: 126.9343504,
    rule: "리사무소 문의", stay: "리사무소 문의", cost: "리사무소 문의",
    tel: "064-782-2241", telLabel: "성산리사무소", note: "", src: ["seogwipo"] },

  { id: "seogwang", city: "서귀포시", kind: "공동주택", status: "check",
    school: "서광초", village: "안덕면 서광동리", name: "서광동리 마을 공동주택", units: "8세대",
    address: "서귀포시 화순서동로 388", area_m2: 85, built: 2020, lat: 33.2850148, lng: 126.3318825,
    rule: "리사무소 문의", stay: "리사무소 문의", cost: "리사무소 문의",
    tel: "064-794-9373", telLabel: "서광동리사무소", note: "", src: ["seogwipo"] },

  { id: "seongeup", city: "서귀포시", kind: "공동주택", status: "check",
    school: "성읍초", village: "표선면 성읍1리", name: "성읍1리 마을 공동주택", units: "4세대",
    address: "서귀포시 표선면 서성일로 72", area_m2: 66.55, built: 2016, lat: 33.4014783, lng: 126.8041421,
    rule: "리사무소 문의", stay: "리사무소 문의", cost: "리사무소 문의",
    tel: "064-787-1306", telLabel: "성읍1리사무소", note: "농어촌유학 참여 학교", src: ["seogwipo"] },

  { id: "sehwa2", city: "서귀포시", kind: "공동주택", status: "check",
    school: "가마초", village: "표선면 세화2리", name: "세화2리 마을 공동주택", units: "6세대",
    address: "서귀포시 표선면 일주동로 6273", area_m2: 54.21, built: 2016, lat: 33.306238, lng: 126.8016268,
    rule: "리사무소 문의", stay: "리사무소 문의", cost: "리사무소 문의",
    tel: "064-787-3310", telLabel: "세화2리사무소", note: "", src: ["seogwipo"] },

  /* ───────── 건립 예정 공공임대 ───────── */
  { id: "naeil", city: "서귀포시", kind: "공공임대(예정)", status: "plan",
    school: "옛 무릉중 · 송당리 체육부지", village: "대정읍 무릉리 / 구좌읍 송당리", name: "내일마을 공공임대주택", units: "약 60세대 (곳마다 약 30세대)",
    address: "", rule: "다자녀 가구 · 신혼부부 (세부 기준은 공고 예정)", stay: "공공임대 기준 (공고 예정)", cost: "공고 예정",
    tel: "", telLabel: "제주개발공사 · 제주도교육청",
    note: "폐교 활용 첫 공공주택. 2026년 설계 시작, 2028년 12월 완공 목표",
    src: [["아시아경제 — 폐교 활용 공공주택 (2025)", "https://www.asiae.co.kr/en/article/2025120914071584208"]] }
];

var SCHOOL_HOUSE_STATUS = {
  open:  ["빈자리·모집 중", "open"],
  wait:  ["대기 많음", "ask"],
  check: ["현황 확인 필요", "wait"],
  plan:  ["건립 예정", "always"]
};

/* 함께온제주 농어촌유학 참여 학교 (2026학년도, 제주도민일보 2025.11 보도) */
var YUHAK_SCHOOLS = ["귀덕초", "송당초", "평대초", "하도초", "성읍초", "신례초", "창천초",
                     "흥산초", "구좌중앙초", "종달초", "한동초", "대정서초", "무릉초", "수산초"];

/* 전체 현황 요약 (공식 목록 기준) */
function schoolHouseTotals() {
  var vill = {}, units = 0;
  SCHOOL_HOUSES.forEach(function (h) {
    if (h.kind === "공공임대(예정)") return;
    vill[h.city + h.village] = 1;
    var m = String(h.units).match(/(\d+)\s*세대/); if (m) units += +m[1];
  });
  return { villages: Object.keys(vill).length, units: units };
}
