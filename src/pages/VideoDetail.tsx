// ────────────────────────────────────────────────────────────────
// 영상 상세 페이지 — 개별 콘텐츠의 주차별 성과를 봅니다.
// (메인 콘텐츠 전용 화면은 MainContentDetail.tsx 로 따로 있습니다)
// ────────────────────────────────────────────────────────────────
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from 'recharts';
import { Card } from '../components/common/Card';
import { SectionHeading } from '../components/common/SectionHeading';
import { KpiCard } from '../components/common/KpiCard';
import { Button } from '../components/common/Button';
import { PlatformBadge } from '../components/common/PlatformBadge';
import { DataTable, type Column } from '../components/common/DataTable';
import { EmptyState } from '../components/common/EmptyState';
import { useData } from '../store/DataContext';
import { buildVideoHistory, engagementRate } from '../lib/metrics';
import { colors, contentTypeLabels } from '../theme/theme';
import { fullNumber, compactNumber, formatDate } from '../lib/format';
import type { WeeklyMetric } from '../types';

interface Props {
  videoId: string;
  onBack: () => void;
}

export function VideoDetail({ videoId, onBack }: Props) {
  const { videos, metrics } = useData();
  const video = videos.find((v) => v.id === videoId);
  const history = buildVideoHistory(metrics, videoId);

  if (!video) {
    return (
      <Card>
        <EmptyState title="영상을 찾을 수 없습니다" description="삭제되었거나 잘못된 링크일 수 있습니다." />
        <div className="text-center mt-2">
          <Button onClick={onBack}>목록으로 돌아가기</Button>
        </div>
      </Card>
    );
  }

  const latest = history[history.length - 1];
  const prev = history.length >= 2 ? history[history.length - 2] : undefined;
  const growth = (cur: number, before: number | undefined) =>
    before === undefined || before === 0 ? null : ((cur - before) / before) * 100;

  // 업로드 후 경과일
  const daysSince = latest
    ? Math.max(0, Math.round(
        (new Date(latest.surveyDate).getTime() - new Date(video.uploadDate).getTime()) / 86400000))
    : 0;

  // 주차별 원시값 표
  const columns: Column<WeeklyMetric>[] = [
    { key: 'date', header: '조사일', width: '110px',
      render: (m) => <span style={{ color: colors.textMuted }}>{formatDate(m.surveyDate)}</span> },
    { key: 'views', header: '조회수', align: 'right', render: (m) => fullNumber(m.views) },
    { key: 'likes', header: '좋아요', align: 'right', render: (m) => fullNumber(m.likes) },
    { key: 'comments', header: '댓글', align: 'right', render: (m) => fullNumber(m.comments) },
    { key: 'extra', header: '저장/공유', align: 'right',
      render: (m) => (
        <span style={{ color: colors.textMuted }}>
          {m.saves !== null ? `저장 ${fullNumber(m.saves)}` : m.shares !== null ? `공유 ${fullNumber(m.shares)}` : '—'}
        </span>
      ) },
    { key: 'eng', header: '참여율', align: 'right',
      render: (m) => `${engagementRate(m).toFixed(2)}%` },
  ];

  return (
    <div className="flex flex-col gap-6">
      {/* 헤더 */}
      <div>
        <button onClick={onBack}
          style={{ fontSize: 12, color: colors.accent, background: 'none', border: 'none',
                   cursor: 'pointer', padding: 0, marginBottom: 8 }}>
          ← 돌아가기
        </button>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            {video.managementGroup === 'main' && (
              <p className="text-xs font-medium mb-1" style={{ color: colors.highlight }}>⭐ 메인 콘텐츠</p>
            )}
            <h1 className="text-lg font-semibold" style={{ color: colors.text }}>{video.title}</h1>
            <div className="flex items-center gap-3 mt-1.5">
              <PlatformBadge platform={video.platform} />
              <span className="text-xs" style={{ color: colors.textMuted }}>
                {contentTypeLabels[video.contentType]}
              </span>
              <span className="text-xs" style={{ color: colors.textMuted }}>
                업로드 {formatDate(video.uploadDate)} · {daysSince}일 경과
              </span>
            </div>
          </div>
          <Button href={video.url} variant="primary">원본 영상 열기 ↗</Button>
        </div>
      </div>

      {history.length === 0 ? (
        <Card>
          <EmptyState
            title="아직 수치가 입력되지 않았습니다"
            description="[주간 데이터 입력] 메뉴에서 이 영상의 조회수·좋아요·댓글을 입력하면 성과가 표시됩니다."
          />
        </Card>
      ) : (
        <>
          {/* 최신 성과 */}
          <div>
            <SectionHeading title="최신 성과" subtitle={`${formatDate(latest.surveyDate)} 조사 기준`} />
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <KpiCard kpi={{ label: '조회수', value: latest.views, changePct: growth(latest.views, prev?.views) }} />
              <KpiCard kpi={{ label: '좋아요', value: latest.likes, changePct: growth(latest.likes, prev?.likes) }} />
              <KpiCard kpi={{ label: '댓글', value: latest.comments, changePct: growth(latest.comments, prev?.comments) }} />
              <KpiCard kpi={{
                label: latest.saves !== null ? '저장' : latest.shares !== null ? '공유' : '참여율(%)',
                value: latest.saves ?? latest.shares ?? Math.round(engagementRate(latest) * 100) / 100,
                changePct: null,
              }} />
            </div>
          </div>

          {/* 주차별 추이 */}
          <Card>
            <SectionHeading title="주차별 추이" subtitle="누적값 기준" />
            {history.length <= 1 ? (
              <EmptyState
                title="아직 1주차 데이터만 있습니다"
                description="다음 주 데이터가 입력되면 이 영상의 성장 곡선이 그려집니다."
              />
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={history} margin={{ top: 8, right: 12, bottom: 0, left: 4 }}>
                  <CartesianGrid stroke={colors.border} vertical={false} />
                  <XAxis dataKey="surveyDate" tickFormatter={formatDate}
                    tick={{ fill: colors.textMuted, fontSize: 11 }} stroke={colors.border} />
                  <YAxis yAxisId="l" tickFormatter={compactNumber}
                    tick={{ fill: colors.textMuted, fontSize: 11 }} stroke={colors.border} />
                  <YAxis yAxisId="r" orientation="right" tickFormatter={compactNumber}
                    tick={{ fill: colors.textMuted, fontSize: 11 }} stroke={colors.border} />
                  <Tooltip
                    contentStyle={{ background: colors.surface, border: `1px solid ${colors.border}`,
                                    borderRadius: 8, color: colors.text }}
                    labelFormatter={formatDate}
                    formatter={(v: number) => fullNumber(v)} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Line yAxisId="l" type="monotone" dataKey="views" name="조회수"
                    stroke={colors.accent} strokeWidth={2} dot={{ r: 3 }} />
                  <Line yAxisId="r" type="monotone" dataKey="likes" name="좋아요"
                    stroke={colors.positive} strokeWidth={2} dot={{ r: 3 }} />
                  <Line yAxisId="r" type="monotone" dataKey="comments" name="댓글"
                    stroke={colors.highlight} strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </Card>

          {/* 주차별 원시값 */}
          <div>
            <SectionHeading title="주차별 기록" subtitle={`${history.length}개 주차`} />
            <Card style={{ padding: 8 }}>
              <DataTable columns={columns} rows={history} rowKey={(m) => m.surveyDate} />
            </Card>
          </div>
        </>
      )}

      {/* 영상 정보 */}
      <div>
        <SectionHeading title="영상 정보" />
        <Card>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            {[
              ['영상 ID', video.id],
              ['콘텐츠 그룹', video.contentGroup],
              ['관리 구분', video.managementGroup === 'main' ? '메인 콘텐츠' : '플랫폼 콘텐츠'],
              ['원본 링크', video.url],
            ].map(([label, value]) => (
              <div key={label} className="flex gap-3">
                <span style={{ color: colors.textMuted, minWidth: 90 }}>{label}</span>
                <span style={{ color: colors.text, wordBreak: 'break-all' }}>{value}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
