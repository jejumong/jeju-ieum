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
if ($a === 'upload') { $R = ['_t' => $_POST['_t'] ?? '']; }   // 사진은 multipart 로 받음
else {
  $raw = file_get_contents('php://input');
  $R = $raw ? json_decode($raw, true) : [];
  if (!is_array($R)) $R = [];
}
if ($a === '' || $a === 'ping') out(['pong' => true, 'time' => iso(now()), 'schema' => (int)(one("SELECT v FROM ji_meta WHERE k='schema'")['v'] ?? 0), 'mail' => function_exists('mail'), 'smtp' => !empty($CFG['smtp_user']) && !empty($CFG['smtp_pass']), 'smtp_host' => (string)($CFG['smtp_host'] ?? '')]);

function post_out($r) {
  $x = json_decode($r['extra'] ?: '{}', true);
  return ['id' => $r['id'], 'board' => $r['board'], 'head' => $r['head'], 'title' => $r['title'], 'content' => $r['content'],
    'loc' => $r['loc'], 'meta' => $r['meta'], 'price' => $r['price'], 'extra' => $x ?: new stdClass(),
    'author' => $r['author'], 'author_nick' => $r['author_nick'], 'author_role' => $r['author_role'] ?? 'user', 'views' => (int)$r['views'],
    'created_at' => iso($r['created_at']), 'updated_at' => iso($r['updated_at']), 'hidden' => !post_live($r)];
}
function likes_map() {
  $m = [];
  foreach (all("SELECT post_id, COUNT(*) n FROM ji_likes WHERE active = 1 GROUP BY post_id") as $r) $m[$r['post_id']] = (int)$r['n'];
  foreach (all("SELECT id, likes_adj FROM ji_posts WHERE likes_adj <> 0") as $r) $m[$r['id']] = max(0, ($m[$r['id']] ?? 0) + (int)$r['likes_adj']);   // 관리자가 정한 수
  return $m ?: new stdClass();
}
function cmt_out($c) {
  $del = !empty($c['deleted']);
  return ['id' => $c['id'], 'post_id' => $c['post_id'], 'author' => $del ? '' : $c['author'], 'author_nick' => $del ? '' : $c['author_nick'],
    'text' => $del ? '' : $c['text'], 'edited' => (bool)$c['edited'], 'created_at' => iso($c['created_at']),
    'parent_id' => $c['parent_id'] ?? null, 'reply_nick' => $c['reply_nick'] ?? '', 'deleted' => $del];
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
function msg_out($m, $me) {
  return ['id' => $m['id'], 'from' => $m['sender'], 'from_nick' => $m['sender_nick'], 'to' => $m['receiver'], 'to_nick' => $m['receiver_nick'],
    'body' => $m['body'], 'kind' => $m['kind'], 'read' => $m['read_at'] !== null, 'mine' => $m['sender'] === $me, 'created_at' => iso($m['created_at'])];
}
function send_msg($from, $fromNick, $to, $body, $kind = 'dm', $ref = '') {
  $id = uuid();
  q("INSERT INTO ji_messages (id, sender, sender_nick, receiver, receiver_nick, body, kind, ref, created_at) VALUES (?,?,?,?,?,?,?,?,?)",
    [$id, $from, $fromNick, $to['id'], $to['nick'], $body, $kind, $ref, now()]);
  notify($to['id'], 'message', '✉️ ' . $fromNick . '님의 쪽지', mb_substr($body, 0, 80), 'messages.html?open=' . $id,
    '제주이음 · ' . $fromNick . '님의 쪽지', mb_substr($body, 0, 80), false);   // 쪽지는 쪽지함 숫자로만 — 알림함에는 안 남기고 휴대폰 푸시만
  return $id;
}
$BOARDS = ['동호회', '구인구직', '중고사고팔기', '부동산', '제주상점', '특가공구', '축제정보', '자유게시판', '질문하기', '최신뉴스', '생활정보', '취미·여행', '교육', '건강웰빙', '제주북쪽', '제주동쪽', '제주서쪽', '제주남쪽'];

if ($a !== 'hit' && $a !== 'hit_dur') { try { if (one("SELECT id FROM ji_scheduled WHERE status = 'wait' AND at <= NOW() LIMIT 1")) publish_due(); } catch (Throwable $e) {} }

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
  if (reserved_nick($nick)) fail('운영자용 이름이라 쓸 수 없어요. 다른 닉네임을 골라 주세요.');
  // 관리자 계정이 이미 있으면 ADMIN_EMAILS 의 다른 주소로 새로 가입해 관리자가 되는 것을 막음 (이메일 인증이 없어서)
  if (in_array($email, $CFG['admins'], true) && one("SELECT id FROM ji_users WHERE role = 'admin'")) fail('이 이메일로는 가입할 수 없어요.');
  $role = in_array($email, $CFG['admins'], true) ? 'admin' : 'user';
  $id = uuid();
  q("INSERT INTO ji_users (id, email, pass, nick, region, role, created_at, last_login) VALUES (?,?,?,?,?,?,?,?)",
    [$id, $email, password_hash($pw, PASSWORD_DEFAULT), $nick, $region, $role, now(), now()]);
  alert_admins('signup', '👋 새 회원가입', $nick . '님이 가입했어요' . ($region ? ' (' . $region . ')' : ''), 'admin/index.html#members', $id);
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
  if ($nick !== $u['nick'] && !is_mod($u) && reserved_nick($nick)) fail('운영자용 이름이라 쓸 수 없어요. 다른 닉네임을 골라 주세요.');
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
  $joined = one("SELECT created_at FROM ji_users WHERE id = ?", [$u['id']])['created_at'] ?? null;
  q("DELETE FROM ji_users WHERE id = ?", [$u['id']]);
  q("DELETE FROM ji_settings WHERE k = ?", ['al:' . $u['id']]);
  log_leave($joined, false);
  q("DELETE FROM ji_suspend_log WHERE user_id = ?", [$u['id']]);   // 탈퇴하면 이름이 남는 기록은 지움
  q("UPDATE ji_reports SET reporter_nick = '(탈퇴한 회원)' WHERE reporter = ?", [$u['id']]);
  q("UPDATE ji_reports SET target_nick = '(탈퇴한 회원)' WHERE target_author = ?", [$u['id']]);
  alert_admins('leave', '🚪 회원 탈퇴', $u['nick'] . '님이 탈퇴했어요', 'admin/index.html#members', $u['id']);
  out(true);
}
/* 비밀번호 찾기: 이메일로 재설정 링크 보내기 (가입 여부는 알려 주지 않음) */
case 'pw_reset_request': {
  $email = strtolower(str($R['email'] ?? '', 190));
  if (!filter_var($email, FILTER_VALIDATE_EMAIL)) fail('올바른 이메일 형식이 아닙니다.');
  q("DELETE FROM ji_resets WHERE created_at < (NOW() - INTERVAL 1 DAY)");
  $byIp = one("SELECT COUNT(*) n FROM ji_resets WHERE ip = ? AND created_at > (NOW() - INTERVAL 1 HOUR)", [ip()])['n'];
  $byMail = one("SELECT COUNT(*) n FROM ji_resets WHERE email = ? AND created_at > (NOW() - INTERVAL 1 HOUR)", [$email])['n'];
  if ($byIp >= 5 || $byMail >= 3) fail('요청이 너무 많아요. 1시간 뒤에 다시 해 주세요.', 429);
  $u = one("SELECT id, nick FROM ji_users WHERE email = ?", [$email]);
  if ($u) {
    $tok = bin2hex(random_bytes(32));
    q("INSERT INTO ji_resets (token, user_id, email, ip, expires_at, created_at) VALUES (?,?,?,?,?,?)",
      [token_hash($tok), $u['id'], $email, ip(), date('Y-m-d H:i:s', time() + 1800), now()]);
    $link = rtrim($CFG['site_url'], '/') . '/reset.html#t=' . $tok;
    $sent = send_mail($email, '[제주이음] 비밀번호 재설정 안내',
      $u['nick'] . "님, 안녕하세요. 제주이음입니다.\n\n" .
      "아래 링크를 눌러 새 비밀번호를 정해 주세요. 링크는 30분 동안, 한 번만 쓸 수 있어요.\n\n" . $link . "\n\n" .
      "직접 요청하지 않으셨다면 이 메일은 무시하셔도 됩니다. 비밀번호는 바뀌지 않아요.\n\n" .
      "— 제주이음 (jejuieum.com)\n문의: help@jejuieum.com");
    if (!$sent) error_log('[jeju] reset mail failed: ' . $email);
  } else {
    q("INSERT INTO ji_resets (token, user_id, email, ip, expires_at, used_at, created_at) VALUES (?,?,?,?,?,?,?)",
      [token_hash(bin2hex(random_bytes(32))), '', $email, ip(), now(), now(), now()]);   // 횟수 제한용 기록만
  }
  out(true);
}
case 'pw_reset': {
  $tok = (string)($R['t'] ?? ''); $pw = (string)($R['pw'] ?? '');
  if (!preg_match('/^[a-f0-9]{64}$/', $tok)) fail('링크가 올바르지 않아요. 비밀번호 찾기를 다시 해 주세요.');
  if (strlen($pw) < 8) fail('비밀번호는 8자 이상이어야 합니다.');
  $r = one("SELECT * FROM ji_resets WHERE token = ?", [token_hash($tok)]);
  if (!$r || $r['used_at'] || strtotime($r['expires_at']) < time() || !$r['user_id']) fail('링크가 만료되었거나 이미 사용됐어요. 비밀번호 찾기를 다시 해 주세요.');
  q("UPDATE ji_users SET pass = ? WHERE id = ?", [password_hash($pw, PASSWORD_DEFAULT), $r['user_id']]);
  q("UPDATE ji_resets SET used_at = ? WHERE user_id = ? AND used_at IS NULL", [now(), $r['user_id']]);
  q("DELETE FROM ji_sessions WHERE user_id = ?", [$r['user_id']]);   // 모든 기기에서 로그아웃
  q("DELETE FROM ji_login_fails WHERE ip = ?", [ip()]);
  out(true);
}
/* 메일 발송 점검: GitHub 매달 자동 실행 → help@ 로 점검 메일 (Brevo 키가 90일 안 쓰면 만료되는 것 방지) */
/* 운영 정리용 (GitHub Actions '서버 글 정리' 에서만 호출 — cron_key 필요)
   op=list : 모든 글·댓글 목록 (제목·작성자만) / op=delete : ids 의 글(댓글·사진 포함)과 cids 의 댓글 삭제 */
