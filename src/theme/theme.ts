// ────────────────────────────────────────────────────────────────
// 디자인 토큰 — 색상/그림자를 '한 곳'에서 관리 (역할: 일관된 룩앤필)
// 색을 바꾸고 싶으면 이 파일만 수정하면 앱 전체(모든 페이지)에 반영됩니다.
//
// 톤: 밝고 깔끔한 관리자용 대시보드 (Linear/Stripe/Notion 계열).
//   - 검정 대신 '밝은 중성 회색' 배경 → 장시간 봐도 눈이 편안
//   - 카드는 흰색으로 띄우고, 옅은 테두리 + 미세한 그림자로 층을 구분
//   - 텍스트는 순검정(#000) 대신 짙은 슬레이트 → 눈부심 감소, 대비는 충분히 확보
// ────────────────────────────────────────────────────────────────

export const colors = {
  // 배경 계층 (뒤 → 앞으로 갈수록 밝아짐)
  bg: '#F5F7FA',          // 페이지 바닥 — 밝은 중성 회색
  surface: '#FFFFFF',     // 카드 기본면
  surfaceHi: '#F0F3F8',   // 호버/강조 면
  sidebar: '#FFFFFF',     // 사이드바 면
  border: '#E3E8EF',      // 옅은 경계선

  // 텍스트 (가독성 우선: 숫자·제목은 가장 진한 색)
  text: '#101828',        // 기본 — KPI 숫자, 제목
  textMuted: '#667085',   // 보조/라벨
  textFaint: '#98A2B3',   // 비활성·안내

  // 브랜드 액센트 (포인트는 절제해서 사용)
  accent: '#4F5FE7',      // 인디고 — 링크/차트 기본선
  accentSoft: '#EEF0FE',

  // 상태 색
  positive: '#12A150',    // 상승
  positiveSoft: '#E7F7EE',
  negative: '#E5484D',    // 하락
  negativeSoft: '#FDECEC',

  // ⭐ 메인 콘텐츠(공식 본편) 강조용 — 골드 계열
  highlight: '#A87B12',
  highlightSoft: '#FDF8EC',
  highlightBorder: '#EBD9A5',
} as const;

// 밝은 배경에서 카드 층을 만들어 주는 미세한 그림자
export const shadows = {
  card: '0 1px 2px rgba(16,24,40,0.04), 0 1px 3px rgba(16,24,40,0.06)',
  cardHover: '0 2px 8px rgba(16,24,40,0.10)',
} as const;

// 플랫폼 식별 색 (밝은 배경에 맞춰 채도 조정 — 포인트 컬러는 유지)
export const platformColors: Record<string, string> = {
  youtube: '#E8322A',
  instagram: '#D6337E',
  tiktok: '#0EA5C4',
  facebook: '#3B6FE0',
  douyin: '#111827',   // 더우인 브랜드의 블랙 계열 (기존 색들과 확실히 구분)
};

// 플랫폼 한글 표기 (표시는 항상 이 표를 통해 → 표기 일관성 유지)
export const platformLabels: Record<string, string> = {
  youtube: '유튜브',
  instagram: '인스타그램',
  tiktok: '틱톡',
  facebook: '페이스북',
  douyin: '더우인',
};

export const contentTypeLabels: Record<string, string> = {
  short: '숏폼',
  long: '롱폼',
};
