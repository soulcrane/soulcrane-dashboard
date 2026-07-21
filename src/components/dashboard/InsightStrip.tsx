// 핵심 인사이트 3칸. 2주차 이상 데이터가 쌓이면 실제 값이 채워집니다.
// 1주차(baseline)에는 '데이터 축적 중' 안내가 표시됩니다.
import { Card } from '../common/Card';
import { colors } from '../../theme/theme';

interface Insight {
  label: string;
  value: string;      // 실제 값 또는 안내 문구
  ready: boolean;     // false면 흐린 안내 톤으로 표시
}

export function InsightStrip({ insights }: { insights: Insight[] }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
      {insights.map((i) => (
        <Card key={i.label}>
          <p className="text-xs mb-1.5" style={{ color: colors.textMuted }}>{i.label}</p>
          <p
            className="text-sm font-medium"
            style={{ color: i.ready ? colors.text : colors.textFaint }}
          >
            {i.value}
          </p>
        </Card>
      ))}
    </div>
  );
}
