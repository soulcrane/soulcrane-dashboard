// ────────────────────────────────────────────────────────────────
// 자동화 환경 상태 조회 (Vercel Serverless Function)
//
// 관리자 화면(자동화 설정)에서 "API Key 설정 여부", "Supabase 연결 상태" 등을
// 보여주기 위한 엔드포인트입니다. 실제 비밀값은 절대 반환하지 않고,
// "설정되어 있는지(boolean)"만 반환하므로 인증 없이 공개해도 안전합니다.
// ────────────────────────────────────────────────────────────────
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  return res.status(200).json({
    supabase: {
      urlSet: Boolean(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL),
      serviceRoleKeySet: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    },
    auth: {
      cronSecretSet: Boolean(process.env.CRON_SECRET),
      adminTriggerTokenSet: Boolean(process.env.VITE_ADMIN_TRIGGER_TOKEN),
    },
    platforms: {
      youtube: { apiKeySet: Boolean(process.env.YOUTUBE_API_KEY) },
      // 향후 플랫폼 추가 시 여기에 한 줄씩 추가:
      // instagram: { apiKeySet: Boolean(process.env.INSTAGRAM_ACCESS_TOKEN) },
      // facebook:  { apiKeySet: Boolean(process.env.FACEBOOK_ACCESS_TOKEN) },
      // tiktok:    { apiKeySet: Boolean(process.env.TIKTOK_ACCESS_TOKEN) },
    },
  });
}
