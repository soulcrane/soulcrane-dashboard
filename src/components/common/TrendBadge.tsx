// 증감 뱃지 — +상승(초록)/-하락(빨강)/—(데이터없음)을 색과 함께 표시 (재사용)
// 밝은 테마에서는 옅은 배경칩을 써서 숫자 대비를 확보합니다.
import { colors } from '../../theme/theme';
import { formatChange } from '../../lib/format';

export function TrendBadge({ changePct }: { changePct: number | null }) {
  const isNull = changePct === null || Number.isNaN(changePct);
  const up = (changePct ?? 0) > 0;

  const fg = isNull ? colors.textFaint : up ? colors.positive : colors.negative;
  const bg = isNull ? 'transparent' : up ? colors.positiveSoft : colors.negativeSoft;

  return (
    <span
      className="inline-flex items-center text-xs font-medium rounded-md px-1.5 py-0.5"
      style={{ color: fg, background: bg }}
    >
      {isNull ? '—' : (up ? '▲ ' : '▼ ')}{formatChange(changePct)}
    </span>
  );
}
