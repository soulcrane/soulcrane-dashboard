// ────────────────────────────────────────────────────────────────
// 앱 전역에서 쓰는 타입 정의 (역할: 데이터 모양을 한 곳에서 관리)
// Supabase 테이블 구조와 1:1로 대응됩니다.
// ────────────────────────────────────────────────────────────────

export type Platform = 'youtube' | 'instagram' | 'tiktok' | 'facebook' | 'douyin';

export type ContentType = 'short' | 'long';

export type ManagementGroup = 'main' | 'platform';

export interface Video {
  id: string;
  platform: Platform;
  contentType: ContentType;
  managementGroup: ManagementGroup;
  title: string;
  contentGroup: string;
  uploadDate: string;
  url: string;

  // 플랫폼 원본 영상 ID (자동 수집 매칭용)
  externalVideoId?: string | null;

  // 플랫폼에서 가져온 원본 제목
  sourceTitle?: string | null;
}

export interface WeeklyMetric {
  videoId: string;
  surveyDate: string;
  views: number;
  likes: number;
  comments: number;
  saves: number | null;
  shares: number | null;
}

export interface PlatformFollower {
  platform: Platform;
  surveyDate: string;
  followers: number;
}

export interface KpiValue {
  label: string;
  value: number;
  changePct: number | null;
}

export interface PlatformSummary {
  platform: Platform;
  followers: number;
  contentCount: number;
  mainCount?: number;
  totalViews: number;
  totalLikes: number;
  totalComments: number;
  weeklyGrowthPct: number | null;
}

export interface RankedVideo {
  rank: number;
  video: Video;
  views: number;
}

export interface MainContentPerformance {
  video: Video;
  views: number;
  likes: number;
  comments: number;
  daysSinceUpload: number;
  weeklyViewGain: number | null;
  weeklyGrowthPct: number | null;
  history: {
    surveyDate: string;
    views: number;
    likes: number;
    comments: number;
  }[];
}