// ────────────────────────────────────────────────────────────────
// 인스타그램(Business 계정) 자동 수집 핵심 로직
//
// 1) automation_settings에서 인스타그램 비즈니스 계정 ID(external_account_id)를 읽는다
//    (Business Suite 화면에 보이는 ID가 아니라, 연결된 페이지의
//     instagram_business_account.id 값이어야 합니다 — 운영 체크리스트 참고)
// 2) {ig-user-id}/media 에서 최근 미디어 목록을 페이지 단위로 가져온다
// 3) DB에 이미 등록된 인스타그램 게시물 + 새로 발견된 게시물을 합쳐서
//    좋아요/댓글 수를 갱신하고, 신규 게시물은 등록한다
// 4) 영상형(REELS/VIDEO) 게시물은 조회수(plays) insights를 추가로 시도하되,
//    실패해도 전체를 중단하지 않고 0으로 두고 경고만 남긴다
// 5) 개별 게시물/배치 단위 오류는 건너뛰고 계속 진행 (전체 중단 없음)
// ────────────────────────────────────────────────────────────────
import type { SupabaseClient } from '@supabase/supabase-js';
import type { SyncResult } from './types';

const GRAPH_API = 'https://graph.facebook.com/v20.0';

interface ExistingMedia {
    id: string;
    external_video_id: string;
}

interface DiscoveredMedia {
    externalMediaId: string;
    caption: string;
    timestamp: string;
    mediaType: string;
    permalink: string;
    likeCount: number;
    commentCount: number;
}

function classifyContentType(mediaType: string): 'short' | 'long' {
    return mediaType === 'REELS' || mediaType === 'VIDEO' ? 'short' : 'long';
}

async function fetchPlayCount(mediaId: string, accessToken: string): Promise<number | null> {
    try {
          const url = `${GRAPH_API}/${mediaId}/insights?metric=plays&access_token=${accessToken}`;
          const resp = await fetch(url);
          const json: any = await resp.json();
          if (!resp.ok) return null;
          const value = json?.data?.[0]?.values?.[0]?.value;
          return typeof value === 'number' ? value : null;
    } catch {
          return null;
    }
}

async function fetchRecentMedia(
    igUserId: string,
    accessToken: string,
    maxPages: number,
    warnings: string[],
  ): Promise<DiscoveredMedia[]> {
    const items: DiscoveredMedia[] = [];
    let after = '';
    const fields = 'id,caption,media_type,timestamp,permalink,like_count,comments_count';

  for (let page = 0; page < maxPages; page++) {
        const url =
                `${GRAPH_API}/${igUserId}/media?fields=${fields}&limit=25&access_token=${accessToken}` +
                (after ? `&after=${after}` : '');

      try {
              const resp = await fetch(url);
              const json: any = await resp.json();
              if (!resp.ok) {
                        warnings.push(`미디어 목록 조회 실패(page ${page + 1}): ${json?.error?.message ?? resp.statusText}`);
                        break;
              }
              for (const it of json.data ?? []) {
                        items.push({
                                    externalMediaId: it.id,
                                    caption: it.caption ?? '(캡션 없음)',
                                    timestamp: it.timestamp ?? new Date().toISOString(),
                                    mediaType: it.media_type ?? 'IMAGE',
                                    permalink: it.permalink ?? '',
                                    likeCount: Number(it.like_count ?? 0),
                                    commentCount: Number(it.comments_count ?? 0),
                        });
              }
              after = json.paging?.cursors?.after;
              if (!after || !json.paging?.next) break;
      } catch (err: any) {
              warnings.push(`미디어 목록 조회 중 네트워크 오류(page ${page + 1}): ${err?.message ?? String(err)}`);
              break;
      }
  }
    return items;
}

