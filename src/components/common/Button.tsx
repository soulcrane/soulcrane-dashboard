// 공통 버튼 — 링크/액션용. primary(채움) / ghost(투명) 두 종류 (재사용)
import type { ReactNode } from 'react';
import { colors } from '../../theme/theme';

interface Props {
  children: ReactNode;
  onClick?: () => void;
  href?: string;               // 값이 있으면 새 탭 링크로 동작(영상 원본 링크 등)
  variant?: 'primary' | 'ghost';
}

export function Button({ children, onClick, href, variant = 'ghost' }: Props) {
  const base = 'inline-flex items-center gap-1 text-xs font-medium rounded-lg px-3 py-1.5 transition-colors';
  const style =
    variant === 'primary'
      ? { background: colors.accent, color: '#fff' }
      : { background: 'transparent', color: colors.accent, border: `1px solid ${colors.border}` };

  if (href) {
    return (
      <a href={href} target="_blank" rel="noreferrer" className={base} style={style}>
        {children}
      </a>
    );
  }
  return (
    <button onClick={onClick} className={base} style={style}>
      {children}
    </button>
  );
}
