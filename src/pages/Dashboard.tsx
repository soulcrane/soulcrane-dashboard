// ────────────────────────────────────────────────────────────────
// 대시보드 페이지 (1단계 결과물)
//
// 이 페이지는 '계산'을 직접 하지 않습니다. lib/metrics.ts 의 함수에
// 원천 데이터를 넘겨 받은 결과(파생 값)를 화면 컴포넌트에 전달만 합니다.
// → 데이터 소스가 시드에서 Supabase로 바뀌어도 이 파일은 거의 그대로입니다.
// ────────────────────────────────────────────────────────────────
import { SectionHeading } from '../components/common/SectionHeading';
import { Card } from '../components/common/Card';
import { KpiGrid } from '../components/dashboard/KpiGrid';
import { PlatformSummaryCards } from '../components/dashboard/PlatformSummaryCards';
import { TopVideosTable } from '../components/dashboard/TopVideosTable';
import { InsightStrip } from '../components/dashboard/InsightStrip';
import { MainContentCard } from '../components/dashboard/MainContentCard';
import { ViewsTrendChart, type TrendPoint } from '../components/dashboard/ViewsTrendChart';

import { useData } from '../store/DataContext';
import {
  buildKpis, buildPlatformSummaries, buildTopVideos, surveyDatesDesc, buildMainContents,
} from '../lib/metrics';
import { platformLabels, colors } from '../theme/theme';
import { compactNumber } from '../lib/format';

interface Props {
  /** 메인 콘텐츠(공식 본편) 상세 페이지로 이동 */
  onOpenMainContent: () => void;
}

export function Dashboard({ onOpenMainContent }: Props) {
  // 데이터는 전역 스토어에서 (주간 입력에서 저장하면 여기도 자동 갱신됩니다)
  const { videos: VIDEOS, metrics: WEEKLY_METRICS, followers: PLATFORM_FOLLOWERS } = useData();

  // 1) 조사일 정렬 → 최신 / 직전 주 구하기
  const dates = surveyDatesDesc(WEEKLY_METRICS);
  const latest = dates[0] ?? '';
  const prev = dates[1]; // 없으면 undefined = baseline(1주차)
  const isBaseline = prev === undefined;

  // 2) 원천 → 파생 값 계산 (전부 metrics.ts 가 담당)
  // ※ KPI/플랫폼요약/TOP10은 모두 '플랫폼 콘텐츠' 기준(공식 본편 제외)으로 계산됩니다.
  const kpis = buildKpis(VIDEOS, WEEKLY_METRICS, latest, prev);
  const platformSummaries = buildPlatformSummaries(VIDEOS, WEEKLY_METRICS, PLATFORM_FOLLOWERS, latest, prev);
  const topVideos = buildTopVideos(VIDEOS, WEEKLY_METRICS, latest, 10);
  // ★ 메인 콘텐츠(공식 본편) — 별도 관리 대상
  const mainContents = buildMainContents(VIDEOS, WEEKLY_METRICS, latest, prev);

  // 3) 추세 차트용 데이터 (조사일별 전체 조회수)
  const trend: TrendPoint[] = dates
    .slice()
    .reverse()
    .map((d) => ({
      surveyDate: d,
      views: WEEKLY_METRICS.filter((m) => m.surveyDate === d).reduce((a, m) => a + m.views, 0),
    }));

  // 4) 인사이트 스트립 — baseline이면 안내, 아니면 실제 값
  const topPlatform = [...platformSummaries].sort((a, b) => b.totalViews - a.totalViews)[0];
  const insights = [
    {
      label: '최다 조회 플랫폼',
      value: topPlatform ? `${platformLabels[topPlatform.platform]} · ${compactNumber(topPlatform.totalViews)}회` : '—',
      ready: true,
    },
    {
      label: '가장 성장한 플랫폼 (전주 대비)',
      value: isBaseline ? '2주차 데이터 입력 후 표시' : '—',
      ready: !isBaseline,
    },
    {
      label: '이번 주 급상승 콘텐츠',
      value: isBaseline ? '2주차 데이터 입력 후 표시' : '—',
      ready: !isBaseline,
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      {/* 페이지 헤더 */}
      <div>
        <h1 className="text-lg font-semibold" style={{ color: colors.text }}>대시보드</h1>
        <p className="text-xs mt-0.5" style={{ color: colors.textMuted }}>
          최신 조사일 기준 전체 콘텐츠 성과 요약
        </p>
      </div>

      {/* 전체 SNS 통합 KPI (플랫폼 콘텐츠 기준) */}
      <div>
        <SectionHeading title="전체 SNS 통합 성과" subtitle="LF. 공식 본편 + 전 플랫폼 콘텐츠 합계" />
        <KpiGrid kpis={kpis} />
      </div>

      {/* 플랫폼별 성과 카드 */}
      <div>
        <SectionHeading title="플랫폼별 성과" subtitle="카드를 누르면 플랫폼 상세로 이동합니다 (2단계에서 연결)" />
        <PlatformSummaryCards summaries={platformSummaries} />
      </div>

      {/* ★ 메인 콘텐츠 강조 영역 — 작품의 핵심 콘텐츠는 독립적으로 관리 */}
      {mainContents.map((mc) => (
        <MainContentCard key={mc.video.id} data={mc} onOpen={onOpenMainContent} />
      ))}

      {/* 추세 차트 + 인사이트 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <div className="lg:col-span-2">
          <Card>
            <SectionHeading title="전체 조회수 추세" />
            <ViewsTrendChart data={trend} />
          </Card>
        </div>
        <div className="flex flex-col gap-3">
          <InsightStrip insights={insights} />
        </div>
      </div>

      {/* TOP 10 */}
      <div>
        <SectionHeading title="이번 주 TOP 10 영상" subtitle="조회수 기준" />
        <Card style={{ padding: 0 }}>
          <div className="p-2">
            <TopVideosTable rows={topVideos} />
          </div>
        </Card>
      </div>
    </div>
  );
}
