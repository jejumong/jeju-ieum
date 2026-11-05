/* ============================================================
   제주이음 · 서비스 / 디지털 상품 데이터 + 신청서 저장
   - 가격(price)을 비워 두면 "가격 문의"로 표시됩니다.
   - status: "open"(신청 받는 중) / "pre"(사전 신청) / "soon"(준비 중·출시 알림)
   ============================================================ */

var SERVICES = [
  { id: "consult", ico: "🧭", tone: "", status: "pre",
    who: "제주 이주를 고민하는 분", title: "제주 이주 상담 + 동네 탐방",
    desc: "7년째 구좌읍 마을에 사는 가족이 '살아보니 이렇더라'를 솔직하게 이야기합니다. 영상 상담으로 방향을 잡고, 원하면 하루 동네 탐방까지 함께 다녀요.",
    points: ["영상 상담 — 가족 상황·일·예산에 맞는 동네 후보 정리", "동네 탐방 — 후보 마을 2~3곳 생활권(마트·병원·학교) 함께 돌기", "상담 후 '우리 집 이주 체크리스트' 정리본 제공"],
    note: "부동산 중개·계약 대행은 하지 않습니다. 정보 제공과 동행만 해요.",
    price: "", unit: "1회" },
  { id: "settle", ico: "🌱", tone: "moss", status: "pre",
    who: "이주 1년 이내 가족", title: "정착 적응 코칭 · 가족 마음 돌봄",
    desc: "낯선 마을, 아이 전학, 부부의 서로 다른 적응 속도. 정신건강 분야 작업치료사와 사회복지사가 이주 초기 가족의 일상 적응을 돕습니다.",
    points: ["가족 생활 리듬·역할 점검과 일상 루틴 만들기", "아이 전학·또래 적응을 위한 활동 제안", "고립감이 길어질 때 지역 자원(모임·기관) 연결"],
    note: "의료 행위(진단·치료)가 아닌 생활 적응 지원 프로그램입니다. 치료가 필요하면 전문 기관을 안내해 드려요.",
    price: "", unit: "회기" },
  { id: "biz", ico: "🎬", tone: "warm", status: "open",
    who: "제주 숙소·카페·농가·가게", title: "제주 소상공인 홍보 패키지",
    desc: "드론 항공 촬영, 짧은 소개 영상, 사진, 블로그 원고까지. 제주 풍경을 오래 찍어 온 영상 제작자가 가게의 첫인상을 만들어 드립니다.",
    points: ["드론 항공 영상·사진 (숙소 전경, 바다·밭 풍경)", "인스타그램·쇼츠용 15~60초 세로 영상", "네이버 플레이스·블로그용 사진과 소개 글", "제주이음 제주상점 게시판 등록 연계"],
    note: "드론 촬영은 비행 허가 구역 확인 후 진행합니다.",
    price: "", unit: "패키지" },
  { id: "kit", ico: "📦", tone: "", status: "soon",
    who: "혼자 차근차근 준비하고 싶은 분", title: "제주살이 준비 키트 (디지털 상품)",
    desc: "가이드에 다 담지 못한 체크리스트·예산표·일정표를 바로 쓸 수 있는 파일로 묶었습니다. 아래 상품에서 필요한 것만 고를 수 있어요.",
    points: ["동네 고르기 가이드북 (PDF)", "한달살기 준비 키트 (예산표·체크리스트)", "아이랑 제주 체험 일정표", "계절별 집 관리 매뉴얼"],
    note: "출시되면 알림을 보내 드려요.",
    price: "", unit: "" }
];

var PRODUCTS = [
  { id: "p-region", kicker: "PDF 가이드북", title: "제주 동네 고르기 가이드북", desc: "읍면별 생활권·병원·학교·바람을 한 권에. 이주 전 동네 후보를 좁혀 줍니다.", c1: "#2b8ce6", c2: "#1559b8" },
  { id: "p-stay", kicker: "템플릿", title: "한달살기 준비 키트", desc: "주차별 일정, 예산표, 짐 목록, 지원사업 정리를 노션·시트 템플릿으로.", c1: "#ff9d3d", c2: "#e2700a" },
  { id: "p-kids", kicker: "일정표", title: "아이랑 제주 체험 일정표", desc: "물때 맞춘 바다 체험, 아이 걸음 오름 지도, 비 오는 날 실내 코스.", c1: "#17a06a", c2: "#0f7a50" },
  { id: "p-season", kicker: "매뉴얼", title: "계절별 제주 집 관리 매뉴얼", desc: "장마 제습, 태풍 대비, 겨울 난방까지 달마다 할 일을 정리.", c1: "#123150", c2: "#0b2034" }
];

var STATUS_LABEL = { open: ["신청 받는 중", "ok"], pre: ["사전 신청", "stage"], soon: ["출시 알림 받기", "region"] };

function serviceById(id) { for (var i = 0; i < SERVICES.length; i++) if (SERVICES[i].id === id) return SERVICES[i]; return null; }

/* 신청서 저장: inquiryEndpoint 가 있으면 그쪽으로도 전송, 없으면 이 브라우저에 저장 */
function saveInquiry(data, done) {
  data.id = "iq" + Date.now();
  var d = new Date(), z = function (n) { return String(n).padStart(2, "0"); };
  data.date = d.getFullYear() + "-" + z(d.getMonth() + 1) + "-" + z(d.getDate()) + " " + z(d.getHours()) + ":" + z(d.getMinutes());
  data.status = "new";
  var list = JI.get("inquiries", []);
  list.push(data);
  JI.set("inquiries", list);
  if (typeof SITE_CFG !== "undefined" && SITE_CFG.inquiryEndpoint) {
    try {
      fetch(SITE_CFG.inquiryEndpoint, { method: "POST", headers: { "Content-Type": "application/json", "Accept": "application/json" }, body: JSON.stringify(data) })
        .then(function () { done && done(true); }, function () { done && done(false); });
      return;
    } catch (e) {}
  }
  done && done(null);
}
