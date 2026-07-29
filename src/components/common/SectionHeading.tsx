// 섹션 제목 — 화면 안 구역을 나눌 때 재사용 (역할: 제목 스타일 통일)
import { colors } from '../../theme/theme';

interface Props {
  title: string;
  subtitle?: string;
}

export function SectionHeading({ title, subtitle }: Props) {
  return (
    <div className="mb-3">
      <h2 className="text-sm font-semibold tracking-wide" style={{ color: colors.text }}>
        {title}
      </h2>
      {subtitle && (
        <p className="text-xs mt-0.5" style={{ color: colors.textMuted }}>{subtitle}</p>
      )}
    </div>
  );
}
