-- ────────────────────────────────────────────────────────────────
-- YouTube 자동 수집 기능을 위한 마이그레이션
-- Supabase 대시보드 → SQL Editor 에서 전체 실행하세요. (기존 데이터는 지워지지 않습니다)
-- ────────────────────────────────────────────────────────────────

-- 1) videos 테이블에 유튜브 영상 ID 컬럼 추가
--    (유튜브 Data API 조회 시 이 ID로 매칭합니다. 예: 'dQw4w9WgXcQ')
alter table videos add column if not exists youtube_video_id text;

-- 2) 기존 유튜브 영상들의 url 컬럼에서 영상 ID를 best-effort로 자동 추출해 채웁니다.
--    지원 형태: watch?v=ID / youtu.be/ID / shorts/ID
--    (추출에 실패한 행은 null로 남으며, 관리자 화면에서 직접 입력/수정할 수 있습니다)
update videos
set youtube_video_id = coalesce(
  substring(url from 'v=([a-zA-Z0-9_-]{11})'),
  substring(url from 'youtu\.be/([a-zA-Z0-9_-]{11})'),
  substring(url from 'shorts/([a-zA-Z0-9_-]{11})')
)
where platform = 'youtube'
  and youtube_video_id is null;

-- 3) 조회 성능 인덱스
create index if not exists idx_videos_youtube_id on videos (youtube_video_id);

-- 참고: weekly_metrics.source 컬럼은 이미 supabase_schema.sql에서
--       'manual' | 'api' 를 지원하도록 정의되어 있어 추가 변경이 필요 없습니다.

-- ────────────────────────────────────────────────────────────────
-- 실행 후 확인할 것:
--   select id, title, url, youtube_video_id from videos where platform = 'youtube';
--   → youtube_video_id 가 비어 있는 행이 있으면 관리자 화면(주간 데이터 입력)에서
--     '유튜브 ID' 칸에 직접 입력해 주세요. 그래야 자동 수집 대상에 포함됩니다.
-- ────────────────────────────────────────────────────────────────
