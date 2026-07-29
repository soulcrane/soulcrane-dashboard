// ────────────────────────────────────────────────────────────────
// AI 분석 페이지
//
// 화면 순서 (요청 반영):
//   ① 이번 주 성과 요약  → ② 간단한 개선 포인트 → ③ 상세 AI 분석
//   → ④ 플랫폼별 분석 → ⑤ 콘텐츠별 분석
//   페이지에 들어오자마자 "잘했나 못했나 / 뭘 고쳐야 하나"를 먼저 보게 하는 순서입니다.
//
// 분석 '로직'은 lib/analysis.ts, 등급 판정은 lib/grading.ts 에 분리되어 있습니다.
// 향후 AI API를 붙여도 이 화면은 고칠 필요가 없습니다.
// ────────────────────────────────────────────────────────────────
import { useMemo } from 'react';
import { Card } from '../components/common/Card';
import { SectionHeading } from '../components/common/SectionHeading';
import { EmptyState } from '../components/common/EmptyState';
import { useData } from '../store/DataContext';
import { surveyDatesDesc } from '../lib/metrics';
import { generateInsights, type InsightSection } from '../lib/analysis';
import { gradeLabel, type Grade } from '../lib/grading';
import { colors } from '../theme/theme';
import { formatDate } from '../lib/format';

// 등급 뱃지 (🟢/🟡/🔴) — 목록과 요약 카드에서 재사용
function GradeBadge({ grade }: { grade: Grade }) {
  const bg = grade === 'good' ? colors.positiveSoft
    : grade === 'poor' ? colors.negativeSoft : colors.surfaceHi;
  const fg = grade === 'good' ? colors.positive
    : grade === 'poor' ? colors.negative : colors.textMuted;
  return (
    <span className="inline-flex items-center text-xs font-medium rounded-md px-2 py-0.5 shrink-0"
      style={{ background: bg, color: fg }}>
      {gradeLabel[grade]}
    </span>
  );
}

// 분석 섹션 카드 하나 (상세/플랫폼/콘텐츠 분석에서 공통 사용)
function SectionCard({ section }: { section: InsightSection }) {
  return (
    <Card>
      <SectionHeading title={section.title} />
      <p className="text-xs leading-relaxed mb-3" style={{ color: colors.textMuted }}>
        {section.summary}
      </p>
      {section.items?.map((item, i) => (
        <div key={`${item.label}-${i}`}
          className="flex items-center justify-between gap-3 py-2"
          style={{ borderTop: i === 0 ? 'none' : `1px solid ${colors.border}` }}>
          <div className="min-w-0">
            <p className="text-xs truncate" style={{ color: colors.text }}>{item.label}</p>
            {item.sub && <p className="text-[11px] mt-0.5" style={{ color: colors.textFaint }}>{item.sub}</p>}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs font-medium tabular-nums" style={{ color: colors.text }}>
              {item.value}
            </span>
            {item.grade && <GradeBadge grade={item.grade} />}
          </div>
        </div>
      ))}
    </Card>
  );
}

export function AiAnalysis() {
  const { videos, metrics } = useData();
  const dates = surveyDatesDesc(metrics);
  const latest = dates[0];
  const prev = dates[1];

  const result = useMemo(
    () => (latest ? generateInsights(videos, metrics, latest, prev) : null),
    [videos, metrics, latest, prev],
  );

  if (!result) {
    return (
      <Card>
        <EmptyState
          title="분석할 데이터가 없습니다"
          description="[주간 데이터 입력]에서 콘텐츠 성과를 저장하면 분석 결과가 자동으로 생성됩니다."
        />
      </Card>
    );
  }

  const gradeBg = result.overallGrade === 'good' ? colors.positiveSoft
    : result.overallGrade === 'poor' ? colors.negativeSoft : colors.accentSoft;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-lg font-semibold" style={{ color: colors.text }}>AI 분석</h1>
        <p className="text-xs mt-0.5" style={{ color: colors.textMuted }}>
          {formatDate(result.surveyDate)} 조사 기준 · 회의에서 바로 읽을 수 있는 요약
        </p>
      </div>

      {/* ① 이번 주 성과 요약 */}
      <Card style={{ background: gradeBg, border: `1px solid ${colors.border}` }}>
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xs font-medium" style={{ color: colors.text }}>이번 주 성과 요약</span>
          <GradeBadge grade={result.overallGrade} />
        </div>
        <p className="text-sm leading-relaxed mb-2" style={{ color: colors.text }}>
          {result.headline}
        </p>
        <p className="text-xs" style={{ color: colors.textMuted }}>
          {result.overallReason}
        </p>
      </Card>

      {/* ② 간단한 개선 포인트 — 요약 바로 아래로 이동 */}
      <div>
        <SectionHeading title="간단한 개선 포인트" subtitle="지금 가장 먼저 확인할 것" />
        <Card>
          <ol className="flex flex-col gap-3">
            {result.recommendations.map((rec, i) => (
              <li key={i} className="flex gap-3 text-sm" style={{ color: colors.text }}>
                <span className="shrink-0 inline-flex items-center justify-center text-xs font-medium rounded-md"
                  style={{ width: 20, height: 20, background: colors.accentSoft, color: colors.accent }}>
                  {i + 1}
                </span>
                <span className="leading-relaxed">{rec}</span>
              </li>
            ))}
          </ol>
        </Card>
      </div>

      {/* ③ 상세 AI 분석 */}
      <div>
        <SectionHeading title="상세 AI 분석" subtitle="최고 성과 · 좋아요율 · 댓글 반응 · 성과 패턴" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {result.detailSections.map((s) => <SectionCard key={s.title} section={s} />)}
        </div>
      </div>

      {/* ④ 플랫폼별 분석 */}
      <div>
        <SectionHeading title="플랫폼별 분석" subtitle="등급은 플랫폼 중앙값 조회수 대비로 계산됩니다" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {result.platformSections.map((s) => <SectionCard key={s.title} section={s} />)}
        </div>
      </div>

      {/* ⑤ 콘텐츠별 분석 */}
      <div>
        <SectionHeading title="콘텐츠별 분석" subtitle="같은 플랫폼 중앙값 대비 성과" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {result.contentSections.map((s) => <SectionCard key={s.title} section={s} />)}
        </div>
      </div>

      {/* 등급 기준 안내 */}
      <Card>
        <p className="text-xs font-medium mb-2" style={{ color: colors.text }}>등급 기준</p>
        <p className="text-xs leading-relaxed" style={{ color: colors.textMuted }}>
          같은 플랫폼의 <strong>중앙값</strong> 조회수를 기준선으로 삼습니다.
          중앙값의 1.5배 이상이면 🟢 성과 좋음, 0.5배 이상이면 🟡 보통, 0.5배 미만이면 🔴 개선 필요입니다.
          평균 대신 중앙값을 쓰는 이유는, 상위 몇 개 콘텐츠가 평균을 크게 끌어올려
          정상적인 콘텐츠까지 '개선 필요'로 표시되는 것을 막기 위해서입니다.
          또 플랫폼마다 조회수 규모가 크게 다르므로 플랫폼별로 따로 계산합니다.
        </p>
        <p className="text-xs mt-3" style={{ color: colors.textFaint }}>
          현재 분석은 실제 데이터를 계산해 자동 생성됩니다(외부 API 불필요).
          향후 AI API를 연결하면 같은 화면에서 더 자연스러운 문장형 분석으로 대체됩니다.
        </p>
      </Card>
    </div>
  );
}
