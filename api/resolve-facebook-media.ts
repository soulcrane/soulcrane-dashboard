// ────────────────────────────────────────────────────────────────
// 페이스북 게시물 URL을 실제 Graph API 게시물 ID로 변환
//
// 페이스북 공유 링크의 숫자 ID는 형식이 제각각이라(watch/?v=, /videos/, /posts/ 등)
// Graph API가 반환하는 실제 게시물 id와 다를 수 있습니다. 이 함수는 연결된
// 페이지의 게시물 목록을 페이지네이션하며 permalink_url 또는 id에 URL 속
// 숫자열이 포함된 항목을 찾아 실제 게시물 ID를 반환합니다.
//
// 호출 방법: GET /api/resolve-facebook-media?url=<페이스북 게시물 URL>
// ────────────────────────────────────────────────────────────────
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabaseAdmin } from './_lib/supabaseAdmin.js';
import { isAuthorized } from './_lib/auth.js';

const GRAPH_API = 'https://graph.facebook.com/v20.0';
const MAX_PAGES = 10;

function extractToken(input: string): string {
  const trimmed = input.trim();
  const matches = trimmed.match(/\d{6,}/g) || [];
  return matches.sort((a, b) => b.length - a.length)[0] || trimmed;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!isAuthorized(req)) {
    return res.status(401).json({ error: '인증되지 않은 요청입니다. Authorization 헤더를 확인해 주세요.' });
  }

  const urlParam = Array.isArray(req.query.url) ? req.query.url[0] : req.query.url;
  if (!urlParam) {
    return res.status(400).json({ error: 'url 쿼리 파라미터가 필요합니다.' });
  }
  const token = extractToken(urlParam);

  const { client, missing } = getSupabaseAdmin();
  if (!client) {
    return res.status(500).json({ error: `환경변수 누락: ${missing.join(', ')}` });
  }

  const { data: setting, error: settingError } = await client
    .from('automation_settings')
    .select('external_account_id')
    .eq('platform', 'facebook')
    .maybeSingle();

  if (settingError || !setting?.external_account_id) {
    return res.status(400).json({ error: '페이스북 페이지 ID가 자동화 설정에 등록되어 있지 않습니다.' });
  }
  const pageId = setting.external_account_id;
  const accessToken = process.env.FACEBOOK_ACCESS_TOKEN;
  if (!accessToken) {
    return res.status(500).json({ error: 'FACEBOOK_ACCESS_TOKEN 환경변수가 설정되어 있지 않습니다.' });
  }

  let nextUrl: string | null =
    `${GRAPH_API}/${pageId}/posts?fields=id,permalink_url&limit=50&access_token=${accessToken}`;
  let pagesChecked = 0;
  let postsChecked = 0;

  try {
    while (nextUrl && pagesChecked < MAX_PAGES) {
      const resp = await fetch(nextUrl);
      const json: any = await resp.json();
      if (json.error) {
        return res.status(502).json({ error: `Graph API 오류: ${json.error.message}` });
      }
      const items: Array<{ id: string; permalink_url?: string }> = json.data || [];
      postsChecked += items.length;
      const found = items.find(
        (it) => (it.permalink_url && it.permalink_url.includes(token)) || (it.id && it.id.includes(token))
      );
      if (found) {
        return res.status(200).json({ success: true, mediaId: found.id, permalink: found.permalink_url });
      }
      nextUrl = json.paging?.next || null;
      pagesChecked += 1;
    }
  } catch (e) {
    return res.status(500).json({ error: `조회 중 오류: ${(e as Error).message}` });
  }

  return res.status(404).json({
    success: false,
    error: `최근 게시물 ${postsChecked}개 안에서 해당 링크를 찾지 못했습니다. 게시물이 너무 오래되었거나, 이 페이지가 아닌 다른 페이지의 게시물일 수 있습니다.`,
  });
}
