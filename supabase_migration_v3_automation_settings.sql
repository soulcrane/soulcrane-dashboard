-- ────────────────────────────────────────────────────────────────
-- v3 마이그레이션: 관리자 자동화 설정
-- Supabase 대시보드 → SQL Editor 에서 전체 실행하세요. (기존 데이터는 지워지지 않습니다)
--
-- 목적: 채널ID/계정ID, 자동화 ON-OFF 같은 "자주 바뀌는 운영 설정"을
--       코드 수정·재배포 없이 관리자 화면에서 즉시 바꿀 수 있도록 DB로 분리합니다.
--       (API 키처럼 진짜 비밀값은 계속 Vercel 환경변수로 관리합니다)
-- ────────────────────────────────────────────────────────────────

create table if not exists automation_settings (
  platform             text primary key,          -- 'youtube' | 'instagram' | 'facebook' | 'tiktok'
  enabled              boolean not null default false,
  external_account_id  text,                       -- 채널ID/계정ID (예: 유튜브 채널 ID 'UC...')
  cron_enabled         boolean not null default false, -- 운영자가 vercel.json에 crons를 추가한 뒤 직접 체크하는 표시용 플래그
                                                          -- (Vercel 프로젝트 설정을 실시간으로 조회하는 것이 아니라 자기보고 값입니다)
  updated_at           timestamptz not null default now()
);

alter table automation_settings enable row level security;

drop policy if exists "anon read automation_settings" on automation_settings;
drop policy if exists "anon write automation_settings" on automation_settings;
drop policy if exists "anon update automation_settings" on automation_settings;

create policy "anon read automation_settings"   on automation_settings for select using (true);
create policy "anon write automation_settings"  on automation_settings for insert with check (true);
create policy "anon update automation_settings" on automation_settings for update using (true) with check (true);
-- delete 정책은 만들지 않습니다 (설정 행은 지우지 않고 항상 4개 플랫폼이 존재하는 것을 전제로 화면을 구성합니다)

-- updated_at 자동 갱신
create or replace function set_automation_settings_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_automation_settings_updated_at on automation_settings;
create trigger trg_automation_settings_updated_at
  before update on automation_settings
  for each row execute function set_automation_settings_updated_at();

-- 4개 플랫폼 기본 행 생성 (이미 있으면 건너뜀) — 자동화 코드가 없는 플랫폼도
-- 관리자 화면에 미리 노출되어 "준비 중" 상태로 보이도록 합니다.
insert into automation_settings (platform, enabled, external_account_id)
values
  ('youtube', false, null),
  ('instagram', false, null),
  ('facebook', false, null),
  ('tiktok', false, null)
on conflict (platform) do nothing;

-- ────────────────────────────────────────────────────────────────
-- 확인:
--   select * from automation_settings;
--   → youtube/instagram/facebook/tiktok 4행이 enabled=false로 보이면 정상
-- ────────────────────────────────────────────────────────────────
