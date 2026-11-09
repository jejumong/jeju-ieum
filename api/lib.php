<?php
/* ============================================================
   제주이음 API · 공통 함수
   - 카페24 웹호스팅(PHP 8 + MariaDB 10)에서 동작
   - 표 이름은 모두 ji_ 로 시작 (같은 DB의 그누보드 g5_ 표와 겹치지 않음)
   ============================================================ */
if (!defined('JI_API')) { http_response_code(403); exit; }

date_default_timezone_set('Asia/Seoul');
$CFG = require __DIR__ . '/config.php';

const JI_SCHEMA = 10;

/* ── 응답 ── */
function cors() {
  global $CFG;
  $o = $_SERVER['HTTP_ORIGIN'] ?? '';
  $ok = in_array($o, $CFG['origins'], true) || preg_match('#^https?://(localhost|127\.0\.0\.1)(:\d+)?$#', $o);
  if ($ok) { header('Access-Control-Allow-Origin: ' . $o); header('Vary: Origin'); }
  header('Access-Control-Allow-Methods: POST, GET, OPTIONS');
  header('Access-Control-Allow-Headers: Content-Type');
  header('Access-Control-Max-Age: 86400');
}
function out($data, $code = 200) {
  http_response_code($code);
  header('Content-Type: application/json; charset=utf-8');
  header('Cache-Control: no-store');
  echo json_encode(['ok' => $code < 400, 'data' => $data], JSON_UNESCAPED_UNICODE);
  exit;
}
function fail($msg, $code = 400) {
  http_response_code($code);
  header('Content-Type: application/json; charset=utf-8');
  echo json_encode(['ok' => false, 'error' => $msg], JSON_UNESCAPED_UNICODE);
  exit;
}

/* ── DB ── */
function db() {
  static $pdo = null; global $CFG;
  if ($pdo) return $pdo;
  try {
    $pdo = new PDO('mysql:host=' . $CFG['db_host'] . ';dbname=' . $CFG['db_name'] . ';charset=utf8mb4', $CFG['db_user'], $CFG['db_pass'], [
      PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
      PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
      PDO::ATTR_EMULATE_PREPARES => false,
    ]);
    $pdo->exec("SET time_zone = '+09:00'");
  } catch (Throwable $e) { fail('데이터베이스에 연결하지 못했어요', 500); }
  migrate($pdo);
  return $pdo;
}
function q($sql, $args = []) { $s = db()->prepare($sql); $s->execute($args); return $s; }
function one($sql, $args = []) { $r = q($sql, $args)->fetch(); return $r ?: null; }
function all($sql, $args = []) { return q($sql, $args)->fetchAll(); }

