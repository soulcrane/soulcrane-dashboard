// 좌측 내비게이션. 메뉴 항목은 배열로 관리 → 페이지가 늘어도 여기만 추가하면 됩니다.
// (역할: 화면 이동. 지금은 대시보드만 활성, 나머지는 2~4단계에서 연결)
import { colors } from '../theme/theme';
import { formatDate } from '../lib/format';
import { storageMode } from '../lib/repository';

// 메뉴 정의. 'adminOnly: true'는 관리자 전용(향후 로그인 붙으면 조건부 노출).
const MENU = [
  { key: 'dashboard', label: '대시보드', icon: '◧', adminOnly: false },
  // ★ 메인 콘텐츠(공식 본편)는 플랫폼 하위가 아니라 최상위 메뉴로 독립 배치
  { key: 'main-content', label: 'LF. 공식 본편', icon: '⭐', adminOnly: false },
  { key: 'platforms', label: '플랫폼 분석', icon: '◑', adminOnly: false },
  { key: 'contents', label: '콘텐츠', icon: '▤', adminOnly: false },
  { key: 'weekly', label: '주간 비교', icon: '↔', adminOnly: false },
  { key: 'ai', label: 'AI 분석', icon: '✦', adminOnly: false },
];
// 관리자 메뉴. 영상 등록·팔로워 입력은 '주간 데이터 입력' 화면에 통합되어 있습니다.
const ADMIN_MENU = [
  { key: 'input', label: '주간 데이터 입력', icon: '✎' },
  { key: 'automation', label: '자동화 설정', icon: '⚙' },
];

interface Props {
  active: string;
  onNavigate: (key: string) => void;
  latestSurveyDate: string;
  isAdmin?: boolean;   // 향후 로그인 연동. 지금은 데모로 true 취급 가능.
}

export function Sidebar({ active, onNavigate, latestSurveyDate, isAdmin = false }: Props) {
  const item = (m: { key: string; label: string; icon: string }, disabled = false) => {
    const on = active === m.key;
    return (
      <button
        key={m.key}
        onClick={() => !disabled && onNavigate(m.key)}
        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-left transition-colors"
        style={{
          color: on ? colors.text : disabled ? colors.textFaint : colors.textMuted,
          background: on ? colors.accentSoft : 'transparent',
          cursor: disabled ? 'not-allowed' : 'pointer',
        }}
      >
        <span style={{ width: 16, textAlign: 'center', color: on ? colors.accent : 'inherit' }}>{m.icon}</span>
        {m.label}
        {disabled && <span className="ml-auto text-[10px]" style={{ color: colors.textFaint }}>준비 중</span>}
      </button>
    );
  };

  return (
    <aside
      className="w-60 shrink-0 h-screen sticky top-0 flex flex-col p-3"
      style={{ background: colors.sidebar, borderRight: `1px solid ${colors.border}` }}
    >
      {/* 로고 영역 */}
      <div className="px-2 py-3 mb-2">
        <p className="text-sm font-semibold" style={{ color: colors.text }}>소울크레인</p>
        <p className="text-xs" style={{ color: colors.textMuted }}>SNS 성과 대시보드</p>
      </div>

      {/* 메인 메뉴 (대시보드만 활성, 나머지는 다음 단계에서 연결) */}
      <nav className="flex flex-col gap-0.5">
        {/* 2단계에서 전 메뉴 활성화 완료 */}
        {MENU.map((m) => item(m))}
      </nav>

      {/* 관리자 메뉴 */}
      {isAdmin && (
        <>
          <div className="mt-4 mb-1 px-3 text-[10px] uppercase tracking-wider" style={{ color: colors.textFaint }}>
            관리
          </div>
          <nav className="flex flex-col gap-0.5">
            {ADMIN_MENU.map((m) => item(m))}
          </nav>
        </>
      )}

      {/* 하단: 저장 모드 + 최신 조사일 */}
      <div className="mt-auto px-3 py-2 text-xs" style={{ color: colors.textMuted }}>
        <div className="mb-2 inline-flex items-center gap-1.5 px-2 py-1 rounded-md"
          style={{
            background: storageMode === 'supabase' ? colors.positiveSoft : colors.surfaceHi,
            color: storageMode === 'supabase' ? colors.positive : colors.textMuted,
          }}>
          <span style={{ width: 6, height: 6, borderRadius: 99,
            background: storageMode === 'supabase' ? colors.positive : colors.textFaint,
            display: 'inline-block' }} />
          {storageMode === 'supabase' ? '공유 DB 연결됨' : '로컬 저장 (이 브라우저)'}
        </div>
        <div>
          <span style={{ color: colors.textFaint }}>최신 조사일</span><br />
          {formatDate(latestSurveyDate)} 기준
        </div>
      </div>
    </aside>
  );
}
