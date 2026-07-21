// ────────────────────────────────────────────────────────────────
// 표시용 포맷 헬퍼 (역할: 숫자·퍼센트·날짜를 사람이 읽기 좋게)
// 화면 컴포넌트는 계산을 몰라도 이 함수들만 쓰면 됩니다.
// ────────────────────────────────────────────────────────────────

// 큰 수를 축약: 1234567 → '123.5만', 12000 → '1.2만', 950 → '950'
export function compactNumber(n: number): string {
  if (n >= 100_000_000) return (n / 100_000_000).toFixed(1).replace(/\.0$/, '') + '억';
  if (n >= 10_000) return (n / 10_000).toFixed(1).replace(/\.0$/, '') + '만';
  return n.toLocaleString('ko-KR');
}

// 정확한 천단위 콤마: 10056720 → '10,056,720'
export function fullNumber(n: number): string {
  return n.toLocaleString('ko-KR');
}

// 변화율 표시: 12.3 → '+12.3%', -4 → '-4.0%', null → '—'
export function formatChange(pct: number | null): string {
  if (pct === null || Number.isNaN(pct)) return '—';
  const sign = pct > 0 ? '+' : '';
  return `${sign}${pct.toFixed(1)}%`;
}

// 날짜 표시: '2026-07-13' → '2026.07.13'
export function formatDate(iso: string): string {
  return iso.replaceAll('-', '.');
}
