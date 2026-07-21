// ────────────────────────────────────────────────────────────────
// 앱 진입 컴포넌트 — 화면 전환(라우팅)을 담당합니다.
// 데이터는 DataProvider(전역 스토어)가 공급하므로, 어느 화면에서 저장해도
// 다른 화면이 같은 데이터를 보게 됩니다.
// ────────────────────────────────────────────────────────────────
import { useState } from 'react';
import { AppLayout } from './layout/AppLayout';
import { DataProvider, useData } from './store/DataContext';

import { Dashboard } from './pages/Dashboard';
import { MainContentDetail } from './pages/MainContentDetail';
import { PlatformAnalysis } from './pages/PlatformAnalysis';
import { Contents } from './pages/Contents';
import { VideoDetail } from './pages/VideoDetail';
import { WeeklyCompare } from './pages/WeeklyCompare';
import { AiAnalysis } from './pages/AiAnalysis';
import { WeeklyInput } from './pages/WeeklyInput';

import { buildMainContents, surveyDatesDesc } from './lib/metrics';
import { colors } from './theme/theme';

function Router() {
  const { videos, metrics, loading, loadError } = useData();

  // 현재 화면 + (영상 상세로 갈 때) 선택된 영상 ID
  const [active, setActive] = useState('dashboard');
  const [videoId, setVideoId] = useState<string | null>(null);
  // 영상 상세에서 '돌아가기'를 눌렀을 때 원래 있던 화면으로 복귀시키기 위해 기억합니다.
  const [returnTo, setReturnTo] = useState('dashboard');

  const dates = surveyDatesDesc(metrics);
  const latest = dates[0] ?? '';
  const prev = dates[1];
  const mainContent = buildMainContents(videos, metrics, latest, prev)[0];

  // 영상 상세로 이동하는 공통 함수 (여러 화면에서 호출)
  const openVideo = (id: string, from: string) => {
    setVideoId(id);
    setReturnTo(from);
    setActive('video-detail');
  };

  if (loading) {
    return (
      <div style={{ padding: 40, color: colors.textMuted, fontSize: 13 }}>
        데이터를 불러오는 중입니다…
      </div>
    );
  }

  // 저장소 로딩 중 오류가 있었으면 화면 상단에 원인을 안내합니다.
  const errorBanner = loadError ? (
    <div style={{
      margin: '0 0 20px', padding: '12px 16px', borderRadius: 8,
      background: colors.negativeSoft, border: `1px solid ${colors.negative}33`,
      color: colors.text, fontSize: 13, lineHeight: 1.6,
    }}>
      <strong style={{ color: colors.negative }}>데이터 저장소 연결 문제</strong>
      <p style={{ margin: '6px 0 0' }}>{loadError}</p>
      <p style={{ margin: '8px 0 0', fontSize: 12, color: colors.textMuted }}>
        지금 보이는 데이터는 이 브라우저에 남아 있던 임시 데이터입니다. 위 문제를 해결한 뒤 새로고침하면 공유 DB와 연결됩니다.
      </p>
    </div>
  ) : null;

  const renderPage = () => {
    switch (active) {
      case 'dashboard':
        return <Dashboard onOpenMainContent={() => setActive('main-content')} />;

      case 'main-content':
        // ⭐ 메인 콘텐츠 전용 상세 (공식 본편)
        return mainContent
          ? <MainContentDetail data={mainContent} onBack={() => setActive('dashboard')} />
          : <Dashboard onOpenMainContent={() => setActive('main-content')} />;

      case 'platforms':
        return <PlatformAnalysis onOpenVideo={(id) => openVideo(id, 'platforms')} />;

      case 'contents':
        return <Contents onOpenVideo={(id) => openVideo(id, 'contents')} />;

      case 'video-detail':
        return videoId
          ? <VideoDetail videoId={videoId} onBack={() => setActive(returnTo)} />
          : <Contents onOpenVideo={(id) => openVideo(id, 'contents')} />;

      case 'weekly':
        return <WeeklyCompare />;

      case 'ai':
        return <AiAnalysis />;

      case 'input':
        return <WeeklyInput />;

      default:
        return <Dashboard onOpenMainContent={() => setActive('main-content')} />;
    }
  };

  return (
    <AppLayout
      // 영상 상세일 때는 사이드바에서 원래 메뉴가 선택된 것처럼 보이게 합니다.
      active={active === 'video-detail' ? returnTo : active}
      onNavigate={setActive}
      latestSurveyDate={latest}
      // 데모: 관리자 메뉴가 보이도록 true. 로그인 붙이면 실제 권한으로 대체됩니다.
      isAdmin={true}
    >
      {errorBanner}
      {renderPage()}
    </AppLayout>
  );
}

export default function App() {
  return (
    <DataProvider>
      <Router />
    </DataProvider>
  );
}
