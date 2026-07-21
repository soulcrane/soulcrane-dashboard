// 빈 상태 안내 — 오류처럼 보이지 않게, '무엇을 하면 되는지'를 알려주는 컴포넌트 (재사용)
import { colors } from '../../theme/theme';

export function EmptyState({ title, description }: { title: string; description?: string }) {
  return (
    <div style={{ textAlign: 'center', padding: '40px 20px' }}>
      <p style={{ fontSize: 13, fontWeight: 500, color: colors.text, marginBottom: 6 }}>{title}</p>
      {description && (
        <p style={{ fontSize: 12, color: colors.textMuted, lineHeight: 1.6, maxWidth: 460, margin: '0 auto' }}>
          {description}
        </p>
      )}
    </div>
  );
}
