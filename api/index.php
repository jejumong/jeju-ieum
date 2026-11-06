<?php
/* ============================================================
   제주이음 API · 요청 받는 곳
   호출: POST  api/?a=동작이름   (본문은 JSON, 로그인 토큰은 _t)
   ============================================================ */
define('JI_API', 1);
require __DIR__ . '/lib.php';

cors();
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }

$a = preg_replace('/[^a-z_]/', '', $_GET['a'] ?? '');
$raw = file_get_contents('php://input');
$R = $raw ? json_decode($raw, true) : [];
if (!is_array($R)) $R = [];
if ($a === '' || $a === 'ping') out(['pong' => true, 'time' => iso(now()), 'schema' => (int)(one("SELECT v FROM ji_meta WHERE k='schema'")['v'] ?? 0)]);

function post_out($r) {
  $x = json_decode($r['extra'] ?: '{}', true);
  return ['id' => $r['id'], 'board' => $r['board'], 'head' => $r['head'], 'title' => $r['title'], 'content' => $r['content'],
    'loc' => $r['loc'], 'meta' => $r['meta'], 'price' => $r['price'], 'extra' => $x ?: new stdClass(),
    'author' => $r['author'], 'author_nick' => $r['author_nick'], 'views' => (int)$r['views'],
    'created_at' => iso($r['created_at']), 'updated_at' => iso($r['updated_at'])];
}
function cmt_out($c) {
  return ['id' => $c['id'], 'post_id' => $c['post_id'], 'author' => $c['author'], 'author_nick' => $c['author_nick'],
    'text' => $c['text'], 'edited' => (bool)$c['edited'], 'created_at' => iso($c['created_at'])];
}
function join_out($j) {
  $j['created_at'] = iso($j['created_at']); $j['decided_at'] = iso($j['decided_at'] ?? null); return $j;
}
function club_of($id) {
  if (!is_uuid($id)) fail('모임을 찾을 수 없어요', 404);
  $c = one("SELECT id, title, author FROM ji_posts WHERE id = ? AND board = '동호회'", [$id]);
  if (!$c) fail('모임을 찾을 수 없어요', 404);
  return $c;
}
$BOARDS = ['동호회', '구인구직', '중고사고팔기', '부동산', '제주상점', '특가공구', '축제정보', '자유게시판', '고민상담실', '생활정보', '최신뉴스', '취미여행', '교육', '건강웰빙', '제주북쪽', '제주동쪽', '제주서쪽', '제주남쪽'];