case 'maint': {
  $k = (string)($R['key'] ?? ''); $want = (string)($CFG['cron_key'] ?? '');
  if ($want === '' || !hash_equals($want, $k)) fail('권한이 없어요', 403);
  $op = $R['op'] ?? 'list';
  if ($op === 'list') {
    out(['posts' => all("SELECT id, board, title, author_nick, created_at FROM ji_posts ORDER BY created_at"),
         'comments' => all("SELECT id, post_id, LEFT(text, 30) text, author_nick, created_at FROM ji_comments ORDER BY created_at")]);
  }
  if ($op === 'delete') {
    $n = 0; $m = 0;
    foreach ((array)($R['ids'] ?? []) as $id) {
      if (!is_uuid($id) || !one("SELECT id FROM ji_posts WHERE id = ?", [$id])) continue;
      q("DELETE FROM ji_posts WHERE id = ?", [$id]);
      q("DELETE FROM ji_club_joins WHERE club_id = ?", [$id]);
      q("DELETE FROM ji_club_notices WHERE club_id = ?", [$id]);
      q("DELETE FROM ji_comments WHERE post_id = ?", [$id]);
      foreach (all("SELECT path FROM ji_uploads WHERE post_id = ?", [$id]) as $o) remove_upload($o['path']);
      q("DELETE FROM ji_likes WHERE post_id = ?", [$id]);
      $n++;
    }
    foreach ((array)($R['cids'] ?? []) as $cid) { if (is_string($cid) && $cid !== '') { q("DELETE FROM ji_comments WHERE id = ?", [$cid]); $m++; } }
    out(['deleted_posts' => $n, 'deleted_comments' => $m]);
  }
  if ($op === 'op_upload') {   // 운영자 정보 글 올리기 — 관리자 계정(ADMIN_EMAILS 첫 번째) 이름으로, 이미 올린 글(extra.op 같음)은 건너뜀
    $a = null; foreach ($CFG['admins'] as $em) { $a = one("SELECT * FROM ji_users WHERE email = ?", [$em]); if ($a) break; }
    if (!$a) fail('관리자 계정을 찾지 못했어요');
    $done = []; foreach (all("SELECT extra FROM ji_posts WHERE author = ?", [$a['id']]) as $r) { $x = json_decode($r['extra'] ?: '{}', true); if (!empty($x['op'])) $done[$x['op']] = 1; }
    $list = array_reverse((array)($R['posts'] ?? [])); $base = time() - count($list); $n = 0; $skip = 0;
    foreach ($list as $i => $p) {
      $k = str($p['k'] ?? '', 40); $b = str($p['board'] ?? '', 30);
      if ($k === '' || !in_array($b, $BOARDS, true)) continue;
      if (isset($done[$k])) { $skip++; continue; }
      $t = date('Y-m-d H:i:s', $base + $i);
      if (isset($R['extra']['op']) && ($u['role'] ?? '') !== 'admin') unset($R['extra']['op']);   // 운영자 글 표시는 관리자만
  q("INSERT INTO ji_posts (id, board, head, title, content, loc, meta, price, extra, author, author_nick, created_at, updated_at) VALUES (?,?,?,?,?,'','','',?,?,?,?,?)",
        [uuid(), $b, str($p['head'] ?? '', 30), str($p['title'] ?? '', 120), str($p['content'] ?? '', 20000), json_encode(['op' => $k], JSON_UNESCAPED_UNICODE), $a['id'], $a['nick'], $t, $t]);
      $n++;
    }
    out(['as' => $a['nick'], 'uploaded' => $n, 'skipped' => $skip]);
  }
  if ($op === 'admin_nick') {   // 관리자 계정 닉네임을 바꾸고, 이미 쓴 글·댓글·쪽지의 작성자 이름도 함께 바꿈
    $nick = str(((array)($R['ids'] ?? []))[0] ?? '', 20); if ($nick === '') fail('닉네임이 비었어요');
    $ad = all("SELECT id FROM ji_users WHERE role = 'admin'"); if (count($ad) !== 1) fail('관리자 계정이 ' . count($ad) . '개예요');
    $aid = $ad[0]['id'];
    if (one("SELECT id FROM ji_users WHERE nick = ? AND id <> ?", [$nick, $aid])) fail('다른 회원이 쓰는 닉네임이에요');
    q("UPDATE ji_users SET nick = ? WHERE id = ?", [$nick, $aid]);
    $c = [q("UPDATE ji_posts SET author_nick = ? WHERE author = ?", [$nick, $aid])->rowCount(), q("UPDATE ji_comments SET author_nick = ? WHERE author = ?", [$nick, $aid])->rowCount(),
          q("UPDATE ji_messages SET sender_nick = ? WHERE sender = ?", [$nick, $aid])->rowCount(), q("UPDATE ji_messages SET receiver_nick = ? WHERE receiver = ?", [$nick, $aid])->rowCount()];
    out(['nick' => $nick, 'posts' => $c[0], 'comments' => $c[1], 'msgs' => $c[2] + $c[3]]);
  }
  if ($op === 'admins') {   // 관리자 계정 확인 (기록이 공개될 수 있어 이메일은 가림)
    $mask = function($e){ $p = explode('@', $e); return mb_substr($p[0], 0, 2) . '***@' . ($p[1] ?? ''); };
    out(['admins' => array_map(function($u) use ($mask) { return ['nick' => $u['nick'], 'email' => $mask($u['email'])]; }, all("SELECT nick, email FROM ji_users WHERE role = 'admin'")),
         'help_taken' => (bool)one("SELECT id FROM ji_users WHERE email = 'help@jejuieum.com'")]);
  }
  if ($op === 'admin_email') {   // 관리자 계정이 하나일 때만, 그 계정의 로그인 이메일을 바꿈
    $new = strtolower(trim((string)(((array)($R['ids'] ?? []))[0] ?? '')));
    if (!filter_var($new, FILTER_VALIDATE_EMAIL)) fail('이메일 형식이 아니에요');
    $ad = all("SELECT id, nick FROM ji_users WHERE role = 'admin'");
    if (count($ad) !== 1) fail('관리자 계정이 ' . count($ad) . '개라 자동으로 바꾸지 않았어요');
    if (one("SELECT id FROM ji_users WHERE email = ? AND id <> ?", [$new, $ad[0]['id']])) fail('이미 다른 계정이 쓰는 이메일이에요');
    q("UPDATE ji_users SET email = ? WHERE id = ?", [$new, $ad[0]['id']]);
    out(['changed' => $ad[0]['nick']]);
  }
  if ($op === 'op_sync') {   // 초안 파일에서 고친 제목·본문·말머리를 이미 올린 운영자 글에 반영 (게시판은 그대로)
    $map = [];
    foreach (all("SELECT id, board, title, content, head, extra FROM ji_posts WHERE extra LIKE '%\"op\"%'") as $r) { $x = json_decode($r['extra'] ?: '{}', true); if (!empty($x['op'])) $map[$x['op']] = $r; }
    $n = []; 
    foreach ((array)($R['posts'] ?? []) as $p) {
      $k = (string)($p['k'] ?? ''); if (!isset($map[$k]) || !in_array($k, (array)($R['ids'] ?? []), true)) continue; $r = $map[$k];   // ids 에 적은 글만 (관리자 콘솔에서 고친 다른 글은 건드리지 않음)
      $t = str($p['title'] ?? '', 120); $c = str($p['content'] ?? '', 20000); $h = str($p['head'] ?? '', 30);
      $b = in_array($p['board'] ?? '', $BOARDS, true) ? $p['board'] : $r['board'];
      if ($t === $r['title'] && $c === $r['content'] && $h === $r['head'] && $b === $r['board']) continue;
      q("UPDATE ji_posts SET board = ?, title = ?, content = ?, head = ?, updated_at = ? WHERE id = ?", [$b, $t, $c, $h, now(), $r['id']]); $n[] = $k;
    }
    out(['updated' => $n]);
  }
  if ($op === 'op_reorder') {   // 운영자 글 시각을 초안 순서대로 1분씩 벌려 정렬 (목록 위쪽 글이 가장 최근)
    $keys = array_map(function($p){ return (string)($p['k'] ?? ''); }, (array)($R['posts'] ?? []));
    $rows = all("SELECT id, extra, created_at FROM ji_posts WHERE extra LIKE '%\"op\"%'");
    $map = []; $top = 0;
    foreach ($rows as $r) { $x = json_decode($r['extra'] ?: '{}', true); if (!empty($x['op'])) { $map[$x['op']] = $r['id']; $top = max($top, strtotime($r['created_at'])); } }
    $n = 0;
    foreach ($keys as $i => $k) { if (!isset($map[$k])) continue; $t = date('Y-m-d H:i:s', $top - $i * 60); q("UPDATE ji_posts SET created_at = ?, updated_at = ? WHERE id = ?", [$t, $t, $map[$k]]); $n++; }
    out(['reordered' => $n]);
  }
  fail('op 가 올바르지 않아요');
}
case 'mail_check': {
  $k = (string)($R['key'] ?? ''); $want = (string)($CFG['cron_key'] ?? '');
  if ($want === '' || !hash_equals($want, $k)) fail('권한이 없어요', 403);
  $to = !empty($CFG['mail_reply']) ? $CFG['mail_reply'] : 'jejumong2@naver.com';
  $ok = send_mail($to, '[제주이음] 메일 발송 점검', "제주이음 서버의 자동 메일 점검입니다.\n\n이 메일이 왔다면 비밀번호 찾기 메일도 정상으로 나가고 있어요.\n매달 1번 자동으로 보내집니다.\n\n보낸 시각: " . date('Y-m-d H:i'));
  out(['sent' => (bool)$ok, 'via' => (!empty($CFG['smtp_user']) ? ($CFG['smtp_host'] ?? 'smtp') : 'mail()'), 'to' => $to]);
}
case 'my_comments': {
  $u = me($R);
  out(array_map('cmt_out', all("SELECT * FROM ji_comments WHERE author = ? AND deleted = 0 ORDER BY created_at DESC LIMIT 300", [$u['id']])));
}

/* ───────── 사진 올리기 ───────── */
case 'upload': {
  $u = active($R);
  $n = one("SELECT COUNT(*) n FROM ji_uploads WHERE user_id = ? AND created_at > (NOW() - INTERVAL 10 MINUTE)", [$u['id']])['n'];
  if ($n >= 40 && !is_mod($u)) fail('사진을 너무 많이 올리고 있어요. 잠시 후 다시 해 주세요.', 429);
  $f = $_FILES['file'] ?? null;
  if (!$f || ($f['error'] ?? 1) !== UPLOAD_ERR_OK) fail('사진을 받지 못했어요 (' . ($f['error'] ?? '없음') . ')');
  if ($f['size'] > 6 * 1024 * 1024) fail('사진이 너무 커요 (최대 6MB)');
  $info = @getimagesize($f['tmp_name']);
  $ext = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp'][$info['mime'] ?? ''] ?? null;
  if (!$info || !$ext) fail('jpg, png, webp 사진만 올릴 수 있어요');
  if ($info[0] < 20 || $info[1] < 20 || $info[0] > 8000 || $info[1] > 8000) fail('사진 크기가 올바르지 않아요');
  $dir = date('Ym'); $full = upload_dir() . '/' . $dir;
  if (!is_dir($full) && !@mkdir($full, 0755, true)) fail('사진 폴더를 만들지 못했어요', 500);
  if (!file_exists(upload_dir() . '/index.html')) @file_put_contents(upload_dir() . '/index.html', '');
  if (!file_exists($full . '/index.html')) @file_put_contents($full . '/index.html', '');
  $id = uuid(); $path = $dir . '/' . $id . '.' . $ext;
  // GD 가 있으면 다시 저장해서 사진 속 위치정보(EXIF)·숨은 데이터를 없앰
  $saved = false;
  if (function_exists('imagecreatefromstring') && $ext !== 'webp') {
    $img = @imagecreatefromstring(file_get_contents($f['tmp_name']));
    if ($img) {
      $saved = $ext === 'png' ? @imagepng($img, $full . '/' . $id . '.png', 7) : @imagejpeg($img, $full . '/' . $id . '.jpg', 85);
      imagedestroy($img);
    }
  }
  if (!$saved && !@move_uploaded_file($f['tmp_name'], $full . '/' . $id . '.' . $ext)) fail('사진을 저장하지 못했어요', 500);
  @chmod($full . '/' . $id . '.' . $ext, 0644);
  $bytes = (int)@filesize($full . '/' . $id . '.' . $ext);
  q("INSERT INTO ji_uploads (id, user_id, path, bytes, w, h, created_at) VALUES (?,?,?,?,?,?,?)", [$id, $u['id'], $path, $bytes, $info[0], $info[1], now()]);
  // 글에 붙지 않고 하루가 지난 사진 정리
  if (random_int(1, 20) === 1) foreach (all("SELECT path FROM ji_uploads WHERE post_id IS NULL AND created_at < (NOW() - INTERVAL 1 DAY) LIMIT 50") as $o) remove_upload($o['path']);
  out(['url' => upload_base() . $path, 'w' => $info[0], 'h' => $info[1], 'bytes' => $bytes]);
}

