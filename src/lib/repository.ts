// ────────────────────────────────────────────────────────────────
// 데이터 접근 계층 (Repository)
//
// ★ 이 파일의 목적: "데이터를 어디에 저장하는가"를 화면 코드에서 완전히 감추는 것.
//
//   지금은 브라우저 로컬 저장소(localStorage)에 저장합니다.
//   나중에 Supabase로 옮길 때는 아래 DataRepository 인터페이스를 구현한
//   'SupabaseRepository'를 하나 더 만들어 교체하기만 하면 되고,
//   화면(pages/components) 코드는 단 한 줄도 고칠 필요가 없습니다.
// ────────────────────────────────────────────────────────────────
import type { Video, WeeklyMetric, PlatformFollower } from '../types';
import { VIDEOS, WEEKLY_METRICS, PLATFORM_FOLLOWERS } from '../data/seed';

/** 앱이 다루는 데이터 전체 묶음 */
export interface DataSnapshot {
  videos: Video[];
  metrics: WeeklyMetric[];
  followers: PlatformFollower[];
}

/** 저장소가 지켜야 할 약속(인터페이스). Supabase 구현체도 이 모양을 따릅니다. */
export interface DataRepository {
  load(): Promise<DataSnapshot>;
  save(data: DataSnapshot): Promise<void>;
  reset(): Promise<DataSnapshot>;

  // ── 선택적 삭제 메서드 ──
  // 로컬 저장소는 save(전체 스냅샷)만으로 삭제가 반영되지만,
  // Supabase는 '지워진 행'을 따로 알려줘야 하므로 이 메서드들을 구현합니다.
  // (있으면 스토어가 우선 호출하고, 없으면 save 로 대체)
  deleteVideo?(id: string): Promise<void>;
  deleteMetric?(videoId: string, surveyDate: string): Promise<void>;
  deleteSurveyDate?(surveyDate: string): Promise<void>;
}

const STORAGE_KEY = 'soulcrane-dashboard-v1';

/** 시드(엑셀에서 가져온 62개) 원본 사본을 만들어 반환 */
function seedSnapshot(): DataSnapshot {
  return {
    videos: JSON.parse(JSON.stringify(VIDEOS)),
    metrics: JSON.parse(JSON.stringify(WEEKLY_METRICS)),
    followers: JSON.parse(JSON.stringify(PLATFORM_FOLLOWERS)),
  };
}

/**
 * 로컬 저장소 구현 — 지금 단계에서 사용합니다.
 * 브라우저에 저장되므로 새로고침해도 입력한 데이터가 유지됩니다.
 */
export class LocalRepository implements DataRepository {
  async load(): Promise<DataSnapshot> {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw) as DataSnapshot;
    } catch {
      // 저장소를 못 읽으면(사생활 보호 모드 등) 시드로 시작합니다.
    }
    const seed = seedSnapshot();
    await this.save(seed);
    return seed;
  }

  async save(data: DataSnapshot): Promise<void> {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      // 저장 실패는 조용히 무시하고 화면 동작은 계속되게 합니다.
    }
  }

  async reset(): Promise<DataSnapshot> {
    const seed = seedSnapshot();
    await this.save(seed);
    return seed;
  }
}

/**
 * 메모리 구현 — 테스트/미리보기용. 새로고침하면 초기화됩니다.
 */
export class MemoryRepository implements DataRepository {
  private data: DataSnapshot = seedSnapshot();
  async load() { return this.data; }
  async save(d: DataSnapshot) { this.data = d; }
  async reset() { this.data = seedSnapshot(); return this.data; }
}

// ────────────────────────────────────────────────────────────────
// 앱이 실제로 사용할 저장소 — 환경에 따라 자동으로 선택됩니다.
//
//   Supabase 접속 정보(환경변수)가 있으면  → SupabaseRepository (공유 저장)
//   없으면                                  → LocalRepository   (브라우저 저장)
//
// 즉, 아무 설정도 안 하면 지금까지처럼 localStorage로 동작하고,
// .env(또는 Vercel 환경변수)에 접속 정보를 넣는 순간 자동으로 공유 DB로 바뀝니다.
// 코드를 고칠 필요가 없습니다.
// ────────────────────────────────────────────────────────────────
import { supabase } from './supabase';
import { SupabaseRepository } from './supabaseRepository';

export const repository: DataRepository = supabase
  ? new SupabaseRepository(supabase)
  : new LocalRepository();

/** 현재 어떤 저장소를 쓰는지 (화면 안내 배지용) */
export const storageMode: 'supabase' | 'local' = supabase ? 'supabase' : 'local';
