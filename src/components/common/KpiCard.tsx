// KPI 카드 — 큰 숫자 하나 + 라벨 + 증감을 보여주는 재사용 컴포넌트
// 대시보드 상단, 플랫폼 분석 등 어디서든 씁니다.
import { Card } from './Card';
import { TrendBadge } from './TrendBadge';
import { colors } from '../../theme/theme';
import { fullNumber } from '../../lib/format';
import type { KpiValue } from '../../types';

export function KpiCard({ kpi }: { kpi: KpiValue }) {
  return (
    <Card>
      <p className="text-xs mb-2" style={{ color: colors.textMuted }}>{kpi.label}</p>
      <div className="flex items-end justify-between gap-2">
        <span className="text-2xl font-semibold tabular-nums" style={{ color: colors.text }}>
          {fullNumber(kpi.value)}
        </span>
        <TrendBadge changePct={kpi.changePct} />
      </div>
    </Card>
  );
}