/* 처음 호출될 때 표를 자동으로 만듦 (여러 번 실행돼도 안전) */
function migrate($pdo) {
  try { $v = (int)$pdo->query("SELECT v FROM ji_meta WHERE k='schema'")->fetchColumn(); }
  catch (Throwable $e) { $v = 0; }
  if ($v >= JI_SCHEMA) return;
  $T = ' ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci';
  $pdo->exec("CREATE TABLE IF NOT EXISTS ji_meta (k VARCHAR(40) PRIMARY KEY, v VARCHAR(255) NOT NULL)$T");
  $pdo->exec("CREATE TABLE IF NOT EXISTS ji_users (
    id CHAR(36) PRIMARY KEY, email VARCHAR(190) NOT NULL UNIQUE, pass VARCHAR(255) NOT NULL,
    nick VARCHAR(20) NOT NULL UNIQUE, region VARCHAR(40) NOT NULL DEFAULT '', role VARCHAR(10) NOT NULL DEFAULT 'user',
    created_at DATETIME NOT NULL, last_login DATETIME NULL)$T");
  $pdo->exec("CREATE TABLE IF NOT EXISTS ji_sessions (
    token CHAR(64) PRIMARY KEY, user_id CHAR(36) NOT NULL, created_at DATETIME NOT NULL, seen_at DATETIME NOT NULL,
    INDEX (user_id))$T");
  $pdo->exec("CREATE TABLE IF NOT EXISTS ji_posts (
    id CHAR(36) PRIMARY KEY, board VARCHAR(30) NOT NULL, head VARCHAR(30) NOT NULL DEFAULT '', title VARCHAR(200) NOT NULL,
    content MEDIUMTEXT NOT NULL, loc VARCHAR(100) NOT NULL DEFAULT '', meta VARCHAR(255) NOT NULL DEFAULT '',
    price VARCHAR(60) NOT NULL DEFAULT '', extra TEXT NOT NULL, author CHAR(36) NOT NULL, author_nick VARCHAR(20) NOT NULL,
    views INT NOT NULL DEFAULT 0, created_at DATETIME NOT NULL, updated_at DATETIME NOT NULL,
    INDEX (board, created_at), INDEX (author))$T");
  $pdo->exec("CREATE TABLE IF NOT EXISTS ji_club_joins (
    id CHAR(36) PRIMARY KEY, club_id CHAR(36) NOT NULL, club_title VARCHAR(200) NOT NULL DEFAULT '', owner CHAR(36) NOT NULL,
    applicant CHAR(36) NOT NULL, applicant_nick VARCHAR(20) NOT NULL, message VARCHAR(300) NOT NULL DEFAULT '',
    status VARCHAR(10) NOT NULL DEFAULT 'pending', created_at DATETIME NOT NULL, decided_at DATETIME NULL,
    UNIQUE KEY (club_id, applicant), INDEX (owner, created_at), INDEX (applicant))$T");
  $pdo->exec("CREATE TABLE IF NOT EXISTS ji_club_notices (
    id CHAR(36) PRIMARY KEY, club_id CHAR(36) NOT NULL, club_title VARCHAR(200) NOT NULL DEFAULT '', owner CHAR(36) NOT NULL,
    body VARCHAR(1000) NOT NULL, created_at DATETIME NOT NULL, INDEX (club_id, created_at))$T");
  $pdo->exec("CREATE TABLE IF NOT EXISTS ji_notifications (
    id CHAR(36) PRIMARY KEY, user_id CHAR(36) NOT NULL, kind VARCHAR(30) NOT NULL, title VARCHAR(200) NOT NULL,
    body VARCHAR(500) NOT NULL DEFAULT '', link VARCHAR(300) NOT NULL DEFAULT '', is_read TINYINT(1) NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL, INDEX (user_id, created_at))$T");
  $pdo->exec("CREATE TABLE IF NOT EXISTS ji_seller_requests (
    id CHAR(36) PRIMARY KEY, board VARCHAR(20) NOT NULL, applicant CHAR(36) NOT NULL, applicant_nick VARCHAR(20) NOT NULL,
    details TEXT NOT NULL, message VARCHAR(1000) NOT NULL DEFAULT '', status VARCHAR(10) NOT NULL DEFAULT 'pending',
    created_at DATETIME NOT NULL)$T");
  $pdo->exec("CREATE TABLE IF NOT EXISTS ji_comments (
    id CHAR(36) PRIMARY KEY, post_id VARCHAR(40) NOT NULL, author CHAR(36) NOT NULL, author_nick VARCHAR(20) NOT NULL,
    text VARCHAR(1000) NOT NULL, edited TINYINT(1) NOT NULL DEFAULT 0, created_at DATETIME NOT NULL,
    INDEX (post_id, created_at), INDEX (author))$T");
  $pdo->exec("CREATE TABLE IF NOT EXISTS ji_settings (k VARCHAR(40) PRIMARY KEY, v MEDIUMTEXT NOT NULL, updated_at DATETIME NOT NULL)$T");
  $pdo->exec("CREATE TABLE IF NOT EXISTS ji_inquiries (
    id CHAR(36) PRIMARY KEY, data TEXT NOT NULL, status VARCHAR(10) NOT NULL DEFAULT 'new', ip VARCHAR(45) NOT NULL DEFAULT '',
    created_at DATETIME NOT NULL, INDEX (created_at))$T");
  $pdo->exec("CREATE TABLE IF NOT EXISTS ji_messages (
    id CHAR(36) PRIMARY KEY, sender CHAR(36) NOT NULL, sender_nick VARCHAR(30) NOT NULL, receiver CHAR(36) NOT NULL, receiver_nick VARCHAR(30) NOT NULL,
    body VARCHAR(2000) NOT NULL, kind VARCHAR(20) NOT NULL DEFAULT 'dm', ref VARCHAR(40) NOT NULL DEFAULT '',
    read_at DATETIME NULL, del_s TINYINT(1) NOT NULL DEFAULT 0, del_r TINYINT(1) NOT NULL DEFAULT 0, created_at DATETIME NOT NULL,
    INDEX (receiver, created_at), INDEX (sender, created_at))$T");
  $pdo->exec("CREATE TABLE IF NOT EXISTS ji_uploads (
    id CHAR(36) PRIMARY KEY, user_id CHAR(36) NOT NULL, path VARCHAR(120) NOT NULL UNIQUE, bytes INT NOT NULL DEFAULT 0,
    w INT NOT NULL DEFAULT 0, h INT NOT NULL DEFAULT 0, post_id CHAR(36) NULL, created_at DATETIME NOT NULL,
    INDEX (user_id, created_at), INDEX (post_id))$T");
  $pdo->exec("CREATE TABLE IF NOT EXISTS ji_likes (
    post_id VARCHAR(40) NOT NULL, user_id CHAR(36) NOT NULL, active TINYINT(1) NOT NULL DEFAULT 1, created_at DATETIME NOT NULL,
    PRIMARY KEY (post_id, user_id), INDEX (user_id))$T");
  $pdo->exec("CREATE TABLE IF NOT EXISTS ji_resets (
    token CHAR(64) PRIMARY KEY, user_id CHAR(36) NOT NULL, email VARCHAR(190) NOT NULL, ip VARCHAR(45) NOT NULL,
    expires_at DATETIME NOT NULL, used_at DATETIME NULL, created_at DATETIME NOT NULL, INDEX (user_id), INDEX (ip, created_at), INDEX (email, created_at))$T");
  $pdo->exec("CREATE TABLE IF NOT EXISTS ji_login_fails (
    ip VARCHAR(45) NOT NULL, at DATETIME NOT NULL, INDEX (ip, at))$T");
  // 버전별 정리
  if ($v < 4) {
    try { $pdo->exec("ALTER TABLE ji_inquiries ADD COLUMN user_id CHAR(36) NULL, ADD COLUMN replied_at DATETIME NULL"); } catch (Throwable $e) {}
    $pdo->exec("UPDATE ji_users SET role = 'shop' WHERE role = 'seller'");
  }
  if ($v < 7) {   // 게시판 이름 변경: 고민상담실 → 질문하기, 취미여행 → 취미.여행
    $pdo->exec("UPDATE ji_posts SET board = '질문하기' WHERE board = '고민상담실'");
  }
  if ($v < 8) {   // 취미여행·취미.여행 → 취미·여행 (가운데 점)
    $pdo->exec("UPDATE ji_posts SET board = '취미·여행' WHERE board IN ('취미여행', '취미.여행')");
  }
  if ($v < 10) {   // 판매자 입점 기간 (비우면 기한 없음)
    try { $pdo->exec("ALTER TABLE ji_users ADD COLUMN seller_until DATE NULL"); } catch (Throwable $e) {}
  }
  $pdo->prepare("REPLACE INTO ji_meta (k, v) VALUES ('schema', ?)")->execute([JI_SCHEMA]);
}

