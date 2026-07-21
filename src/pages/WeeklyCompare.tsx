// ────────────────────────────────────────────────────────────────
// 주간 비교 페이지 — 두 조사일(주차)을 골라 변화를 봅니다.
//
// 지금은 1주차 데이터만 있으므로 '기준 주차' 상태를 명확히 안내하고,
// 다음 주 데이터가 입력되는 즉시 아래 계산이 자동으로 동작합니다.
// (계산 자체는 lib/metrics.ts 의 buildWeeklyComparison 이 담당)
// ────────────────────────────────────────────────────────────────
import { useState, useMemo } from 'react';
import { Card } from '../components/common/Card';
import { SectionHeading } from '../components/common/SectionHeading';
import { KpiCard } from '../components/common/KpiCard';
import { TrendBadge } from '../components/common/TrendBadge';
import { PlatformBadge } from '../components/common/PlatformBadge';
import { SelectField } from '../components/common/Field';
import { DataTable, type Column } from '../components/common/DataTable';
import { EmptyState } from '../components/common/EmptyState';
import { useData } from '../store/DataContext';
import { surveyDatesDesc, buildWeeklyComparison, buildVideoRows, platformVideos } from '../lib/metrics';
import { colors, platformLabels } from '../theme/theme';
import { fullNumber, formatDate } from '../lib/format';

