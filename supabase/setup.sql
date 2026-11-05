-- ============================================================
--  제주이음 · Supabase 데이터베이스 준비 (한 번만 실행)
--  Supabase → SQL Editor → New query → 이 파일 내용을 전부 붙여 넣고 Run
--  여러 번 실행해도 안전하게 만들었습니다.
-- ============================================================

-- 1) 회원 프로필 (로그인 계정과 1:1)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nick text not null unique check (char_length(nick) between 2 and 10),
  region text not null default '',
  created_at timestamptz not null default now()
);

-- 2) 게시글 (지금은 동호회부터, 다른 게시판도 차례로 옮겨 올 예정)
create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  board text not null,
  head text default '',
  title text not null check (char_length(title) between 1 and 120),
  content text default '',
  loc text default '',
  meta text default '',
  price text default '',
  extra jsonb not null default '{}'::jsonb,
  author uuid not null references public.profiles(id) on delete cascade,
  author_nick text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists posts_board_idx on public.posts(board, created_at desc);

-- 3) 동호회 가입 신청
create table if not exists public.club_joins (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.posts(id) on delete cascade,
  club_title text not null default '',
  owner uuid not null references public.profiles(id) on delete cascade,
  applicant uuid not null references public.profiles(id) on delete cascade,
  applicant_nick text not null,
  message text default '' check (char_length(message) <= 300),
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  unique (club_id, applicant)
);
create index if not exists club_joins_owner_idx on public.club_joins(owner, created_at desc);

-- 4) 알림함 (사이트 안 종 모양)
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null,
  title text not null,
  body text default '',
  link text default '',
  read boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists notifications_user_idx on public.notifications(user_id, created_at desc);

-- ── 보안 규칙 (Row Level Security) ──
alter table public.profiles enable row level security;
alter table public.posts enable row level security;
alter table public.club_joins enable row level security;
alter table public.notifications enable row level security;

drop policy if exists "profiles read" on public.profiles;
create policy "profiles read" on public.profiles for select using (true);
drop policy if exists "profiles insert own" on public.profiles;
create policy "profiles insert own" on public.profiles for insert with check (auth.uid() = id);
drop policy if exists "profiles update own" on public.profiles;
create policy "profiles update own" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "posts read" on public.posts;
create policy "posts read" on public.posts for select using (true);
drop policy if exists "posts insert own" on public.posts;
create policy "posts insert own" on public.posts for insert with check (auth.uid() = author);
drop policy if exists "posts update own" on public.posts;
create policy "posts update own" on public.posts for update using (auth.uid() = author) with check (auth.uid() = author);
drop policy if exists "posts delete own" on public.posts;
create policy "posts delete own" on public.posts for delete using (auth.uid() = author);

-- 신청은 본인 이름으로만, 모임장은 실제 글쓴이여야 함
drop policy if exists "joins insert own" on public.club_joins;
create policy "joins insert own" on public.club_joins for insert with check (
  auth.uid() = applicant
  and applicant <> owner
  and status = 'pending'
  and exists (select 1 from public.posts p where p.id = club_id and p.author = owner and p.board = '동호회')
);
-- 신청자 본인과 모임장만 볼 수 있음
drop policy if exists "joins read mine" on public.club_joins;
create policy "joins read mine" on public.club_joins for select using (auth.uid() = applicant or auth.uid() = owner);
-- 승인·거절은 모임장만
drop policy if exists "joins decide owner" on public.club_joins;
create policy "joins decide owner" on public.club_joins for update using (auth.uid() = owner) with check (auth.uid() = owner);
-- 신청 취소는 신청자만
drop policy if exists "joins cancel own" on public.club_joins;
create policy "joins cancel own" on public.club_joins for delete using (auth.uid() = applicant);

drop policy if exists "noti read own" on public.notifications;
create policy "noti read own" on public.notifications for select using (auth.uid() = user_id);
drop policy if exists "noti update own" on public.notifications;
create policy "noti update own" on public.notifications for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "noti delete own" on public.notifications;
create policy "noti delete own" on public.notifications for delete using (auth.uid() = user_id);

-- ── 신청 내용은 바꿀 수 없게 (모임장은 상태만 바꿈) ──
create or replace function public.club_joins_guard() returns trigger language plpgsql as $$
begin
  if new.club_id <> old.club_id or new.owner <> old.owner or new.applicant <> old.applicant
     or new.applicant_nick <> old.applicant_nick or coalesce(new.message,'') <> coalesce(old.message,'') then
    raise exception '신청 내용은 바꿀 수 없어요';
  end if;
  if new.status <> old.status then new.decided_at := now(); end if;
  return new;