/* ── 도움 함수 ── */
function now() { return date('Y-m-d H:i:s'); }
function iso($dt) { return $dt ? date('c', strtotime($dt)) : null; }
function uuid() {
  $d = random_bytes(16); $d[6] = chr(ord($d[6]) & 0x0f | 0x40); $d[8] = chr(ord($d[8]) & 0x3f | 0x80);
  return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($d), 4));
}
function is_uuid($s) { return is_string($s) && preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i', $s); }
function str($v, $max) { $v = trim((string)($v ?? '')); return mb_substr($v, 0, $max); }
function ip() { return $_SERVER['REMOTE_ADDR'] ?? ''; }

/* ── 로그인 상태 ── */
function token_hash($t) { return hash('sha256', $t); }
function new_session($uid) {
  $t = bin2hex(random_bytes(32));
  q("INSERT INTO ji_sessions (token, user_id, created_at, seen_at) VALUES (?,?,?,?)", [token_hash($t), $uid, now(), now()]);
  return $t;
}
function me($req, $need = true) {
  static $u = false;
  if ($u !== false) { if (!$u && $need) fail('로그인이 필요해요', 401); return $u; }
  $u = null; $t = $req['_t'] ?? '';
  if (is_string($t) && strlen($t) === 64) {
    $s = one("SELECT s.token, s.seen_at, u.id, u.email, u.nick, u.region, u.role, u.seller_until FROM ji_sessions s JOIN ji_users u ON u.id = s.user_id
              WHERE s.token = ? AND s.seen_at > (NOW() - INTERVAL 60 DAY)", [token_hash($t)]);
    if ($s) {
      if (strtotime($s['seen_at']) < time() - 86400) q("UPDATE ji_sessions SET seen_at = ? WHERE token = ?", [now(), $s['token']]);
      unset($s['token'], $s['seen_at']); $u = $s;
    }
  }
  if (!$u && $need) fail('로그인이 필요해요', 401);
  return $u;
}
/* 역할: user 일반 · realtor 부동산 중개인 · shop 상점판매자 · dealer 공구판매자 · staff 스텝 · admin 관리자 */
const JI_ROLES = ['user', 'realtor', 'shop', 'dealer', 'staff', 'admin'];
/* 알림 주제(태그)를 켠 기기에 푸시 — 예: 학교 주변 새 매물 'yuhak_3' */
function push_tag($tag, $title, $body, $link) {
  global $CFG;
  if (empty($CFG['onesignal_key']) || !function_exists('curl_init')) return;
  $payload = json_encode(['app_id' => $CFG['onesignal_app'], 'target_channel' => 'push',
    'filters' => [['field' => 'tag', 'key' => $tag, 'relation' => 'exists']],
    'headings' => ['en' => $title, 'ko' => $title], 'contents' => ['en' => $body, 'ko' => $body],
    'url' => rtrim($CFG['site_url'], '/') . '/' . ltrim($link, '/')], JSON_UNESCAPED_UNICODE);
  $c = curl_init('https://api.onesignal.com/notifications');
  curl_setopt_array($c, [CURLOPT_POST => true, CURLOPT_POSTFIELDS => $payload, CURLOPT_RETURNTRANSFER => true, CURLOPT_CONNECTTIMEOUT => 3, CURLOPT_TIMEOUT => 4,
    CURLOPT_HTTPHEADER => ['Content-Type: application/json', 'Authorization: Key ' . $CFG['onesignal_key']]]);
  @curl_exec($c); @curl_close($c);
}
/* 농어촌유학 학교 (school-housing-data.js 의 YUHAK_SCHOOLS 와 같은 순서) */
const YUHAK_BASES = ['귀덕', '송당', '평대', '하도', '성읍', '신례', '창천', '흥산', '구좌중앙', '종달', '한동', '대정서', '무릉', '수산'];
/* 운영자처럼 보이는 닉네임은 일반 회원이 못 씀 */
function reserved_nick($n) { $k = preg_replace('/\s+/u', '', mb_strtolower($n)); return (bool)preg_match('/제주이음|운영자|관리자|운영진|admin/u', $k); }
function is_mod($u) { return in_array($u['role'] ?? '', ['admin', 'staff'], true); }   // 글·댓글 관리 가능
/* 관리자 페이지: 스텝도 들어올 수 있음. $strict 이면 관리자만 (역할 바꾸기 등) */
function admin($req, $strict = false) {
  $u = me($req);
  if (!(($u['role'] ?? '') === 'admin' || (!$strict && ($u['role'] ?? '') === 'staff'))) fail($strict ? '관리자만 할 수 있어요' : '관리자·스텝만 할 수 있어요', 403);
  return $u;
}
function can_write_board($u, $b) {
  if (is_mod($u)) return true;
  if ($b === '제주상점') return ($u['role'] ?? '') === 'shop' && seller_live('shop', $u['seller_until'] ?? null);
  if ($b === '특가공구') return ($u['role'] ?? '') === 'dealer' && seller_live('dealer', $u['seller_until'] ?? null);
  if ($b === '축제정보') return false;   // 회원 축제 제보는 문의·제보로 받고 운영진이 검토해 게시
  return true;
}
/* 관리자·스텝이 받을 알림 종류 — 각자 켜고 끔 (ji_settings 'al:<회원id>') */
const ADMIN_ALERTS = [
  'signup'  => ['👋 새 회원가입', false],
  'leave'   => ['🚪 회원 탈퇴', false],
  'post'    => ['📝 커뮤니티 새 글', false],
  'trade'   => ['🏷️ 거래·부동산 새 글', false],
  'comment' => ['💬 새 댓글', false],
  'inquiry' => ['📮 새 문의·제보', true],
  'seller'  => ['🏪 입점·공구 승인 요청', true],
];
function admin_alert_prefs($uid) {
  $saved = setting('al:' . $uid, []); $out = [];
  foreach (ADMIN_ALERTS as $k => $v) $out[$k] = array_key_exists($k, $saved) ? (bool)$saved[$k] : $v[1];
  return $out;
}
function alert_admins($ev, $title, $body, $link, $except = null, $pushTitle = null, $pushBody = null) {
  foreach (all("SELECT id FROM ji_users WHERE role IN ('admin','staff')") as $ad) {
    if ($ad['id'] === $except) continue;
    if (!(admin_alert_prefs($ad['id'])[$ev] ?? false)) continue;
    notify($ad['id'], 'admin_' . $ev, $title, $body, $link, $pushTitle ?? ('제주이음 · ' . $title), $pushBody ?? $body);
  }
}
function setting($k, $def) { $r = one("SELECT v FROM ji_settings WHERE k = ?", [$k]); return $r ? json_decode($r['v'], true) : $def; }
/* ── 사진 ── */
function upload_dir() { return dirname(__DIR__) . '/uploads'; }   // www/jeju/uploads
function upload_base() {
  global $CFG;
  if (!empty($CFG['upload_url'])) return rtrim($CFG['upload_url'], '/') . '/';
  $https = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') || ($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https' || ($_SERVER['SERVER_PORT'] ?? '') == 443;
  $host = $_SERVER['HTTP_HOST'] ?? 'localhost';
  if (preg_match('/mycafe24\.com$/', $host)) $https = true;
  return ($https ? 'https://' : 'http://') . $host . rtrim(dirname(dirname($_SERVER['SCRIPT_NAME'])), '/\\') . '/uploads/';
}
/* 글에 붙은 사진 목록 정리: 내가 올린 사진만 남기고 글에 연결 */
function attach_photos($postId, $uid, $photos, $isMod = false) {
  $base = upload_base(); $keep = [];
  foreach (array_slice(is_array($photos) ? $photos : [], 0, 10) as $url) {
    if (!is_string($url) || strpos($url, $base) !== 0) continue;
    $path = substr($url, strlen($base));
    $u = one("SELECT user_id, post_id FROM ji_uploads WHERE path = ?", [$path]);
    if (!$u || ($u['user_id'] !== $uid && !$isMod) || ($u['post_id'] && $u['post_id'] !== $postId)) continue;
    $keep[] = $path;
  }
  // 이 글에서 빠진 사진은 지움
  foreach (all("SELECT path FROM ji_uploads WHERE post_id = ?", [$postId]) as $old)
    if (!in_array($old['path'], $keep, true)) remove_upload($old['path']);
  foreach ($keep as $path) q("UPDATE ji_uploads SET post_id = ? WHERE path = ?", [$postId, $path]);
  return array_map(function ($p) use ($base) { return $base . $p; }, $keep);
}
function remove_upload($path) {
  if (!preg_match('#^\d{6}/[0-9a-f-]{36}\.(jpg|png|webp)$#', $path)) return;
  @unlink(upload_dir() . '/' . $path);
  q("DELETE FROM ji_uploads WHERE path = ?", [$path]);
}
function user_out($u) { return ['id' => $u['id'], 'email' => $u['email'], 'nick' => $u['nick'], 'region' => $u['region'], 'role' => $u['role'] ?? 'user', 'seller_until' => $u['seller_until'] ?? null]; }
/* 판매 게시판: 제주상점은 상점판매자, 특가공구는 공구판매자 — 입점 기간(seller_until)이 지났으면 '쉬는 중' */
const SELLER_BOARDS = ['제주상점' => 'shop', '특가공구' => 'dealer'];
function seller_live($role, $until) { return in_array($role, ['admin', 'staff'], true) ? true : ($until === null || $until === '' || $until >= date('Y-m-d')); }
/* 글이 남에게 보이는지: 판매 게시판 글은 글쓴이가 지금 그 판매자이고 입점 기간 안일 때만 */
function post_live($r) {
  $need = SELLER_BOARDS[$r['board']] ?? null; if (!$need) return true;
  $role = $r['author_role'] ?? 'user';
  if (in_array($role, ['admin', 'staff'], true)) return true;
  return $role === $need && seller_live($role, $r['author_until'] ?? null);
}

/* ── 알림 + 휴대폰 푸시 (OneSignal) ── */
function notify($uid, $kind, $title, $body, $link, $pushTitle = null, $pushBody = null, $save = true) {
  global $CFG;
  if ($save) q("INSERT INTO ji_notifications (id, user_id, kind, title, body, link, created_at) VALUES (?,?,?,?,?,?,?)",
    [uuid(), $uid, $kind, mb_substr($title, 0, 200), mb_substr($body, 0, 500), $link, now()]);
  if (empty($CFG['onesignal_key']) || !function_exists('curl_init')) return;
  $h = $pushTitle ?? ('제주이음 · ' . $title); $m = $pushBody ?? $body;
  // 같은 기기에 사이트 앱·관리자 앱·브라우저가 따로 구독돼 있어도 기기마다 한 번만 오게: 기기별 최근 구독 하나로만 보냄
  $subs = array_values(array_unique(array_filter(array_map(function ($d) { return $d['sid'] ?? ''; }, (array)setting('ps:' . $uid, [])))));
  $payload = json_encode([
    'app_id' => $CFG['onesignal_app'], 'target_channel' => 'push',
  ] + ($subs ? ['include_subscription_ids' => $subs] : ['include_aliases' => ['external_id' => [$uid]]]) + [
    'web_push_topic' => substr(md5($uid . $title . $body), 0, 16),
    'headings' => ['en' => $h, 'ko' => $h], 'contents' => ['en' => $m, 'ko' => $m],
    'url' => rtrim($CFG['site_url'], '/') . '/' . ltrim($link, '/'),
  ], JSON_UNESCAPED_UNICODE);
  $c = curl_init('https://api.onesignal.com/notifications');
  curl_setopt_array($c, [CURLOPT_POST => true, CURLOPT_POSTFIELDS => $payload, CURLOPT_RETURNTRANSFER => true,
    CURLOPT_CONNECTTIMEOUT => 3, CURLOPT_TIMEOUT => 4,
    CURLOPT_HTTPHEADER => ['Content-Type: application/json', 'Authorization: Key ' . $CFG['onesignal_key']]]);
  @curl_exec($c); @curl_close($c);   // 푸시가 실패해도 알림함에는 남음
}


/* 메일 보내기
   ① smtp_user·smtp_pass 가 설정돼 있으면 네이버 메일 서버(SMTP)로 보냄 → 스팸으로 잘 가지 않음
   ② 없거나 실패하면 카페24 서버의 기본 mail() 로 보냄 */
function send_mail($to, $subject, $text) {
  global $CFG;
  if (!empty($CFG['mail_log'])) { @file_put_contents($CFG['mail_log'], "TO: $to\n$subject\n$text\n---\n", FILE_APPEND); return true; }   // 개발용
  $enc = function ($t) { return '=?UTF-8?B?' . base64_encode($t) . '?='; };
  $su = (string)($CFG['smtp_user'] ?? ''); $sp = (string)($CFG['smtp_pass'] ?? '');
  $from = !empty($CFG['mail_from']) ? $CFG['mail_from'] : ($su && strpos($su, '@naver.com') ? $su : ('noreply@' . (parse_url($CFG['site_url'] ?? '', PHP_URL_HOST) ?: 'jejuieum.com')));
  $host = parse_url($CFG['site_url'] ?? '', PHP_URL_HOST) ?: 'jejuieum.com';
  $head = [
    'Date: ' . date('r'),
    'From: ' . $enc('제주이음') . ' <' . $from . '>',
    'To: <' . $to . '>',
    'Reply-To: ' . (!empty($CFG['mail_reply']) ? $CFG['mail_reply'] : 'jejumong2@naver.com'),
    'Subject: ' . $enc($subject),
    'Message-ID: <' . bin2hex(random_bytes(12)) . '@' . $host . '>',
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
  ];
  $body = chunk_split(base64_encode($text));
  if ($su && $sp && smtp_send(!empty($CFG['smtp_host']) ? $CFG['smtp_host'] : 'smtp.naver.com', (int)(!empty($CFG['smtp_port']) ? $CFG['smtp_port'] : 465), $su, $sp, $from, $to, implode("\r\n", $head) . "\r\n\r\n" . $body)) return true;
  if (!function_exists('mail')) return false;
  $h2 = array_values(array_filter($head, function ($l) { return strpos($l, 'To:') !== 0 && strpos($l, 'Subject:') !== 0; }));
  return @mail($to, $enc($subject), $body, implode("\r\n", $h2), '-f' . $from);
}
function smtp_send($host, $port, $user, $pass, $from, $to, $data) {
  $fp = @stream_socket_client('ssl://' . $host . ':' . $port, $en, $es, 10);
  if (!$fp) { error_log("[jeju] smtp connect fail: $es"); return false; }
  stream_set_timeout($fp, 10);
  $read = function () use ($fp) { $r = ''; while (($l = fgets($fp, 1024)) !== false) { $r .= $l; if (strlen($l) < 4 || $l[3] === ' ') break; } return $r; };
  $cmd = function ($c, $ok) use ($fp, $read) { if ($c !== null) fwrite($fp, $c . "\r\n"); $r = $read(); if ((int)substr($r, 0, 3) !== $ok) throw new Exception(trim($r)); return $r; };
  try {
    $cmd(null, 220);
    $cmd('EHLO jejuieum.com', 250);
    $cmd('AUTH LOGIN', 334); $cmd(base64_encode($user), 334); $cmd(base64_encode($pass), 235);
    $cmd('MAIL FROM:<' . $from . '>', 250);
    $cmd('RCPT TO:<' . $to . '>', 250);
    $cmd('DATA', 354);
    $cmd(preg_replace('/^\./m', '..', $data) . "\r\n.", 250);
    $cmd('QUIT', 221);
    fclose($fp); return true;
  } catch (Throwable $e) { error_log('[jeju] smtp fail: ' . $e->getMessage()); @fclose($fp); return false; }
}
