<?php
/* 제주이음 API 설정 — 실제 config.php 는 GitHub Actions 가 Secrets 값으로 만들어서 올립니다.
   (이 파일과 config.php 는 공개 저장소에 비밀번호를 올리지 않기 위한 구조입니다) */
return [
  'db_host' => 'localhost',
  'db_name' => 'DB이름',
  'db_user' => 'DB아이디',
  'db_pass' => 'DB비밀번호',
  'site_url' => 'https://jejuieum.com/',
  'origins' => ['https://jejuieum.com', 'https://www.jejuieum.com', 'https://jeju.hintdaily.com', 'https://jejumong.github.io'],
  'admins' => [],                 // 관리자 이메일 (소문자)
  'onesignal_app' => 'c7fd4d45-3d1b-4157-9230-d29e4676f659',
  'onesignal_key' => '',          // OneSignal REST API 키 (비우면 휴대폰 푸시 없이 알림함만)
];