try {
switch ($a) {

/* ───────── 회원 ───────── */
case 'signup': {
  $email = strtolower(str($R['email'] ?? '', 190)); $pw = (string)($R['pw'] ?? '');
  $nick = str($R['nick'] ?? '', 10); $region = str($R['region'] ?? '', 40);
  if (!filter_var($email, FILTER_VALIDATE_EMAIL)) fail('올바른 이메일 형식이 아닙니다.');
  if (strlen($pw) < 8) fail('비밀번호는 8자 이상이어야 합니다.');
  if (mb_strlen($nick) < 2) fail('닉네임은 2~10자로 입력해 주세요.');
  if (one("SELECT id FROM ji_users WHERE email = ?", [$email])) fail('이미 가입된 이메일입니다.');
  if (one("SELECT id FROM ji_users WHERE nick = ?", [$nick])) fail('이미 사용 중인 닉네임입니다.');
  $role = in_array($email, $CFG['admins'], true) ? 'admin' : 'user';
  $id = uuid();
  q("INSERT INTO ji_users (id, email, pass, nick, region, role, created_at, last_login) VALUES (?,?,?,?,?,?,?,?)",
    [$id, $email, password_hash($pw, PASSWORD_DEFAULT), $nick, $region, $role, now(), now()]);
  out(['token' => new_session($id), 'user' => ['id' => $id, 'email' => $email, 'nick' => $nick, 'region' => $region, 'role' => $role]]);
}
case 'login': {
  $email = strtolower(str($R['email'] ?? '', 190)); $pw = (string)($R['pw'] ?? '');
  $fails = one("SELECT COUNT(*) n FROM ji_login_fails WHERE ip = ? AND at > (NOW() - INTERVAL 10 MINUTE)", [ip()])['n'];
  if ($fails >= 10) fail('로그인 시도가 너무 많아요. 10분 뒤에 다시 해 주세요.', 429);
  $u = one("SELECT * FROM ji_users WHERE email = ?", [$email]);
  if (!$u || !password_verify($pw, $u['pass'])) {
    q("INSERT INTO ji_login_fails (ip, at) VALUES (?, ?)", [ip(), now()]);
    fail('이메일 또는 비밀번호가 올바르지 않습니다.');
  }
  if (password_needs_rehash($u['pass'], PASSWORD_DEFAULT)) q("UPDATE ji_users SET pass = ? WHERE id = ?", [password_hash($pw, PASSWORD_DEFAULT), $u['id']]);
  $role = in_array($email, $CFG['admins'], true) ? 'admin' : $u['role'];
  q("UPDATE ji_users SET last_login = ?, role = ? WHERE id = ?", [now(), $role, $u['id']]);
  q("DELETE FROM ji_login_fails WHERE at < (NOW() - INTERVAL 1 DAY)");
  $u['role'] = $role;
  out(['token' => new_session($u['id']), 'user' => user_out($u)]);
}
case 'logout': {
  $t = $R['_t'] ?? ''; if (is_string($t) && $t) q("DELETE FROM ji_sessions WHERE token = ?", [token_hash($t)]);
  out(true);
}
case 'me': { $u = me($R, false); out($u ? user_out($u) : null); }
case 'profile_update': {
  $u = me($R); $nick = str($R['nick'] ?? $u['nick'], 10); $region = str($R['region'] ?? $u['region'], 40);
  if (mb_strlen($nick) < 2) fail('닉네임은 2~10자로 입력해 주세요.');
  if ($nick !== $u['nick'] && one("SELECT id FROM ji_users WHERE nick = ?", [$nick])) fail('이미 사용 중인 닉네임입니다.');
  q("UPDATE ji_users SET nick = ?, region = ? WHERE id = ?", [$nick, $region, $u['id']]);
  if ($nick !== $u['nick']) q("UPDATE ji_posts SET author_nick = ? WHERE author = ?", [$nick, $u['id']]);
  out(['nick' => $nick, 'region' => $region]);
}

case 'password_change': {
  $u = me($R); $row = one("SELECT pass FROM ji_users WHERE id = ?", [$u['id']]);
  if (!password_verify((string)($R['cur'] ?? ''), $row['pass'])) fail('현재 비밀번호가 올바르지 않습니다.');
  $n = (string)($R['new'] ?? ''); if (strlen($n) < 8) fail('새 비밀번호는 8자 이상이어야 합니다.');
  q("UPDATE ji_users SET pass = ? WHERE id = ?", [password_hash($n, PASSWORD_DEFAULT), $u['id']]);
  q("DELETE FROM ji_sessions WHERE user_id = ? AND token <> ?", [$u['id'], token_hash($R['_t'])]);   // 다른 기기는 로그아웃
  out(true);
}
case 'account_delete': {
  $u = me($R); $row = one("SELECT pass FROM ji_users WHERE id = ?", [$u['id']]);
  if (!password_verify((string)($R['pw'] ?? ''), $row['pass'])) fail('비밀번호가 올바르지 않습니다.');
  q("DELETE FROM ji_sessions WHERE user_id = ?", [$u['id']]);
  q("DELETE FROM ji_notifications WHERE user_id = ?", [$u['id']]);
  q("DELETE FROM ji_club_joins WHERE applicant = ?", [$u['id']]);
  q("DELETE FROM ji_users WHERE id = ?", [$u['id']]);
  out(true);
}
case 'my_comments': {
  $u = me($R);
  out(array_map('cmt_out', all("SELECT * FROM ji_comments WHERE author = ? ORDER BY created_at DESC LIMIT 300", [$u['id']])));
}

/* ───────── 글 ───────── */
case 'post_list': {
  $b = str($R['board'] ?? '', 30); if (!in_array($b, $BOARDS, true)) fail('게시판 이름이 올바르지 않아요');
  out(array_map('post_out', all("SELECT * FROM ji_posts WHERE board = ? ORDER BY created_at DESC LIMIT 300", [$b])));
}
case 'post_get': {
  $id = $R['id'] ?? ''; if (!is_uuid($id)) out(null);
  $r = one("SELECT * FROM ji_posts WHERE id = ?", [$id]); if (!$r) out(null);
  if (!empty($R['view'])) { q("UPDATE ji_posts SET views = views + 1 WHERE id = ?", [$id]); $r['views']++; }
  out(post_out($r));
}
case 'post_create': {
  $u = me($R); $b = str($R['board'] ?? '', 30);
  if (!in_array($b, $BOARDS, true)) fail('게시판 이름이 올바르지 않아요');
  if (in_array($b, ['제주상점', '특가공구'], true) && !in_array($u['role'], ['admin', 'seller'], true)) fail('승인된 판매자만 올릴 수 있어요', 403);
  $title = str($R['title'] ?? '', 120); if ($title === '') fail('제목을 입력해 주세요.');
  $recent = one("SELECT COUNT(*) n FROM ji_posts WHERE author = ? AND created_at > (NOW() - INTERVAL 1 MINUTE)", [$u['id']])['n'];
  if ($recent >= 3) fail('글을 너무 빨리 올리고 있어요. 잠시 후 다시 해 주세요.', 429);
  $id = uuid(); $t = now();
  q("INSERT INTO ji_posts (id, board, head, title, content, loc, meta, price, extra, author, author_nick, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
    [$id, $b, str($R['head'] ?? '', 30), $title, str($R['content'] ?? '', 20000), str($R['loc'] ?? '', 100), str($R['meta'] ?? '', 255),
     str($R['price'] ?? '', 60), json_encode($R['extra'] ?? new stdClass(), JSON_UNESCAPED_UNICODE), $u['id'], $u['nick'], $t, $t]);
  out(post_out(one("SELECT * FROM ji_posts WHERE id = ?", [$id])));
}
case 'post_update': {
  $u = me($R); $id = $R['id'] ?? ''; $r = is_uuid($id) ? one("SELECT * FROM ji_posts WHERE id = ?", [$id]) : null;
  if (!$r) fail('글을 찾을 수 없어요', 404);
  if ($r['author'] !== $u['id'] && $u['role'] !== 'admin') fail('내가 쓴 글만 고칠 수 있어요', 403);
  $title = str($R['title'] ?? $r['title'], 120); if ($title === '') fail('제목을 입력해 주세요.');
  $extra = array_key_exists('extra', $R) ? json_encode($R['extra'] ?: new stdClass(), JSON_UNESCAPED_UNICODE) : $r['extra'];
  q("UPDATE ji_posts SET head = ?, title = ?, content = ?, loc = ?, meta = ?, price = ?, extra = ?, updated_at = ? WHERE id = ?",
    [str($R['head'] ?? $r['head'], 30), $title, str($R['content'] ?? $r['content'], 20000), str($R['loc'] ?? $r['loc'], 100),
     str($R['meta'] ?? $r['meta'], 255), str($R['price'] ?? $r['price'], 60), $extra, now(), $id]);
  out(post_out(one("SELECT * FROM ji_posts WHERE id = ?", [$id])));
}
case 'post_delete': {
  $u = me($R); $id = $R['id'] ?? ''; $r = is_uuid($id) ? one("SELECT author FROM ji_posts WHERE id = ?", [$id]) : null;
  if (!$r) fail('글을 찾을 수 없어요', 404);
  if ($r['author'] !== $u['id'] && $u['role'] !== 'admin') fail('내가 쓴 글만 지울 수 있어요', 403);
  q("DELETE FROM ji_posts WHERE id = ?", [$id]);
  q("DELETE FROM ji_club_joins WHERE club_id = ?", [$id]);
  q("DELETE FROM ji_club_notices WHERE club_id = ?", [$id]);
  q("DELETE FROM ji_comments WHERE post_id = ?", [$id]);
  out(true);
}

/* ───────── 전체 새 글 + 댓글 수 (화면 캐시용) ───────── */
case 'feed': {
  $rows = all("SELECT * FROM ji_posts ORDER BY created_at DESC LIMIT 600");
  $counts = [];
  foreach (all("SELECT post_id, COUNT(*) n FROM ji_comments GROUP BY post_id") as $c) $counts[$c['post_id']] = (int)$c['n'];
  out(['posts' => array_map('post_out', $rows), 'counts' => $counts ?: new stdClass(),
       'site' => ['admin_ov' => setting('admin_ov', new stdClass()) ?: new stdClass(), 'notices' => setting('notices', [])]]);
}

/* ───────── 댓글 (예시 글에도 달 수 있게 post_id 는 아무 글 id) ───────── */
case 'comments': {
  $pid = str($R['post_id'] ?? '', 40); if ($pid === '') out([]);
  out(array_map('cmt_out', all("SELECT * FROM ji_comments WHERE post_id = ? ORDER BY created_at, id LIMIT 500", [$pid])));
}
case 'comment_add': {
  $u = me($R); $pid = str($R['post_id'] ?? '', 40); $text = str($R['text'] ?? '', 1000);
  if ($pid === '' || $text === '') fail('댓글 내용을 입력해 주세요.');
  $recent = one("SELECT COUNT(*) n FROM ji_comments WHERE author = ? AND created_at > (NOW() - INTERVAL 1 MINUTE)", [$u['id']])['n'];
  if ($recent >= 6) fail('댓글을 너무 빨리 달고 있어요. 잠시 후 다시 해 주세요.', 429);
  $id = uuid(); q("INSERT INTO ji_comments (id, post_id, author, author_nick, text, created_at) VALUES (?,?,?,?,?,?)", [$id, $pid, $u['id'], $u['nick'], $text, now()]);
  $p = is_uuid($pid) ? one("SELECT author, title FROM ji_posts WHERE id = ?", [$pid]) : null;
  if ($p && $p['author'] !== $u['id'])
    notify($p['author'], 'comment', '새 댓글', $u['nick'] . '님: ' . mb_substr($text, 0, 60), 'view.html?id=' . $pid . '#cmt-list', '제주이음 · 「' . mb_substr($p['title'], 0, 30) . '」 새 댓글', $u['nick'] . '님: ' . mb_substr($text, 0, 60));
  out(cmt_out(one("SELECT * FROM ji_comments WHERE id = ?", [$id])));
}
case 'comment_update': {
  $u = me($R); $text = str($R['text'] ?? '', 1000); if ($text === '') fail('댓글 내용을 입력해 주세요.');
  $c = one("SELECT * FROM ji_comments WHERE id = ?", [$R['id'] ?? '']); if (!$c) fail('댓글을 찾을 수 없어요', 404);
  if ($c['author'] !== $u['id']) fail('내가 쓴 댓글만 고칠 수 있어요', 403);
  q("UPDATE ji_comments SET text = ?, edited = 1 WHERE id = ?", [$text, $c['id']]);
  out(cmt_out(one("SELECT * FROM ji_comments WHERE id = ?", [$c['id']])));
}
case 'comment_delete': {
  $u = me($R); $c = one("SELECT author FROM ji_comments WHERE id = ?", [$R['id'] ?? '']); if (!$c) fail('댓글을 찾을 수 없어요', 404);
  if ($c['author'] !== $u['id'] && $u['role'] !== 'admin') fail('내가 쓴 댓글만 지울 수 있어요', 403);
  q("DELETE FROM ji_comments WHERE id = ?", [$R['id']]); out(true);
}

/* ───────── 동호회 가입 신청 ───────── */
case 'join_my': {
  $u = me($R, false); if (!$u || !is_uuid($R['club_id'] ?? '')) out(null);
  $j = one("SELECT * FROM ji_club_joins WHERE club_id = ? AND applicant = ?", [$R['club_id'], $u['id']]);
  out($j ? join_out($j) : null);
}
case 'join_request': {
  $u = me($R); $c = club_of($R['club_id'] ?? '');
  if ($c['author'] === $u['id']) fail('내가 만든 모임이에요');
  if (one("SELECT id FROM ji_club_joins WHERE club_id = ? AND applicant = ?", [$c['id'], $u['id']])) fail('이미 신청한 모임이에요');
  $id = uuid(); $msg = str($R['message'] ?? '', 300);
  q("INSERT INTO ji_club_joins (id, club_id, club_title, owner, applicant, applicant_nick, message, created_at) VALUES (?,?,?,?,?,?,?,?)",
    [$id, $c['id'], $c['title'], $c['author'], $u['id'], $u['nick'], $msg, now()]);
  $body = $u['nick'] . '님이 「' . $c['title'] . '」에 가입을 신청했어요.';
  notify($c['author'], 'join_request', '새 가입 신청', $body, 'activity.html#received', '제주이음 · 새 가입 신청', $body);
  out(join_out(one("SELECT * FROM ji_club_joins WHERE id = ?", [$id])));
}
case 'join_cancel': {
  $u = me($R); q("DELETE FROM ji_club_joins WHERE id = ? AND applicant = ?", [$R['id'] ?? '', $u['id']]); out(true);
}
case 'joins_received': { $u = me($R); out(array_map('join_out', all("SELECT * FROM ji_club_joins WHERE owner = ? ORDER BY created_at DESC LIMIT 300", [$u['id']]))); }
case 'joins_sent':     { $u = me($R); out(array_map('join_out', all("SELECT * FROM ji_club_joins WHERE applicant = ? ORDER BY created_at DESC LIMIT 300", [$u['id']]))); }
case 'join_decide': {
  $u = me($R); $st = $R['status'] ?? '';
  if (!in_array($st, ['approved', 'rejected'], true)) fail('처리 방법이 올바르지 않아요');
  $j = one("SELECT * FROM ji_club_joins WHERE id = ? AND owner = ?", [$R['id'] ?? '', $u['id']]);
  if (!$j) fail('신청을 찾을 수 없어요', 404);
  if ($j['status'] !== $st) {
    q("UPDATE ji_club_joins SET status = ?, decided_at = ? WHERE id = ?", [$st, now(), $j['id']]);
    $t = $st === 'approved' ? '가입이 승인됐어요 🎉' : '가입 신청 결과';
    $b = '「' . $j['club_title'] . '」 ' . ($st === 'approved' ? '모임장이 가입을 승인했어요.' : '이번에는 함께하기 어렵다는 답을 받았어요.');
    notify($j['applicant'], 'join_' . $st, $t, $b, 'view.html?id=' . $j['club_id'], '제주이음 · ' . $t, '「' . $j['club_title'] . '」');
  }
  out(join_out(one("SELECT * FROM ji_club_joins WHERE id = ?", [$j['id']])));
}
case 'join_count': {
  if (!is_uuid($R['club_id'] ?? '')) out(0);
  out((int)one("SELECT COUNT(*) n FROM ji_club_joins WHERE club_id = ? AND status = 'pending'", [$R['club_id']])['n']);
}

/* ───────── 모임 공지 · 회원 ───────── */
case 'notices': {
  $u = me($R, false); if (!$u || !is_uuid($R['club_id'] ?? '')) out([]);
  $c = one("SELECT author FROM ji_posts WHERE id = ?", [$R['club_id']]); if (!$c) out([]);
  $ok = $c['author'] === $u['id'] || one("SELECT id FROM ji_club_joins WHERE club_id = ? AND applicant = ? AND status = 'approved'", [$R['club_id'], $u['id']]);
  if (!$ok) out([]);
  out(array_map(function ($n) { $n['created_at'] = iso($n['created_at']); return $n; },
    all("SELECT * FROM ji_club_notices WHERE club_id = ? ORDER BY created_at DESC LIMIT 50", [$R['club_id']])));
}
case 'notice_add': {
  $u = me($R); $c = club_of($R['club_id'] ?? '');
  if ($c['author'] !== $u['id']) fail('모임장만 공지를 남길 수 있어요', 403);
  $body = str($R['body'] ?? '', 1000); if ($body === '') fail('공지 내용을 입력해 주세요.');
  $id = uuid(); q("INSERT INTO ji_club_notices (id, club_id, club_title, owner, body, created_at) VALUES (?,?,?,?,?,?)", [$id, $c['id'], $c['title'], $u['id'], $body, now()]);
  $short = mb_substr($body, 0, 60) . (mb_strlen($body) > 60 ? '…' : '');
  foreach (all("SELECT applicant FROM ji_club_joins WHERE club_id = ? AND status = 'approved'", [$c['id']]) as $m)
    notify($m['applicant'], 'club_notice', '「' . $c['title'] . '」 모임 공지', $short, 'view.html?id=' . $c['id'] . '#club-notices', '제주이음 · ' . $c['title'] . ' 공지', $short);
  $n = one("SELECT * FROM ji_club_notices WHERE id = ?", [$id]); $n['created_at'] = iso($n['created_at']); out($n);
}
case 'notice_delete': { $u = me($R); q("DELETE FROM ji_club_notices WHERE id = ? AND owner = ?", [$R['id'] ?? '', $u['id']]); out(true); }
case 'club_members': {
  $u = me($R, false); if (!$u || !is_uuid($R['club_id'] ?? '')) out([]);
  $c = one("SELECT author FROM ji_posts WHERE id = ?", [$R['club_id']]); if (!$c) out([]);
  $rows = $c['author'] === $u['id']
    ? all("SELECT id, applicant_nick, status, decided_at, created_at FROM ji_club_joins WHERE club_id = ? ORDER BY created_at", [$R['club_id']])
    : all("SELECT id, applicant_nick, status, decided_at, created_at FROM ji_club_joins WHERE club_id = ? AND applicant = ?", [$R['club_id'], $u['id']]);
  out(array_map('join_out', $rows));
}

/* ───────── 상점·공구 승인 요청 ───────── */
case 'seller_request': {
  $u = me($R); $b = $R['board'] ?? '';
  if (!in_array($b, ['제주상점', '특가공구'], true)) fail('게시판 이름이 올바르지 않아요');
  q("INSERT INTO ji_seller_requests (id, board, applicant, applicant_nick, details, message, created_at) VALUES (?,?,?,?,?,?,?)",
    [uuid(), $b, $u['id'], $u['nick'], json_encode($R['details'] ?? new stdClass(), JSON_UNESCAPED_UNICODE), str($R['message'] ?? '', 1000), now()]);
  foreach (all("SELECT id FROM ji_users WHERE role = 'admin'") as $ad)
    notify($ad['id'], 'seller_request', '새 입점·공구 요청', $u['nick'] . '님이 ' . $b . ' 승인을 요청했어요.', 'admin/index.html');
  out(true);
}

/* ───────── 문의·신청 (로그인 없이 보낼 수 있음) ───────── */
case 'inquiry_add': {
  $d = $R['data'] ?? null; if (!is_array($d)) fail('내용이 비어 있어요');
  $n = one("SELECT COUNT(*) n FROM ji_inquiries WHERE ip = ? AND created_at > (NOW() - INTERVAL 10 MINUTE)", [ip()])['n'];
  if ($n >= 5) fail('잠시 후 다시 보내 주세요.', 429);
  $js = json_encode($d, JSON_UNESCAPED_UNICODE); if (strlen($js) > 8000) fail('내용이 너무 길어요');
  q("INSERT INTO ji_inquiries (id, data, ip, created_at) VALUES (?,?,?,?)", [uuid(), $js, ip(), now()]);
  foreach (all("SELECT id FROM ji_users WHERE role = 'admin'") as $ad)
    notify($ad['id'], 'inquiry', '새 문의·신청', mb_substr((string)($d['type'] ?? $d['service'] ?? '문의'), 0, 40) . ' · ' . mb_substr((string)($d['name'] ?? ''), 0, 20), 'admin/index.html');
  out(true);
}

/* ───────── 관리자 ───────── */
case 'admin_overview': {
  admin($R);
  out(['users' => (int)one("SELECT COUNT(*) n FROM ji_users")['n'],
       'users_week' => (int)one("SELECT COUNT(*) n FROM ji_users WHERE created_at > (NOW() - INTERVAL 7 DAY)")['n'],
       'posts' => (int)one("SELECT COUNT(*) n FROM ji_posts")['n'],
       'comments' => (int)one("SELECT COUNT(*) n FROM ji_comments")['n'],
       'inquiries_new' => (int)one("SELECT COUNT(*) n FROM ji_inquiries WHERE status = 'new'")['n'],
       'sellers_pending' => (int)one("SELECT COUNT(*) n FROM ji_seller_requests WHERE status = 'pending'")['n']]);
}
case 'admin_users': {
  admin($R);
  out(array_map(function ($u) { $u['created_at'] = iso($u['created_at']); $u['last_login'] = iso($u['last_login']); return $u; },
    all("SELECT u.id, u.email, u.nick, u.region, u.role, u.created_at, u.last_login,
         (SELECT COUNT(*) FROM ji_posts p WHERE p.author = u.id) posts FROM ji_users u ORDER BY u.created_at DESC LIMIT 500")));
}
case 'admin_set_role': {
  $a = admin($R); $role = $R['role'] ?? '';
  if (!in_array($role, ['user', 'seller', 'admin'], true)) fail('역할이 올바르지 않아요');
  if (($R['id'] ?? '') === $a['id'] && $role !== 'admin') fail('내 관리자 권한은 내릴 수 없어요');
  q("UPDATE ji_users SET role = ? WHERE id = ?", [$role, $R['id'] ?? '']); out(true);
}
case 'admin_set': {
  admin($R); $k = $R['k'] ?? '';
  if (!in_array($k, ['admin_ov', 'notices'], true)) fail('저장할 수 없는 항목이에요');
  $v = json_encode($R['v'] ?? null, JSON_UNESCAPED_UNICODE); if (strlen($v) > 2000000) fail('너무 커요');
  q("REPLACE INTO ji_settings (k, v, updated_at) VALUES (?,?,?)", [$k, $v, now()]); out(true);
}
case 'admin_inquiries': {
  admin($R);
  out(array_map(function ($r) { $d = json_decode($r['data'], true) ?: []; $d['id'] = $r['id']; $d['status'] = $r['status'];
    $d['date'] = date('Y-m-d H:i', strtotime($r['created_at'])); return $d; },
    all("SELECT * FROM ji_inquiries ORDER BY created_at DESC LIMIT 500")));
}
case 'admin_inquiry_set': {
  admin($R); $st = $R['status'] ?? ''; if (!in_array($st, ['new', 'contacted', 'done'], true)) fail('상태가 올바르지 않아요');
  q("UPDATE ji_inquiries SET status = ? WHERE id = ?", [$st, $R['id'] ?? '']); out(true);
}
case 'admin_inquiry_delete': { admin($R); q("DELETE FROM ji_inquiries WHERE id = ?", [$R['id'] ?? '']); out(true); }
case 'admin_sellers': {
  admin($R);
  out(array_map(function ($r) { $r['details'] = json_decode($r['details'], true); $r['created_at'] = iso($r['created_at']);
    $u = one("SELECT email, region FROM ji_users WHERE id = ?", [$r['applicant']]); $r['email'] = $u['email'] ?? ''; $r['region'] = $u['region'] ?? ''; return $r; },
    all("SELECT * FROM ji_seller_requests ORDER BY created_at DESC LIMIT 300")));
}
case 'admin_seller_decide': {
  admin($R); $st = $R['status'] ?? ''; if (!in_array($st, ['approved', 'rejected'], true)) fail('처리 방법이 올바르지 않아요');
  $r = one("SELECT * FROM ji_seller_requests WHERE id = ?", [$R['id'] ?? '']); if (!$r) fail('요청을 찾을 수 없어요', 404);
  q("UPDATE ji_seller_requests SET status = ? WHERE id = ?", [$st, $r['id']]);
  if ($st === 'approved') q("UPDATE ji_users SET role = 'seller' WHERE id = ? AND role = 'user'", [$r['applicant']]);
  $link = $r['board'] === '제주상점' ? 'shops.html' : 'deals.html';
  notify($r['applicant'], 'seller_' . $st, $st === 'approved' ? $r['board'] . ' 승인 완료 🎉' : $r['board'] . ' 요청 결과',
    $st === 'approved' ? '이제 ' . $r['board'] . '에 글을 올릴 수 있어요. (사이트를 새로고침하면 바로 반영돼요)' : '이번에는 승인이 어렵다는 답을 받았어요. 자세한 내용은 문의해 주세요.', $link);
  out(true);
}

/* ───────── 알림함 ───────── */
case 'notis': {
  $u = me($R);
  out(array_map(function ($n) { $n['read'] = (bool)$n['is_read']; unset($n['is_read']); $n['created_at'] = iso($n['created_at']); return $n; },
    all("SELECT * FROM ji_notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50", [$u['id']])));
}
case 'noti_unread': { $u = me($R, false); out($u ? (int)one("SELECT COUNT(*) n FROM ji_notifications WHERE user_id = ? AND is_read = 0", [$u['id']])['n'] : 0); }
case 'noti_read_all': { $u = me($R); q("UPDATE ji_notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0", [$u['id']]); out(true); }

default: fail('알 수 없는 요청이에요', 404);
}
} catch (PDOException $e) {
  if ($e->getCode() == 23000) fail('이미 등록된 내용이에요');
  error_log('[jeju api] ' . $e->getMessage());
  fail('서버에서 문제가 생겼어요. 잠시 후 다시 해 주세요.', 500);
}
