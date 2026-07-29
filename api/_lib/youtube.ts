// ────────────────────────────────────────────────────────────────
// 유튜브 자동 수집 핵심 로직
//
//   1) 채널의 업로드 재생목록에서 최근 영상 목록을 가져온다 (신규 발견용)
//   2) DB에 이미 등록된 유튜브 영상 + 새로 발견된 영상을 합쳐서
//      videos.list(part=snippet,contentDetails,statistics)로 상세/통계 조회
//      (최대 50개씩 배치)
//   3) DB에 없는 영상 → videos에 신규 등록 + 최초 weekly_metrics 생성
//      DB에 있는 영상   → weekly_metrics만 갱신 (title은 절대 건드리지 않음)
//   4) 개별 영상/배치 단위 오류는 건너뛰고 계속 진행 (전체 중단 없음)
// ────────────────────────────────────────────────────────────────
import type { SupabaseClient } from '@supabase/supabase-js';
import type { SyncResult } from './types';

const YT_API = 'https://www.googleapis.com/youtube/v3';

interface ExistingVideo {
  id: string;              // 내부 videoId
  external_video_id: string;
}

interface DiscoveredItem {
  externalVideoId: string;
  title: string;
  publishedAt: string; // ISO datetime
}

/** ISO 8601 duration('PT1M3S' 등)을 초 단위로 변환. 실패하면 null. */
function parseDurationSeconds(iso: string | undefined): number | null {
  if (!iso) return null;
  const m = iso.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!m) return null;
  const [, h, min, s] = m;
  return (Number(h ?? 0) * 3600) + (Number(min ?? 0) * 60) + Number(s ?? 0);
}

function buildYoutubeUrl(externalId: string, contentType: 'short' | 'long'): string {
  return contentType === 'short'
    ? `https://www.youtube.com/shorts/${externalId}`
    : `https://www.youtube.com/watch?v=${externalId}`;
}

/** 채널의 업로드 재생목록 ID를 조회 */
async function fetchUploadsPlaylistId(channelId: string, apiKey: string): Promise<string> {
  const url = `${YT_API}/channels?part=contentDetails&id=${encodeURIComponent(channelId)}&key=${apiKey}`;
  const resp = await fetch(url);
  const json: any = await resp.json();
  if (!resp.ok) throw new Error(json?.error?.message ?? resp.statusText);
  const playlistId = json.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
  if (!playlistId) throw new Error('채널의 업로드 재생목록을 찾을 수 없습니다. 관리자 화면(자동화 설정)의 채널 ID를 확인해 주세요.');
  return playlistId;
}

/** 업로드 재생목록에서 최근 영상 목록을 페이지 단위로 조회 (최대 maxPages * 50개) */
async function fetchRecentUploads(
  playlistId: string,
  apiKey: string,
  maxPages: number,
  warnings: string[],
): Promise<DiscoveredItem[]> {
  const items: DiscoveredItem[] = [];
  let pageToken = '';

  for (let page = 0; page < maxPages; page++) {
    const url =
      `${YT_API}/playlistItems?part=snippet&maxResults=50&playlistId=${encodeURIComponent(playlistId)}` +
      `&key=${apiKey}` + (pageToken ? `&pageToken=${pageToken}` : '');

    try {
      const resp = await fetch(url);
      const json: any = await resp.json();
      if (!resp.ok) {
        warnings.push(`업로드 목록 조회 실패(page ${page + 1}): ${json?.error?.message ?? resp.statusText}`);
        break; // 이번 페이지부터는 신뢰할 수 없으므로 중단하되, 지금까지 모은 건 사용
      }
      for (const it of json.items ?? []) {
        const externalVideoId = it.snippet?.resourceId?.videoId;
        if (!externalVideoId) continue;
        items.push({
          externalVideoId,
          title: it.snippet?.title ?? '(제목 없음)',
          publishedAt: it.snippet?.publishedAt ?? new Date().toISOString(),
        });
      }
      pageToken = json.nextPageToken;
      if (!pageToken) break;
    } catch (err: any) {
      warnings.push(`업로드 목록 조회 중 네트워크 오류(page ${page + 1}): ${err?.message ?? String(err)}`);
      break;
    }
  }
  return items;
}

