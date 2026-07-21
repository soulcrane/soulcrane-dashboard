// ────────────────────────────────────────────────────────────────
// 성과 등급 판정 (🟢 성과 좋음 / 🟡 보통 / 🔴 개선 필요)
//
// ★ 기준선 = '같은 플랫폼의 중앙값 조회수'
//
//   왜 평균이 아니라 중앙값인가?
//   우리 데이터는 상위 몇 개 콘텐츠가 조회수를 독식하는 구조입니다.
//   (예: 인스타그램 평균 590,667회 vs 중앙값 36,000회 — 16배 차이)
//   평균을 기준으로 하면 정상적인 콘텐츠까지 61개 중 47개가 '개선 필요'로 찍혀
//   실제 판단에 쓸 수 없습니다. 중앙값을 쓰면 '보통의 콘텐츠'가 기준이 되어
//   🟢31% / 🟡43% / 🔴26% 로 실제 감각에 맞는 분포가 나옵니다.
//
//   또한 플랫폼마다 규모가 크게 다르므로(페이스북 중앙값 280회 vs 틱톡 94,200회)
//   전체가 아닌 '플랫폼별' 기준선을 사용합니다.
//
//   중앙값의 1.5배 이상 → 🟢 성과 좋음
//   중앙값의 0.5배 이상 → 🟡 보통
//   중앙값의 0.5배 미만 → 🔴 개선 필요
// ────────────────────────────────────────────────────────────────
import type { Platform } from '../types';
import type { VideoRow } from './metrics';

export type Grade = 'good' | 'normal' | 'poor';

export const GRADE_META: Record<Grade, { emoji: string; label: string }> = {
  good:   { emoji: '🟢', label: '성과 좋음' },
  normal: { emoji: '🟡', label: '보통' },
  poor:   { emoji: '🔴', label: '개선 필요' },
};

/** 화면 표시용 라벨 */
export const gradeLabel: Record<Grade, string> = {
  good: '🟢 성과 좋음',
  normal: '🟡 보통',
  poor: '🔴 개선 필요',
};

/** 배수 → 등급 */
export function gradeFromRatio(ratio: number): Grade {
  if (ratio >= 1.5) return 'good';
  if (ratio >= 0.5) return 'normal';
  return 'poor';
}

/** 숫자 목록의 중앙값 */
export function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** 플랫폼별 기준선(중앙값 조회수) 표를 만듭니다 */
export function platformBaselines(rows: VideoRow[]): Map<Platform, number> {
  const grouped = new Map<Platform, number[]>();
  for (const r of rows) {
    const list = grouped.get(r.video.platform) ?? [];
    list.push(r.views);
    grouped.set(r.video.platform, list);
  }
  const out = new Map<Platform, number>();
  grouped.forEach((views, platform) => out.set(platform, median(views)));
  return out;
}

/** 콘텐츠 한 개의 등급 (같은 플랫폼 중앙값 대비) */
export function gradeVideo(row: VideoRow, baselines: Map<Platform, number>): {
  grade: Grade; ratio: number; baseline: number;
} {
  const baseline = baselines.get(row.video.platform) ?? 0;
  const ratio = baseline > 0 ? row.views / baseline : 0;
  return { grade: gradeFromRatio(ratio), ratio, baseline };
}
