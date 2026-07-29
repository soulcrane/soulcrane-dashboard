// ────────────────────────────────────────────────────────────────
// YouTube 성과/신규 영상 자동 수집 (Vercel Serverless Function)
//
// 호출 방법:
//   - 수동 테스트: curl -H "Authorization: Bearer <CRON_SECRET>" https://.../api/collect-youtube
//   - 자동 실행:   vercel.json의 crons 설정 (운영 체크리스트에서 활성화 방법 안내)
//
// 이 파일은 인증 확인 → 동기화 실행 → sync_logs 기록 → 응답, 만 담당합니다.
// 실제 수집 로직은 api/_lib/youtube.ts에 있고, 다른 플랫폼(인스타/페북/틱톡)도
// 같은 패턴(api/_lib/{platform}.ts + 이런 얇은 핸들러)으로 추가하면 됩니다.
// ────────────────────────────────────────────────────────────────
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabaseAdmin } from './_lib/supabaseAdmin.js';
import { isAuthorized } from './_lib/auth.js';
import { startSyncLog, finishSyncLog } from './_lib/syncLog.js';
import { runYoutubeSync } from './_lib/youtube.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!isAuthorized(req)) {
    return res.status(401).json({ error: '인증되지 않은 요청입니다. Authorization 헤더를 확인해 주세요.' });
  }

  const { client, missing } = getSupabaseAdmin();
  if (!client) {
    return res.status(500).json({ error: `환경변수가 설정되지 않았습니다: ${missing.join(', ')}` });
  }

  const { startedAt } = startSyncLog();

  try {
    const result = await runYoutubeSync(client);
    const durationMs = Date.now() - startedAt;

    await finishSyncLog(client, startedAt, result);

    const statusCode = result.success ? 200 : 500;
    return res.status(statusCode).json({ ...result, durationMs });
  } catch (err: any) {
    // runYoutubeSync 내부에서 잡히지 않은 예기치 못한 오류 — 그래도 로그는 남기고 500 응답
    const message = `예기치 못한 오류: ${err?.message ?? String(err)}`;
    await finishSyncLog(client, startedAt, {
      platform: 'youtube', success: false, processedCount: 0, newVideoCount: 0,
      errorMessage: message, warnings: [],
    });
    return res.status(500).json({ error: message });
  }
}
