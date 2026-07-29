// ────────────────────────────────────────────────────────────────
// 로컬 → Supabase 데이터 이전(마이그레이션) 도우미
//
// ★ 왜 필요한가:
//   그동안 브라우저(localStorage)에 쌓아 온 데이터가 있는데, Supabase를 처음 연결하면
//   DB는 비어 있습니다. 이때 자동으로 옛 로컬 데이터를 DB로 한 번 올려 주지 않으면
//   "내가 입력한 데이터가 사라진 것처럼" 보입니다. 이 함수가 그 이전을 안전하게 처리합니다.
//
//   동작:
//   - Supabase를 쓰는 경우에만 실행됩니다.
//   - localStorage에 예전 데이터가 있고, 아직 이전한 적이 없으면(플래그 확인) 1회만 올립니다.
//   - 이전이 끝나면 플래그를 남겨 다시 올리지 않습니다(중복 방지).
//   - 로컬 데이터는 지우지 않고 그대로 둡니다(안전장치: 문제가 생겨도 원본이 남음).
// ────────────────────────────────────────────────────────────────
import type { DataRepository, DataSnapshot } from './repository';

const LOCAL_KEY = 'soulcrane-dashboard-v1';
const MIGRATED_FLAG = 'soulcrane-migrated-to-supabase';

/**
 * 필요 시 로컬 데이터를 Supabase로 1회 이전합니다.
 * @returns 이전을 수행했으면 true (호출 측에서 다시 load 하도록)
 */
export async function migrateLocalToSupabase(
  repository: DataRepository,
  storageMode: 'supabase' | 'local',
): Promise<boolean> {
  // Supabase를 쓰지 않으면 이전할 필요 없음
  if (storageMode !== 'supabase') return false;
  // 이미 이전했으면 건너뜀
  if (localStorage.getItem(MIGRATED_FLAG)) return false;

  let local: DataSnapshot | null = null;
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (raw) local = JSON.parse(raw) as DataSnapshot;
  } catch {
    local = null;
  }

  // 올릴 로컬 데이터가 없으면(처음부터 Supabase로 시작한 사용자) 그냥 플래그만 남김
  if (!local || local.videos.length === 0) {
    localStorage.setItem(MIGRATED_FLAG, new Date().toISOString());
    return false;
  }

  // 현재 DB 상태를 읽어, 로컬 쪽이 더 많은 데이터를 갖고 있을 때만 올립니다.
  // (다른 사람이 이미 더 많은 데이터를 넣어 둔 DB를 로컬 것으로 덮어쓰지 않기 위함)
  try {
    const remote = await repository.load();
    const localTotal = local.videos.length + local.metrics.length;
    const remoteTotal = remote.videos.length + remote.metrics.length;

    if (localTotal > remoteTotal) {
      // 로컬 + 원격을 합쳐 올립니다(둘 다 살림). 같은 키는 로컬 값으로 갱신됩니다.
      const merged = mergeSnapshots(remote, local);
      await repository.save(merged);
    }
    localStorage.setItem(MIGRATED_FLAG, new Date().toISOString());
    return true;
  } catch {
    // DB 접근 실패 시 이전을 미룹니다(플래그를 남기지 않아 다음에 재시도).
    return false;
  }
}

/** 두 스냅샷을 합칩니다. 같은 키(영상 id / 수치 video+date / 팔로워 platform+date)는 b 우선. */
function mergeSnapshots(a: DataSnapshot, b: DataSnapshot): DataSnapshot {
  const videoMap = new Map(a.videos.map((v) => [v.id, v]));
  b.videos.forEach((v) => videoMap.set(v.id, v));

  const metricMap = new Map(a.metrics.map((m) => [`${m.videoId}__${m.surveyDate}`, m]));
  b.metrics.forEach((m) => metricMap.set(`${m.videoId}__${m.surveyDate}`, m));

  const followerMap = new Map(a.followers.map((f) => [`${f.platform}__${f.surveyDate}`, f]));
  b.followers.forEach((f) => followerMap.set(`${f.platform}__${f.surveyDate}`, f));

  return {
    videos: [...videoMap.values()],
    metrics: [...metricMap.values()],
    followers: [...followerMap.values()],
  };
}
