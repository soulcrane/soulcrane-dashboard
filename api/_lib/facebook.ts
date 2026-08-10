// ────────────────────────────────────────────────────────────────
// 페이스북 페이지 게시물 자동 수집 핵심 로직
//
// 1) automation_settings에서 페이스북 페이지 ID(external_account_id)를 읽는다
// 2) {page-id}/posts 에서 최근 게시물 목록을 페이지 단위로 가져온다
//    (reactions/comments 총계를 함께 조회)
// 3) DB에 이미 등록된 페이스북 게시물 + 새로 발견된 게시물을 합쳐서
//    좋아요/댓글 수를 갱신하고, 신규 게시물은 등록한다
// 4) 조회수(views)는 페이지 인사이트 권한(read_insights)이 있어야 조회 가능하므로
//    현재는 0으로 두고 있습니다. 필요하면 {post-id}/insights 조회를 추가하세요.
// 5) 개별 게시물/배치 단위 오류는 건너뛰고 계속 진행 (전체 중단 없음)
// ────────────────────────────────────────────────────────────────
import type { SupabaseClient } from '@supabase/supabase-js';
import type { SyncResult } from './types';

const GRAPH_API = 'https://graph.facebook.com/v20.0';

interface ExistingPost {
    id: string;
    external_video_id: string;
}

interface DiscoveredPost {
    externalPostId: string;
    message: string;
    createdTime: string;
    permalink: string;
    likeCount: number;
    commentCount: number;
}

async function fetchRecentPosts(
    pageId: string,
    accessToken: string,
    maxPages: number,
    warnings: string[],
  ): Promise<DiscoveredPost[]> {
    const items: DiscoveredPost[] = [];
    let after = '';
    const fields = 'id,message,created_time,permalink_url,reactions.summary(true).limit(0),comments.summary(true).limit(0)';

  for (let page = 0; page < maxPages; page++) {
        const url =
                `${GRAPH_API}/${pageId}/posts?fields=${fields}&limit=25&access_token=${accessToken}` +
                (after ? `&after=${after}` : '');

      try {
              const resp = await fetch(url);
              const json: any = await resp.json();
              if (!resp.ok) {
                        warnings.push(`게시물 목록 조회 실패(page ${page + 1}): ${json?.error?.message ?? resp.statusText}`);
                        break;
              }
              for (const it of json.data ?? []) {
                        items.push({
                                    externalPostId: it.id,
                                    message: it.message ?? '(내용 없음)',
                                    createdTime: it.created_time ?? new Date().toISOString(),
                                    permalink: it.permalink_url ?? '',
                                    likeCount: Number(it.reactions?.summary?.total_count ?? 0),
                                    commentCount: Number(it.comments?.summary?.total_count ?? 0),
                        });
              }
              after = json.paging?.cursors?.after;
              if (!after || !json.paging?.next) break;
      } catch (err: any) {
              warnings.push(`게시물 목록 조회 중 네트워크 오류(page ${page + 1}): ${err?.message ?? String(err)}`);
              break;
      }
  }
    return items;
}

