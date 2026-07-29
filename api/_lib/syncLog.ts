// ────────────────────────────────────────────────────────────────
// sync_logs 기록 도우미
// 실행 시작 시각을 잡아두고, 끝나면(성공/실패 상관없이) 한 행을 기록합니다.
// ────────────────────────────────────────────────────────────────
import type { SupabaseClient } from '@supabase/supabase-js';
import type { SyncResult } from './types';

/** 실행 시작 시각을 기록. 반환값을 finishSyncLog에 그대로 넘기세요. */
export function startSyncLog() {
  return { startedAt: Date.now() };
}

/**
 * 실행 결과를 sync_logs 테이블에 기록합니다.
 * 이 함수 자체가 실패해도(DB 접속 문제 등) 예외를 던지지 않고 콘솔에만 남깁니다.
 * — 로그 기록 실패가 본 작업의 성공/실패에 영향을 주면 안 되기 때문입니다.
 */
export async function finishSyncLog(
  client: SupabaseClient,
  startedAt: number,
  result: Omit<SyncResult, 'durationMs'>,
): Promise<void> {
  const durationMs = Date.now() - startedAt;
  try {
    await client.from('sync_logs').insert({
      platform: result.platform,
      started_at: new Date(startedAt).toISOString(),
      finished_at: new Date().toISOString(),
      duration_ms: durationMs,
      success: result.success,
      processed_count: result.processedCount,
      new_video_count: result.newVideoCount,
      error_message: result.errorMessage ?? null,
      warnings: result.warnings.length > 0 ? result.warnings : null,
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[sync_logs 기록 실패]', err);
  }
}
