-- ============================================================
--  제주이음 · 모임 공지 (모임장 → 승인된 회원)
--  Supabase → SQL Editor → New query → 전부 붙여 넣고 Run (여러 번 실행해도 안전)
-- ============================================================

create table if not exists public.club_notices (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.posts(id) on delete cascade,
  club_title text not null default '',
  owner uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index if not exists club_notices_club_idx on public.club_notices(club_id, created_at desc);

alter table public.club_notices enable row level security;

-- 모임장만 공지를 남길 수 있음
drop policy if exists "notices insert owner" on public.club_notices;
create policy "notices insert owner" on public.club_notices for insert with check (
  auth.uid() = owner
  and exists (select 1 from public.posts p where p.id = club_id and p.author = owner and p.board = '동호회')
);
-- 모임장과 승인된 회원만 볼 수 있음
drop policy if exists "notices read members" on public.club_notices;
create policy "notices read members" on public.club_notices for select using (
  auth.uid() = owner
  or exists (select 1 from public.club_joins j where j.club_id = club_notices.club_id and j.applicant = auth.uid() and j.status = 'approved')
);
-- 모임장은 지울 수 있음
drop policy if exists "notices delete owner" on public.club_notices;
create policy "notices delete owner" on public.club_notices for delete using (auth.uid() = owner);

grant select, insert, delete on public.club_notices to authenticated;

-- 모임장이 승인된 회원 목록(닉네임)을 볼 수 있게 이미 club_joins 읽기 규칙이 있음

-- 공지가 올라오면 승인된 회원 모두에게 알림 + 휴대폰 푸시
create or replace function public.on_club_notice_insert() returns trigger
language plpgsql security definer set search_path = public as $$
declare r record; short text;
begin
  short := left(new.body, 60) || case when char_length(new.body) > 60 then '…' else '' end;
  for r in select applicant from public.club_joins where club_id = new.club_id and status = 'approved' loop
    insert into public.notifications(user_id, kind, title, body, link)
    values (r.applicant, 'club_notice', '「' || new.club_title || '」 모임 공지', short, 'view.html?id=' || new.club_id || '#club-notices');
    perform public.send_push(r.applicant, '제주이음 · ' || new.club_title || ' 공지', short,
                             public.site_url() || 'view.html?id=' || new.club_id);
  end loop;
  return new;
end $$;
drop trigger if exists club_notice_insert on public.club_notices;
create trigger club_notice_insert after insert on public.club_notices for each row execute function public.on_club_notice_insert();
