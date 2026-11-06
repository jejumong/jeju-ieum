<?php
/* ============================================================
   제주이음 API · 공통 함수
   - 카페24 웹호스팅(PHP 8 + MariaDB 10)에서 동작
   - 표 이름은 모두 ji_ 로 시작 (같은 DB의 그누보드 g5_ 표와 겹치지 않음)
   ============================================================ */
if (!defined('JI_API')) { http_response_code(403); exit; }

date_default_timezone_set('Asia/Seoul');
$CFG = require __DIR__ . '/config.php';

const JI_SCHEMA = 4;

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
  $pdo->exec("CREATE TABLE IF NOT EXISTS ji_login_fails (
    ip VARCHAR(45) NOT NULL, at DATETIME NOT NULL, INDEX (ip, at))$T");
  // 버전별 정리
  if ($v < 4) {
    try { $pdo->exec("ALTER TABLE ji_inquiries ADD COLUMN user_id CHAR(36) NULL, ADD COLUMN replied_at DATETIME NULL"); } catch (Throwable $e) {}
    $pdo->exec("UPDATE ji_users SET role = 'shop' WHERE role = 'seller'");
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
    $s = one("SELECT s.token, s.seen_at, u.id, u.email, u.nick, u.region, u.role FROM ji_sessions s JOIN ji_users u ON u.id = s.user_id
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
function is_mod($u) { return in_array($u['role'] ?? '', ['admin', 'staff'], true); }   // 글·댓글 관리 가능
/* 관리자 페이지: 스텝도 들어올 수 있음. $strict 이면 관리자만 (역할 바꾸기 등) */
function admin($req, $strict = false) {
  $u = me($req);
  if (!(($u['role'] ?? '') === 'admin' || (!$strict && ($u['role'] ?? '') === 'staff'))) fail($strict ? '관리자만 할 수 있어요' : '관리자·스텝만 할 수 있어요', 403);
  return $u;
}
function can_write_board($u, $b) {
  if (is_mod($u)) return true;
  if ($b === '제주상점') return ($u['role'] ?? '') === 'shop';
  if ($b === '특가공구') return ($u['role'] ?? '') === 'dealer';
  return true;
}
function setting($k, $def) { $r = one("SELECT v FROM ji_settings WHERE k = ?", [$k]); return $r ? json_decode($r['v'], true) : $def; }
function user_out($u) { return ['id' => $u['id'], 'email' => $u['email'], 'nick' => $u['nick'], 'region' => $u['region'], 'role' => $u['role'] ?? 'user']; }

/* ── 알림 + 휴대폰 푸시 (OneSignal) ── */
function notify($uid, $kind, $title, $body, $link, $pushTitle = null, $pushBody = null) {
  global $CFG;
  q("INSERT INTO ji_notifications (id, user_id, kind, title, body, link, created_at) VALUES (?,?,?,?,?,?,?)",
    [uuid(), $uid, $kind, mb_substr($title, 0, 200), mb_substr($body, 0, 500), $link, now()]);
  if (empty($CFG['onesignal_key']) || !function_exists('curl_init')) return;
  $h = $pushTitle ?? ('제주이음 · ' . $title); $m = $pushBody ?? $body;
  $payload = json_encode([
    'app_id' => $CFG['onesignal_app'], 'target_channel' => 'push',
    'include_aliases' => ['external_id' => [$uid]],
    'headings' => ['en' => $h, 'ko' => $h], 'contents' => ['en' => $m, 'ko' => $m],
    'url' => rtrim($CFG['site_url'], '/') . '/' . ltrim($link, '/'),
  ], JSON_UNESCAPED_UNICODE);
  $c = curl_init('https://api.onesignal.com/notifications');
  curl_setopt_array($c, [CURLOPT_POST => true, CURLOPT_POSTFIELDS => $payload, CURLOPT_RETURNTRANSFER => true,
    CURLOPT_CONNECTTIMEOUT => 3, CURLOPT_TIMEOUT => 4,
    CURLOPT_HTTPHEADER => ['Content-Type: application/json', 'Authorization: Key ' . $CFG['onesignal_key']]]);
  @curl_exec($c); @curl_close($c);   // 푸시가 실패해도 알림함에는 남음
}
