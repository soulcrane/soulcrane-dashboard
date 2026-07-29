// 폼 입력 공통 부품 — 라벨 + 입력창을 한 세트로 (재사용: 주간 입력, 영상 등록)
import { colors } from '../../theme/theme';

const inputStyle = {
  width: '100%', fontSize: 13, padding: '8px 10px', borderRadius: 8,
  border: `1px solid ${colors.border}`, background: colors.surface, color: colors.text,
  outline: 'none' as const,
};

export function TextField({ label, value, onChange, placeholder, type = 'text', disabled }: {
  label?: string; value: string; onChange: (v: string) => void;
  placeholder?: string; type?: string; disabled?: boolean;
}) {
  return (
    <label style={{ display: 'block' }}>
      {label && <span style={{ display: 'block', fontSize: 12, color: colors.textMuted, marginBottom: 4 }}>{label}</span>}
      <input
        type={type} value={value} placeholder={placeholder} disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        style={{ ...inputStyle, opacity: disabled ? 0.6 : 1 }}
      />
    </label>
  );
}

export function SelectField<T extends string>({ label, value, onChange, options }: {
  label?: string; value: T; onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <label style={{ display: 'block' }}>
      {label && <span style={{ display: 'block', fontSize: 12, color: colors.textMuted, marginBottom: 4 }}>{label}</span>}
      <select value={value} onChange={(e) => onChange(e.target.value as T)} style={inputStyle}>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  );
}
