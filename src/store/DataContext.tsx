// ────────────────────────────────────────────────────────────────
// 전역 데이터 스토어 (React Context)
//
// ★ 이 파일의 목적: 앱의 모든 화면이 '같은 데이터'를 보게 만드는 것.
//
//   관리자가 [주간 데이터 입력]에서 저장하면 → 여기 데이터가 바뀌고 →
//   대시보드 · 플랫폼 분석 · 주간 비교 · AI 분석이 전부 자동으로 다시 그려집니다.
//   (엑셀에서 4개 시트에 중복 입력하던 문제를 구조적으로 없앤 부분)
// ────────────────────────────────────────────────────────────────
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Video, WeeklyMetric, PlatformFollower } from '../types';
import { repository, storageMode, type DataSnapshot } from '../lib/repository';
import { migrateLocalToSupabase } from '../lib/migrate';

interface DataContextValue extends DataSnapshot {
  loading: boolean;
  loadError: string | null;   // 저장소 로딩 실패 시 오류 메시지 (없으면 null)

  // ── 영상 마스터 CRUD ──
  addVideo: (v: Video) => Promise<void>;
  updateVideo: (id: string, patch: Partial<Video>) => Promise<void>;
  deleteVideo: (id: string) => Promise<void>;  // 관련 주간 수치도 함께 삭제

  // ── 주간 수치 CRUD ──
  upsertMetric: (m: WeeklyMetric) => Promise<void>;  // 같은 영상+조사일이면 덮어쓰기
  deleteMetric: (videoId: string, surveyDate: string) => Promise<void>;
  deleteSurveyDate: (surveyDate: string) => Promise<void>; // 한 주차 통째 삭제

  // ── 플랫폼 팔로워 ──
  upsertFollower: (f: PlatformFollower) => Promise<void>;

  // ── 초기화 ──
  resetToSeed: () => Promise<void>;
}

const DataContext = createContext<DataContextValue | null>(null);

export function DataProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<DataSnapshot>({ videos: [], metrics: [], followers: [] });
  const [loading, setLoading] = useState(true);
  // 저장소 로딩 중 발생한 오류 메시지 (화면 상단 배너로 안내)
  const [loadError, setLoadError] = useState<string | null>(null);

  // 앱 시작 시: (Supabase면) 로컬 데이터 이전 → 저장소에서 데이터 읽기
  useEffect(() => {
    (async () => {
      try {
        // 예전 브라우저 데이터가 있으면 Supabase로 1회 안전하게 옮깁니다.
        await migrateLocalToSupabase(repository, storageMode);
      } catch {
        // 이전 실패해도 앱은 계속 뜨게 합니다.
      }

      try {
        const d = await repository.load();
        setData(d);
      } catch (err) {
        // ★ 저장소(Supabase) 읽기 실패 — 여기서 멈추지 않고 원인을 화면에 보여줍니다.
        console.error('[데이터 로딩 실패]', err);
        const msg = err instanceof Error ? err.message : String(err);
        setLoadError(msg);

        // 앱이 완전히 먹통이 되지 않도록, 브라우저에 남아있는 로컬 데이터로 폴백합니다.
        try {
          const raw = localStorage.getItem('soulcrane-dashboard-v1');
          if (raw) setData(JSON.parse(raw));
        } catch {
          // 폴백도 실패하면 빈 상태로 두되, 아래에서 로딩은 반드시 해제합니다.
        }
      } finally {
        // 성공하든 실패하든 로딩 화면은 반드시 벗어납니다. (무한 로딩 방지)
        setLoading(false);
      }
    })();
  }, []);

  // 변경 → 저장소에 기록 + 화면 갱신을 한 번에 처리하는 공통 함수
  const commit = async (next: DataSnapshot) => {
    setData(next);
    await repository.save(next);
  };

  const value: DataContextValue = {
    ...data,
    loading,
    loadError,

    addVideo: async (v) => {
      // 같은 ID가 이미 있으면 추가하지 않습니다(중복 방지).
      if (data.videos.some((x) => x.id === v.id)) return;
      await commit({ ...data, videos: [...data.videos, v] });
    },

    updateVideo: async (id, patch) => {
      await commit({
        ...data,
        videos: data.videos.map((v) => (v.id === id ? { ...v, ...patch } : v)),
      });
    },

    deleteVideo: async (id) => {
      // 영상을 지우면 그 영상의 주간 수치도 같이 지웁니다(고아 데이터 방지).
      const next = {
        ...data,
        videos: data.videos.filter((v) => v.id !== id),
        metrics: data.metrics.filter((m) => m.videoId !== id),
      };
      setData(next);
      // Supabase처럼 명시적 삭제가 필요한 저장소는 그 메서드를, 아니면 전체 저장을 씁니다.
      if (repository.deleteVideo) await repository.deleteVideo(id);
      else await repository.save(next);
    },

    upsertMetric: async (m) => {
      const exists = data.metrics.some(
        (x) => x.videoId === m.videoId && x.surveyDate === m.surveyDate,
      );
      await commit({
        ...data,
        metrics: exists
          ? data.metrics.map((x) =>
              x.videoId === m.videoId && x.surveyDate === m.surveyDate ? m : x)
          : [...data.metrics, m],
      });
    },

    deleteMetric: async (videoId, surveyDate) => {
      const next = {
        ...data,
        metrics: data.metrics.filter(
          (m) => !(m.videoId === videoId && m.surveyDate === surveyDate)),
      };
      setData(next);
      if (repository.deleteMetric) await repository.deleteMetric(videoId, surveyDate);
      else await repository.save(next);
    },

    deleteSurveyDate: async (surveyDate) => {
      const next = {
        ...data,
        metrics: data.metrics.filter((m) => m.surveyDate !== surveyDate),
        followers: data.followers.filter((f) => f.surveyDate !== surveyDate),
      };
      setData(next);
      if (repository.deleteSurveyDate) await repository.deleteSurveyDate(surveyDate);
      else await repository.save(next);
    },

    upsertFollower: async (f) => {
      const exists = data.followers.some(
        (x) => x.platform === f.platform && x.surveyDate === f.surveyDate);
      await commit({
        ...data,
        followers: exists
          ? data.followers.map((x) =>
              x.platform === f.platform && x.surveyDate === f.surveyDate ? f : x)
          : [...data.followers, f],
      });
    },

    resetToSeed: async () => {
      const seed = await repository.reset();
      setData(seed);
    },
  };

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

/** 화면에서 데이터를 쓸 때 호출하는 훅. 예) const { videos, metrics } = useData(); */
export function useData(): DataContextValue {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData 는 DataProvider 안에서만 사용할 수 있습니다.');
  return ctx;
}
