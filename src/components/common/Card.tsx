// 공통 카드 컨테이너 — 앱의 모든 '박스'는 이 컴포넌트를 재사용합니다.
// (역할: 배경/테두리/모서리/여백/그림자를 한 곳에서 통일)
// 밝은 테마에서는 흰 카드 + 옅은 테두리 + 미세한 그림자로 층을 만듭니다.
import type { ReactNode, CSSProperties } from 'react';
import { colors, shadows } from '../../theme/theme';

interface CardProps {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  /** true면 호버 시 살짝 떠오르고 클릭 가능한 느낌을 줍니다(플랫폼 카드 등) */
  interactive?: boolean;
  onClick?: () => void;
}

export function Card({ children, className = '', style, interactive, onClick }: CardProps) {
  return (
    <div
      onClick={onClick}
      className={`rounded-xl p-5 transition-all ${interactive ? 'cursor-pointer' : ''} ${className}`}
      style={{
        background: colors.surface,
        border: `1px solid ${colors.border}`,
        boxShadow: shadows.card,
        ...style,
      }}
      onMouseEnter={(e) => { if (interactive) e.currentTarget.style.boxShadow = shadows.cardHover; }}
      onMouseLeave={(e) => { if (interactive) e.currentTarget.style.boxShadow = shadows.card; }}
    >
      {children}
    </div>
  );
}
