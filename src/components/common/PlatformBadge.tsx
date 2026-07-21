// 플랫폼 뱃지 — 유튜브/인스타/틱톡/페이스북을 색 점 + 한글로 표시 (재사용)
import { platformColors, platformLabels, colors } from '../../theme/theme';
import type { Platform } from '../../types';

export function PlatformBadge({ platform }: { platform: Platform }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs" style={{ color: colors.textMuted }}>
      <span
        className="inline-block w-2 h-2 rounded-full"
        style={{ background: platformColors[platform] }}
      />
      {platformLabels[platform]}
    </span>
  );
}
