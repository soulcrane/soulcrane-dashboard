// 앱 전체 뼈대 = 좌측 사이드바 + 우측 콘텐츠 영역.
// 페이지들은 이 안에 children으로 들어옵니다. (역할: 공통 레이아웃)
import type { ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { colors } from '../theme/theme';

interface Props {
  children: ReactNode;
  active: string;
  onNavigate: (key: string) => void;
  latestSurveyDate: string;
  isAdmin?: boolean;
}

export function AppLayout({ children, active, onNavigate, latestSurveyDate, isAdmin }: Props) {
  return (
    <div className="flex min-h-screen" style={{ background: colors.bg }}>
      <Sidebar
        active={active}
        onNavigate={onNavigate}
        latestSurveyDate={latestSurveyDate}
        isAdmin={isAdmin}
      />
      <main className="flex-1 min-w-0 px-6 py-6 max-w-[1200px] mx-auto w-full">
        {children}
      </main>
    </div>
  );
}
