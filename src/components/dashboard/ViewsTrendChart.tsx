// 전체 조회수 주차별 추세 차트 (Recharts LineChart 사용).
// 조사일이 1개뿐인 baseline 주차에는 점 하나 + 안내가 나옵니다.
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { colors } from '../../theme/theme';
import { compactNumber, formatDate } from '../../lib/format';

export interface TrendPoint {
  surveyDate: string;  // x축
  views: number;       // y축
}

export function ViewsTrendChart({ data }: { data: TrendPoint[] }) {
  if (data.length <= 1) {
    // 데이터가 1주뿐이면 추세선이 무의미하므로 안내 문구로 대체
    return (
      <p className="text-xs py-10 text-center" style={{ color: colors.textFaint }}>
        아직 1주차 데이터만 있습니다. 다음 주 데이터가 입력되면 추세 그래프가 그려집니다.
      </p>
    );
  }
  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 4 }}>
        <CartesianGrid stroke={colors.border} vertical={false} />
        <XAxis
          dataKey="surveyDate" tickFormatter={formatDate}
          tick={{ fill: colors.textMuted, fontSize: 11 }} stroke={colors.border}
        />
        <YAxis
          tickFormatter={compactNumber}
          tick={{ fill: colors.textMuted, fontSize: 11 }} stroke={colors.border}
        />
        <Tooltip
          contentStyle={{ background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: 8, color: colors.text }}
          labelFormatter={formatDate}
          formatter={(v: number) => [compactNumber(v), '조회수']}
        />
        <Line type="monotone" dataKey="views" stroke={colors.accent} strokeWidth={2} dot={{ r: 3 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}