export async function runFacebookSync(client: SupabaseClient): Promise<SyncResult> {
    const warnings: string[] = [];
    const accessToken = process.env.FACEBOOK_ACCESS_TOKEN;

  if (!accessToken) {
        return {
                platform: 'facebook', success: false, processedCount: 0, newVideoCount: 0,
                errorMessage: 'FACEBOOK_ACCESS_TOKEN 환경변수가 설정되지 않았습니다.', warnings, durationMs: 0,
        };
  }

  const { data: setting, error: settingError } = await client
      .from('automation_settings')
      .select('enabled, external_account_id')
      .eq('platform', 'facebook')
      .maybeSingle();

  if (settingError) {
        return {
                platform: 'facebook', success: false, processedCount: 0, newVideoCount: 0,
                errorMessage: `automation_settings 조회 실패: ${settingError.message}`, warnings, durationMs: 0,
        };
  }
    if (!setting || !setting.enabled) {
          return {
                  platform: 'facebook', success: true, processedCount: 0, newVideoCount: 0,
                  warnings: ['자동화가 비활성화 상태입니다. 관리자 화면(자동화 설정)에서 활성화해 주세요.'],
                  durationMs: 0,
          };
    }
    const pageId: string | null = setting.external_account_id || null;
    if (!pageId) {
          return {
                  platform: 'facebook', success: true, processedCount: 0, newVideoCount: 0,
                  warnings: ['페이스북 페이지 ID가 설정되지 않아(관리자 화면 → 자동화 설정) 수집을 건너뜁니다.'],
                  durationMs: 0,
          };
    }

  const { data: existingRows, error: existingError } = await client
      .from('videos')
      .select('id, external_video_id')
      .eq('platform', 'facebook')
      .not('external_video_id', 'is', null);

  if (existingError) {
        return {
                platform: 'facebook', success: false, processedCount: 0, newVideoCount: 0,
                errorMessage: `videos 조회 실패: ${existingError.message}`, warnings, durationMs: 0,
        };
  }
    const existing = (existingRows ?? []) as ExistingPost[];
    const existingByExternalId = new Map(existing.map((v) => [v.external_video_id, v.id]));

  const discovered = await fetchRecentPosts(pageId, accessToken, 5, warnings);

  if (discovered.length === 0) {
        return {
                platform: 'facebook', success: true, processedCount: 0, newVideoCount: 0,
                warnings: [...warnings, '수집 대상 게시물이 없습니다.'], durationMs: 0,
        };
  }

  const surveyDate = new Date().toISOString().slice(0, 10);
    const newVideoRows: any[] = [];
    const metricRows: any[] = [];
    let newVideoCount = 0;
    let processedCount = 0;

  for (const item of discovered) {
        try {
                const internalId = existingByExternalId.get(item.externalPostId);
                const views = 0;

          if (internalId) {
                    metricRows.push({
                                video_id: internalId, survey_date: surveyDate,
                                views, likes: item.likeCount, comments: item.commentCount, source: 'api',
                    });
                    processedCount++;
          } else {
                    const newInternalId = `FB_${item.externalPostId}`;
                    const title = item.message.length > 0 ? item.message.slice(0, 200) : '(내용 없음)';

                  newVideoRows.push({
                              id: newInternalId,
                              platform: 'facebook',
                              content_type: 'long',
                              management_group: 'platform',
                              title,
                              content_group: null,
                              upload_date: item.createdTime.slice(0, 10),
                              url: item.permalink,
                              external_video_id: item.externalPostId,
                              source_title: title,
                  });
                    metricRows.push({
                                video_id: newInternalId, survey_date: surveyDate,
                                views, likes: item.likeCount, comments: item.commentCount, source: 'api',
                    });
                    newVideoCount++;
                    processedCount++;
          }
        } catch (err: any) {
                warnings.push(`${item.externalPostId}: 처리 중 오류로 건너뜀 - ${err?.message ?? String(err)}`);
        }
  }

  if (newVideoRows.length > 0) {
        const { error: insertError } = await client
          .from('videos')
          .upsert(newVideoRows, { onConflict: 'platform,external_video_id' });
        if (insertError) {
                return {
                          platform: 'facebook', success: false, processedCount, newVideoCount: 0,
                          errorMessage: `신규 게시물 등록 실패: ${insertError.message}`, warnings, durationMs: 0,
                };
        }
  }

  if (metricRows.length > 0) {
        const { error: metricsError } = await client
          .from('weekly_metrics')
          .upsert(metricRows, { onConflict: 'video_id,survey_date' });
        if (metricsError) {
                return {
                          platform: 'facebook', success: false, processedCount, newVideoCount,
                          errorMessage: `weekly_metrics 저장 실패: ${metricsError.message}`, warnings, durationMs: 0,
                };
        }
  }

  return {
        platform: 'facebook',
        success: true,
        processedCount,
        newVideoCount,
        warnings,
        durationMs: 0,
        surveyDate,
  };
}
