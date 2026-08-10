// ────────────────────────────────────────────────────────────────
// 페이스북 페이지 게시물 자동 수집 (Vercel Serverless Function)
//
// 호출 방법:
// - 수동 테스트: curl -H "Authorization: Bearer <CRON_SECRET>" https://.../api/collect-facebook
// - 자동 실행: vercel.json의 crons 설정 (운영 체크리스트에서 활성화 방법 안내)
//
// 이 파일은 인증 확인 → 동기화 실행 → sync_logs 기록 → 응답, 만 담당합니다.
// 실제 수집 로직은 api/_lib/facebook.ts에 있습니다.
// ────────────────────────────────────────────────────────────────
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabaseAdmin } from './_lib/supabaseAdmin.js';
import { isAuthorized } from './_lib/auth.js';
import { startSyncLog, finishSyncLog } from './_lib/syncLog.js';
import { runFacebookSync } from './_lib/facebook.js';

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
        const result = await runFacebookSync(client);
        const durationMs = Date.now() - startedAt;

      await finishSyncLog(client, startedAt, result);

      const statusCode = result.success ? 200 : 500;
        return res.status(statusCode).json({ ...result, durationMs });
  } catch (err: any) {
        const message = `예기치 못한 오류: ${err?.message ?? String(err)}`;
        await finishSyncLog(client, startedAt, {
                platform: 'facebook', success: false, processedCount: 0, newVideoCount: 0,
                errorMessage: message, warnings: [],
        });
        return res.status(500).json({ error: message });
  }
}
