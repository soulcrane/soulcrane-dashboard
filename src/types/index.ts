// ────────────────────────────────────────────────────────────────
// 앱 전역에서 쓰는 타입 정의 (역할: 데이터 모양을 한 곳에서 관리)
// Supabase 테이블 구조와 1:1로 대응됩니다.
// ────────────────────────────────────────────────────────────────

// 플랫폼 4종. 향후 새 플랫폼(예: 'x', 'threads')을 추가할 때 여기만 늘리면 됩니다.
// 플랫폼 종류. Douyin(抖音)은 기능만 활성화된 상태이며 실제 데이터는 아직 없습니다.
export type Platform = 'youtube' | 'instagram' | 'tiktok' | 'facebook' | 'douyin';

// 콘텐츠 유형: 숏폼 / 롱폼 (엑셀 원본의 분류 축을 그대로 유지)
export type ContentType = 'short' | 'long';

// ★ 관리 그룹 — 이 시스템에서 콘텐츠를 '어떻게 관리할지' 구분하는 축
//   'main'     : 작품의 핵심 콘텐츠 (LF. 공식 본편). 별도 화면에서 독립 관리.
//   'platform' : 일반 SNS 플랫폼 콘텐츠 (숏폼, 릴스, 틱톡 등)
//
//   ※ contentType(숏폼/롱폼)과는 다른 축입니다.
//      contentType = 영상의 형식,  managementGroup = 업무상 관리 단위.
//      두 축을 분리해 두면 나중에 "메인 콘텐츠가 여러 개"가 되어도 구조가 안 깨집니다.
export type ManagementGroup = 'main' | 'platform';

// ① 영상 마스터 — 고정 정보 (Supabase: videos)
export interface Video {
  id: string;              // VideoID 예: 'YT_SF_60sMV'
  platform: Platform;
  contentType: ContentType;
  managementGroup: ManagementGroup;  // ★ 추가: 메인 콘텐츠 / 플랫폼 콘텐츠
  title: string;           // 영상명 예: 'SF. 60s MV'
  contentGroup: string;    // 크로스플랫폼 묶음 키 예: '60s MV' (같은 영상의 플랫폼별 성과 합산용)
  uploadDate: string;      // 'YYYY-MM-DD'
  url: string;             // 원본 링크
}

// ② 주간 수치 — 영상 × 조사일 당 1행 (Supabase: weekly_metrics)
export interface WeeklyMetric {
  videoId: string;
  surveyDate: string;      // 조사일 'YYYY-MM-DD'
  views: number;
  likes: number;
  comments: number;
  saves: number | null;    // 틱톡만 값이 있음 (나머지 null)
  shares: number | null;   // 인스타·페이스북만 값이 있음 (나머지 null)
}

// ③ 플랫폼 주간 팔로워/구독자 (Supabase: platform_followers)
export interface PlatformFollower {
  platform: Platform;
  surveyDate: string;
  followers: number;
}

// ── 아래는 '저장하지 않고 계산해서 만드는' 파생 타입들 ──
// (엑셀의 플랫폼요약/차트데이터 등이 여기에 해당. lib/metrics.ts 에서 생성)

// 대시보드 상단 KPI 카드 한 장에 담기는 값
export interface KpiValue {
  label: string;
  value: number;
  // 전주 대비 변화율(%). baseline(1주차)이면 데이터가 없어 null.
  changePct: number | null;
}

// 플랫폼별 요약 (플랫폼 카드 + 플랫폼 분석 화면에서 사용)
export interface PlatformSummary {
  platform: Platform;
  followers: number;
  contentCount: number;
  mainCount?: number;   // 이 플랫폼에 포함된 메인 콘텐츠 수 (유튜브=1, 나머지 0)
  totalViews: number;
  totalLikes: number;
  totalComments: number;
  weeklyGrowthPct: number | null; // 전주 대비 조회수 증가율
}

// TOP 영상 랭킹 한 줄
export interface RankedVideo {
  rank: number;
  video: Video;
  views: number;
}

// ★ 메인 콘텐츠(공식 본편) 성과 — 대시보드 강조 영역 + 상세 페이지에서 사용
export interface MainContentPerformance {
  video: Video;
  views: number;
  likes: number;
  comments: number;
  daysSinceUpload: number;          // 업로드 후 경과일 (조사일 기준)
  weeklyViewGain: number | null;    // 주차별 조회수 증가량 (직전 조사일 대비)
  weeklyGrowthPct: number | null;   // 전주 대비 성장률(%)
  history: {                        // 주차별 이력 (상세 페이지 차트용)
    surveyDate: string;
    views: number;
    likes: number;
    comments: number;
  }[];
}