export async function runYoutubeSync(client: SupabaseClient): Promise<SyncResult> {
  const warnings: string[] = [];
  const apiKey = process.env.YOUTUBE_API_KEY;

  if (!apiKey) {
    return {
      platform: 'youtube', success: false, processedCount: 0, newVideoCount: 0,
      errorMessage: 'YOUTUBE_API_KEY 환경변수가 설정되지 않았습니다.', warnings, durationMs: 0,
    };
  }

  // ── 0) 자동화 설정 조회 (관리자 화면에서 코드 수정 없이 바꾸는 값들) ──
  const { data: setting, error: settingError } = await client
    .from('automation_settings')
    .select('enabled, external_account_id')
    .eq('platform', 'youtube')
    .maybeSingle();

  if (settingError) {
    return {
      platform: 'youtube', success: false, processedCount: 0, newVideoCount: 0,
      errorMessage: `automation_settings 조회 실패: ${settingError.message}`, warnings, durationMs: 0,
    };
  }
  if (!setting || !setting.enabled) {
    return {
      platform: 'youtube', success: true, processedCount: 0, newVideoCount: 0,
      warnings: ['자동화가 비활성화 상태입니다. 관리자 화면(자동화 설정)에서 활성화해 주세요.'],
      durationMs: 0,
    };
  }
  const channelId: string | null = setting.external_account_id || null;

  // ── 1) DB에 이미 등록된 유튜브 영상 조회 ──
  const { data: existingRows, error: existingError } = await client
    .from('videos')
    .select('id, external_video_id')
    .eq('platform', 'youtube')
    .not('external_video_id', 'is', null);

  if (existingError) {
    return {
      platform: 'youtube', success: false, processedCount: 0, newVideoCount: 0,
      errorMessage: `videos 조회 실패: ${existingError.message}`, warnings, durationMs: 0,
    };
  }
  const existing = (existingRows ?? []) as ExistingVideo[];
  const existingByExternalId = new Map(existing.map((v) => [v.external_video_id, v.id]));

  // ── 2) 신규 영상 발견 (채널 ID가 설정된 경우에만) ──
  //    실패해도 전체를 중단하지 않고, 기존 영상 통계 갱신은 계속 진행합니다.
  let discovered: DiscoveredItem[] = [];
  if (channelId) {
    try {
      const uploadsPlaylistId = await fetchUploadsPlaylistId(channelId, apiKey);
      discovered = await fetchRecentUploads(uploadsPlaylistId, apiKey, 5, warnings);
    } catch (err: any) {
      warnings.push(`신규 영상 발견 단계 실패(기존 영상 통계 갱신은 계속 진행): ${err?.message ?? String(err)}`);
    }
  } else {
    warnings.push('채널 ID가 설정되지 않아(관리자 화면 → 자동화 설정) 신규 영상 자동 등록은 건너뛰고, 기존 영상 통계만 갱신합니다.');
  }

  // ── 3) 조회할 전체 대상 ID 목록 구성 (기존 + 신규 발견분, 중복 제거) ──
  const discoveredMap = new Map(discovered.map((d) => [d.externalVideoId, d]));
  const allExternalIds = new Set<string>([...existingByExternalId.keys(), ...discoveredMap.keys()]);
  const targetIds = [...allExternalIds];

  if (targetIds.length === 0) {
    return {
      platform: 'youtube', success: true, processedCount: 0, newVideoCount: 0,
      warnings: [...warnings, '수집 대상 영상이 없습니다.'], durationMs: 0,
    };
  }

  // ── 4) videos.list 로 상세/통계 배치 조회 (최대 50개씩) ──
  const surveyDate = new Date().toISOString().slice(0, 10);
  const newVideoRows: any[] = [];
  const existingTitleUpdates: { id: string; source_title: string | null }[] = [];
  const metricRows: any[] = [];
  let newVideoCount = 0;
  let processedCount = 0;

  for (let i = 0; i < targetIds.length; i += 50) {
    const batch = targetIds.slice(i, i + 50);
    const url = `${YT_API}/videos?part=snippet,contentDetails,statistics&id=${encodeURIComponent(batch.join(','))}&key=${apiKey}`;

    let json: any;
    try {
      const resp = await fetch(url);
      json = await resp.json();
      if (!resp.ok) {
        warnings.push(`통계 조회 실패(batch ${i / 50 + 1}): ${json?.error?.message ?? resp.statusText}`);
        continue; // 이 배치는 건너뛰고 다음 배치 계속 (API 오류/쿼터 초과 대응)
      }
    } catch (err: any) {
      warnings.push(`통계 조회 중 네트워크 오류(batch ${i / 50 + 1}): ${err?.message ?? String(err)}`);
      continue;
    }

    const itemsByExternalId = new Map<string, any>((json.items ?? []).map((it: any) => [it.id, it]));

    for (const externalId of batch) {
      const item = itemsByExternalId.get(externalId);
      if (!item) {
        warnings.push(`${externalId}: 유튜브에서 데이터를 찾지 못했습니다 (비공개/삭제된 영상일 수 있음).`);
        continue;
      }

      try {
        const stats = item.statistics ?? {};
        const views = Number(stats.viewCount ?? 0);
        const likes = Number(stats.likeCount ?? 0);
        const comments = Number(stats.commentCount ?? 0);

        const internalId = existingByExternalId.get(externalId);

        if (internalId) {
          // ── 기존 영상: 통계만 갱신, title은 절대 건드리지 않음 ──
          metricRows.push({
            video_id: internalId, survey_date: surveyDate,
            views, likes, comments, source: 'api',
          });
          // source_title(원본 제목 추적)만 최신화 대상으로 모아둠 — title은 손대지 않음.
          // (배치 upsert로 한 번에 반영 → 영상 수가 많아도 DB 왕복 최소화)
          existingTitleUpdates.push({ id: internalId, source_title: item.snippet?.title ?? null });
          processedCount++;
        } else {
          // ── 신규 영상: 자동 등록 ──
          const durationSec = parseDurationSeconds(item.contentDetails?.duration);
          const contentType: 'short' | 'long' = durationSec !== null && durationSec <= 60 ? 'short' : 'long';
          const title = item.snippet?.title ?? discoveredMap.get(externalId)?.title ?? '(제목 없음)';
          const publishedAt = item.snippet?.publishedAt ?? discoveredMap.get(externalId)?.publishedAt;
          const uploadDate = publishedAt ? String(publishedAt).slice(0, 10) : surveyDate;
          const newInternalId = `YT_${externalId}`;

          newVideoRows.push({
            id: newInternalId,
            platform: 'youtube',
            content_type: contentType,
            management_group: 'platform', // 요구사항: 관리 그룹은 기본값으로 등록
            title,                        // 최초 등록 시 title = 유튜브 원본 제목
            content_group: null,
            upload_date: uploadDate,
            url: buildYoutubeUrl(externalId, contentType),
            external_video_id: externalId,
            source_title: title,
          });
          metricRows.push({
            video_id: newInternalId, survey_date: surveyDate,
            views, likes, comments, source: 'api',
          });
          newVideoCount++;
          processedCount++;
        }
      } catch (err: any) {
        // 영상 한 건 처리 중 예기치 못한 오류 — 이 영상만 건너뛰고 계속
        warnings.push(`${externalId}: 처리 중 오류로 건너뜀 - ${err?.message ?? String(err)}`);
      }
    }
  }

  // ── 5) 기존 영상 source_title 배치 갱신 (title은 절대 포함하지 않음) ──
  if (existingTitleUpdates.length > 0) {
    const { error: titleUpdateError } = await client
      .from('videos')
      .upsert(existingTitleUpdates, { onConflict: 'id' });
    if (titleUpdateError) {
      warnings.push(`원본 제목(source_title) 갱신 일부 실패: ${titleUpdateError.message}`);
    }
  }

  // ── 6) 신규 영상 등록 (있는 경우) ──
  if (newVideoRows.length > 0) {
    const { error: insertError } = await client
      .from('videos')
      .upsert(newVideoRows, { onConflict: 'platform,external_video_id' });
    if (insertError) {
      return {
        platform: 'youtube', success: false, processedCount, newVideoCount: 0,
        errorMessage: `신규 영상 등록 실패: ${insertError.message}`, warnings, durationMs: 0,
      };
    }
  }

  // ── 7) 주간 성과 upsert (신규 + 기존 모두 포함) ──
  if (metricRows.length > 0) {
    const { error: metricsError } = await client
      .from('weekly_metrics')
      .upsert(metricRows, { onConflict: 'video_id,survey_date' });
    if (metricsError) {
      return {
        platform: 'youtube', success: false, processedCount, newVideoCount,
        errorMessage: `weekly_metrics 저장 실패: ${metricsError.message}`, warnings, durationMs: 0,
      };
    }
  }

  return {
    platform: 'youtube',
    success: true,
    processedCount,
    newVideoCount,
    warnings,
    durationMs: 0, // finishSyncLog에서 실제 경과시간으로 채움
    surveyDate,
  };
}
