// ────────────────────────────────────────────────────────────────
// 파생 계산 로직 (★이 시스템의 핵심★)
//
// 엑셀에서는 사람이 '플랫폼 주간요약 / 숏폼롱폼 비교 / 차트데이터'를
// 손으로 다시 입력했지만, 여기서는 원천 3종(videos / weekly_metrics /
// platform_followers)만 있으면 아래 함수들이 전부 자동으로 계산합니다.
//
// 즉, 관리자가 수치를 '한 번' 넣으면 대시보드의 모든 값이 여기서 파생됩니다.
// ────────────────────────────────────────────────────────────────
import type {
  Video, WeeklyMetric, PlatformFollower,
  Platform, KpiValue, PlatformSummary, RankedVideo, MainContentPerformance,
} from '../types';

// 관리 대상 플랫폼 목록 — 화면마다 따로 적지 않고 이 배열 하나를 공유합니다.
// (플랫폼을 늘리려면 여기와 theme.ts 의 색/이름 표에만 추가하면 됩니다)
export const PLATFORMS: Platform[] = ['youtube', 'instagram', 'tiktok', 'facebook', 'douyin'];

// ★ 관리 그룹 분리 헬퍼
// 'main'(공식 본편)은 작품의 핵심 콘텐츠라 일반 SNS 집계와 성격이 달라
// 플랫폼 통계·랭킹에서 분리합니다. 아래 두 함수가 그 기준점입니다.
export function platformVideos(videos: Video[]): Video[] {
  return videos.filter((v) => v.managementGroup === 'platform');
}
export function mainVideos(videos: Video[]): Video[] {
  return videos.filter((v) => v.managementGroup === 'main');
}

// 참여율(%) = (좋아요 + 댓글 + 저장 + 공유) / 조회수 × 100
// 플랫폼에 없는 지표(null)는 0으로 취급합니다.
export function engagementRate(m: WeeklyMetric): number {
  if (!m.views) return 0;
  const eng = m.likes + m.comments + (m.saves ?? 0) + (m.shares ?? 0);
  return (eng / m.views) * 100;
}

// 특정 조사일의 수치만 골라 videoId로 빠르게 찾을 수 있는 Map으로 만듭니다.
function metricsBySurvey(metrics: WeeklyMetric[], surveyDate: string) {
  const map = new Map<string, WeeklyMetric>();
  for (const m of metrics) if (m.surveyDate === surveyDate) map.set(m.videoId, m);
  return map;
}

// 존재하는 조사일 목록을 최신순으로 반환 (주차 선택 드롭다운 등에서 사용)
export function surveyDatesDesc(metrics: WeeklyMetric[]): string[] {
  return [...new Set(metrics.map((m) => m.surveyDate))].sort().reverse();
}

