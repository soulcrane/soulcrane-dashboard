// ────────────────────────────────────────────────────────────────
// service_role 키로 동작하는 Supabase 관리자 클라이언트
// 모든 플랫폼 수집기(api/collect-*.ts)가 공통으로 이 함수를 사용합니다.
// ────────────────────────────────────────────────────────────────
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export function getSupabaseAdmin(): { client: SupabaseClient | null; missing: string[] } {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  const missing: string[] = [];
  if (!supabaseUrl) missing.push('SUPABASE_URL');
  if (!serviceRoleKey) missing.push('SUPABASE_SERVICE_ROLE_KEY');

  if (missing.length > 0) return { client: null, missing };

  return { client: createClient(supabaseUrl as string, serviceRoleKey as string), missing };
}
