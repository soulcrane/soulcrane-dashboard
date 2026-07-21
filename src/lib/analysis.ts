// ────────────────────────────────────────────────────────────────
// 분석 모듈 (AI 분석 화면의 두뇌)
//
// ★ 설계 의도: 분석 '로직'을 화면에서 완전히 떼어낸 별도 모듈로 둡니다.
//
//   1단계(현재): 아래 generateInsights() 가 실제 데이터를 계산해서
//                회의에서 바로 읽을 수 있는 요약을 즉시 만들어 냅니다. (API 불필요)
//   2단계(향후): 같은 자리에 LLM API 호출을 넣으면 됩니다.
//                이때 원시 데이터 전체가 아니라 아래에서 계산된 '요약 수치'만
//                넘기면 되므로 비용과 정확도를 모두 관리할 수 있습니다.
//                화면(pages/AiAnalysis.tsx)은 결과 모양만 알면 되므로 수정 불필요.
// ────────────────────────────────────────────────────────────────
import type { Video, WeeklyMetric } from '../types';
import { platformVideos, mainVideos, engagementRate, buildVideoRows, PLATFORMS, type VideoRow } from './metrics';
import { platformLabels, contentTypeLabels } from '../theme/theme';
import { compactNumber, fullNumber } from './format';
import { platformBaselines, gradeVideo, gradeFromRatio, GRADE_META, type Grade } from './grading';

// 성과 등급 관련 정의는 lib/grading.ts 한 곳에서 관리합니다.
// (화면에서도 쓰기 쉽도록 여기서 다시 내보냅니다)
export { gradeLabel, GRADE_META } from './grading';
export type { Grade } from './grading';

/** 분석 결과 한 덩어리 */
export interface InsightSection {
  title: string;
  summary: string;          // 회의에서 그대로 읽을 수 있는 한두 문장
  grade?: Grade;            // 이 섹션 전체의 성과 등급 (선택)
  items?: { label: string; value: string; sub?: string; grade?: Grade }[];
}

export interface AnalysisResult {
  surveyDate: string;
  headline: string;              // 이번 주 성과 요약 (2~3문장)
  overallGrade: Grade;           // 이번 주 전체 성과 등급
  overallReason: string;         // 그 등급이 나온 이유 한 줄
  recommendations: string[];     // 간단한 개선 포인트 (화면 상단 배치)
  detailSections: InsightSection[];   // 상세 AI 분석
  platformSections: InsightSection[]; // 플랫폼별 분석
  contentSections: InsightSection[];  // 콘텐츠별 분석
  generatedBy: 'rule' | 'ai';    // 향후 AI 연결 시 'ai'
}

/**
 * 현재 데이터에서 계산 가능한 분석을 즉시 생성합니다.
 * (외부 API 없이 동작 — 비용 0, 오프라인 가능)
 */
