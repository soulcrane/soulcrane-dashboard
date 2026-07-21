// 탭 전환 공통 부품 (재사용: 플랫폼 분석의 플랫폼 선택 등)
import { colors } from '../../theme/theme';

export function Tabs<T extends string>({ value, onChange, options }: {
  value: T; onChange: (v: T) => void;
  options: { value: T; label: string; color?: string }[];
}) {
  return (
    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 16 }}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button key={o.value} onClick={() => onChange(o.value)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              fontSize: 13, fontWeight: on ? 600 : 400, padding: '7px 14px', borderRadius: 8,
              cursor: 'pointer',
              color: on ? colors.accent : colors.textMuted,
              background: on ? colors.accentSoft : 'transparent',
              border: `1px solid ${on ? colors.accentSoft : colors.border}`,
            }}>
            {o.color && <span style={{ width: 8, height: 8, borderRadius: 99, background: o.color }} />}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
