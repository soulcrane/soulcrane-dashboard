// ────────────────────────────────────────────────────────────────
// 플랫폼 자동 수집 공용 타입
// 유튜브 외 다른 플랫폼(인스타그램/페이스북/틱톡) 수집기도 이 타입을 그대로 재사용합니다.
// ────────────────────────────────────────────────────────────────

/** 플랫폼에서 가져온, DB에 아직 없을 수도 있는 영상 한 건의 원본 정보 */
export interface DiscoveredVideo {
  externalVideoId: string;   // 플랫폼상의 원본 ID (자연키의 일부)
  title: string;             // 플랫폼 원본 제목
  url: string;
  uploadDate: string;        // 'YYYY-MM-DD'
  contentType: 'short' | 'long';
  views: number;
  likes: number;
  comments: number;
  saves?: number | null;
  shares?: number | null;
}

/** 한 번의 동기화 실행 결과 (sync_logs 테이블과 1:1 대응) */
export interface SyncResult {
  platform: string;
  success: boolean;
  processedCount: number;   // 통계가 갱신된 영상 수(신규+기존)
  newVideoCount: number;    // 새로 등록된 영상 수
  errorMessage?: string | null;  // 실행 자체를 중단시킨 치명적 오류
  warnings: string[];       // 개별 영상 단위로 건너뛴 항목들
  durationMs: number;
  surveyDate?: string;
}