/* ───────── 글 ───────── */
case 'post_list': {
  $b = str($R['board'] ?? '', 30); if (!in_array($b, $BOARDS, true)) fail('게시판 이름이 올바르지 않아요');
  $lv = me($R, false); $lmod = $lv && is_mod($lv);
  out(array_map('post_out', array_values(array_filter(all("SELECT p.*, u.role author_role, u.seller_until author_until FROM ji_posts p LEFT JOIN ji_users u ON u.id = p.author WHERE p.board = ? ORDER BY p.created_at DESC LIMIT 300", [$b]), function ($r) use ($lv, $lmod) { return $lmod || ($lv && $r['author'] === $lv['id']) || post_live($r); }))));
}
case 'post_get': {
  $id = $R['id'] ?? ''; if (!is_uuid($id)) out(null);
  $r = one("SELECT p.*, u.role author_role, u.seller_until author_until FROM ji_posts p LEFT JOIN ji_users u ON u.id = p.author WHERE p.id = ?", [$id]); if (!$r) out(null);
  if (!post_live($r)) { $gv = me($R, false); if (!$gv || ($gv['id'] !== $r['author'] && !is_mod($gv))) out(null); }
  if (!empty($R['view'])) {   // 조회수: 글쓴이 본인은 세지 않음 (같은 브라우저 24시간 1번은 화면에서 거름)
    $vu = me($R, false);
    if (!$vu || $vu['id'] !== $r['author']) { q("UPDATE ji_posts SET views = views + 1 WHERE id = ?", [$id]); $r['views']++; }
  }
  out(post_out($r));
}
case 'post_create': {
  $u = active($R); $b = str($R['board'] ?? '', 30);
  if (!in_array($b, $BOARDS, true)) fail('게시판 이름이 올바르지 않아요');
  if (isset(SELLER_BOARDS[$b]) && ($u['role'] ?? '') === SELLER_BOARDS[$b] && !seller_live($u['role'], $u['seller_until'] ?? null)) fail('입점 기간이 끝나 새 글을 올릴 수 없어요. 운영자에게 문의해 주세요.', 403);
  if (!can_write_board($u, $b)) fail($b === '축제정보' ? '축제 정보는 운영자가 확인한 뒤 올려요. 축제 제보로 보내 주세요.' : '승인된 ' . ($b === '제주상점' ? '상점판매자' : '공구판매자') . '만 올릴 수 있어요', 403);
  $title = str($R['title'] ?? '', 120); if ($title === '') fail('제목을 입력해 주세요.');
  if ($b === '부동산') {
    if ($u['role'] === 'realtor') {
      $ag = $R['extra']['agency'] ?? [];
      if (!is_array($ag) || trim($ag['name'] ?? '') === '' || trim($ag['reg'] ?? '') === '') fail('중개사무소 이름과 등록번호를 적어 주세요.');
    } elseif (!is_mod($u)) {
      $n = one("SELECT COUNT(*) n FROM ji_posts WHERE author = ? AND board = '부동산'", [$u['id']])['n'];
      if ($n >= 3) fail('일반 회원은 매물을 동시에 3건까지 올릴 수 있어요. 지난 매물을 정리한 뒤 올려 주세요.');
    }
  }
  if ($b === '제주상점' && !is_mod($u)) {   // 상점판매자: 제주상점 글은 24시간에 1번만
    $last = one("SELECT created_at FROM ji_posts WHERE author = ? AND board = '제주상점' AND created_at > (NOW() - INTERVAL 24 HOUR) ORDER BY created_at DESC LIMIT 1", [$u['id']]);
    if ($last) fail('제주상점 글은 24시간에 한 번만 올릴 수 있어요. ' . date('n월 j일 H:i', strtotime($last['created_at']) + 86400) . ' 이후에 다시 올려 주세요.', 429);
  }
  $recent = one("SELECT COUNT(*) n FROM ji_posts WHERE author = ? AND created_at > (NOW() - INTERVAL 1 MINUTE)", [$u['id']])['n'];
  if ($recent >= 3 && !is_mod($u)) fail('글을 너무 빨리 올리고 있어요. 잠시 후 다시 해 주세요.', 429);
  $id = uuid(); $t = now();
  q("INSERT INTO ji_posts (id, board, head, title, content, loc, meta, price, extra, author, author_nick, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
    [$id, $b, str($R['head'] ?? '', 30), $title, str($R['content'] ?? '', 20000), str($R['loc'] ?? '', 100), str($R['meta'] ?? '', 255),
     str($R['price'] ?? '', 60), json_encode(array_diff_key(is_array($R['extra'] ?? null) ? $R['extra'] : [], ['photos' => 1]) ?: new stdClass(), JSON_UNESCAPED_UNICODE), $u['id'], $u['nick'], $t, $t]);
  if (is_mod($u) && is_uuid($R['from_iq'] ?? '')) q("UPDATE ji_uploads SET post_id = NULL WHERE post_id = ?", [$R['from_iq']]);   // 제보 사진을 게시 글로 옮김
  if (!empty($R['extra']['photos'])) {
    $x = $R['extra']; $x['photos'] = attach_photos($id, $u['id'], $x['photos'], is_mod($u));
    q("UPDATE ji_posts SET extra = ? WHERE id = ?", [json_encode($x, JSON_UNESCAPED_UNICODE), $id]);
  }
  if ($b === '부동산') {   // 학교 주변 매물 알림: 글·주소에 학교 마을 이름이 있으면 그 학교 알림을 켠 사람에게
    $txt = $title . ' ' . ($R['content'] ?? '') . ' ' . ($R['loc'] ?? '') . ' ' . (($R['extra'] ?? [])['addr'] ?? '');
    foreach (YUHAK_BASES as $i => $base) if (mb_strpos($txt, $base) !== false)
      push_tag('yuhak_' . $i, '제주이음 · ' . $base . '초 주변 새 매물', mb_substr($title, 0, 60), 'view.html?id=' . $id);
  }
  $isTrade = in_array($b, ['구인구직', '중고사고팔기', '부동산', '제주상점', '특가공구'], true);
  alert_admins($isTrade ? 'trade' : 'post', ($isTrade ? '🏷️ ' : '📝 ') . $b . ' 새 글', $u['nick'] . '님: ' . mb_substr($title, 0, 60), 'view.html?id=' . $id, $u['id']);
  out(post_out(one("SELECT p.*, u.role author_role, u.seller_until author_until FROM ji_posts p LEFT JOIN ji_users u ON u.id = p.author WHERE p.id = ?", [$id])));
}
case 'post_update': {
  $u = active($R); $id = $R['id'] ?? ''; $r = is_uuid($id) ? one("SELECT * FROM ji_posts WHERE id = ?", [$id]) : null;
  if (!$r) fail('글을 찾을 수 없어요', 404);
  if ($r['author'] !== $u['id'] && !is_mod($u)) fail('내가 쓴 글만 고칠 수 있어요', 403);
  $title = str($R['title'] ?? $r['title'], 120); if ($title === '') fail('제목을 입력해 주세요.');
  if (array_key_exists('extra', $R)) {
    $x = is_array($R['extra']) ? $R['extra'] : [];
    $x['photos'] = attach_photos($id, $r['author'], $x['photos'] ?? [], is_mod($u));
    if (!$x['photos']) unset($x['photos']);
    $extra = json_encode($x ?: new stdClass(), JSON_UNESCAPED_UNICODE);
  } else $extra = $r['extra'];
  $board = $r['board'];   // 게시판 이동은 운영진만
  if (isset($R['board']) && $R['board'] !== $r['board']) {
    $COMM = ['자유게시판', '질문하기', '최신뉴스', '생활정보', '취미·여행', '교육', '건강웰빙', '제주북쪽', '제주동쪽', '제주서쪽', '제주남쪽'];
    if (!is_mod($u) && !(in_array($r['board'], $COMM, true) && in_array($R['board'], $COMM, true))) fail('커뮤니티 글은 커뮤니티 게시판 안에서만 옮길 수 있어요', 403);
    if (!in_array($R['board'], $BOARDS, true)) fail('게시판 이름이 올바르지 않아요');
    $board = $R['board'];
  }
  q("UPDATE ji_posts SET board = ?, head = ?, title = ?, content = ?, loc = ?, meta = ?, price = ?, extra = ?, updated_at = ? WHERE id = ?",
    [$board, str($R['head'] ?? $r['head'], 30), $title, str($R['content'] ?? $r['content'], 20000), str($R['loc'] ?? $r['loc'], 100),
     str($R['meta'] ?? $r['meta'], 255), str($R['price'] ?? $r['price'], 60), $extra, now(), $id]);
  out(post_out(one("SELECT p.*, u.role author_role, u.seller_until author_until FROM ji_posts p LEFT JOIN ji_users u ON u.id = p.author WHERE p.id = ?", [$id])));
}
case 'post_delete': {
  $u = me($R); $id = $R['id'] ?? ''; $r = is_uuid($id) ? one("SELECT author FROM ji_posts WHERE id = ?", [$id]) : null;
  if (!$r) fail('글을 찾을 수 없어요', 404);
  if ($r['author'] !== $u['id'] && !is_mod($u)) fail('내가 쓴 글만 지울 수 있어요', 403);
  q("DELETE FROM ji_posts WHERE id = ?", [$id]);
  q("DELETE FROM ji_club_joins WHERE club_id = ?", [$id]);
  q("DELETE FROM ji_club_notices WHERE club_id = ?", [$id]);
  q("DELETE FROM ji_comments WHERE post_id = ?", [$id]);
  foreach (all("SELECT path FROM ji_uploads WHERE post_id = ?", [$id]) as $o) remove_upload($o['path']);
  q("DELETE FROM ji_likes WHERE post_id = ?", [$id]);
  out(true);
}

/* ───────── 전체 새 글 + 댓글 수 (화면 캐시용) ───────── */
case 'feed': {
  $rows = all("SELECT p.*, u.role author_role, u.seller_until author_until FROM ji_posts p LEFT JOIN ji_users u ON u.id = p.author ORDER BY p.created_at DESC LIMIT 600");
  $fv = me($R, false); $fmod = $fv && is_mod($fv);
  $rows = array_values(array_filter($rows, function ($r) use ($fv, $fmod) { return $fmod || ($fv && $r['author'] === $fv['id']) || post_live($r); }));   // 입점 기간이 끝난 판매 글은 본인·운영진에게만
  foreach ($rows as &$r) if (mb_strlen($r['content']) > 400) $r['content'] = mb_substr($r['content'], 0, 400) . '…';   // 목록용: 앞부분만 (전문은 글 화면에서)
  unset($r);
  $counts = [];
  foreach (all("SELECT post_id, COUNT(*) n FROM ji_comments WHERE deleted = 0 GROUP BY post_id") as $c) $counts[$c['post_id']] = (int)$c['n'];
  out(['posts' => array_map('post_out', $rows), 'counts' => $counts ?: new stdClass(),
       'site' => ['admin_ov' => setting('admin_ov', new stdClass()) ?: new stdClass(), 'notices' => setting('notices', [])],
       'likes' => likes_map(), 'my_likes' => ($fu = me($R, false)) ? array_column(all("SELECT post_id FROM ji_likes WHERE user_id = ? AND active = 1", [$fu['id']]), 'post_id') : []]);
}

