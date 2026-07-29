// ────────────────────────────────────────────────────────────────
// Cron/수동 실행 요청 인증
//
// 두 가지 정당한 호출 주체를 구분해서 허용합니다.
//   1) Vercel Cron   → CRON_SECRET (서버 전용 시크릿, 절대 브라우저에 노출되지 않음)
//   2) 관리자 화면    → VITE_ADMIN_TRIGGER_TOKEN ('지금 동기화' 버튼이 브라우저에서 호출)
//      브라우저 코드에 포함되어야 하므로 진짜 비밀은 아니며, 기존 anon 키와 동일한
//      신뢰 모델입니다(링크/앱을 아는 사람은 실행 가능). 목적은 URL을 우연히 발견한
//      외부 요청을 걸러내는 최소한의 방어입니다.
//
// 둘 다 설정되어 있지 않으면(초기 테스트 단계) 인증을 건너뜁니다.
// ────────────────────────────────────────────────────────────────
import type { VercelRequest } from '@vercel/node';

export function isAuthorized(req: VercelRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  const adminToken = process.env.VITE_ADMIN_TRIGGER_TOKEN;

  // 아무 시크릿도 설정하지 않았다면(초기 수동 테스트 단계) 인증을 건너뜁니다.
  if (!cronSecret && !adminToken) return true;

  const authHeader = req.headers['authorization'];
  if (cronSecret && authHeader === `Bearer ${cronSecret}`) return true;
  if (adminToken && authHeader === `Bearer ${adminToken}`) return true;
  return false;
}