end $$;
drop trigger if exists club_joins_guard on public.club_joins;
create trigger club_joins_guard before update on public.club_joins for each row execute function public.club_joins_guard();

-- ── 휴대폰 푸시 (OneSignal) ──
-- 휴대폰 알림은 pg_net 으로 OneSignal 에 요청합니다.
-- REST API 키는 아래 vault 에 'onesignal_api_key' 이름으로 직접 넣어 주세요 (안내문 참고).
create extension if not exists pg_net;

create or replace function public.send_push(target uuid, head text, msg text, link text)
returns void language plpgsql security definer set search_path = public, extensions as $$
declare
  k text;
  app text := 'c7fd4d45-3d1b-4157-9230-d29e4676f659';
begin
  select decrypted_secret into k from vault.decrypted_secrets where name = 'onesignal_api_key' limit 1;
  if k is null then return; end if;  -- 키가 없으면 사이트 안 알림만
  perform net.http_post(
    url := 'https://api.onesignal.com/notifications',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Key ' || k),
    body := jsonb_build_object(
      'app_id', app,
      'target_channel', 'push',
      'include_aliases', jsonb_build_object('external_id', jsonb_build_array(target::text)),
      'headings', jsonb_build_object('en', head, 'ko', head),
      'contents', jsonb_build_object('en', msg, 'ko', msg),
      'url', link
    )
  );
exception when others then
  return;  -- 푸시가 실패해도 신청 자체는 저장
end $$;

-- 사이트 주소 (도메인을 바꾸면 여기만 바꾸면 됨)
create or replace function public.site_url() returns text language sql immutable as $$ select 'https://jeju.hintdaily.com/' $$;

-- 새 신청 → 모임장에게 알림
create or replace function public.on_club_join_insert() returns trigger
language plpgsql security definer set search_path = public as $$
declare lnk text := public.site_url() || 'activity.html#received';
begin
  insert into public.notifications(user_id, kind, title, body, link)
  values (new.owner, 'join_request', '새 가입 신청',
          new.applicant_nick || '님이 「' || new.club_title || '」에 가입을 신청했어요.', 'activity.html#received');
  perform public.send_push(new.owner, '제주이음 · 새 가입 신청',
          new.applicant_nick || '님이 「' || new.club_title || '」에 가입을 신청했어요.', lnk);
  return new;
end $$;
drop trigger if exists club_join_insert on public.club_joins;
create trigger club_join_insert after insert on public.club_joins for each row execute function public.on_club_join_insert();

-- 승인·거절 → 신청자에게 알림
create or replace function public.on_club_join_decide() returns trigger
language plpgsql security definer set search_path = public as $$
declare t text; lnk text := public.site_url() || 'view.html?id=' || new.club_id;
begin
  if new.status = old.status or new.status = 'pending' then return new; end if;
  t := case when new.status = 'approved' then '가입이 승인됐어요 🎉' else '가입 신청 결과' end;
  insert into public.notifications(user_id, kind, title, body, link)
  values (new.applicant, 'join_' || new.status, t,
          '「' || new.club_title || '」 ' || case when new.status = 'approved' then '모임장이 가입을 승인했어요.' else '이번에는 함께하기 어렵다는 답을 받았어요.' end,
          'view.html?id=' || new.club_id);
  perform public.send_push(new.applicant, '제주이음 · ' || t, '「' || new.club_title || '」', lnk);
  return new;
end $$;
drop trigger if exists club_join_decide on public.club_joins;
create trigger club_join_decide after update on public.club_joins for each row execute function public.on_club_join_decide();

-- send_push 는 트리거 안에서만 쓰도록 일반 사용자 호출 막기
revoke all on function public.send_push(uuid, text, text, text) from public, anon, authenticated;

-- 가입하면 프로필 자동 생성 (닉네임·지역은 가입 화면에서 받은 값)
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles(id, nick, region)
  values (new.id,
          coalesce(nullif(new.raw_user_meta_data->>'nick', ''), '이웃' || substr(new.id::text, 1, 6)),
          coalesce(new.raw_user_meta_data->>'region', ''))
  on conflict (id) do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- 표 사용 권한 (자동 공개를 꺼 둔 프로젝트에서도 동작하도록 명시)
grant usage on schema public to anon, authenticated;
grant select on public.profiles, public.posts to anon, authenticated;
grant insert, update on public.profiles to authenticated;
grant insert, update, delete on public.posts to authenticated;
grant select, insert, update, delete on public.club_joins to authenticated;
grant select, update, delete on public.notifications to authenticated;
