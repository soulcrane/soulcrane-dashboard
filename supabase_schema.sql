-- 소울크레인 SNS 성과 관리 시스템 — Supabase 초기 스키마
-- 원칙: 사람이 입력하는 테이블은 3개. 나머지 화면은 전부 이 3개에서 파생.

-- 1) 영상 마스터 (고정 정보)
create table videos (
  id            text primary key,                 -- VideoID 예: YT_SF_60sMV
  platform      text not null check (platform in ('youtube','instagram','tiktok','facebook','douyin')),
  content_type  text not null check (content_type in ('short','long')),  -- 숏폼/롱폼
  -- 관리 그룹: main = LF. 공식 본편(핵심 콘텐츠), platform = 일반 SNS 콘텐츠
  -- 전체 통합 성과에는 둘 다 포함되지만, 순위·유형 비교에서는 main 을 분리합니다.
  management_group text not null default 'platform' check (management_group in ('main','platform')),
  title         text not null,                    -- 영상명
  content_group text,                             -- 크로스플랫폼 묶음 키(선택) 예: '60s MV'
  upload_date   date not null,
  url           text not null,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

-- 2) 주간 수치 (영상 × 조사일 당 1행)
create table weekly_metrics (
  id          uuid primary key default gen_random_uuid(),
  video_id    text not null references videos(id) on delete cascade,
  survey_date date not null,                       -- 조사일
  views       integer not null default 0,
  likes       integer not null default 0,
  comments    integer not null default 0,
  saves       integer,                             -- 틱톡만 입력, 그 외 null
  shares      integer,                             -- 인스타·페이스북만 입력, 그 외 null
  source      text not null default 'manual' check (source in ('manual','api')), -- 향후 API 수집 대비
  created_at  timestamptz default now(),
  unique (video_id, survey_date)
);

-- 3) 플랫폼 주간 팔로워 (플랫폼 × 조사일 당 1행)
create table platform_followers (
  id          uuid primary key default gen_random_uuid(),
  platform    text not null check (platform in ('youtube','instagram','tiktok','facebook','douyin')),
  survey_date date not null,
  followers   integer not null default 0,          -- 팔로워/구독자수
  created_at  timestamptz default now(),
  unique (platform, survey_date)
);

-- 조회 성능 인덱스
create index idx_metrics_survey  on weekly_metrics (survey_date);
create index idx_metrics_video   on weekly_metrics (video_id);
create index idx_videos_platform on videos (platform);

-- 참고: 플랫폼요약 / 숏폼·롱폼 비교 / 차트데이터 / 대시보드 / AI분석은
--       테이블로 저장하지 않고, 위 3개 테이블을 조회 시점에 집계해 계산합니다.
--       (증가량/증가율/참여율/랭킹 전부 파생)

-- ────────────────────────────────────────────────────────────────
-- 접근 정책 (RLS)
--
-- 이 앱은 '사내 5명이 링크로 공유해서 함께 편집'하는 모델입니다.
-- 별도 로그인 없이 anon 키로 읽고 쓰므로, 아래처럼 anon 에게 전체 권한을 엽니다.
--
-- ⚠️ 주의: 이 정책은 링크(=anon 키)를 아는 누구나 데이터를 읽고 쓸 수 있음을 의미합니다.
--         사내 비공개용으로는 충분하지만, 외부에 링크가 노출되면 안 됩니다.
--         더 엄격히 하려면 Supabase Auth(로그인)를 붙이고 정책을 auth.uid() 기준으로 바꾸세요.
-- ────────────────────────────────────────────────────────────────
alter table videos             enable row level security;
alter table weekly_metrics     enable row level security;
alter table platform_followers enable row level security;

-- videos
create policy "anon read videos"   on videos for select using (true);
create policy "anon write videos"  on videos for insert with check (true);
create policy "anon update videos" on videos for update using (true) with check (true);
create policy "anon delete videos" on videos for delete using (true);

-- weekly_metrics
create policy "anon read metrics"   on weekly_metrics for select using (true);
create policy "anon write metrics"  on weekly_metrics for insert with check (true);
create policy "anon update metrics" on weekly_metrics for update using (true) with check (true);
create policy "anon delete metrics" on weekly_metrics for delete using (true);

-- platform_followers
create policy "anon read followers"   on platform_followers for select using (true);
create policy "anon write followers"  on platform_followers for insert with check (true);
create policy "anon update followers" on platform_followers for update using (true) with check (true);
create policy "anon delete followers" on platform_followers for delete using (true);

-- ────────────────────────────────────────────────────────────────
-- 초기 데이터(시드)는 넣지 않아도 됩니다.
-- 앱이 처음 실행될 때 테이블이 비어 있으면 62개 시드를 자동으로 올립니다.
-- 또한 그동안 브라우저에 입력해 둔 데이터가 있으면 그 데이터까지 자동 이전됩니다.
-- ────────────────────────────────────────────────────────────────
