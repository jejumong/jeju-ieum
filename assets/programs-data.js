/* ============================================================
   제주이음 · 장기체류·정착 지원 프로그램 모음
   - 한달살기·이주 페이지와 메인 화면이 이 목록을 읽습니다.
   - 새 공고가 나오면 같은 모양으로 추가하고 status·when·checked 를 고쳐 주세요.
   - status: open(모집 중) / always(상시·수시) / wait(마감·다음 공고 대기) / ask(문의 필요)
   - cat: 체류 체험 / 워케이션 / 귀농·귀촌 / 정착 지원 / 청년
   ============================================================ */

var PROGRAMS_CHECKED = "2026-11-12";

var PROGRAM_CATS = [
  { id: "체류 체험", ico: "🧳", desc: "먼저 살아보기 — 숙박비·체험비 지원" },
  { id: "워케이션", ico: "💻", desc: "일하면서 머물기 — 숙박·오피스 지원" },
  { id: "귀농·귀촌", ico: "🌱", desc: "농촌에 정착하기 — 융자·실습·임시 거처" },
  { id: "정착 지원", ico: "🏡", desc: "이사 온 뒤 — 상담 창구·공동체" },
  { id: "청년", ico: "🎒", desc: "만 19~39세 대상 지원" },
  { id: "주거비 지원", ico: "🏠", desc: "월세·전세 대출이자·주거비 지원만 모아 보기" }
];