/* ───────── 댓글 (예시 글에도 달 수 있게 post_id 는 아무 글 id) ───────── */
case 'comments': {
  $pid = str($R['post_id'] ?? '', 40); if ($pid === '') out([]);
  $rows = all("SELECT * FROM ji_comments WHERE post_id = ? ORDER BY created_at, id LIMIT 500", [$pid]);
  // 댓글 좋아요 수와 내가 눌렀는지 (좋아요 키는 'c:댓글id')
  $cnt = []; $mine = []; $me = me($R, false);
  if ($rows) {
    $keys = array_map(function ($c) { return 'c:' . $c['id']; }, $rows); $in = implode(',', array_fill(0, count($keys), '?'));
    foreach (all("SELECT post_id, COUNT(*) n FROM ji_likes WHERE active = 1 AND post_id IN ($in) GROUP BY post_id", $keys) as $r) $cnt[$r['post_id']] = (int)$r['n'];
    if ($me) foreach (all("SELECT post_id FROM ji_likes WHERE active = 1 AND user_id = ? AND post_id IN ($in)", array_merge([$me['id']], $keys)) as $r) $mine[$r['post_id']] = true;
  }
  out(array_map(function ($c) use ($cnt, $mine) { $o = cmt_out($c); $o['likes'] = $cnt['c:' . $c['id']] ?? 0; $o['liked'] = !empty($mine['c:' . $c['id']]); return $o; }, $rows));
}
case 'comment_add': {
  $u = active($R); $pid = str($R['post_id'] ?? '', 40); $text = str($R['text'] ?? '', 1000);
  if ($pid === '' || $text === '') fail('댓글 내용을 입력해 주세요.');
  $recent = one("SELECT COUNT(*) n FROM ji_comments WHERE author = ? AND created_at > (NOW() - INTERVAL 1 MINUTE)", [$u['id']])['n'];
  if ($recent >= 6) fail('댓글을 너무 빨리 달고 있어요. 잠시 후 다시 해 주세요.', 429);
  // 대댓글: 답글의 답글도 맨 위 댓글 아래로 모음 (한 단계), 누구에게 단 답글인지는 reply_nick 으로
  $top = null; $rn = ''; $to = null;
  if (!empty($R['parent_id'])) {
    $pc = one("SELECT id, post_id, parent_id, author, author_nick, deleted FROM ji_comments WHERE id = ?", [(string)$R['parent_id']]);
    if (!$pc || $pc['post_id'] !== $pid) fail('답글을 달 댓글을 찾을 수 없어요', 404);
    if (!empty($pc['deleted'])) fail('삭제된 댓글에는 답글을 달 수 없어요');
    $top = $pc['parent_id'] ?: $pc['id']; $rn = $pc['author_nick']; $to = $pc['author'];
  }
  $id = uuid(); q("INSERT INTO ji_comments (id, post_id, author, author_nick, text, created_at, parent_id, reply_nick) VALUES (?,?,?,?,?,?,?,?)", [$id, $pid, $u['id'], $u['nick'], $text, now(), $top, $rn]);
  $p = is_uuid($pid) ? one("SELECT author, title FROM ji_posts WHERE id = ?", [$pid]) : null;
  if ($to && $to !== $u['id'])
    notify($to, 'comment', '새 답글', $u['nick'] . '님이 내 댓글에 답글: ' . mb_substr($text, 0, 60), 'view.html?id=' . $pid . '#cmt-list', '제주이음 · 내 댓글에 새 답글', $u['nick'] . '님: ' . mb_substr($text, 0, 60));
  if ($p && $p['author'] !== $u['id'] && $p['author'] !== $to)
    notify($p['author'], 'comment', '새 댓글', $u['nick'] . '님: ' . mb_substr($text, 0, 60), 'view.html?id=' . $pid . '#cmt-list', '제주이음 · 「' . mb_substr($p['title'], 0, 30) . '」 새 댓글', $u['nick'] . '님: ' . mb_substr($text, 0, 60));
  alert_admins('comment', '💬 새 댓글', $u['nick'] . '님: ' . mb_substr($text, 0, 60), 'view.html?id=' . $pid . '#cmt-list', $u['id']);
  out(cmt_out(one("SELECT * FROM ji_comments WHERE id = ?", [$id])));
}
case 'comment_update': {
  $u = active($R); $text = str($R['text'] ?? '', 1000); if ($text === '') fail('댓글 내용을 입력해 주세요.');
  $c = one("SELECT * FROM ji_comments WHERE id = ?", [$R['id'] ?? '']); if (!$c) fail('댓글을 찾을 수 없어요', 404);
  if ($c['author'] !== $u['id'] || !empty($c['deleted'])) fail('내가 쓴 댓글만 고칠 수 있어요', 403);
  q("UPDATE ji_comments SET text = ?, edited = 1 WHERE id = ?", [$text, $c['id']]);
  out(cmt_out(one("SELECT * FROM ji_comments WHERE id = ?", [$c['id']])));
}
case 'comment_delete': {
  $u = me($R); $c = one("SELECT id, author, parent_id, deleted FROM ji_comments WHERE id = ?", [$R['id'] ?? '']); if (!$c) fail('댓글을 찾을 수 없어요', 404);
  if (!empty($c['deleted']) || ($c['author'] !== $u['id'] && !is_mod($u))) fail('내가 쓴 댓글만 지울 수 있어요', 403);
  q("DELETE FROM ji_likes WHERE post_id = ?", ['c:' . $c['id']]);
  // 답글이 달린 댓글은 '삭제된 댓글'로만 남겨 답글 흐름을 지킴
  if (!$c['parent_id'] && one("SELECT id FROM ji_comments WHERE parent_id = ? LIMIT 1", [$c['id']])) { q("UPDATE ji_comments SET deleted = 1, text = '' WHERE id = ?", [$c['id']]); out(['soft' => true]); }
  q("DELETE FROM ji_comments WHERE id = ?", [$c['id']]);
  // 마지막 답글을 지우면, 이미 삭제 표시만 남은 맨 위 댓글도 정리
  if ($c['parent_id'] && one("SELECT id FROM ji_comments WHERE id = ? AND deleted = 1", [$c['parent_id']]) && !one("SELECT id FROM ji_comments WHERE parent_id = ? LIMIT 1", [$c['parent_id']]))
    q("DELETE FROM ji_comments WHERE id = ?", [$c['parent_id']]);
  out(true);
}

