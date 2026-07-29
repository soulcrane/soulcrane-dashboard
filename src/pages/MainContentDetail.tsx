// ────────────────────────────────────────────────────────────────
// ★ 메인 콘텐츠(LF. 공식 본편) 상세 페이지
//
// 구성: 성과 요약 → 주차별 조회수 변화 → 조회수/좋아요/댓글 추이 → 영상 정보
// 계산은 하지 않고 lib/metrics.ts 의 결과를 받아 표시만 합니다.
// ────────────────────────────────────────────────────────────────
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from 'recharts';
import { Card } from '../components/common/Card';
import { SectionHeading } from '../components/common/SectionHeading';
import { KpiCard } from '../components/common/KpiCard';
import { Button } from '../components/common/Button';
import { DataTable, type Column } from '../components/common/DataTable';
import { colors } from '../theme/theme';
import { fullNumber, compactNumber, formatDate } from '../lib/format';
import type { MainContentPerformance } from '../types';

interface Props {
  data: MainContentPerformance;
  onBack: () => void;
}

export function MainContentDetail({ data, onBack }: Props) {
  const { video, history } = data;
  const isBaseline = history.length <= 1;

  // 주차별 조회수 '증가량' 계산 (막대 차트용) — 첫 주는 증가량 개념이 없어 제외
  const gains = history.slice(1).map((h, i) => ({
    surveyDate: h.surveyDate,
    gain: h.views - history[i].views,
  }));

  // 영상 정보 표의 열 정의
  const infoColumns: Column<{ label: string; value: string }>[] = [
    { key: 'label', header: '항목', width: '160px', render: (r) => <span style={{ color: colors.textMuted }}>{r.label}</span> },
    { key: 'value', header: '내용', render: (r) => <span style={{ color: colors.text }}>{r.value}</span> },
  ];
  const infoRows = [
    { label: '영상 ID', value: video.id },
    { label: '영상명', value: video.title },
    { label: '플랫폼', value: '유튜브' },
    { label: '콘텐츠 유형', value: '롱폼 (공식 본편)' },
    { label: '업로드일', value: formatDate(video.uploadDate) },
    { label: '업로드 후 경과', value: `${data.daysSinceUpload}일` },
    { label: '기록된 조사 주차', value: `${history.length}주차` },
  ];

  return (
    <div className="flex flex-col gap-6">
      {/* 헤더 */}
      <div>
        <button
          onClick={onBack}
          className="text-xs mb-2"
          style={{ color: colors.accent, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
        >
          ← 대시보드로 돌아가기
        </button>
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-medium mb-1" style={{ color: colors.highlight }}>⭐ 메인 콘텐츠</p>
            <h1 className="text-lg font-semibold" style={{ color: colors.text }}>{video.title}</h1>
            <p className="text-xs mt-0.5" style={{ color: colors.textMuted }}>
              작품의 핵심 콘텐츠 · 별도 관리 대상
            </p>
          </div>
          <Button href={video.url} variant="primary">유튜브에서 열기 ↗</Button>
        </div>
      </div>

      {/* 1) 성과 요약 */}
      <div>
        <SectionHeading title="성과 요약" subtitle={`업로드 후 ${data.daysSinceUpload}일 경과`} />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiCard kpi={{ label: '조회수', value: data.views, changePct: data.weeklyGrowthPct }} />
          <KpiCard kpi={{ label: '좋아요', value: data.likes, changePct: null }} />
          <KpiCard kpi={{ label: '댓글', value: data.comments, changePct: null }} />
          <KpiCard kpi={{ label: '주간 조회수 증가', value: data.weeklyViewGain ?? 0, changePct: data.weeklyGrowthPct }} />
        </div>
      </div>

      {/* 2) 주차별 조회수 변화 (증가량 막대) */}
      <Card>
        <SectionHeading title="주차별 조회수 증가량" subtitle="직전 조사일 대비 늘어난 조회수" />
        {isBaseline ? (
          <p className="text-xs py-10 text-center" style={{ color: colors.textFaint }}>
            아직 1주차 데이터만 있습니다. 다음 주 데이터가 입력되면 증가량이 표시됩니다.
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={gains} margin={{ top: 8, right: 12, bottom: 0, left: 4 }}>
              <CartesianGrid stroke={colors.border} vertical={false} />
              <XAxis dataKey="surveyDate" tickFormatter={formatDate} tick={{ fill: colors.textMuted, fontSize: 11 }} stroke={colors.border} />
              <YAxis tickFormatter={compactNumber} tick={{ fill: colors.textMuted, fontSize: 11 }} stroke={colors.border} />
              <Tooltip
                contentStyle={{ background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: 8, color: colors.text }}
                labelFormatter={formatDate}
                formatter={(v: number) => [fullNumber(v), '증가량']}
              />
              <Bar dataKey="gain" fill={colors.highlight} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </Card>

      {/* 3) 조회수 / 좋아요 / 댓글 추이 */}
      <Card>
        <SectionHeading title="조회수 · 좋아요 · 댓글 추이" subtitle="누적값 기준" />
        {isBaseline ? (
          <p className="text-xs py-10 text-center" style={{ color: colors.textFaint }}>
            2주차 데이터가 입력되면 추이 그래프가 그려집니다.
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={history} margin={{ top: 8, right: 12, bottom: 0, left: 4 }}>
              <CartesianGrid stroke={colors.border} vertical={false} />
              <XAxis dataKey="surveyDate" tickFormatter={formatDate} tick={{ fill: colors.textMuted, fontSize: 11 }} stroke={colors.border} />
              {/* 조회수는 자릿수가 커서 좌축, 좋아요·댓글은 우축으로 분리 */}
              <YAxis yAxisId="left" tickFormatter={compactNumber} tick={{ fill: colors.textMuted, fontSize: 11 }} stroke={colors.border} />
              <YAxis yAxisId="right" orientation="right" tickFormatter={compactNumber} tick={{ fill: colors.textMuted, fontSize: 11 }} stroke={colors.border} />
              <Tooltip
                contentStyle={{ background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: 8, color: colors.text }}
                labelFormatter={formatDate}
                formatter={(v: number) => fullNumber(v)}
              />
              <Legend wrapperStyle={{ fontSize: 11, color: colors.textMuted }} />
              <Line yAxisId="left" type="monotone" dataKey="views" name="조회수" stroke={colors.accent} strokeWidth={2} dot={{ r: 3 }} />
              <Line yAxisId="right" type="monotone" dataKey="likes" name="좋아요" stroke={colors.positive} strokeWidth={2} dot={{ r: 3 }} />
              <Line yAxisId="right" type="monotone" dataKey="comments" name="댓글" stroke={colors.highlight} strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </Card>

      {/* 4) 영상 정보 */}
      <div>
        <SectionHeading title="영상 정보" />
        <Card style={{ padding: 8 }}>
          <DataTable columns={infoColumns} rows={infoRows} rowKey={(r) => r.label} />
        </Card>
      </div>
    </div>
  );
}