export function WeeklyCompare() {
  const { videos, metrics } = useData();
  const dates = surveyDatesDesc(metrics);

  // 기본값: 최신 주차 vs 직전 주차
  const [currentDate, setCurrentDate] = useState(dates[0] ?? '');
  const [previousDate, setPreviousDate] = useState(dates[1] ?? '');

  const comparison = useMemo(
    () => buildWeeklyComparison(videos, metrics, currentDate, previousDate || undefined),
    [videos, metrics, currentDate, previousDate],
  );

  // 비교 대상이 없을 때 보여줄 '기준 주차' 요약
  const baselineRows = useMemo(
    () => (currentDate ? buildVideoRows(platformVideos(videos), metrics, currentDate) : []),
    [videos, metrics, currentDate],
  );

  const dateOptions = dates.map((d) => ({ value: d, label: formatDate(d) }));

  // 표 행 타입 (제네릭 추론을 위해 명시)
  type PlatformRow = typeof comparison.byPlatform[number];
  type VideoRowDelta = typeof comparison.byVideo[number];

  // 플랫폼별 변화 표의 열 정의 (기준 주차 / 비교 주차 두 곳에서 재사용)
  const platformBaselineColumns: Column<PlatformRow>[] = [
    { key: 'p', header: '플랫폼', render: (r) => <PlatformBadge platform={r.platform} /> },
    { key: 'v', header: '조회수', align: 'right', render: (r) => fullNumber(r.current) },
    { key: 'd', header: '증감', align: 'right',
      render: () => <span style={{ color: colors.textFaint }}>다음 주부터</span> },
  ];

  const platformCompareColumns: Column<PlatformRow>[] = [
    { key: 'p', header: '플랫폼', render: (r) => <PlatformBadge platform={r.platform} /> },
    { key: 'prev', header: '지난 주', align: 'right',
      render: (r) => <span style={{ color: colors.textMuted }}>{r.previous === null ? '—' : fullNumber(r.previous)}</span> },
    { key: 'cur', header: '이번 주', align: 'right', render: (r) => fullNumber(r.current) },
    { key: 'diff', header: '증감', align: 'right',
      render: (r) => (
        <span style={{ color: (r.diff ?? 0) > 0 ? colors.positive : colors.textMuted }}>
          {r.diff === null ? '—' : r.diff > 0 ? `+${fullNumber(r.diff)}` : fullNumber(r.diff)}
        </span>
      ) },
    { key: 'g', header: '성장률', align: 'right', render: (r) => <TrendBadge changePct={r.growthPct} /> },
  ];

  // 콘텐츠별 변화 표 (비교 가능할 때만 사용)
  const videoColumns: Column<VideoRowDelta>[] = [
    { key: 'title', header: '영상명',
      render: (r) => <span style={{ color: colors.text }}>{r.video.title}</span> },
    { key: 'platform', header: '플랫폼', width: '120px',
      render: (r) => <PlatformBadge platform={r.video.platform} /> },
    { key: 'prev', header: '지난 주', align: 'right', width: '100px',
      render: (r) => <span style={{ color: colors.textMuted }}>{r.previous === null ? '—' : fullNumber(r.previous)}</span> },
    { key: 'cur', header: '이번 주', align: 'right', width: '100px',
      render: (r) => fullNumber(r.current) },
    { key: 'diff', header: '증감', align: 'right', width: '100px',
      render: (r) => (
        <span style={{ color: r.diff === null ? colors.textFaint : r.diff > 0 ? colors.positive : colors.textMuted }}>
          {r.diff === null ? '—' : r.diff > 0 ? `+${fullNumber(r.diff)}` : fullNumber(r.diff)}
        </span>
      ) },
    { key: 'growth', header: '성장률', align: 'right', width: '90px',
      render: (r) => <TrendBadge changePct={r.growthPct} /> },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-lg font-semibold" style={{ color: colors.text }}>주간 비교</h1>
        <p className="text-xs mt-0.5" style={{ color: colors.textMuted }}>
          두 조사 주차를 골라 조회수·좋아요·댓글 변화를 확인합니다
        </p>
      </div>

      {/* 주차 선택 */}
      <Card>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <SelectField
            label="기준 주차 (이번 주)"
            value={currentDate}
            onChange={setCurrentDate}
            options={dateOptions.length ? dateOptions : [{ value: '', label: '데이터 없음' }]}
          />
          <SelectField
            label="비교 주차 (지난 주)"
            value={previousDate}
            onChange={setPreviousDate}
            options={[
              { value: '', label: dates.length < 2 ? '비교할 주차 없음' : '선택 안 함' },
              ...dateOptions.filter((o) => o.value !== currentDate),
            ]}
          />
        </div>
      </Card>

      {!comparison.hasComparison ? (
        // ── 1주차만 있는 상태: 오류가 아니라 '기준 주차'로 안내 ──
        <>
          <Card style={{ background: colors.accentSoft, border: `1px solid ${colors.border}` }}>
            <p className="text-sm font-medium mb-1.5" style={{ color: colors.text }}>
              현재 1주차 데이터가 입력되어 있습니다. 다음 주 데이터를 입력하면 주간 비교가 활성화됩니다.
            </p>
            <p className="text-xs leading-relaxed" style={{ color: colors.textMuted }}>
              기준 조사일은 <strong>{currentDate ? formatDate(currentDate) : '—'}</strong> 입니다.
              아래는 다음 주 비교의 출발점이 되는 기준값이며, <strong>[주간 데이터 입력]</strong>에서
              다음 주 데이터를 저장하면 조회수·좋아요·댓글 증감, 전주 대비 성장률,
              플랫폼별·콘텐츠별 변화가 이 화면에 자동으로 나타납니다.
            </p>
          </Card>

          <div>
            <SectionHeading title="기준 주차 성과" subtitle="다음 주 비교의 출발점이 되는 값입니다" />
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <KpiCard kpi={{ label: '조회수', value: baselineRows.reduce((a, r) => a + r.views, 0), changePct: null }} />
              <KpiCard kpi={{ label: '좋아요', value: baselineRows.reduce((a, r) => a + r.likes, 0), changePct: null }} />
              <KpiCard kpi={{ label: '댓글', value: baselineRows.reduce((a, r) => a + r.comments, 0), changePct: null }} />
              <KpiCard kpi={{ label: '콘텐츠 수', value: baselineRows.length, changePct: null }} />
            </div>
          </div>

          <div>
            <SectionHeading title="플랫폼별 기준값" />
            <Card style={{ padding: 8 }}>
              <DataTable
                columns={platformBaselineColumns}
                rows={comparison.byPlatform}
                rowKey={(r) => r.platform}
              />
            </Card>
          </div>
        </>
      ) : (
        // ── 2주차 이상: 실제 비교 ──
        <>
          <div>
            <SectionHeading
              title="전체 변화"
              subtitle={`${formatDate(comparison.previousDate!)} → ${formatDate(comparison.currentDate)}`}
            />
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
              {comparison.totals.map((t) => (
                <Card key={t.label}>
                  <p className="text-xs mb-2" style={{ color: colors.textMuted }}>{t.label}</p>
                  <div className="flex items-end justify-between gap-2">
                    <span className="text-2xl font-semibold tabular-nums" style={{ color: colors.text }}>
                      {fullNumber(t.current)}
                    </span>
                    <TrendBadge changePct={t.growthPct} />
                  </div>
                  <p className="text-xs mt-2" style={{ color: colors.textMuted }}>
                    지난 주 {t.previous === null ? '—' : fullNumber(t.previous)}
                    {t.diff !== null && (
                      <span style={{ color: t.diff > 0 ? colors.positive : colors.negative, marginLeft: 6 }}>
                        {t.diff > 0 ? `+${fullNumber(t.diff)}` : fullNumber(t.diff)}
                      </span>
                    )}
                  </p>
                </Card>
              ))}
            </div>
          </div>

          <div>
            <SectionHeading title="플랫폼별 변화" subtitle="조회수 기준" />
            <Card style={{ padding: 8 }}>
              <DataTable
                columns={platformCompareColumns}
                rows={comparison.byPlatform}
                rowKey={(r) => r.platform}
              />
            </Card>
          </div>

          <div>
            <SectionHeading
              title="콘텐츠별 변화"
              subtitle="조회수 증가량이 큰 순 · 상위 20개"
            />
            <Card style={{ padding: 8 }}>
              {comparison.byVideo.length === 0 ? (
                <EmptyState title="비교할 콘텐츠가 없습니다" />
              ) : (
                <DataTable
                  columns={videoColumns}
                  rows={comparison.byVideo.slice(0, 20)}
                  rowKey={(r) => r.video.id}
                />
              )}
            </Card>
          </div>
        </>
      )}

      {/* 플랫폼 라벨 참조 (표기 일관성 확인용 주석) */}
      <p className="text-xs" style={{ color: colors.textFaint }}>
        비교 대상: 플랫폼 콘텐츠 ({Object.values(platformLabels).join(' · ')}) · 메인 콘텐츠는 전용 화면에서 관리합니다.
      </p>
    </div>
  );
}