// 두 값의 변화율(%). 이전 값이 없으면(=1주차) null → 화면에서 '—'로 표시됩니다.
function changePct(current: number, previous: number | undefined): number | null {
  if (previous === undefined || previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

// ── 대시보드 상단 KPI 4장 (전체 SNS 통합 성과) ──
// ※ 여기에는 메인 콘텐츠(LF. 공식 본편)까지 '포함'한 전체 합계입니다.
//    전체 통합 성과 = 공식 본편 + 유튜브 + 인스타 + 틱톡 + 페이스북 + 더우인
//    (단, 콘텐츠끼리 순위를 매기거나 숏폼과 비교할 때는 공식 본편을 분리합니다)
export function buildKpis(
  videos: Video[],
  metrics: WeeklyMetric[],
  latestDate: string,
  prevDate: string | undefined,
): KpiValue[] {
  const targetIds = new Set(videos.map((v) => v.id));
  const pick = (date: string) =>
    [...metricsBySurvey(metrics, date).values()].filter((m) => targetIds.has(m.videoId));

  const cur = pick(latestDate);
  const prev = prevDate ? pick(prevDate) : undefined;

  const sum = (arr: WeeklyMetric[], key: 'views' | 'likes' | 'comments') =>
    arr.reduce((acc, m) => acc + (m[key] ?? 0), 0);

  return [
    { label: '전체 조회수', value: sum(cur, 'views'),    changePct: prev ? changePct(sum(cur, 'views'), sum(prev, 'views')) : null },
    { label: '전체 좋아요', value: sum(cur, 'likes'),    changePct: prev ? changePct(sum(cur, 'likes'), sum(prev, 'likes')) : null },
    { label: '전체 댓글',   value: sum(cur, 'comments'), changePct: prev ? changePct(sum(cur, 'comments'), sum(prev, 'comments')) : null },
    { label: '콘텐츠 수',   value: cur.length,           changePct: null }, // 콘텐츠 수는 증감률 개념이 없어 항상 '—'
  ];
}

// ── 플랫폼별 요약 (플랫폼 카드) ──
// ★ 플랫폼 '총 성과'에는 메인 콘텐츠(LF. 공식 본편)도 포함합니다.
//   예) 유튜브 총조회수 = 유튜브 Shorts + LF. 공식 본편
//   (콘텐츠 순위·숏폼/롱폼 비교에서는 여전히 분리 — buildTopVideos 참고)
export function buildPlatformSummaries(
  videos: Video[],
  metrics: WeeklyMetric[],
  followers: PlatformFollower[],
  latestDate: string,
  prevDate: string | undefined,
): PlatformSummary[] {
  const curMap = metricsBySurvey(metrics, latestDate);
  const prevMap = prevDate ? metricsBySurvey(metrics, prevDate) : undefined;

  return PLATFORMS.map((platform) => {
    // 이 플랫폼의 모든 영상 (메인 콘텐츠 포함)
    const platformAll = videos.filter((v) => v.platform === platform);
    const ids = platformAll.map((v) => v.id);
    // 순수 플랫폼 콘텐츠 수 (메인 제외) — 카드에 '콘텐츠 N개'로 표시할 값
    const contentCount = platformAll.filter((v) => v.managementGroup === 'platform').length;
    const mainCount = platformAll.filter((v) => v.managementGroup === 'main').length;

    let totalViews = 0, totalLikes = 0, totalComments = 0, prevViews = 0;
    let hasPrev = false;

    for (const id of ids) {
      const m = curMap.get(id);
      if (m) { totalViews += m.views; totalLikes += m.likes; totalComments += m.comments; }
      const p = prevMap?.get(id);
      if (p) { prevViews += p.views; hasPrev = true; }
    }

    const follower = followers.find((f) => f.platform === platform && f.surveyDate === latestDate);

    return {
      platform,
      followers: follower?.followers ?? 0,
      contentCount,
      mainCount,               // 이 플랫폼에 포함된 메인 콘텐츠 수 (유튜브만 1)
      totalViews,
      totalLikes,
      totalComments,
      weeklyGrowthPct: hasPrev ? changePct(totalViews, prevViews) : null,
    };
  });
  // ※ 데이터 없는 플랫폼(더우인)도 그대로 반환 → 화면에서 '데이터 입력 대기 중' 표시
  //    더우인처럼 '기능은 활성화됐고 데이터만 없는' 상태를 화면에서 안내하기 위해서입니다.
}

// ── 이번 주 TOP N 영상 (조회수 기준) ──
// ※ 메인 콘텐츠(공식 본편)는 규모가 달라 랭킹을 왜곡하므로 제외합니다.
export function buildTopVideos(
  videos: Video[],
  metrics: WeeklyMetric[],
  latestDate: string,
  limit = 10,
): RankedVideo[] {
  const curMap = metricsBySurvey(metrics, latestDate);
  const videoById = new Map(platformVideos(videos).map((v) => [v.id, v]));

  return [...curMap.values()]
    .map((m) => ({ video: videoById.get(m.videoId)!, views: m.views }))
    .filter((x) => x.video)
    .sort((a, b) => b.views - a.views)
    .slice(0, limit)
    .map((x, i) => ({ rank: i + 1, video: x.video, views: x.views }));
}

// ── ★ 메인 콘텐츠(공식 본편) 성과 ──
// 대시보드 강조 영역과 상세 페이지가 모두 이 함수 하나를 씁니다.
// 메인 콘텐츠가 여러 개로 늘어나도 배열로 반환되므로 구조가 그대로 유지됩니다.
export function buildMainContents(
  videos: Video[],
  metrics: WeeklyMetric[],
  latestDate: string,
  prevDate: string | undefined,
): MainContentPerformance[] {
  return mainVideos(videos).map((video) => {
    // 이 영상의 모든 주차 기록을 날짜 오름차순으로 정렬 (차트용 이력)
    const history = metrics
      .filter((m) => m.videoId === video.id)
      .sort((a, b) => a.surveyDate.localeCompare(b.surveyDate))
      .map((m) => ({
        surveyDate: m.surveyDate,
        views: m.views,
        likes: m.likes,
        comments: m.comments,
      }));

    const cur = metrics.find((m) => m.videoId === video.id && m.surveyDate === latestDate);
    const prev = prevDate
      ? metrics.find((m) => m.videoId === video.id && m.surveyDate === prevDate)
      : undefined;

    // 업로드 후 경과일 = 조사일 - 업로드일 (일 단위)
    const msPerDay = 1000 * 60 * 60 * 24;
    const daysSinceUpload = Math.max(
      0,
      Math.round((new Date(latestDate).getTime() - new Date(video.uploadDate).getTime()) / msPerDay),
    );

    return {
      video,
      views: cur?.views ?? 0,
      likes: cur?.likes ?? 0,
      comments: cur?.comments ?? 0,
      daysSinceUpload,
      weeklyViewGain: prev && cur ? cur.views - prev.views : null,
      weeklyGrowthPct: prev && cur ? changePct(cur.views, prev.views) : null,
      history,
    };
  });
}

// ────────────────────────────────────────────────────────────────
// 2단계 추가: 콘텐츠 목록 / 주간 비교용 계산
// ────────────────────────────────────────────────────────────────

/** 영상 + 특정 조사일 수치를 합쳐 한 줄로 만든 형태 (콘텐츠 목록·랭킹에서 사용) */
export interface VideoRow {
  video: Video;
  views: number;
  likes: number;
  comments: number;
  saves: number | null;
  shares: number | null;
  engagement: number;   // 참여율(%)
}

/** 특정 조사일 기준으로 영상 목록에 수치를 붙여 반환 */
export function buildVideoRows(
  videos: Video[],
  metrics: WeeklyMetric[],
  surveyDate: string,
): VideoRow[] {
  const map = metricsBySurvey(metrics, surveyDate);
  return videos.map((video) => {
    const m = map.get(video.id);
    return {
      video,
      views: m?.views ?? 0,
      likes: m?.likes ?? 0,
      comments: m?.comments ?? 0,
      saves: m?.saves ?? null,
      shares: m?.shares ?? null,
      engagement: m ? engagementRate(m) : 0,
    };
  });
}

/** 한 영상의 주차별 이력 (영상 상세 화면 차트·표에서 사용) */
export function buildVideoHistory(metrics: WeeklyMetric[], videoId: string): WeeklyMetric[] {
  return metrics
    .filter((m) => m.videoId === videoId)
    .sort((a, b) => a.surveyDate.localeCompare(b.surveyDate));
}

/** 주간 비교 — 한 항목의 이전/현재/증감 */
export interface DeltaRow {
  label: string;
  current: number;
  previous: number | null;
  diff: number | null;
  growthPct: number | null;
}

function makeDelta(label: string, current: number, previous: number | null): DeltaRow {
  return {
    label,
    current,
    previous,
    diff: previous === null ? null : current - previous,
    growthPct: previous === null ? null : changePct(current, previous),
  };
}

/** 주간 비교 결과 전체 */
export interface WeeklyComparison {
  currentDate: string;
  previousDate: string | null;   // null 이면 비교 대상이 아직 없음(1주차)
  hasComparison: boolean;
  totals: DeltaRow[];            // 조회수·좋아요·댓글 전체 증감
  byPlatform: (DeltaRow & { platform: Platform })[];
  byVideo: (DeltaRow & { video: Video })[];  // 콘텐츠별 조회수 증감(내림차순)
}

/**
 * 두 조사일을 비교합니다.
 * previousDate 가 없으면(1주차) hasComparison=false 로 반환하여
 * 화면에서 "다음 주 데이터가 입력되면 비교가 시작됩니다"를 표시하게 합니다.
 */
export function buildWeeklyComparison(
  videos: Video[],
  metrics: WeeklyMetric[],
  currentDate: string,
  previousDate: string | undefined,
): WeeklyComparison {
  const targets = platformVideos(videos);
  const curMap = metricsBySurvey(metrics, currentDate);
  const prevMap = previousDate ? metricsBySurvey(metrics, previousDate) : undefined;
  const has = !!previousDate;

  const sumOf = (map: Map<string, WeeklyMetric>, ids: string[], key: 'views' | 'likes' | 'comments') =>
    ids.reduce((acc, id) => acc + (map.get(id)?.[key] ?? 0), 0);

  const allIds = targets.map((v) => v.id);

  // 전체 합계 증감
  const totals: DeltaRow[] = (['views', 'likes', 'comments'] as const).map((key) => {
    const labelMap = { views: '조회수', likes: '좋아요', comments: '댓글' };
    return makeDelta(
      labelMap[key],
      sumOf(curMap, allIds, key),
      prevMap ? sumOf(prevMap, allIds, key) : null,
    );
  });

  // 플랫폼별 조회수 증감
  const byPlatform = PLATFORMS.map((platform) => {
    const ids = targets.filter((v) => v.platform === platform).map((v) => v.id);
    const row = makeDelta(
      platform,
      sumOf(curMap, ids, 'views'),
      prevMap ? sumOf(prevMap, ids, 'views') : null,
    );
    return { ...row, platform };
  }).filter((r) => r.current > 0 || (r.previous ?? 0) > 0);

  // 콘텐츠별 조회수 증감 (증가량 큰 순)
  const byVideo = targets
    .map((video) => {
      const row = makeDelta(
        video.title,
        curMap.get(video.id)?.views ?? 0,
        prevMap ? (prevMap.get(video.id)?.views ?? 0) : null,
      );
      return { ...row, video };
    })
    .sort((a, b) => (b.diff ?? b.current) - (a.diff ?? a.current));

  return {
    currentDate,
    previousDate: previousDate ?? null,
    hasComparison: has,
    totals,
    byPlatform,
    byVideo,
  };
}
