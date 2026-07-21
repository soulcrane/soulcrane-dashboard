// ────────────────────────────────────────────────────────────────
// Supabase 클라이언트
//
// 접속 정보는 코드에 직접 쓰지 않고 '환경변수'로 주입합니다.
//   - 로컬 개발: 프로젝트 루트에 .env 파일
//   - Vercel 배포: 프로젝트 Settings → Environment Variables
//
// 필요한 값 2개:
//   VITE_SUPABASE_URL         = https://xxxx.supabase.co
//   VITE_SUPABASE_ANON_KEY    = 접속 키
//
// ※ 키 이름 호환:
//   Supabase가 최근 키 이름을 바꿔서, 화면에 'anon / public' 대신
//   'Publishable key'(sb_publishable_...)로 보일 수 있습니다. 둘 다 사용 가능합니다.
//   또한 사람마다 환경변수 이름을 다르게 적는 경우가 있어(_ANON_KEY / _PUBLISHABLE_KEY 등)
//   아래에서 흔한 이름들을 모두 확인해, 이름 불일치로 연결이 안 되는 실수를 막습니다.
//
// 환경변수가 없으면 null 을 반환하고, 앱은 자동으로 로컬 저장소로 동작합니다.
// ────────────────────────────────────────────────────────────────
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const env = import.meta.env as Record<string, string | undefined>;

// URL — 흔히 쓰는 이름들을 모두 확인
const url =
  env.VITE_SUPABASE_URL ||
  env.VITE_SUPABASE_PROJECT_URL ||
  undefined;

// 키 — anon / publishable 등 이름이 달라도 잡히도록
const key =
  env.VITE_SUPABASE_ANON_KEY ||
  env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  env.VITE_SUPABASE_KEY ||
  env.VITE_SUPABASE_PUBLIC_KEY ||
  undefined;

// 값을 앞뒤 공백 없이 정리 (복사·붙여넣기 시 흔한 실수 방지). 값 자체는 로그에 남기지 않습니다.
const cleanUrl = url?.trim().replace(/\/+$/, '');   // 끝 슬래시 제거
const cleanKey = key?.trim();

// 두 값이 모두 있을 때만 실제 클라이언트를 만듭니다.
export const supabase: SupabaseClient | null =
  cleanUrl && cleanKey ? createClient(cleanUrl, cleanKey) : null;

/** Supabase가 연결되어 있는지 (화면 안내·저장소 선택에 사용) */
export const isSupabaseEnabled = supabase !== null;

// 개발 편의: 어떤 값이 '감지됐는지'만 콘솔에 남깁니다. (키 값 자체는 절대 출력하지 않음)
if (typeof window !== 'undefined') {
  // eslint-disable-next-line no-console
  console.info(
    `[Supabase] URL 감지: ${cleanUrl ? '있음' : '없음'} · 키 감지: ${cleanKey ? '있음' : '없음'} · ` +
    `모드: ${supabase ? 'Supabase(공유 DB)' : 'localStorage(로컬)'}`,
  );
}