var PROGRAMS = [
  /* ── 체류 체험 ── */
  { id: "p01", cat: "체류 체험", tags: ["청년"], status: "wait", top: true,
    name: "청춘정거장 in 제주 (런케이션)", org: "제주도 · 제주관광공사",
    who: "제주 밖에 사는 만 19~39세 청년",
    what: "한주살이(7일 이상) 14만 원 + 교육비 최대 5만 원 / 한달살이(14일 이상) 1박 1만 원씩 최대 30만 원 + 교육비 최대 10만 원, 30일 이상이면 5만 원 추가",
    cond: "읍·면 지역 숙소 이용, 오리엔테이션 참석, SNS에 제주살이 콘텐츠 올리기",
    when: "2026 여름 시즌 5.27~6.17 접수 (마감) — 첫날에만 약 700명 신청",
    contact: "제주관광공사 064-740-6925",
    url: "https://www.jeju.go.kr/move/prog/place02.htm",
    src: [["제주愛in 체류 프로그램", "https://www.jeju.go.kr/move/prog/place02.htm"], ["파이낸셜뉴스 2026.5", "https://www.fnnews.com/news/202605291330075055"]] },

  { id: "p02", cat: "체류 체험", tags: [], status: "wait", top: true,
    name: "안전 인증 농어촌민박 한 달 살기", org: "제주도 · 제주관광공사",
    who: "제주 외 지역에 주소지를 둔 누구나 (MZ세대부터 70대까지 지원)",
    what: "1인 1팀 30만 원, 2인 이상 1팀 최대 60만 원",
    cond: "안전 인증 농어촌민박에서 28박 이상 연속 체류, SNS 홍보, 종료 후 영수증 제출",
    when: "2026년 7.3 이메일 접수 마감, 11.22까지 체류 — 50팀 모집에 178팀이 몰려 100팀으로 확대",
    contact: "제주관광공사 jejulife@ijto.or.kr",
    url: "https://www.newsseoul.co.kr/news/view/1065603035208430",
    src: [["뉴스서울 2026.6", "https://www.newsseoul.co.kr/news/view/1065603035208430"], ["서울신문 2026.7", "https://m.seoul.co.kr/news/2026/07/13/20260713500047"]] },

  { id: "p03", cat: "체류 체험", tags: [], status: "ask",
    name: "제주 탐나는 농케이션", org: "제주도 · 제주농업인력지원센터",
    who: "제주 외 도시민 단체 (대학·직장 등 10명 이상)",
    what: "1인 하루 3만 원, 2일 이상 최대 6만 원을 지역화폐 '탐나는전'으로 지급",
    cond: "오전엔 농가 일손 돕기, 오후엔 관광·휴식 — 2일 이상 체류",
    when: "2026년 여름방학 대학생 단체부터 운영, 공공기관·기업으로 확대 예정",
    contact: "제주농업인력지원센터 064-720-1260~2",
    url: "https://www.twig24.com/news/travel-news/2026/06/24/20260624500121",
    src: [["트래블뉴스 2026.6", "https://www.twig24.com/news/travel-news/2026/06/24/20260624500121"]] },

  { id: "p04", cat: "체류 체험", tags: ["청년"], status: "ask",
    name: "오아시스 청년마을 1주일 체류", org: "서귀포시 표선면 오아시스 청년마을",
    who: "청년 (행정안전부 청년마을 만들기 사업)",
    what: "표선 마을에서 1주일 동안 농촌 생활 체험",
    cond: "기수별 모집",
    when: "기수별 모집 — 다음 기수 일정은 문의",
    contact: "서귀포시 인구청년정책팀 064-760-3881",
    url: "https://jejuzine.com/5894",
    src: [["제주진 기사", "https://jejuzine.com/5894"]] },

  { id: "p05", cat: "체류 체험", tags: ["주거비 지원"], status: "wait", top: true,
    name: "함께온제주 농어촌유학 (가족체류형)", org: "제주도교육청 · 제주도 · 서울시교육청",
    who: "제주 외 지역 초등학생과 함께 이주하는 부모 1명 이상 (농어촌 읍면 거주 학생 제외)",
    what: "자녀 수에 따라 가구당 월 60만~120만 원 주거·생활비 지원, 6개월 단위로 읍면 작은 학교에 다님",
    cond: "배정 후 전입 완료해야 확정, 학교 동의 시 6개월·1년 단위 연장 — 집은 가정이 직접 구함",
    when: "2026 2학기는 6.15까지 22가구 모집 (마감). 2026 1학기 모집은 2025년 11.26~12.2였음 — 2027 1학기 공고 확인 필요",
    contact: "제주도교육청 정책기획과 064-710-0173",
    url: "http://www.ihalla.com/article.php?aid=1780629272786769014",
    school: "귀덕초 · 송당초 · 평대초 · 하도초 · 성읍초 · 신례초 · 창천초 · 흥산초 · 구좌중앙초 · 종달초 · 한동초 · 대정서초 · 무릉초 · 수산초",
    src: [["한라일보 2026.6", "http://www.ihalla.com/article.php?aid=1780629272786769014"], ["제주도민일보 2025.11", "https://www.jejudomin.co.kr/news/articleView.html?idxno=315436"], ["미디어제주 (2026 1학기 165명 배정)", "https://www.mediajeju.com/news/articleView.html?idxno=362515"]] },

  /* ── 워케이션 ── */
  { id: "p06", cat: "워케이션", tags: [], status: "open", top: true,
    name: "제주 워케이션 바우처", org: "제주도 · 제주창조경제혁신센터",
    who: "제주 외 지역 기업의 근로자, 개인사업자, 프리랜서 (기업은 최대 15명 일괄 신청)",
    what: "숙박비 + 오피스 이용료 1박 최대 5만 원, 1인 최대 30만 원 (사후 정산)",
    cond: "민간 워케이션 오피스에서 3박 4일 이상(주말 포함), 하루 4시간 이상 근무 — 공공기관·협동조합·재단·비영리기관 제외",
    when: "하반기 추가모집 11.2 14시부터 선착순 130명, 인원 차면 마감 (이용 11.9~12.4) — 남은 자리는 누리집 확인",
    contact: "제주창조경제혁신센터 064-710-1999",
    url: "https://www.jeju.go.kr/workation/index.htm",
    src: [["트래블뉴스 2026.3", "https://www.twig24.com/news/travel-news/2026/03/19/20260319500183"], ["벤처스퀘어 2026 하반기", "https://www.venturesquare.net/1106123/"], ["제주워케이션 추가모집 공고 2026.10.27", "https://www.jeju.go.kr/workation/board/notice.htm?act=view&seq=2039514"]] },

  { id: "p07", cat: "워케이션", tags: [], status: "ask",
    name: "대정 하모 촌피스", org: "촌피스 운영위원단",
    who: "워케이션 기업·근로자, 지역과 협업하려는 외부인",
    what: "모슬포 하모리의 농어업 특화 워케이션 센터 — 2~3일 워케이션부터 3개월 협력 프로젝트까지",
    cond: "프로그램별 상이",
    when: "2025년 개소, 운영 중",
    contact: "064-901-8003",
    url: "https://chonffice.tistory.com/1",
    src: [["촌피스 블로그", "https://chonffice.tistory.com/1"], ["제주愛in 체류 프로그램 목록", "https://www.jeju.go.kr/move/intro/list.htm"]] },

  { id: "p08", cat: "워케이션", tags: [], status: "ask",
    name: "화순 워케이션 빌리지", org: "서귀포시 · 화순리마을회",
    who: "상세 조건은 문의", what: "안덕면 화순리 마을 연계 워케이션",
    cond: "—", when: "운영 중 (도 체류 프로그램 목록 등재)",
    contact: "서귀포시 마을활력과 064-760-3382, 마을 064-794-9008",
    url: "https://www.jeju.go.kr/move/intro/list.htm",
    src: [["제주愛in 체류 프로그램 목록", "https://www.jeju.go.kr/move/intro/list.htm"]] },

  { id: "p09", cat: "워케이션", tags: [], status: "ask",
    name: "어촌체험휴양마을 워케이션 (사계리·김녕)", org: "사계리·김녕 어촌체험휴양마을",
    who: "상세 조건은 문의", what: "어촌 마을에 머물며 일하고 바다 체험",
    cond: "—", when: "운영 중 (도 체류 프로그램 목록 등재)",
    contact: "사계리 064-792-3090, 김녕 064-784-2880",
    url: "https://www.jeju.go.kr/move/intro/list.htm",
    src: [["제주愛in 체류 프로그램 목록", "https://www.jeju.go.kr/move/intro/list.htm"]] },

  { id: "p10", cat: "워케이션", tags: [], status: "ask",
    name: "김녕어울림센터", org: "제주시 마을활력과",
    who: "도외 직장인·사업자 등 (재직·사업자·소득 증빙 1개 제출)", what: "구좌읍 김녕리 마을 거점 공간 (오피스 18명, 숙소 6객실) — 농식품부 농촌형 워케이션 거점 선정, 평일 1인 하루 최대 5만 원, 최대 5일 25만 원 할인",
    cond: "전용 플랫폼에서 예약·결제, 여행자보험 지원", when: "2026년 9~11월 할인 적용 (기사 기준) — 운영 중",
    contact: "제주시 마을활력과 064-728-2862, 센터 010-2239-0321",
    url: "https://www.jeju.go.kr/move/intro/list.htm",
    src: [["제주愛in 체류 프로그램 목록", "https://www.jeju.go.kr/move/intro/list.htm"], ["파이낸셜뉴스 2026.9", "https://www.fnnews.com/news/202609050200011619"]] },

  /* ── 귀농·귀촌 ── */
  { id: "p11", cat: "귀농·귀촌", tags: ["주거비 지원"], status: "always", top: true,
    name: "귀농 농업창업·주택구입 융자", org: "제주시·서귀포시 마을활력과",
    who: "도시 1년 이상 거주 후 농어촌 전입 5년 이내, 귀농교육 100시간 이수자 등",
    what: "농업 창업자금 최대 3억 원, 주택자금 최대 7,500만 원 — 연 2%(변동), 5년 거치 10년 분할상환",
    cond: "귀농교육 100시간 이수 필요",
    when: "해마다 사업 공고 — 시청 문의",
    contact: "제주시 064-728-2922, 서귀포시 064-760-3953",
    url: "https://www.jeju.go.kr/move/guide/farm.htm",
    src: [["제주愛in 귀농귀촌 지원사업", "https://www.jeju.go.kr/move/guide/farm.htm"]] },

  { id: "p12", cat: "귀농·귀촌", tags: ["주거비 지원"], status: "always", top: true,
    name: "귀농인의 집 (임시 거처)", org: "제주시·서귀포시 마을활력과 (운영: 마을회)",
    who: "영농기술을 배우고 농촌을 체험하며 귀농을 준비하는 예비 귀농·귀촌인",
    what: "마을회가 운영하는 임시 거처 제공 — 임대료·공공요금은 관리자와 협의",
    cond: "1개월 이상~1년 이내 거주 원칙, 조건 충족 시 3개월 추가",
    when: "상시 — 빈 집 여부는 시청 문의",
    contact: "제주시 064-728-2921, 서귀포시 064-760-3951",
    url: "https://www.jeju.go.kr/move/guide/farm.htm",
    src: [["제주愛in 귀농귀촌 지원사업", "https://www.jeju.go.kr/move/guide/farm.htm"]] },

  { id: "p13", cat: "귀농·귀촌", tags: [], status: "ask",
    name: "귀농인 영농현장 실습", org: "농업기술센터 (제주·서귀포·동부·서부)",
    who: "이주 5년 이내 귀농인 또는 농업경영체 등록 5년 이내 신규 농업인",
    what: "선도농장에서 3~7개월 실습, 연수생 교육비 월 80만 원",
    cond: "멘토 농가 매칭",
    when: "해마다 모집 — 농업기술센터 문의",
    contact: "농업기술센터 064-760-7521 등",
    url: "https://www.jeju.go.kr/move/guide/farm.htm",
    src: [["제주愛in 귀농귀촌 지원사업", "https://www.jeju.go.kr/move/guide/farm.htm"]] },

  { id: "p14", cat: "귀농·귀촌", tags: [], status: "wait",
    name: "귀농·귀촌 교육", org: "제주도 · 서귀포시 · 농업기술센터",
    who: "귀농·귀촌 희망자, 신규 농업인",
    what: "서귀포시 기본과정 400명(2~3월·6~7월), 심화 360명 / 도 교육 80명(10~11월) / 감귤·채소 기초 과정",
    cond: "창업·주택 융자를 받으려면 100시간 이수 필요 — 온라인 교육(귀농귀촌종합센터)도 인정",
    when: "2027년 일정은 연초 공고",
    contact: "서귀포시 마을활력과 064-760-3952~3",
    url: "https://www.jeju.go.kr/move/guide/farm.htm",
    src: [["제주愛in 귀농귀촌 지원사업", "https://www.jeju.go.kr/move/guide/farm.htm"], ["귀농귀촌종합센터", "https://www.returnfarm.com"]] },

  { id: "p15", cat: "귀농·귀촌", tags: [], status: "always",
    name: "귀농인 농어촌진흥기금 이자 지원", org: "주소지 읍면동",
    who: "귀농인 (농어업인)",
    what: "운전자금 세대당 1,000만 원까지 이자 차액 보전, 금리 0.9%",
    cond: "농어촌진흥기금 융자 대상",
    when: "읍면동 문의",
    contact: "제주시 농정과, 서귀포시 감귤농정과",
    url: "https://www.jeju.go.kr/move/guide/farm.htm",
    src: [["제주愛in 귀농귀촌 지원사업", "https://www.jeju.go.kr/move/guide/farm.htm"]] },

  /* ── 정착 지원 ── */
  { id: "p16", cat: "정착 지원", tags: [], status: "always", top: true,
    name: "정착주민지원창구", org: "제주도 자치행정과",
    who: "제주로 주민등록을 옮긴 지 5년이 안 된 정착주민",
    what: "도·행정시·읍면동 46곳에서 지역 정보 제공, 생활 불편 접수·해결, 지역 교류 지원",
    cond: "—",
    when: "상시",
    contact: "도 자치행정과 064-710-4775",
    url: "https://www.jeju.go.kr/move/guide/settle.htm",
    src: [["제주愛in 정착지원사업", "https://www.jeju.go.kr/move/guide/settle.htm"]] },

  { id: "p17", cat: "정착 지원", tags: [], status: "wait",
    name: "정착주민 지역공동체 조성 공모", org: "제주도 자치행정과",
    who: "정착주민 지원 활동을 하는 비영리 법인·단체",
    what: "정착주민과 원주민이 함께하는 문화교류·협력 프로그램 사업비",
    cond: "단체 공모 (개인 신청 불가)",
    when: "매년 초 도청 공고",
    contact: "도 자치행정과 064-710-4775",
    url: "https://www.jeju.go.kr/move/guide/settle.htm",
    src: [["제주愛in 정착지원사업", "https://www.jeju.go.kr/move/guide/settle.htm"]] },

  { id: "p18", cat: "정착 지원", tags: ["주거비 지원"], status: "ask",
    name: "작은학교 마을 학부모 주택 (빈집 리모델링)", org: "제주도 문화체육교육국 · 행정시",
    who: "학생 100명 이하 또는 6학급 이하 작은 학교 통학구역 마을로 이사 오는 학부모 (도내 61개교)",
    what: "마을이 빈집·노후주택을 고쳐 학부모용 임대주택으로 공급 — 도가 리모델링비 90%, 신축비 60% 지원",
    cond: "마을별 입주 조건·임대료는 마을회 공고 확인",
    when: "2026.6.30 조례 개정 시행 — 마을별 입주자 모집은 수시",
    contact: "제주도청 문화체육교육국, 해당 마을 리사무소",
    url: "https://www.seoul.co.kr/news/society/2026/07/01/20260701500137",
    src: [["서울신문 2026.7", "https://www.seoul.co.kr/news/society/2026/07/01/20260701500137"], ["파이낸셜뉴스 2026.7", "https://www.fnnews.com/news/202607011451171546"]] },

  /* ── 청년 ── */
  { id: "p19", cat: "청년", tags: ["주거비 지원"], status: "wait",
    name: "청년월세 지원 (국토교통부)", org: "국토교통부 · 복지로",
    who: "만 19~34세 부모와 따로 사는 무주택 청년 (소득 기준 있음) — 제주로 이사 온 청년도 해당",
    what: "월 최대 20만 원, 최대 24개월 (생애 1회)",
    cond: "원가구 중위소득 100% 이하, 청년가구 60% 이하",
    when: "2026년 3.30~5.29 접수 (마감) — 2026년 신규 6만 명",
    contact: "콜센터 1599-0001",
    url: "https://www.bokjiro.go.kr/ssis-tbu/cms/pc/customer/notice/1309500_1141.html",
    src: [["복지로 공지", "https://www.bokjiro.go.kr/ssis-tbu/cms/pc/customer/notice/1309500_1141.html"]] },
  /* ── 주거비 (제주도 자체·복권기금) ── */
  { id: "p20", cat: "청년", tags: ["주거비 지원"], status: "ask",
    name: "제주청년 희망충전 월세 지원 (35~39세)", org: "제주특별자치도",
    who: "국토교통부 청년월세 지원 대상에서 빠지는 만 35~39세 청년 (부모와 따로 사는 무주택자)",
    what: "월세 일부 지원 — 지원 금액·기간은 해당 연도 공고 확인",
    cond: "청년 가구 기준 중위소득 60% 이하, 자산 1억 2,200만 원 이하 (원가구 소득은 보지 않음)",
    when: "2025년부터 시행 — 2026년 신청 일정은 정부24·주민센터 확인",
    contact: "거주지 읍면동 주민센터, 도 주택토지과 주거복지팀 064-710-4251~4252",
    url: "https://www.gov.kr",
    src: [["제주도민일보 2026.3", "https://www.jejudomin.co.kr/news/articleView.html?idxno=317932"]] },
  { id: "p21", cat: "정착 지원", tags: ["주거비 지원"], status: "wait",
    name: "신혼부부·자녀출산 가구 전세자금 대출이자 지원", org: "제주특별자치도 (복권기금)",
    who: "혼인신고 또는 자녀 출생 7년 이내 무주택 가구 중 금융기관 전세자금 대출을 받은 가구",
    what: "대출잔액의 1.5%, 최대 150만 원 / 다자녀·장애인·다문화 가구는 2%, 최대 190만 원",
    cond: "공고일 기준 주택 전세자금 대출 이용 중",
    when: "2026년 2차 5.4~6.5 접수 (마감) — 다음 공고는 도청 고시·공고 확인",
    contact: "도 주택토지과 064-710-4254, 제주시 주택과 064-728-3072, 서귀포시 건축과 064-760-3013",
    url: "https://www.jeju.go.kr/news/news/law/jeju2.htm",
    src: [["제주진 2026.4", "https://jejuzine.com/5491"], ["헤드라인제주 2026.4", "https://www.headlinejeju.co.kr/news/articleView.html?idxno=591558"]] },
  { id: "p22", cat: "정착 지원", tags: ["주거비 지원"], status: "wait",
    name: "하영드림 주택마련 지원 (주택구입 대출이자)", org: "제주특별자치도",
    who: "제주에서 집을 산 신혼부부 또는 7년 이내 자녀 출산 가구 (전용 85㎡ 이하, 6억 원 이하 주택)",
    what: "주택구입 대출 3억 원 한도 이자 지원 — 신혼 0.2%, 1자녀 0.8%, 2자녀 이상 0.5% (기사 기준)",
    cond: "부부 합산 연소득 1억 원 이하(정책대출) 또는 1억 3천만 원 이하(일반 대출)",
    when: "2026년 5.4~6.22 접수 (마감) — 다음 공고 확인",
    contact: "도 주택토지과 주거복지팀 064-710-4251~4252",
    url: "https://plus.gov.kr",
    src: [["헤드라인제주 2026.4", "https://www.headlinejeju.co.kr/news/articleView.html?idxno=591558"]] },
  { id: "p23", cat: "정착 지원", tags: ["주거비 지원", "청년"], status: "ask",
    name: "주택 연세·월세 대출이자 지원", org: "제주특별자치도 (복권기금)",
    who: "7년 이내 무주택 신혼부부·자녀출산 가정, 만 19~39세 사회초년생(재직 5년 이내)",
    what: "제주은행·NH농협에서 연 최대 600만 원 대출, 도가 이자 3.5%(연 최대 21만 원) 지원",
    cond: "보증금 3,000만 원 이하, 연세 720만 원 또는 월세 60만 원 이하 계약",
    when: "2024년 발표 기준 연중 접수 — 올해 운영 여부는 도청 문의",
    contact: "도 주택토지과 주거복지팀 064-710-4251~4252",
    url: "https://www.jeju.go.kr/news/news/law/jeju2.htm",
    src: [["헤드라인제주 2024.2", "https://www.headlinejeju.co.kr/news/articleView.html?idxno=535515"]] }
];

/* [표시 이름, 색 클래스, 점 색] — 색은 style.css 의 .pst.* 에서 바꿀 수 있어요 */
var PROGRAM_STATUS = {
  open:   ["모집 중", "open", "#e04b3f"],
  always: ["상시", "always", "#17a06a"],
  wait:   ["다음 공고 대기", "wait", "#a3adb8"],
  ask:    ["문의 필요", "ask", "#2b8ce6"]
};
var PROGRAMS_PER_PAGE = 10;

/* 공식 창구 */
var PROGRAM_HUBS = [
  { name: "제주愛in", desc: "제주도 공식 이주·체류 누리집 — 체류 프로그램 신청, 정착 길잡이", url: "https://www.jeju.go.kr/move/intro.htm" },
  { name: "제주 워케이션", desc: "워케이션 바우처·오피스 안내", url: "https://www.jeju.go.kr/workation/index.htm" },
  { name: "귀농귀촌종합센터", desc: "전국 귀농 정보와 온라인 교육 (100시간 이수)", url: "https://www.returnfarm.com" },
  { name: "복지로", desc: "청년월세 등 중앙정부 지원 신청", url: "https://www.bokjiro.go.kr" }
];