export function generateInsights(
  videos: Video[],
  metrics: WeeklyMetric[],
  surveyDate: string,
  previousDate?: string,
): AnalysisResult {
  const targets = platformVideos(videos);
  const rows = buildVideoRows(targets, metrics, surveyDate).filter((r) => r.views > 0);

  // ★ 메인 콘텐츠(LF. 공식 본편) — 순위/유형 비교에서는 빼지만 전체 합계에는 포함
  const mainRows = buildVideoRows(mainVideos(videos), metrics, surveyDate).filter((r) => r.views > 0);
  const mainRow = mainRows[0];

  const totalViews = rows.reduce((a, r) => a + r.views, 0);        // 플랫폼 콘텐츠 합계
  const totalLikes = rows.reduce((a, r) => a + r.likes, 0);
  const totalComments = rows.reduce((a, r) => a + r.comments, 0);

  // 전체 SNS 통합 = 플랫폼 콘텐츠 + 메인 콘텐츠
  const totalViewsAll = totalViews + mainRows.reduce((a, r) => a + r.views, 0);

  // ── 플랫폼별 집계 ──
  const platforms = PLATFORMS;
  const platStats = platforms
    .map((p) => {
      const rs = rows.filter((r) => r.video.platform === p);
      const views = rs.reduce((a, r) => a + r.views, 0);
      return {
        platform: p,
        count: rs.length,
        views,
        likes: rs.reduce((a, r) => a + r.likes, 0),
        avgViews: rs.length ? Math.round(views / rs.length) : 0,
        sharePct: totalViews ? (views / totalViews) * 100 : 0,
      };
    })
    .filter((s) => s.count > 0)
    .sort((a, b) => b.views - a.views);

  // ★ 아직 데이터가 입력되지 않은 플랫폼 (예: 더우인)
  //   기능은 활성화되어 있고, 데이터가 들어오면 자동으로 분석에 포함됩니다.
  const activePlatforms = new Set(platStats.map((s) => s.platform));
  const waitingPlatforms = platforms.filter((p) => !activePlatforms.has(p));

  const top = [...rows].sort((a, b) => b.views - a.views);
  const best = top[0];
  const topPlatform = platStats[0];
  const bestAvgPlatform = [...platStats].sort((a, b) => b.avgViews - a.avgViews)[0];

  // ── 좋아요 대비 조회수(=좋아요율) ──
  const likeRate = totalViews ? (totalLikes / totalViews) * 100 : 0;
  const commentRate = totalViews ? (totalComments / totalViews) * 100 : 0;
  const byLikeRate = [...rows]
    .filter((r) => r.views >= 1000)   // 표본이 너무 작은 영상은 비율이 왜곡되어 제외
    .sort((a, b) => (b.likes / b.views) - (a.likes / a.views));

  // ── 댓글 반응 ──
  const byComments = [...rows].sort((a, b) => b.comments - a.comments);

  // ── 숏폼/롱폼 패턴 ──
  const typeStats = (['short', 'long'] as const).map((t) => {
    const rs = rows.filter((r) => r.video.contentType === t);
    const views = rs.reduce((a, r) => a + r.views, 0);
    return {
      type: t, count: rs.length, views,
      avgViews: rs.length ? Math.round(views / rs.length) : 0,
    };
  }).filter((s) => s.count > 0);

  // ── 성과 편중도: 상위 5개가 전체 조회수에서 차지하는 비중 ──
  const top5Share = totalViews
    ? (top.slice(0, 5).reduce((a, r) => a + r.views, 0) / totalViews) * 100
    : 0;

  // ── 저조 콘텐츠 (하위, 조회수 오름차순) ──
  const worst = [...rows].sort((a, b) => a.views - b.views).slice(0, 3);

  // ── 등급 판정 기준: 플랫폼별 '중앙값' 조회수 (사유는 lib/grading.ts 주석 참고) ──
  const averages = platformBaselines(rows);
  const fmtRow = (r: VideoRow) => {
    const g = gradeVideo(r, averages);
    return {
      label: r.video.title,
      value: `${fullNumber(r.views)}회`,
      sub: `${platformLabels[r.video.platform]} · ${contentTypeLabels[r.video.contentType]} · 플랫폼 중앙값의 ${g.ratio.toFixed(1)}배`,
      grade: g.grade,
    };
  };

  // ── 이번 주 전체 성과 등급 ──
  // 기준: 상위권 콘텐츠 비중과 저조 콘텐츠 비율을 함께 봅니다.
  const goodCount = rows.filter((r) => gradeVideo(r, averages).grade === 'good').length;
  const poorCount = rows.filter((r) => gradeVideo(r, averages).grade === 'poor').length;
  const goodShare = rows.length ? (goodCount / rows.length) * 100 : 0;
  const poorShare = rows.length ? (poorCount / rows.length) * 100 : 0;
  const overallGrade: Grade =
    poorShare >= 50 ? 'poor' : goodShare >= 20 ? 'good' : 'normal';
  const overallReason =
    `전체 ${rows.length}개 중 성과 좋음 ${goodCount}개(${goodShare.toFixed(0)}%), ` +
    `개선 필요 ${poorCount}개(${poorShare.toFixed(0)}%)입니다.`;

  // ── 헤드라인 (회의에서 그대로 읽는 요약) ──
  const headline = [
    `이번 주 전체 SNS 통합 조회수는 ${fullNumber(totalViewsAll)}회입니다.`,
    mainRow
      ? `이 중 메인 콘텐츠 '${mainRow.video.title}'이 ${compactNumber(mainRow.views)}회를 기록했습니다.`
      : '',
    topPlatform
      ? `플랫폼 콘텐츠 중에서는 ${platformLabels[topPlatform.platform]}이 ${topPlatform.sharePct.toFixed(0)}%(${compactNumber(topPlatform.views)}회)로 비중이 가장 큽니다.`
      : '',
    best ? `최고 성과 콘텐츠는 '${best.video.title}'(${compactNumber(best.views)}회)입니다.` : '',
  ].filter(Boolean).join(' ');

  // ══ 상세 AI 분석 ══
  const detailSections: InsightSection[] = [
    {
      title: '최고 성과 콘텐츠',
      summary: best
        ? `'${best.video.title}'이 ${fullNumber(best.views)}회로 1위입니다. 플랫폼 콘텐츠 조회수의 ${((best.views / totalViews) * 100).toFixed(1)}%를 혼자 차지합니다.`
        : '데이터가 없습니다.',
      items: top.slice(0, 5).map(fmtRow),
    },
    {
      title: '좋아요 대비 조회수',
      summary: `전체 평균 좋아요율은 ${likeRate.toFixed(2)}%입니다. (조회수 100회당 좋아요 약 ${likeRate.toFixed(1)}개) 비율이 높을수록 시청자가 실제로 반응한 콘텐츠입니다.`,
      items: byLikeRate.slice(0, 5).map((r) => {
        const rate = (r.likes / r.views) * 100;
        return {
          label: r.video.title,
          value: `${rate.toFixed(2)}%`,
          sub: `조회 ${compactNumber(r.views)} · 좋아요 ${fullNumber(r.likes)}`,
          grade: gradeFromRatio(likeRate > 0 ? rate / likeRate : 0),
        };
      }),
    },
    {
      title: '댓글 반응',
      summary: `전체 댓글은 ${fullNumber(totalComments)}개, 댓글률은 ${commentRate.toFixed(3)}%입니다. 댓글이 많은 콘텐츠는 팬 반응이 활발한 지점입니다.`,
      items: byComments.slice(0, 5).map((r) => {
        const avgCmt = rows.length ? totalComments / rows.length : 0;
        return {
          label: r.video.title,
          value: `${fullNumber(r.comments)}개`,
          sub: `${platformLabels[r.video.platform]} · 조회 ${compactNumber(r.views)}`,
          grade: gradeFromRatio(avgCmt > 0 ? r.comments / avgCmt : 0),
        };
      }),
    },
    {
      title: '콘텐츠 성과 패턴',
      summary: typeStats.length === 2
        ? `숏폼 ${typeStats.find((t) => t.type === 'short')?.count ?? 0}개(평균 ${compactNumber(typeStats.find((t) => t.type === 'short')?.avgViews ?? 0)}회), 롱폼 ${typeStats.find((t) => t.type === 'long')?.count ?? 0}개(평균 ${compactNumber(typeStats.find((t) => t.type === 'long')?.avgViews ?? 0)}회)입니다. ※ 메인 콘텐츠는 성격이 달라 이 비교에서 제외했습니다.`
        : '유형별 비교를 위한 데이터가 부족합니다.',
      items: typeStats.map((s) => ({
        label: contentTypeLabels[s.type],
        value: `평균 ${compactNumber(s.avgViews)}회`,
        sub: `${s.count}개 · 합계 ${compactNumber(s.views)}회`,
      })),
    },
  ];

  // ══ 플랫폼별 분석 ══
  const platformSections: InsightSection[] = [
    {
      title: '플랫폼별 성과 차이',
      summary: topPlatform && bestAvgPlatform
        ? `총량은 ${platformLabels[topPlatform.platform]}이 가장 크고, 콘텐츠 1개당 평균 조회수는 ${platformLabels[bestAvgPlatform.platform]}이 ${fullNumber(bestAvgPlatform.avgViews)}회로 가장 높습니다.`
        : '데이터가 없습니다.',
      items: platStats.map((s) => {
        const avgOfAvg = platStats.length
          ? platStats.reduce((a, x) => a + x.avgViews, 0) / platStats.length
          : 0;
        return {
          label: platformLabels[s.platform],
          value: `${compactNumber(s.views)}회`,
          sub: `비중 ${s.sharePct.toFixed(0)}% · 콘텐츠 ${s.count}개 · 평균 ${compactNumber(s.avgViews)}회`,
          grade: gradeFromRatio(avgOfAvg > 0 ? s.avgViews / avgOfAvg : 0),
        };
      }),
    },
    {
      title: '데이터 대기 중인 플랫폼',
      summary: waitingPlatforms.length
        ? `${waitingPlatforms.map((p) => platformLabels[p]).join(', ')}은(는) 아직 데이터가 입력되지 않았습니다. 입력하면 위 분석에 자동으로 포함됩니다.`
        : '모든 플랫폼에 데이터가 입력되어 있습니다.',
    },
  ];

  // ══ 콘텐츠별 분석 ══
  const contentSections: InsightSection[] = [
    {
      title: '조회수 상위 콘텐츠',
      summary: `상위 5개 콘텐츠가 플랫폼 조회수의 ${top5Share.toFixed(0)}%를 차지합니다.${
        top5Share > 70 ? ' 소수 콘텐츠에 성과가 크게 몰려 있습니다.' : ''}`,
      items: top.slice(0, 10).map(fmtRow),
    },
    {
      title: '성과가 저조한 콘텐츠',
      summary: '같은 플랫폼 중앙값에 크게 못 미치는 콘텐츠입니다. 소재나 노출 방식을 점검해 볼 지점입니다.',
      items: worst.map(fmtRow),
    },
  ];

  // ── 개선 포인트 (데이터에서 자동 도출) ──
  const recommendations: string[] = [];
  if (top5Share > 70) {
    recommendations.push(
      `상위 5개가 전체의 ${top5Share.toFixed(0)}%를 차지합니다. 성과가 특정 콘텐츠에 몰려 있으니, 잘 된 콘텐츠의 소재·길이·썸네일 패턴을 다음 제작에 반영해 보세요.`);
  }
  if (topPlatform && topPlatform.sharePct > 60) {
    recommendations.push(
      `${platformLabels[topPlatform.platform]} 의존도가 ${topPlatform.sharePct.toFixed(0)}%로 높습니다. 다른 플랫폼에도 동일 콘텐츠를 재배포해 채널 편중을 줄이는 것이 안전합니다.`);
  }
  if (poorShare >= 30) {
    recommendations.push(
      `개선 필요 등급이 ${poorCount}개(${poorShare.toFixed(0)}%)입니다. 하위 콘텐츠의 공통점(길이·업로드 시간대·소재)을 한 번 점검해 보세요.`);
  }
  if (commentRate < 0.05) {
    recommendations.push(
      `댓글률이 ${commentRate.toFixed(3)}%로 낮은 편입니다. 영상 말미 질문 던지기, 고정 댓글 활용 등 간단한 유도 장치를 시도해 볼 수 있습니다.`);
  }
  if (bestAvgPlatform && topPlatform && bestAvgPlatform.platform !== topPlatform.platform) {
    recommendations.push(
      `${platformLabels[bestAvgPlatform.platform]}은 콘텐츠 수는 적지만 평균 조회수가 가장 높습니다(${compactNumber(bestAvgPlatform.avgViews)}회). 업로드 빈도를 늘리면 효율이 좋을 수 있습니다.`);
  }
  if (waitingPlatforms.length) {
    recommendations.push(
      `${waitingPlatforms.map((p) => platformLabels[p]).join(', ')} 데이터가 아직 없습니다. 입력하면 전체 통합 성과와 모든 분석에 자동 반영됩니다.`);
  }
  if (!previousDate) {
    recommendations.push(
      '아직 1주차 데이터만 있어 추세 분석은 제한적입니다. 다음 주 데이터가 입력되면 성장률 기반 분석이 자동으로 추가됩니다.');
  }

  return {
    surveyDate,
    headline,
    overallGrade,
    overallReason,
    recommendations,
    detailSections,
    platformSections,
    contentSections,
    generatedBy: 'rule',
  };
}

// 참고: engagementRate 는 향후 참여율 기반 분석 확장에서 사용합니다.
void engagementRate;
void GRADE_META;