export async function runInstagramSync(client: SupabaseClient): Promise<SyncResult> {
    const warnings: string[] = [];
    const accessToken = process.env.INSTAGRAM_ACCESS_TOKEN;

  if (!accessToken) {
        return {
                platform: 'instagram', success: false, processedCount: 0, newVideoCount: 0,
                errorMessage: 'INSTAGRAM_ACCESS_TOKEN 환경변수가 설정되지 않았습니다.', warnings, durationMs: 0,
        };
  }

  const { data: setting, error: settingError } = await client
      .from('automation_settings')
      .select('enabled, external_account_id')
      .eq('platform', 'instagram')
      .maybeSingle();

  if (settingError) {
        return {
                platform: 'instagram', success: false, processedCount: 0, newVideoCount: 0,
                errorMessage: `automation_settings 조회 실패: ${settingError.message}`, warnings, durationMs: 0,
        };
  }
    if (!setting || !setting.enabled) {
          return {
                  platform: 'instagram', success: true, processedCount: 0, newVideoCount: 0,
                  warnings: ['자동화가 비활성화 상태입니다. 관리자 화면(자동화 설정)에서 활성화해 주세요.'],
                  durationMs: 0,
          };
    }
    const igUserId: string | null = setting.external_account_id || null;
    if (!igUserId) {
          return {
                  platform: 'instagram', success: true, processedCount: 0, newVideoCount: 0,
                  warnings: ['인스타그램 비즈니스 계정 ID가 설정되지 않아(관리자 화면 → 자동화 설정) 수집을 건너뜁니다.'],
                  durationMs: 0,
          };
    }

  const { data: existingRows, error: existingError } = await client
      .from('videos')
      .select('id, external_video_id')
      .eq('platform', 'instagram')
      .not('external_video_id', 'is', null);

  if (existingError) {
        return {
                platform: 'instagram', success: false, processedCount: 0, newVideoCount: 0,
                errorMessage: `videos 조회 실패: ${existingError.message}`, warnings, durationMs: 0,
        };
  }
    const existing = (existingRows ?? []) as ExistingMedia[];
    const existingByExternalId = new Map(existing.map((v) => [v.external_video_id, v.id]));

  const discovered = await fetchRecentMedia(igUserId, accessToken, 5, warnings);

  if (discovered.length === 0) {
        return {
                platform: 'instagram', success: true, processedCount: 0, newVideoCount: 0,
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
                const isVideo = item.mediaType === 'REELS' || item.mediaType === 'VIDEO';
                let views = 0;
                if (isVideo) {
                          const plays = await fetchPlayCount(item.externalMediaId, accessToken);
                          if (plays === null) {
                                      warnings.push(`${item.externalMediaId}: 조회수(insights) 조회 실패 — 0으로 처리`);
                          } else {
                                      views = plays;
                          }
                }

          const internalId = existingByExternalId.get(item.externalMediaId);

          if (internalId) {
                    metricRows.push({
                                video_id: internalId, survey_date: surveyDate,
                                views, likes: item.likeCount, comments: item.commentCount, source: 'api',
                    });
                    processedCount++;
          } else {
                    const contentType = classifyContentType(item.mediaType);
                    const newInternalId = `IG_${item.externalMediaId}`;
                    const title = item.caption.length > 0 ? item.caption.slice(0, 200) : '(캡션 없음)';

                  newVideoRows.push({
                              id: newInternalId,
                              platform: 'instagram',
                              content_type: contentType,
                              management_group: 'platform',
                              title,
                              content_group: null,
                              upload_date: item.timestamp.slice(0, 10),
                              url: item.permalink,
                              external_video_id: item.externalMediaId,
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
                warnings.push(`${item.externalMediaId}: 처리 중 오류로 건너뜀 - ${err?.message ?? String(err)}`);
        }
  }

  if (newVideoRows.length > 0) {
        const { error: insertError } = await client
          .from('videos')
          .upsert(newVideoRows, { onConflict: 'platform,external_video_id' });
        if (insertError) {
                return {
                          platform: 'instagram', success: false, processedCount, newVideoCount: 0,
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
                          platform: 'instagram', success: false, processedCount, newVideoCount,
                          errorMessage: `weekly_metrics 저장 실패: ${metricsError.message}`, warnings, durationMs: 0,
                };
        }
  }

  return {
        platform: 'instagram',
        success: true,
        processedCount,
        newVideoCount,
        warnings,
        durationMs: 0,
        surveyDate,
  };
}