/* ───────── 동호회 가입 신청 ───────── */
case 'join_my': {
  $u = me($R, false); if (!$u || !is_uuid($R['club_id'] ?? '')) out(null);
  $j = one("SELECT * FROM ji_club_joins WHERE club_id = ? AND applicant = ?", [$R['club_id'], $u['id']]);
  out($j ? join_out($j) : null);
}
case 'join_request': {
  $u = active($R); $c = club_of($R['club_id'] ?? '');
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
  $u = active($R); $c = club_of($R['club_id'] ?? '');
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
case 'seller_my': {   // 내가 이 게시판에 보낸 가장 최근 승인 요청 (상태는 서버 기준)
  $u = me($R); $r = one("SELECT status, created_at FROM ji_seller_requests WHERE applicant = ? AND board = ? ORDER BY created_at DESC LIMIT 1", [$u['id'], $R['board'] ?? '']);
  out($r ? ['status' => $r['status'], 'date' => substr($r['created_at'], 0, 10)] : null);
}
case 'seller_request': {
  $u = active($R); $b = $R['board'] ?? '';
  if (!in_array($b, ['제주상점', '특가공구'], true)) fail('게시판 이름이 올바르지 않아요');
  $rid = uuid(); $det = is_array($R['details'] ?? null) ? $R['details'] : [];
  q("INSERT INTO ji_seller_requests (id, board, applicant, applicant_nick, details, message, created_at) VALUES (?,?,?,?,?,?,?)",
    [$rid, $b, $u['id'], $u['nick'], json_encode($det ?: new stdClass(), JSON_UNESCAPED_UNICODE), str($R['message'] ?? '', 1000), now()]);
  if (!empty($det['_photos']) && is_array($det['_photos'])) {   // 신청 사진은 자동 정리되지 않게 이 신청에 묶어 둠
    $base = upload_base();
    foreach (array_slice($det['_photos'], 0, 6) as $url) if (is_string($url) && strpos($url, $base) === 0)
      q("UPDATE ji_uploads SET post_id = ? WHERE path = ? AND user_id = ? AND post_id IS NULL", [$rid, substr($url, strlen($base)), $u['id']]);
  }
  alert_admins('seller', '🏪 새 입점·공구 요청', $u['nick'] . '님이 ' . $b . ' 승인을 요청했어요.', 'admin/index.html#sellers');
  out(true);
}

/* ───────── 좋아요 (예시 글에도 누를 수 있게 post_id 는 아무 글 id) ───────── */
case 'like_toggle': {
  $u = active($R); $pid = str($R['post_id'] ?? '', 40); if ($pid === '') fail('글을 찾을 수 없어요');
  $row = one("SELECT active FROM ji_likes WHERE post_id = ? AND user_id = ?", [$pid, $u['id']]);
  if (!$row) {
    q("INSERT INTO ji_likes (post_id, user_id, active, created_at) VALUES (?,?,1,?)", [$pid, $u['id'], now()]);
    $liked = true;
    // 처음 누를 때만 글쓴이에게 알림 (눌렀다 취소를 반복해도 알림은 한 번)
    if (strpos($pid, 'c:') === 0) {
      $c = one("SELECT author, post_id, text FROM ji_comments WHERE id = ?", [substr($pid, 2)]);
      if ($c && $c['author'] !== $u['id'])
        notify($c['author'], 'like', '♥ 댓글 좋아요', $u['nick'] . '님이 내 댓글 「' . mb_substr($c['text'], 0, 30) . '」을 좋아해요.', 'view.html?id=' . $c['post_id'] . '#cmt-list',
          '제주이음 · ♥ 댓글 좋아요', $u['nick'] . '님이 내 댓글을 좋아해요: ' . mb_substr($c['text'], 0, 30));
      $p = null;
    } else $p = is_uuid($pid) ? one("SELECT author, title FROM ji_posts WHERE id = ?", [$pid]) : null;
    if ($p && $p['author'] !== $u['id'])
      notify($p['author'], 'like', '♥ 좋아요', $u['nick'] . '님이 「' . mb_substr($p['title'], 0, 40) . '」 글을 좋아해요.', 'view.html?id=' . $pid,
        '제주이음 · ♥ 좋아요', $u['nick'] . '님이 「' . mb_substr($p['title'], 0, 30) . '」 글을 좋아해요.');
  } else {
    $liked = !$row['active'];
    q("UPDATE ji_likes SET active = ? WHERE post_id = ? AND user_id = ?", [$liked ? 1 : 0, $pid, $u['id']]);
  }
  $adj = is_uuid($pid) ? (int)(one("SELECT likes_adj FROM ji_posts WHERE id = ?", [$pid])['likes_adj'] ?? 0) : 0;
  out(['liked' => $liked, 'count' => max(0, (int)one("SELECT COUNT(*) n FROM ji_likes WHERE post_id = ? AND active = 1", [$pid])['n'] + $adj)]);
}

/* ───────── 문의·신청 (로그인 없이 보낼 수 있음) ───────── */
case 'inquiry_add': {
  $d = $R['data'] ?? null; if (!is_array($d)) fail('내용이 비어 있어요');
  $n = one("SELECT COUNT(*) n FROM ji_inquiries WHERE ip = ? AND created_at > (NOW() - INTERVAL 10 MINUTE)", [ip()])['n'];
  if ($n >= 5) fail('잠시 후 다시 보내 주세요.', 429);
  $js = json_encode($d, JSON_UNESCAPED_UNICODE); if (strlen($js) > 8000) fail('내용이 너무 길어요');
  $who = me($R, false);
  $iqid = uuid();
  q("INSERT INTO ji_inquiries (id, data, ip, user_id, created_at) VALUES (?,?,?,?,?)", [$iqid, $js, ip(), $who ? $who['id'] : null, now()]);
  if ($who && !empty($d['photos']) && is_array($d['photos'])) {   // 제보 사진은 1일 뒤 자동 정리되지 않게 이 제보에 묶어 둠
    $base = upload_base();
    foreach (array_slice($d['photos'], 0, 10) as $url) if (is_string($url) && strpos($url, $base) === 0)
      q("UPDATE ji_uploads SET post_id = ? WHERE path = ? AND user_id = ? AND post_id IS NULL", [$iqid, substr($url, strlen($base)), $who['id']]);
  }
  alert_admins('inquiry', '📮 새 문의 · ' . mb_substr((string)($d['type'] ?? $d['service'] ?? '문의'), 0, 30),
    mb_substr((string)($d['name'] ?? ''), 0, 20) . ($who ? ' (회원 ' . $who['nick'] . ')' : ' (비회원)') . ': ' . mb_substr(preg_replace('/\s+/u', ' ', (string)($d['msg'] ?? '')), 0, 70),
    'admin/index.html#inquiries', null, '제주이음 · 새 문의가 왔어요', mb_substr((string)($d['type'] ?? '문의'), 0, 30) . ' · ' . mb_substr(preg_replace('/\s+/u', ' ', (string)($d['msg'] ?? '')), 0, 60));
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
       'sellers_pending' => (int)one("SELECT COUNT(*) n FROM ji_seller_requests WHERE status = 'pending'")['n'],
       'reports_new' => (int)one("SELECT COUNT(DISTINCT kind, target_id) n FROM ji_reports WHERE status = 'new'")['n']]);
}
case 'hit': {   // 방문 기록 한 줄 (로그인 필요 없음, 개인정보 없음)
  $vid = $R['vid'] ?? ''; $path = (string)($R['path'] ?? '');
  $ua = $_SERVER['HTTP_USER_AGENT'] ?? '';
  if (!preg_match('/^[a-z0-9]{16}$/', $vid) || $path === '' || preg_match('/bot|crawl|spider|slurp|headless/i', $ua)) out(true);
  $path = mb_substr($path, 0, 120);
  // 같은 사람이 같은 페이지를 10초 안에 다시 열면 한 번만
  if (one("SELECT id FROM ji_hits WHERE vid = ? AND path = ? AND at > (NOW() - INTERVAL 10 SECOND) LIMIT 1", [$vid, $path])) out(true);
  q("INSERT INTO ji_hits (at, vid, nw, path, title, ref, dev, os, br, kw) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    [now(), $vid, !empty($R['nw']) ? 1 : 0, $path, mb_substr((string)($R['title'] ?? ''), 0, 80), mb_substr((string)($R['ref'] ?? ''), 0, 40), ($R['dev'] ?? '') === 'm' ? 'm' : 'p',
     mb_substr((string)($R['os'] ?? ''), 0, 12), mb_substr((string)($R['br'] ?? ''), 0, 12), mb_substr(trim((string)($R['kw'] ?? '')), 0, 60)]);
  if (mt_rand(1, 500) === 1) q("DELETE FROM ji_hits WHERE at < (NOW() - INTERVAL 400 DAY)");
  out(true);
}
case 'admin_traffic': {   // 관리자: 실시간·오늘·어제 방문 통계
  admin($R);
  $today = date('Y-m-d'); $yest = date('Y-m-d', strtotime('-1 day'));
  $nowT = date('H:i:s');
  $day = function ($d) {
    $r = one("SELECT COUNT(*) pv, COUNT(DISTINCT vid) uv, COUNT(DISTINCT CASE WHEN nw = 1 THEN vid END) nv,
      COUNT(DISTINCT CASE WHEN dev = 'm' THEN vid END) mob FROM ji_hits WHERE at >= ? AND at < ? + INTERVAL 1 DAY", [$d, $d]);
    return ['pv' => (int)$r['pv'], 'uv' => (int)$r['uv'], 'nv' => (int)$r['nv'], 'mob' => (int)$r['mob']];
  };
  $hours = function ($d) {
    $h = array_fill(0, 24, ['pv' => 0, 'uv' => 0]);
    foreach (all("SELECT HOUR(at) h, COUNT(*) pv, COUNT(DISTINCT vid) uv FROM ji_hits WHERE at >= ? AND at < ? + INTERVAL 1 DAY GROUP BY HOUR(at)", [$d, $d]) as $r)
      $h[(int)$r['h']] = ['pv' => (int)$r['pv'], 'uv' => (int)$r['uv']];
    return $h;
  };
  $pages = function ($d) {
    return array_map(function ($r) { return ['path' => $r['path'], 'title' => $r['title'], 'pv' => (int)$r['pv'], 'uv' => (int)$r['uv']]; },
      all("SELECT path, MAX(title) title, COUNT(*) pv, COUNT(DISTINCT vid) uv FROM ji_hits WHERE at >= ? AND at < ? + INTERVAL 1 DAY GROUP BY path ORDER BY pv DESC LIMIT 15", [$d, $d]));
  };
  $refs = function ($d) {
    return array_map(function ($r) { return ['ref' => $r['ref'], 'n' => (int)$r['n']]; },
      all("SELECT ref, COUNT(DISTINCT vid) n FROM ji_hits WHERE at >= ? AND at < ? + INTERVAL 1 DAY AND ref <> '' GROUP BY ref ORDER BY n DESC LIMIT 12", [$d, $d]));
  };
  $cnt = function ($table, $d, $where = '') {
    return (int)one("SELECT COUNT(*) n FROM $table WHERE created_at >= ? AND created_at < ? + INTERVAL 1 DAY $where", [$d, $d])['n'];
  };
  $act = function ($d) use ($cnt) {
    return ['users' => $cnt('ji_users', $d), 'posts' => $cnt('ji_posts', $d), 'comments' => $cnt('ji_comments', $d),
      'inquiries' => $cnt('ji_inquiries', $d), 'messages' => $cnt('ji_messages', $d, "AND kind = 'dm'"), 'likes' => $cnt('ji_likes', $d),
      'leaves' => (int)one("SELECT COUNT(*) n FROM ji_leaves WHERE left_at >= ? AND left_at < ? + INTERVAL 1 DAY", [$d, $d])['n']];
  };
  // 회원 현황: 지금 회원 수 · 기간별 가입/탈퇴 · 최근 탈퇴 (이름 없이)
  $jl = function ($days) {
    return ['join' => (int)one("SELECT COUNT(*) n FROM ji_users WHERE created_at >= CURDATE() - INTERVAL ? DAY", [$days - 1])['n']
                    + (int)one("SELECT COUNT(*) n FROM ji_leaves WHERE joined_at >= CURDATE() - INTERVAL ? DAY", [$days - 1])['n'],
            'leave' => (int)one("SELECT COUNT(*) n FROM ji_leaves WHERE left_at >= CURDATE() - INTERVAL ? DAY", [$days - 1])['n']];
  };
  $members = ['now' => (int)one("SELECT COUNT(*) n FROM ji_users")['n'],
    'left_total' => (int)one("SELECT COUNT(*) n FROM ji_leaves")['n'],
    'd7' => $jl(7), 'd30' => $jl(30),
    'recent' => array_map(function ($r) { return ['left_at' => iso($r['left_at']), 'joined_at' => iso($r['joined_at']), 'by_admin' => (bool)$r['by_admin']]; },
      all("SELECT left_at, joined_at, by_admin FROM ji_leaves ORDER BY left_at DESC LIMIT 10"))];
  $days = [];
  foreach (all("SELECT DATE(at) d, COUNT(*) pv, COUNT(DISTINCT vid) uv FROM ji_hits WHERE at >= (CURDATE() - INTERVAL 29 DAY) GROUP BY DATE(at) ORDER BY d") as $r)
    $days[$r['d']] = ['pv' => (int)$r['pv'], 'uv' => (int)$r['uv']];
  $live = all("SELECT path, MAX(title) title, COUNT(DISTINCT vid) n FROM ji_hits WHERE at > (NOW() - INTERVAL 5 MINUTE) GROUP BY path ORDER BY n DESC LIMIT 8");
  $yNow = one("SELECT COUNT(*) pv, COUNT(DISTINCT vid) uv FROM ji_hits WHERE at >= ? AND at <= ?", [$yest, $yest . ' ' . $nowT]);
  out(['now' => iso(now()), 'today' => $today, 'yesterday' => $yest,
    'live' => (int)one("SELECT COUNT(DISTINCT vid) n FROM ji_hits WHERE at > (NOW() - INTERVAL 5 MINUTE)")['n'],
    'live_pages' => array_map(function ($r) { return ['path' => $r['path'], 'title' => $r['title'], 'n' => (int)$r['n']]; }, $live),
    't' => $day($today), 'y' => $day($yest), 'y_same' => ['pv' => (int)$yNow['pv'], 'uv' => (int)$yNow['uv']],
    't_hours' => $hours($today), 'y_hours' => $hours($yest),
    't_pages' => $pages($today), 'y_pages' => $pages($yest), 't_refs' => $refs($today), 'y_refs' => $refs($yest),
    't_act' => $act($today), 'y_act' => $act($yest), 'members' => $members, 'days' => $days ?: new stdClass(),
    'since' => one("SELECT MIN(at) m FROM ji_hits")['m']]);
}
case 'admin_traffic_more': {   // 관리자: 기간별 유입경로·검색·기기·글 순위
  admin($R);
  $p = (string)($R['p'] ?? 't');
  $today = date('Y-m-d');
  if ($p === 'y') { $from = date('Y-m-d', strtotime('-1 day')); $to = $today; }
  elseif ($p === '7') { $from = date('Y-m-d', strtotime('-6 day')); $to = date('Y-m-d', strtotime('+1 day')); }
  elseif ($p === '30') { $from = date('Y-m-d', strtotime('-29 day')); $to = date('Y-m-d', strtotime('+1 day')); }
  else { $p = 't'; $from = $today; $to = date('Y-m-d', strtotime('+1 day')); }
  // 날짜를 직접 고른 경우 (from~to, 둘 다 포함, 최대 1년)
  $isD = function ($d) { return is_string($d) && preg_match('/^\d{4}-\d{2}-\d{2}$/', $d) && strtotime($d); };
  if ($isD($R['from'] ?? null)) {
    $f = $R['from']; $t2 = $isD($R['to'] ?? null) ? $R['to'] : $f;
    if ($t2 < $f) { $x = $f; $f = $t2; $t2 = $x; }
    if ((strtotime($t2) - strtotime($f)) / 86400 > 366) $f = date('Y-m-d', strtotime($t2 . ' -366 day'));
    $p = 'd'; $from = $f; $to = date('Y-m-d', strtotime($t2 . ' +1 day'));
  }
  $W = "at >= ? AND at < ?"; $A = [$from, $to];
  $grp = function ($col, $lim = 12, $extra = '') use ($W, $A) {
    return array_map(function ($r) { return ['k' => $r['k'], 'n' => (int)$r['n']]; },
      all("SELECT $col k, COUNT(DISTINCT vid) n FROM ji_hits WHERE $W $extra GROUP BY $col ORDER BY n DESC LIMIT $lim", $A));
  };
  $refs = $grp('ref', 30, "AND ref <> ''");
  // 검색 사이트: 이름으로 기록된 것 + 예전에 사이트 주소 그대로 기록된 것(chatgpt.com 등)을 같은 이름으로 묶음
  $seName = function ($k) {
    static $M = [['/^네이버$|naver/u', '네이버'], ['/^구글$/u', '구글'], ['/^다음$|daum/u', '다음'], ['/^빙$|bing\./u', '빙'], ['/^줌$|zum\./u', '줌'],
      ['/^네이트$|nate\.com/u', '네이트'], ['/^야후$|yahoo\./u', '야후'], ['/^덕덕고$|duckduckgo/u', '덕덕고'], ['/^바이두$|baidu\./u', '바이두'],
      ['/^에코시아$|ecosia\./u', '에코시아'], ['/^얀덱스$|yandex\./u', '얀덱스'], ['/^ChatGPT$|chatgpt\.com|openai\.com/u', 'ChatGPT'],
      ['/^퍼플렉시티$|perplexity\./u', '퍼플렉시티'], ['/^제미나이$|gemini\.google/u', '제미나이'], ['/^코파일럿$|copilot\./u', '코파일럿'],
      ['/(^|\.)google\./u', '구글']];
    foreach ($M as $m) if (preg_match($m[0], $k)) return $m[1];
    return null;
  };
  $SNS = ['카카오', '카카오톡', '인스타그램', '페이스북', '유튜브', '밴드', '스레드', 'X'];
  $groups = ['검색' => 0, 'SNS·메신저' => 0, '직접 방문' => 0, '다른 사이트' => 0];
  foreach ($refs as $r) {
    $g = $seName($r['k']) ? '검색' : (in_array($r['k'], $SNS) ? 'SNS·메신저' : ($r['k'] === '직접 방문' ? '직접 방문' : '다른 사이트'));
    $groups[$g] += $r['n'];
  }
  $S = []; $seRefs = [];
  foreach (all("SELECT ref k, COUNT(DISTINCT vid) n, COUNT(*) pv FROM ji_hits WHERE $W AND ref <> '' GROUP BY ref", $A) as $r) {
    $nm = $seName($r['k']); if (!$nm) continue;
    $seRefs[] = $r['k'];
    if (!isset($S[$nm])) $S[$nm] = ['k' => $nm, 'n' => 0, 'pv' => 0];
    $S[$nm]['n'] += (int)$r['n']; $S[$nm]['pv'] += (int)$r['pv'];
  }
  $search = array_values($S); usort($search, function ($a, $b) { return $b['n'] - $a['n']; }); $search = array_slice($search, 0, 10);
  $kws = array_map(function ($r) { return ['k' => $r['k'], 'ref' => $r['ref'], 'n' => (int)$r['n']]; },
    all("SELECT kw k, MAX(ref) ref, COUNT(DISTINCT vid) n FROM ji_hits WHERE $W AND kw <> '' GROUP BY kw ORDER BY n DESC LIMIT 20", $A));
  $land = [];
  if ($seRefs) {
    $in = implode(',', array_fill(0, count($seRefs), '?'));
    $land = array_map(function ($r) { return ['path' => $r['path'], 'title' => $r['title'], 'n' => (int)$r['n']]; },
      all("SELECT path, MAX(title) title, COUNT(DISTINCT vid) n FROM ji_hits WHERE $W AND ref IN ($in) GROUP BY path ORDER BY n DESC LIMIT 10", array_merge($A, $seRefs)));
  }
  // 글 순위: 조회(기간 안 방문 기록) · 댓글 · 좋아요
  $title = function ($ids) {
    if (!$ids) return [];
    $m = [];
    foreach (all("SELECT id, title, board, author_nick, views FROM ji_posts WHERE id IN (" . implode(',', array_fill(0, count($ids), '?')) . ")", $ids) as $r) $m[$r['id']] = $r;
    return $m;
  };
  $rank = function ($rows) use ($title) {
    $m = $title(array_column($rows, 'id'));
    $o = [];
    foreach ($rows as $r) {
      if (!isset($m[$r['id']])) continue;
      $o[] = ['id' => $r['id'], 'title' => $m[$r['id']]['title'], 'board' => $m[$r['id']]['board'], 'nick' => $m[$r['id']]['author_nick'], 'n' => (int)$r['n']];
      if (count($o) >= 10) break;
    }
    return $o;
  };
  $views = $rank(all("SELECT SUBSTRING(path, 15) id, COUNT(*) n FROM ji_hits WHERE $W AND path LIKE '/view.html?id=%' GROUP BY path ORDER BY n DESC LIMIT 30", $A));
  $cmts = $rank(all("SELECT post_id id, COUNT(*) n FROM ji_comments WHERE created_at >= ? AND created_at < ? GROUP BY post_id ORDER BY n DESC LIMIT 30", $A));
  $likes = $rank(all("SELECT post_id id, COUNT(*) n FROM ji_likes WHERE active = 1 AND created_at >= ? AND created_at < ? GROUP BY post_id ORDER BY n DESC LIMIT 30", $A));
  $allViews = array_map(function ($r) { return ['id' => $r['id'], 'title' => $r['title'], 'board' => $r['board'], 'nick' => $r['author_nick'], 'n' => (int)$r['views']]; },
    all("SELECT id, title, board, author_nick, views FROM ji_posts ORDER BY views DESC LIMIT 10"));
  $tot = (int)one("SELECT COUNT(DISTINCT vid) n FROM ji_hits WHERE $W", $A)['n'];
  // 사이트 안 검색어 (첫 화면·가이드 검색창)
  $site = array_map(function ($r) { return ['k' => $r['k'], 'n' => (int)$r['n'], 'res' => (int)$r['res']]; },
    all("SELECT q k, COUNT(DISTINCT vid) n, MAX(n) res FROM ji_searches WHERE $W GROUP BY q ORDER BY n DESC, MAX(at) DESC LIMIT 20", $A));
  $siteZero = array_map(function ($r) { return ['k' => $r['k'], 'n' => (int)$r['n']]; },
    all("SELECT q k, COUNT(DISTINCT vid) n FROM ji_searches WHERE $W GROUP BY q HAVING MAX(n) = 0 ORDER BY n DESC LIMIT 15", $A));
  // 머문 시간·이탈: 하루 한 사람의 방문을 한 번의 방문으로 보고, 그날 한 페이지만 보고 나가면 '이탈'
  $sess = all("SELECT COUNT(*) c, SUBSTRING_INDEX(GROUP_CONCAT(path ORDER BY id SEPARATOR '\n'), '\n', 1) first FROM ji_hits WHERE $W GROUP BY vid, DATE(at)", $A);
  $land2 = []; $sN = 0; $sOne = 0;
  foreach ($sess as $x) { $sN++; $one = (int)$x['c'] === 1; if ($one) $sOne++;
    $f = $x['first']; if (!isset($land2[$f])) $land2[$f] = [0, 0]; $land2[$f][0]++; if ($one) $land2[$f][1]++; }
  $eng = array_map(function ($r) use ($land2) {
    $l = $land2[$r['path']] ?? [0, 0];
    return ['path' => $r['path'], 'title' => $r['title'], 'pv' => (int)$r['pv'], 'dur' => $r['nd'] ? (int)round($r['ad']) : null,
            'land' => $l[0], 'bounce' => $l[0] ? (int)round($l[1] / $l[0] * 100) : null];
  }, all("SELECT path, MAX(title) title, COUNT(*) pv, AVG(dur) ad, SUM(dur IS NOT NULL) nd FROM ji_hits WHERE $W GROUP BY path ORDER BY pv DESC LIMIT 20", $A));
  $avgDur = one("SELECT AVG(dur) a FROM ji_hits WHERE $W AND dur IS NOT NULL", $A)['a'];
  // 이전 같은 길이 기간과 비교
  $sum = function ($f, $t) use ($seName) {
    $B = [$f, $t];
    $r = one("SELECT COUNT(DISTINCT vid) uv, COUNT(*) pv FROM ji_hits WHERE at >= ? AND at < ?", $B);
    $se = 0; foreach (all("SELECT ref, COUNT(DISTINCT vid) n FROM ji_hits WHERE at >= ? AND at < ? AND ref <> '' GROUP BY ref", $B) as $x) if ($seName($x['ref'])) $se += (int)$x['n'];
    $join = (int)one("SELECT COUNT(*) n FROM ji_users WHERE created_at >= ? AND created_at < ?", $B)['n'] + (int)one("SELECT COUNT(*) n FROM ji_leaves WHERE joined_at >= ? AND joined_at < ?", $B)['n'];
    $posts = (int)one("SELECT COUNT(*) n FROM ji_posts WHERE created_at >= ? AND created_at < ?", $B)['n'];
    return ['uv' => (int)$r['uv'], 'pv' => (int)$r['pv'], 'search' => $se, 'join' => $join, 'posts' => $posts];
  };
  $len = (strtotime($to) - strtotime($from));
  $cmp = ['cur' => $sum($from, $to), 'prev' => $sum(date('Y-m-d', strtotime($from) - $len), $from),
          'prev_from' => date('Y-m-d', strtotime($from) - $len), 'prev_to' => date('Y-m-d', strtotime($from) - 86400)];
  out(['p' => $p, 'from' => $from, 'to' => date('Y-m-d', strtotime($to . ' -1 day')), 'uv' => $tot,
    'site_kws' => $site, 'site_zero' => $siteZero, 'eng' => $eng, 'bounce' => $sN ? (int)round($sOne / $sN * 100) : null,
    'avg_dur' => $avgDur !== null ? (int)round($avgDur) : null, 'cmp' => $cmp,
    'groups' => $groups, 'refs' => $refs, 'search' => $search, 'kws' => $kws, 'landing' => $land,
    'dev' => $grp('dev', 2), 'os' => $grp('os', 6, "AND os <> ''"), 'br' => $grp('br', 10, "AND br <> ''"),
    'rank_views' => $views, 'rank_comments' => $cmts, 'rank_likes' => $likes, 'rank_total' => $allViews]);
}
case 'admin_users': {
  admin($R);
  out(array_map(function ($u) { $u['created_at'] = iso($u['created_at']); $u['last_login'] = iso($u['last_login']); $u['suspended_until'] = iso($u['suspended_until']);
    if (in_array($u['role'], ['shop', 'dealer'], true)) $u['periods'] = (array)setting('sp:' . $u['id'], []);
    return $u; },
    all("SELECT u.id, u.email, u.nick, u.region, u.role, u.seller_until, IF(u.suspended_until > NOW(), u.suspended_until, NULL) suspended_until, u.created_at, u.last_login,
         (SELECT COUNT(*) FROM ji_posts p WHERE p.author = u.id) posts,
         (SELECT COUNT(*) FROM ji_comments c WHERE c.author = u.id) comments FROM ji_users u ORDER BY u.created_at DESC LIMIT 1000")));
}
case 'admin_user_activity': {
  admin($R); $id = $R['id'] ?? ''; if (!is_uuid($id)) fail('회원을 찾을 수 없어요', 404);
  $posts = array_map(function ($r) { return ['id' => $r['id'], 'board' => $r['board'], 'head' => $r['head'], 'title' => $r['title'],
      'views' => (int)$r['views'], 'created_at' => iso($r['created_at'])]; },
    all("SELECT id, board, head, title, views, created_at FROM ji_posts WHERE author = ? ORDER BY created_at DESC LIMIT 500", [$id]));
  $cmts = array_map(function ($c) { return ['id' => $c['id'], 'post_id' => $c['post_id'], 'post_title' => $c['title'], 'post_board' => $c['board'],
      'text' => $c['text'], 'edited' => (bool)$c['edited'], 'created_at' => iso($c['created_at'])]; },
    all("SELECT c.*, p.title, p.board FROM ji_comments c LEFT JOIN ji_posts p ON p.id = c.post_id WHERE c.author = ? ORDER BY c.created_at DESC LIMIT 500", [$id]));
  out(['posts' => $posts, 'comments' => $cmts]);
}
case 'admin_set_role': {
  $a = admin($R, true); $role = $R['role'] ?? '';
  if (!in_array($role, ['user', 'realtor', 'shop', 'dealer', 'staff'], true)) fail('역할이 올바르지 않아요');
  if (($R['id'] ?? '') === $a['id']) fail('내 역할은 바꿀 수 없어요');
  $t = one("SELECT role FROM ji_users WHERE id = ?", [$R['id'] ?? '']); if (!$t) fail('회원을 찾을 수 없어요', 404);
  if ($t['role'] === 'admin') fail('관리자 역할은 GitHub Secrets 의 ADMIN_EMAILS 로만 바꿀 수 있어요');
  q("UPDATE ji_users SET role = ? WHERE id = ?", [$role, $R['id'] ?? '']); out(true);
}
case 'admin_alerts': {
  $u = me($R); if (!is_mod($u)) fail('권한이 없어요', 403);
  $list = []; foreach (ADMIN_ALERTS as $k => $v) $list[] = ['key' => $k, 'label' => $v[0], 'default' => $v[1]];
  out(['items' => $list, 'prefs' => admin_alert_prefs($u['id'])]);
}
case 'admin_alerts_set': {
  $u = me($R); if (!is_mod($u)) fail('권한이 없어요', 403);
  $in = is_array($R['prefs'] ?? null) ? $R['prefs'] : []; $save = [];
  foreach (ADMIN_ALERTS as $k => $v) $save[$k] = !empty($in[$k]);
  q("REPLACE INTO ji_settings (k, v, updated_at) VALUES (?,?,?)", ['al:' . $u['id'], json_encode($save), now()]);
  out(['prefs' => $save]);
}
case 'admin_post_counts': {   // 관리자: 회원 글 조회수·좋아요 수 정하기
  admin($R, true); $id = $R['id'] ?? '';
  $r = is_uuid($id) ? one("SELECT id FROM ji_posts WHERE id = ?", [$id]) : null; if (!$r) fail('글을 찾을 수 없어요', 404);
  if (isset($R['views'])) q("UPDATE ji_posts SET views = ? WHERE id = ?", [max(0, min(100000000, (int)$R['views'])), $id]);
  if (isset($R['likes'])) {
    $real = (int)one("SELECT COUNT(*) n FROM ji_likes WHERE post_id = ? AND active = 1", [$id])['n'];
    q("UPDATE ji_posts SET likes_adj = ? WHERE id = ?", [max(0, min(100000000, (int)$R['likes'])) - $real, $id]);
  }
  $x = one("SELECT views, likes_adj FROM ji_posts WHERE id = ?", [$id]);
  out(['views' => (int)$x['views'], 'likes' => max(0, (int)one("SELECT COUNT(*) n FROM ji_likes WHERE post_id = ? AND active = 1", [$id])['n'] + (int)$x['likes_adj'])]);
}
/* ───────── 신고 ───────── */
case 'report_add': {
  $u = me($R); $kind = $R['kind'] ?? ''; $tid = (string)($R['id'] ?? '');
  $REASONS = ['광고·홍보', '욕설·비방', '음란·불쾌한 내용', '사기 의심', '개인정보 노출', '기타'];
  $reason = in_array($R['reason'] ?? '', $REASONS, true) ? $R['reason'] : '';
  if ($reason === '') fail('신고 이유를 골라 주세요.');
  if ($kind === 'post') { $t = is_uuid($tid) ? one("SELECT id, author, author_nick nick, title snip, id post FROM ji_posts WHERE id = ?", [$tid]) : null; }
  elseif ($kind === 'comment') { $t = one("SELECT id, author, author_nick nick, text snip, post_id post FROM ji_comments WHERE id = ?", [$tid]); }
  else fail('신고할 수 없는 대상이에요');
  if (!$t) fail('이미 지워졌거나 찾을 수 없는 글이에요', 404);
  if ($t['author'] === $u['id']) fail('내가 쓴 글은 신고할 수 없어요');
  if (one("SELECT id FROM ji_reports WHERE kind = ? AND target_id = ? AND reporter = ?", [$kind, $tid, $u['id']])) out(['already' => true]);
  $n = one("SELECT COUNT(*) n FROM ji_reports WHERE reporter = ? AND created_at > (NOW() - INTERVAL 1 HOUR)", [$u['id']])['n'];
  if ($n >= 10) fail('신고를 너무 많이 했어요. 잠시 후 다시 해 주세요.', 429);
  q("INSERT INTO ji_reports (kind, target_id, post_id, reason, detail, reporter, reporter_nick, target_author, target_nick, snippet, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
    [$kind, $tid, (string)$t['post'], $reason, str($R['detail'] ?? '', 300), $u['id'], $u['nick'], $t['author'] ?? '', $t['nick'] ?? '', mb_substr((string)$t['snip'], 0, 190), now()]);
  alert_admins('report', '🚨 ' . ($kind === 'post' ? '게시글' : '댓글') . ' 신고 · ' . $reason, mb_substr((string)$t['snip'], 0, 60), 'admin/index.html#reports');
  out(['already' => false]);
}
case 'admin_reports': {
  admin($R);
  out(array_map(function ($r) { $r['created_at'] = iso($r['created_at']); $r['handled_at'] = iso($r['handled_at']); return $r; },
    all("SELECT id, kind, target_id, post_id, reason, detail, reporter_nick, target_author, target_nick, snippet, status, created_at, handled_at, handled_by FROM ji_reports ORDER BY created_at DESC LIMIT 300")));
}
case 'admin_report_set': {   // 같은 글·댓글에 들어온 신고를 한꺼번에 처리
  $me = admin($R); $st = $R['status'] ?? '';
  if (!in_array($st, ['new', 'done', 'ignored'], true)) fail('상태가 올바르지 않아요');
  q("UPDATE ji_reports SET status = ?, handled_at = ?, handled_by = ? WHERE kind = ? AND target_id = ?",
    [$st, $st === 'new' ? null : now(), $st === 'new' ? null : $me['nick'], (string)($R['kind'] ?? ''), (string)($R['target_id'] ?? '')]);
  out(true);
}
case 'admin_suspend_log': {
  admin($R); $id = $R['id'] ?? '';
  $rows = is_uuid($id) ? all("SELECT nick, action, until_at, reason, by_nick, at FROM ji_suspend_log WHERE user_id = ? ORDER BY at DESC LIMIT 50", [$id])
                       : all("SELECT user_id, nick, action, until_at, reason, by_nick, at FROM ji_suspend_log ORDER BY at DESC LIMIT 100");
  out(array_map(function ($r) { $r['at'] = iso($r['at']); $r['until_at'] = iso($r['until_at']); return $r; }, $rows));
}
/* ───────── 사이트 안 검색어 · 머문 시간 ───────── */
case 'search_log': {
  $vid = $R['vid'] ?? ''; $qq = trim(preg_replace('/\s+/u', ' ', (string)($R['q'] ?? '')));
  $ua = $_SERVER['HTTP_USER_AGENT'] ?? '';
  if (!preg_match('/^[a-z0-9]{16}$/', $vid) || mb_strlen($qq) < 1 || preg_match('/bot|crawl|spider|slurp|headless/i', $ua)) out(true);
  $qq = mb_substr($qq, 0, 60);
  if (one("SELECT id FROM ji_searches WHERE vid = ? AND q = ? AND at > (NOW() - INTERVAL 10 MINUTE) LIMIT 1", [$vid, $qq])) out(true);
  q("INSERT INTO ji_searches (at, q, n, vid) VALUES (?,?,?,?)", [now(), $qq, max(0, min(9999, (int)($R['n'] ?? 0))), $vid]);
  if (mt_rand(1, 500) === 1) q("DELETE FROM ji_searches WHERE at < (NOW() - INTERVAL 400 DAY)");
  out(true);
}
case 'hit_dur': {   // 페이지를 떠날 때 머문 시간(초)
  $vid = $R['vid'] ?? ''; $path = (string)($R['path'] ?? ''); $sec = (int)($R['sec'] ?? 0);
  if (!preg_match('/^[a-z0-9]{16}$/', $vid) || $path === '' || $sec < 1) out(true);
  $sec = min($sec, 1800);
  $h = one("SELECT id, dur FROM ji_hits WHERE vid = ? AND path = ? AND at > (NOW() - INTERVAL 3 HOUR) ORDER BY id DESC LIMIT 1", [$vid, mb_substr($path, 0, 120)]);
  if ($h && (int)$h['dur'] < $sec) q("UPDATE ji_hits SET dur = ? WHERE id = ?", [$sec, $h['id']]);
  out(true);
}
/* ───────── 운영자 글 예약 게시 ───────── */
case 'admin_sched_add': {   // items: [{op_k, board, head, title, content, at}]
  $me = admin($R, true); $items = is_array($R['items'] ?? null) ? array_slice($R['items'], 0, 100) : [];
  $n = 0;
  foreach ($items as $it) {
    $b = str($it['board'] ?? '', 30); $at = strtotime((string)($it['at'] ?? ''));
    if (!in_array($b, $BOARDS, true) || !$at || $at < time() - 60) continue;
    $k = str($it['op_k'] ?? '', 60);
    if ($k !== '' && one("SELECT id FROM ji_scheduled WHERE op_k = ? AND status = 'wait'", [$k])) continue;
    q("INSERT INTO ji_scheduled (op_k, board, head, title, content, at, by_id, created_at) VALUES (?,?,?,?,?,?,?,?)",
      [$k, $b, str($it['head'] ?? '', 30), str($it['title'] ?? '', 120), str($it['content'] ?? '', 20000), date('Y-m-d H:i:s', $at), $me['id'], now()]);
    $n++;
  }
  out(['added' => $n]);
}
case 'admin_sched_list': {
  admin($R, true);
  out(array_map(function ($r) { $r['at'] = iso($r['at']); return $r; },
    all("SELECT s.id, s.op_k, s.board, s.title, s.at, s.status, s.post_id, u.nick by_nick FROM ji_scheduled s LEFT JOIN ji_users u ON u.id = s.by_id
         WHERE s.status IN ('wait','busy','fail') OR s.at > (NOW() - INTERVAL 7 DAY) ORDER BY s.at")));
}
case 'admin_sched_cancel': {
  admin($R, true); q("DELETE FROM ji_scheduled WHERE id = ? AND status IN ('wait','fail')", [(int)($R['id'] ?? 0)]); out(true);
}
case 'admin_set': {
  $me = admin($R); $k = $R['k'] ?? '';
  if (!in_array($k, ['admin_ov', 'notices'], true)) fail('저장할 수 없는 항목이에요');
  if ($k === 'admin_ov' && ($me['role'] ?? '') !== 'admin' && is_array($R['v'] ?? null)) {
    // 스텝: 프리미엄·조회수·좋아요는 바꿀 수 없음 → 저장된 값을 그대로 둠
    $old = setting('admin_ov', []); $old = is_array($old) ? $old : []; $nv = $R['v'];
    foreach (array_unique(array_merge(array_keys($old), array_keys($nv))) as $pid) {
      foreach (['premium', 'views', 'likes'] as $f) {
        if (isset($old[$pid]) && is_array($old[$pid]) && array_key_exists($f, $old[$pid])) { if (!isset($nv[$pid]) || !is_array($nv[$pid])) $nv[$pid] = []; $nv[$pid][$f] = $old[$pid][$f]; }
        elseif (isset($nv[$pid]) && is_array($nv[$pid])) unset($nv[$pid][$f]);
      }
    }
    $R['v'] = $nv;
  }
  $v = json_encode($R['v'] ?? null, JSON_UNESCAPED_UNICODE); if (strlen($v) > 2000000) fail('너무 커요');
  q("REPLACE INTO ji_settings (k, v, updated_at) VALUES (?,?,?)", [$k, $v, now()]); out(true);
}
case 'admin_inquiries': {
  admin($R);
  q("DELETE FROM ji_inquiries WHERE created_at < (NOW() - INTERVAL 12 MONTH)");   // 개인정보처리방침: 접수 후 1년 보관
  out(array_map(function ($r) { $d = json_decode($r['data'], true) ?: []; $d['id'] = $r['id']; $d['status'] = $r['status'];
    $d['date'] = date('Y-m-d H:i', strtotime($r['created_at'])); $d['user_id'] = $r['user_id']; $d['user_nick'] = $r['nick'];
    $d['replied_at'] = $r['replied_at'] ? date('Y-m-d H:i', strtotime($r['replied_at'])) : null; return $d; },
    all("SELECT i.*, u.nick FROM ji_inquiries i LEFT JOIN ji_users u ON u.id = i.user_id ORDER BY i.created_at DESC LIMIT 500")));
}
case 'admin_inquiry_pub': {   // 축제 제보를 게시한 뒤: 게시한 제목·글 id 를 제보에 적어 둠 (목록에 고친 제목으로 보이게)
  admin($R); $r = one("SELECT data FROM ji_inquiries WHERE id = ?", [$R['id'] ?? '']); if (!$r) fail('제보를 찾을 수 없어요', 404);
  $d = json_decode($r['data'], true) ?: [];
  $d['pub_title'] = str($R['title'] ?? '', 120); $d['pub_id'] = is_uuid($R['post_id'] ?? '') ? $R['post_id'] : ''; $d['pub_at'] = date('Y-m-d H:i');
  q("UPDATE ji_inquiries SET data = ?, status = 'done' WHERE id = ?", [json_encode($d, JSON_UNESCAPED_UNICODE), $R['id']]); out(true);
}
case 'admin_user_delete': {   // 관리자만: 회원 탈퇴 처리 (관리자 계정·자기 자신은 못 지움). with_content 면 그 회원의 글·댓글도 지움
  $me = admin($R, true); $id = $R['id'] ?? ''; $u = is_uuid($id) ? one("SELECT id, nick, role FROM ji_users WHERE id = ?", [$id]) : null;
  if (!$u) fail('회원을 찾을 수 없어요', 404);
  if ($u['role'] === 'admin' || $u['id'] === $me['id']) fail('관리자 계정은 지울 수 없어요', 403);
  if (!empty($R['with_content'])) {
    foreach (all("SELECT id FROM ji_posts WHERE author = ?", [$id]) as $p) {
      q("DELETE FROM ji_posts WHERE id = ?", [$p['id']]); q("DELETE FROM ji_comments WHERE post_id = ?", [$p['id']]);
      q("DELETE FROM ji_club_joins WHERE club_id = ?", [$p['id']]); q("DELETE FROM ji_club_notices WHERE club_id = ?", [$p['id']]); q("DELETE FROM ji_likes WHERE post_id = ?", [$p['id']]);
      foreach (all("SELECT path FROM ji_uploads WHERE post_id = ?", [$p['id']]) as $o) remove_upload($o['path']);
    }
    q("DELETE FROM ji_comments WHERE author = ?", [$id]);
  }
  q("DELETE FROM ji_sessions WHERE user_id = ?", [$id]); q("DELETE FROM ji_notifications WHERE user_id = ?", [$id]);
  q("DELETE FROM ji_club_joins WHERE applicant = ?", [$id]); q("DELETE FROM ji_settings WHERE k = ?", ['al:' . $id]);
  $joined = one("SELECT created_at FROM ji_users WHERE id = ?", [$id])['created_at'] ?? null;
  q("DELETE FROM ji_users WHERE id = ?", [$id]);
  if ($joined) log_leave($joined, true);
  out(true);
}
case 'admin_suspend': {   // 활동정지: p = 7(일주일) · 30(한 달) · perm(영구) · off(해제)
  $me = admin($R); $id = $R['id'] ?? '';
  $t = is_uuid($id) ? one("SELECT id, nick, role, suspended_until FROM ji_users WHERE id = ?", [$id]) : null;
  if (!$t) fail('회원을 찾을 수 없어요', 404);
  if ($t['id'] === $me['id']) fail('내 계정은 정지할 수 없어요');
  if (is_mod($t)) fail('관리자·스텝 계정은 정지할 수 없어요', 403);
  $p = (string)($R['p'] ?? ''); $why = str($R['reason'] ?? '', 200);
  if ($p === 'off') {
    q("UPDATE ji_users SET suspended_until = NULL WHERE id = ?", [$id]);
    log_suspend($id, $t['nick'], 'lift', null, $why, $me['nick']);
    notify($id, 'suspend', '활동정지가 풀렸어요', '이제 다시 글·댓글·쪽지를 쓸 수 있어요.', 'profile.html');
    out(['suspended_until' => null]);
  }
  $until = $p === '7' ? date('Y-m-d H:i:s', strtotime('+7 day')) : ($p === '30' ? date('Y-m-d H:i:s', strtotime('+1 month')) : ($p === 'perm' ? '9999-12-31 23:59:59' : null));
  if (!$until) fail('정지 기간을 골라 주세요');
  q("UPDATE ji_users SET suspended_until = ? WHERE id = ?", [$until, $id]);
  log_suspend($id, $t['nick'], 'suspend', $until, $why, $me['nick']);
  notify($id, 'suspend', '활동이 정지됐어요 (' . suspend_text($until) . ')',
    ($why !== '' ? '사유: ' . $why . ' · ' : '') . '정지 기간에는 글·댓글·쪽지·좋아요를 쓸 수 없어요. 문의는 문의·제보로 보내 주세요.', 'contact.html');
  out(['suspended_until' => iso($until)]);
}
case 'admin_seller_until': {   // 판매자 입점 기간 정하기 (null = 기한 없음)
  admin($R, true); $u = one("SELECT id FROM ji_users WHERE id = ?", [$R['id'] ?? '']); if (!$u) fail('회원을 찾을 수 없어요', 404);
  $d = $R['until'] ?? null; if ($d !== null && $d !== '' && !preg_match('/^\d{4}-\d{2}-\d{2}$/', $d)) fail('날짜 형식이 올바르지 않아요');
  q("UPDATE ji_users SET seller_until = ? WHERE id = ?", [$d ?: null, $u['id']]);
  // 입점 기간 기록 (언제부터 언제까지, 얼마나) — 'sp:<회원id>'
  $log = (array)setting('sp:' . $u['id'], []);
  $st = (string)($R['start'] ?? ''); if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $st)) $st = '';
  $log[] = ['start' => $st, 'end' => $d ?: '', 'kind' => str($R['kind'] ?? '', 20), 'at' => date('Y-m-d H:i'), 'memo' => str($R['memo'] ?? '', 60)];
  $log = array_slice($log, -50);
  q("REPLACE INTO ji_settings (k, v, updated_at) VALUES (?,?,?)", ['sp:' . $u['id'], json_encode($log, JSON_UNESCAPED_UNICODE), now()]);
  out($log);
}
case 'admin_inquiry_set': {
  admin($R); $st = $R['status'] ?? ''; if (!in_array($st, ['new', 'seen', 'contacted', 'done'], true)) fail('상태가 올바르지 않아요');
  q("UPDATE ji_inquiries SET status = ? WHERE id = ?", [$st, $R['id'] ?? '']); out(true);
}
case 'admin_inquiry_delete': { admin($R); $iq = $R['id'] ?? ''; if (is_uuid($iq)) foreach (all("SELECT path FROM ji_uploads WHERE post_id = ?", [$iq]) as $o) remove_upload($o['path']); q("DELETE FROM ji_inquiries WHERE id = ?", [$iq]); out(true); }
case 'admin_sellers': {
  admin($R, true);
  out(array_map(function ($r) { $r['details'] = json_decode($r['details'], true); $r['created_at'] = iso($r['created_at']);
    $u = one("SELECT email, region FROM ji_users WHERE id = ?", [$r['applicant']]); $r['email'] = $u['email'] ?? ''; $r['region'] = $u['region'] ?? ''; return $r; },
    all("SELECT * FROM ji_seller_requests ORDER BY created_at DESC LIMIT 300")));
}
case 'admin_seller_decide': {
  admin($R, true); $st = $R['status'] ?? ''; if (!in_array($st, ['approved', 'rejected'], true)) fail('처리 방법이 올바르지 않아요');
  $r = one("SELECT * FROM ji_seller_requests WHERE id = ?", [$R['id'] ?? '']); if (!$r) fail('요청을 찾을 수 없어요', 404);
  $was = $r['status'];
  q("UPDATE ji_seller_requests SET status = ? WHERE id = ?", [$st, $r['id']]);
  $role = $r['board'] === '제주상점' ? 'shop' : 'dealer';
  if ($st === 'approved') q("UPDATE ji_users SET role = ? WHERE id = ? AND role IN ('user','realtor','shop','dealer')", [$role, $r['applicant']]);
  if ($st === 'rejected' && $was === 'approved') q("UPDATE ji_users SET role = 'user' WHERE id = ? AND role = ?", [$r['applicant'], $role]);   // 승인 취소 → 일반 회원으로
  $link = $r['board'] === '제주상점' ? 'shops.html' : 'deals.html';
  notify($r['applicant'], 'seller_' . $st, $st === 'approved' ? $r['board'] . ' 승인 완료 🎉' : ($was === 'approved' ? $r['board'] . ' 승인 취소' : $r['board'] . ' 요청 결과'),
    $st === 'approved' ? '이제 ' . $r['board'] . '에 ' . ($role === 'shop' ? '상점 글' : '공구 글') . '을 올릴 수 있어요. (사이트를 새로고침하면 바로 반영돼요)' : ($was === 'approved' ? $r['board'] . ' 글쓰기 승인이 취소되었어요. 자세한 내용은 문의해 주세요.' : '이번에는 승인이 어렵다는 답을 받았어요. 자세한 내용은 문의해 주세요.'), $link);
  out(true);
}

/* ───────── 쪽지 ───────── */
case 'msg_send': {
  $u = me($R); $body = str($R['body'] ?? '', 2000); if ($body === '') fail('쪽지 내용을 입력해 주세요.');
  $to = !empty($R['to']) && is_uuid($R['to']) ? one("SELECT id, nick FROM ji_users WHERE id = ?", [$R['to']])
      : one("SELECT id, nick FROM ji_users WHERE nick = ?", [str($R['to_nick'] ?? '', 20)]);
  if (!$to) fail('받는 사람을 찾을 수 없어요. 닉네임을 확인해 주세요.', 404);
  if ($to['id'] === $u['id']) fail('나에게는 보낼 수 없어요');
  if (($t = suspended($u)) && !is_mod(one("SELECT role FROM ji_users WHERE id = ?", [$to['id']]) ?: []))
    fail('활동이 정지된 계정이에요 (' . suspend_text($t) . '). 관리자에게만 쪽지를 보낼 수 있어요.', 403);
  $n = one("SELECT COUNT(*) n FROM ji_messages WHERE sender = ? AND created_at > (NOW() - INTERVAL 10 MINUTE)", [$u['id']])['n'];
  if ($n >= 20 && !is_mod($u)) fail('쪽지를 너무 많이 보내고 있어요. 잠시 후 다시 해 주세요.', 429);
  $id = send_msg($u['id'], $u['nick'], $to, $body);
  out(msg_out(one("SELECT * FROM ji_messages WHERE id = ?", [$id]), $u['id']));
}
case 'msg_list': {
  $u = me($R); $box = ($R['box'] ?? 'in') === 'sent' ? 'sent' : 'in';
  $rows = $box === 'in' ? all("SELECT * FROM ji_messages WHERE receiver = ? AND del_r = 0 ORDER BY created_at DESC LIMIT 300", [$u['id']])
                        : all("SELECT * FROM ji_messages WHERE sender = ? AND del_s = 0 ORDER BY created_at DESC LIMIT 300", [$u['id']]);
  out(array_map(function ($m) use ($u) { return msg_out($m, $u['id']); }, $rows));
}
case 'msg_read': {
  $u = me($R); q("UPDATE ji_messages SET read_at = ? WHERE id = ? AND receiver = ? AND read_at IS NULL", [now(), $R['id'] ?? '', $u['id']]); out(true);
}
case 'msg_delete': {
  $u = me($R); $id = $R['id'] ?? '';
  q("UPDATE ji_messages SET del_r = 1 WHERE id = ? AND receiver = ?", [$id, $u['id']]);
  q("UPDATE ji_messages SET del_s = 1 WHERE id = ? AND sender = ?", [$id, $u['id']]);
  q("DELETE FROM ji_messages WHERE del_r = 1 AND del_s = 1");
  out(true);
}
case 'msg_unread': { $u = me($R, false); out($u ? (int)one("SELECT COUNT(*) n FROM ji_messages WHERE receiver = ? AND read_at IS NULL AND del_r = 0", [$u['id']])['n'] : 0); }
case 'admin_inquiry_reply': {
  $a = admin($R); $body = str($R['body'] ?? '', 2000); if ($body === '') fail('답장 내용을 입력해 주세요.');
  $i = one("SELECT * FROM ji_inquiries WHERE id = ?", [$R['id'] ?? '']); if (!$i) fail('문의를 찾을 수 없어요', 404);
  if (!$i['user_id']) fail('로그인하지 않고 보낸 문의라 쪽지로 답할 수 없어요. 남긴 연락처로 연락해 주세요.');
  $to = one("SELECT id, nick FROM ji_users WHERE id = ?", [$i['user_id']]); if (!$to) fail('탈퇴한 회원이에요');
  send_msg($a['id'], '제주이음', $to, $body, 'reply', $i['id']);
  q("UPDATE ji_inquiries SET status = 'done', replied_at = ? WHERE id = ?", [now(), $i['id']]);
  out(true);
}

/* ───────── 알림함 ───────── */
case 'notis': {
  $u = me($R);
  out(array_map(function ($n) { $n['read'] = (bool)$n['is_read']; unset($n['is_read']); $n['created_at'] = iso($n['created_at']); return $n; },
    all("SELECT * FROM ji_notifications WHERE user_id = ? AND kind <> 'message' ORDER BY created_at DESC LIMIT 50", [$u['id']])));
}
case 'noti_unread': { $u = me($R, false); out($u ? (int)one("SELECT COUNT(*) n FROM ji_notifications WHERE user_id = ? AND is_read = 0 AND kind <> 'message'", [$u['id']])['n'] : 0); }
case 'noti_read': {   // 고른 알림만 읽음으로
  $u = me($R); $n = 0;
  foreach (array_slice((array)($R['ids'] ?? []), 0, 200) as $id) if (is_uuid($id)) { q("UPDATE ji_notifications SET is_read = 1 WHERE id = ? AND user_id = ?", [$id, $u['id']]); $n++; }
  out($n);
}
case 'msg_read_many': {   // 고른 쪽지만 읽음으로
  $u = me($R); $n = 0;
  foreach (array_slice((array)($R['ids'] ?? []), 0, 200) as $id) if (is_uuid($id)) { q("UPDATE ji_messages SET read_at = ? WHERE id = ? AND receiver = ? AND read_at IS NULL", [now(), $id, $u['id']]); $n++; }
  out($n);
}
case 'push_reg': {   // 이 기기(dev)의 최근 푸시 구독 id 를 기억 — 기기마다 하나만 남김
  $u = me($R); $sid = (string)($R['sid'] ?? ''); $dev = substr(preg_replace('/[^a-z0-9]/', '', (string)($R['dev'] ?? '')), 0, 16);
  if (!preg_match('/^[0-9a-f-]{36}$/i', $sid) || $dev === '') fail('구독 정보가 올바르지 않아요');
  $m = (array)setting('ps:' . $u['id'], []);
  foreach ($m as $k => $d) if (($d['sid'] ?? '') === $sid && $k !== $dev) unset($m[$k]);
  $m[$dev] = ['sid' => $sid, 'at' => date('Y-m-d H:i')];
  if (count($m) > 6) { uasort($m, function ($a, $b) { return strcmp($b['at'], $a['at']); }); $m = array_slice($m, 0, 6, true); }
  q("REPLACE INTO ji_settings (k, v, updated_at) VALUES (?,?,?)", ['ps:' . $u['id'], json_encode($m), now()]);
  out(count($m));
}
case 'noti_read_admin': {   // 관리자 콘솔을 열면: 운영 알림(새 문의·가입·댓글 등)은 확인한 것으로 — 앱 아이콘 숫자가 남지 않게
  $u = me($R); if (!is_mod($u)) out(0);
  q("UPDATE ji_notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0 AND kind LIKE 'admin\\_%'", [$u['id']]); out(true);
}
case 'noti_read_all': { $u = me($R); q("UPDATE ji_notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0", [$u['id']]); out(true); }

default: fail('알 수 없는 요청이에요', 404);
}
} catch (PDOException $e) {
  if ($e->getCode() == 23000) fail('이미 등록된 내용이에요');
  error_log('[jeju api] ' . $e->getMessage());
  fail('서버에서 문제가 생겼어요. 잠시 후 다시 해 주세요.', 500);
}
