-- ============================================================
--  제주이음 · 제주상점 입점 / 특가공구 승인 요청
--  Supabase → SQL Editor → New query → 전부 붙여 넣고 Run (여러 번 실행해도 안전)
--  들어온 요청은 Supabase → Table Editor → seller_requests 에서 볼 수 있어요.
-- ============================================================
create table if not exists public.seller_requests (
  id uuid primary key default gen_random_uuid(),
  board text not null check (board in ('제주상점','특가공구')),
  applicant uuid not null references public.profiles(id) on delete cascade,
  applicant_nick text not null,
  details jsonb not null default '{}'::jsonb,
  message text default '' check (char_length(message) <= 1000),
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at timestamptz not null default now()
);
alter table public.seller_requests enable row level security;

-- 요청은 본인 이름으로만 보낼 수 있고, 본인 것만 볼 수 있음 (연락처·사업자 정보 보호)
drop policy if exists "seller req insert own" on public.seller_requests;
create policy "seller req insert own" on public.seller_requests for insert with check (auth.uid() = applicant and status = 'pending');
drop policy if exists "seller req read own" on public.seller_requests;
create policy "seller req read own" on public.seller_requests for select using (auth.uid() = applicant);
grant select, insert on public.seller_requests to authenticated;
