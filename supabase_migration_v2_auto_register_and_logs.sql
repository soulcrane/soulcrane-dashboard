-- ────────────────────────────────────────────────────────────────
-- v2 마이그레이션: 자동 등록 + 동기화 로그 + 컬럼 일반화
-- Supabase 대시보드 → SQL Editor 에서 전체 실행하세요.
--
-- v1(supabase_migration_youtube_automation.sql)을 이미 실행했어도,
-- 아직 실행 안 했어도 안전하게 동작하도록 작성했습니다(idempotent).
-- 기존 데이터는 지워지지 않습니다.
-- ────────────────────────────────────────────────────────────────

-- 1) youtube_video_id → external_video_id 로 일반화
--    향후 인스타그램/페이스북/틱톡 자동화도 같은 컬럼(플랫폼 공통 자연키)을 씁니다.
--    자연키는 (platform, external_video_id) 조합입니다.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_name = 'videos' and column_name = 'youtube_video_id'
  ) and not exists (
    select 1 from information_schema.columns
    where table_name = 'videos' and column_name = 'external_video_id'
  ) then
    alter table videos rename column youtube_video_id to external_video_id;
  end if;
end $$;

-- v1을 아직 실행하지 않은 경우를 위한 안전장치 (컬럼이 없으면 새로 만듦)
alter table videos add column if not exists external_video_id text;

-- v1에서 만든 인덱스 이름이 남아있으면 정리
drop index if exists idx_videos_youtube_id;

-- platform + external_video_id 조합의 중복 등록 방지 (자동 등록 로직의 핵심 제약)
-- ⚠️ 만약 아래 생성 시 "duplicate key" 오류가 나면, 같은 (platform, external_video_id)를
--    가진 행이 이미 여러 개 있다는 뜻이니 먼저 중복 데이터를 정리해야 합니다.
create unique index if not exists idx_videos_platform_external_id
  on videos (platform, external_video_id)
  where external_video_id is not null;

-- 2) 원본 제목 보존 컬럼
--    - source_title: 플랫폼(유튜브 등)에서 가져온 원본 제목. 자동화가 매번 최신값으로 갱신.
--    - title      : 사이트에서 실제로 보여주는 제목. 관리자가 자유롭게 수정하며,
--                   자동화는 절대 이 컬럼을 덮어쓰지 않음.
--    최초 자동 등록 시에는 title = source_title 로 동일하게 시작합니다.
alter table videos add column if not exists source_title text;

-- 3) 자동화 실행 로그
create table if not exists sync_logs (
  id               uuid primary key default gen_random_uuid(),
  platform         text not null,              -- 'youtube' | 'instagram' | 'facebook' | 'tiktok' ...
  started_at       timestamptz not null default now(),
  finished_at      timestamptz,
  duration_ms      integer,
  success          boolean not null default false,
  processed_count  integer not null default 0, -- 통계가 갱신된 영상 수 (신규+기존)
  new_video_count  integer not null default 0, -- 이번 실행에서 새로 등록된 영상 수
  error_message    text,                       -- 실행 자체를 중단시킨 치명적 오류 (있는 경우)
  warnings         jsonb,                      -- 개별 영상 단위로 건너뛴 항목들 (배열)
  created_at       timestamptz default now()
);
create index if not exists idx_sync_logs_platform on sync_logs (platform, started_at desc);

alter table sync_logs enable row level security;
-- 조회는 누구나 허용 (관리자 화면에서 '마지막 동기화 상태'를 보여줄 수 있도록)
-- 쓰기(insert/update/delete)는 서버의 service_role 키로만 수행되며,
-- service_role은 RLS를 우회하므로 별도의 쓰기 정책은 만들지 않습니다.
drop policy if exists "anon read sync_logs" on sync_logs;
create policy "anon read sync_logs" on sync_logs for select using (true);

-- ────────────────────────────────────────────────────────────────
-- 실행 후 확인:
--   select column_name from information_schema.columns where table_name = 'videos';
--   → external_video_id, source_title 이 보이면 정상
--
--   select * from sync_logs order by started_at desc limit 5;
--   → 아직 실행 전이면 빈 결과가 정상
-- ────────────────────────────────────────────────────────────────
