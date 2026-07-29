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
import { AutomationSettings } from './pages/AutomationSettings';

import { buildMainContents, surveyDatesDesc } from './lib/metrics';
import { colors } from './theme/theme';

function Router() {
  const { videos, metrics, loading, loadError } = useData();

  const [active, setActive] = useState('dashboard');
  const [videoId, setVideoId] = useState<string | null>(null);
  const [returnTo, setReturnTo] = useState('dashboard');

  const dates = surveyDatesDesc(metrics);
  const latest = dates[0] ?? '';
  const prev = dates[1];
  const mainContent = buildMainContents(videos, metrics, latest, prev)[0];

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

  const errorBanner = loadError ? (
    <div
      style={{
        margin: '0 0 20px',
        padding: '12px 16px',
        borderRadius: 8,
        background: colors.negativeSoft,
        border: `1px solid ${colors.negative}33`,
        color: colors.text,
        fontSize: 13,
        lineHeight: 1.6,
      }}
    >
      <strong style={{ color: colors.negative }}>
        데이터 저장소 연결 문제
      </strong>
      <p style={{ margin: '6px 0 0' }}>{loadError}</p>
      <p
        style={{
          margin: '8px 0 0',
          fontSize: 12,
          color: colors.textMuted,
        }}
      >
        지금 보이는 데이터는 이 브라우저에 남아 있던 임시 데이터입니다.
        위 문제를 해결한 뒤 새로고침하면 공유 DB와 연결됩니다.
      </p>
    </div>
  ) : null;

  const renderPage = () => {
    switch (active) {
      case 'dashboard':
        return (
          <Dashboard
            onOpenMainContent={() => setActive('main-content')}
          />
        );

      case 'main-content':
        return mainContent ? (
          <MainContentDetail
            data={mainContent}
            onBack={() => setActive('dashboard')}
          />
        ) : (
          <Dashboard
            onOpenMainContent={() => setActive('main-content')}
          />
        );

      case 'platforms':
        return (
          <PlatformAnalysis
            onOpenVideo={(id) => openVideo(id, 'platforms')}
          />
        );

      case 'contents':
        return (
          <Contents
            onOpenVideo={(id) => openVideo(id, 'contents')}
          />
        );

      case 'video-detail':
        return videoId ? (
          <VideoDetail
            videoId={videoId}
            onBack={() => setActive(returnTo)}
          />
        ) : (
          <Contents
            onOpenVideo={(id) => openVideo(id, 'contents')}
          />
        );

      case 'weekly':
        return <WeeklyCompare />;

      case 'ai':
        return <AiAnalysis />;

      case 'input':
        return <WeeklyInput />;

      case 'automation':
        return <AutomationSettings />;

      default:
        return (
          <Dashboard
            onOpenMainContent={() => setActive('main-content')}
          />
        );
    }
  };

  return (
    <AppLayout
      active={active === 'video-detail' ? returnTo : active}
      onNavigate={setActive}
      latestSurveyDate={latest}
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