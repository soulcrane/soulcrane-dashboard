// ────────────────────────────────────────────────────────────────
// Supabase 저장소 구현
//
// LocalRepository 와 '완전히 같은 인터페이스(DataRepository)'를 따릅니다.
// 그래서 repository.ts 에서 이 클래스로 바꾸기만 하면 화면 코드는 그대로입니다.
//
// 3개 테이블(videos / weekly_metrics / platform_followers)을 읽고 씁니다.
// 스키마는 프로젝트에 함께 있는 supabase_schema.sql 을 Supabase에서 실행해 두어야 합니다.
// ────────────────────────────────────────────────────────────────
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Video, WeeklyMetric, PlatformFollower } from '../types';
import type { DataRepository, DataSnapshot } from './repository';
import { VIDEOS, WEEKLY_METRICS, PLATFORM_FOLLOWERS } from '../data/seed';

// DB 컬럼(snake_case) ↔ 앱 타입(camelCase) 변환
// DB는 소문자+언더스코어 관례를, 앱은 카멜케이스를 쓰므로 경계에서 한 번 변환합니다.
const toVideo = (r: any): Video => ({
  id: r.id,
  platform: r.platform,
  contentType: r.content_type,
  managementGroup: r.management_group,
  title: r.title,
  contentGroup: r.content_group,
  uploadDate: r.upload_date,
  url: r.url ?? '',
});
const fromVideo = (v: Video) => ({
  id: v.id,
  platform: v.platform,
  content_type: v.contentType,
  management_group: v.managementGroup,
  title: v.title,
  content_group: v.contentGroup,
  upload_date: v.uploadDate,
  url: v.url,
});

const toMetric = (r: any): WeeklyMetric => ({
  videoId: r.video_id,
  surveyDate: r.survey_date,
  views: r.views,
  likes: r.likes,
  comments: r.comments,
  saves: r.saves,
  shares: r.shares,
});
const fromMetric = (m: WeeklyMetric) => ({
  video_id: m.videoId,
  survey_date: m.surveyDate,
  views: m.views,
  likes: m.likes,
  comments: m.comments,
  saves: m.saves,
  shares: m.shares,
});

const toFollower = (r: any): PlatformFollower => ({
  platform: r.platform,
  surveyDate: r.survey_date,
  followers: r.followers,
});
const fromFollower = (f: PlatformFollower) => ({
  platform: f.platform,
  survey_date: f.surveyDate,
  followers: f.followers,
});

// Supabase 에러를 '무엇을 고쳐야 하는지' 알려주는 한국어 안내로 변환합니다.
// 화면 상단 배너에 그대로 표시됩니다.
function explainSupabaseError(err: any): string {
  const code = err?.code ?? '';
  const msg = String(err?.message ?? err ?? '');

  // 1) 테이블이 없음 (스키마 SQL을 아직 실행 안 함)
  //    PostgREST: 42P01 = undefined_table, PGRST205 = 관계를 찾을 수 없음
  if (code === '42P01' || code === 'PGRST205' || /relation .* does not exist|Could not find the table/i.test(msg)) {
    return '연결은 됐지만 테이블이 없습니다. Supabase의 SQL Editor에서 supabase_schema.sql 전체를 실행했는지 확인해 주세요. (videos / weekly_metrics / platform_followers 테이블이 만들어져야 합니다)';
  }
  // 2) 권한/RLS 문제 또는 키가 잘못됨 (401/403)
  if (code === '42501' || code === 'PGRST301' || /permission denied|JWT|Invalid API key|No API key|row-level security|not authorized/i.test(msg)) {
    return '연결은 됐지만 권한이 거부됐습니다. ① API 키가 올바른지(Publishable 또는 anon/public 키, service_role 아님), ② supabase_schema.sql의 RLS 정책 부분까지 모두 실행했는지 확인해 주세요.';
  }
  // 3) 주소 자체가 틀렸거나 네트워크 실패
  if (/Failed to fetch|NetworkError|ENOTFOUND|fetch failed/i.test(msg)) {
    return 'Supabase 서버에 연결하지 못했습니다. VITE_SUPABASE_URL 주소가 맞는지(끝에 슬래시/공백 없이 https://로 시작), 인터넷 연결을 확인해 주세요.';
  }
  // 그 외: 원본 메시지를 그대로 노출 (콘솔에도 전체 객체가 찍힘)
  return `Supabase 오류: ${msg}${code ? ` (코드 ${code})` : ''}`;
}

export class SupabaseRepository implements DataRepository {
  constructor(private client: SupabaseClient) {}

  async load(): Promise<DataSnapshot> {
    const [videos, metrics, followers] = await Promise.all([
      this.client.from('videos').select('*'),
      this.client.from('weekly_metrics').select('*'),
      this.client.from('platform_followers').select('*'),
    ]);

    // 에러가 나면, 원인을 사람이 이해할 수 있는 안내로 바꿔서 던집니다.
    // (화면 상단 배너에 그대로 표시되어 무엇을 고쳐야 하는지 알 수 있게)
    const firstError = videos.error || metrics.error || followers.error;
    if (firstError) throw new Error(explainSupabaseError(firstError));

    // 테이블이 완전히 비어 있으면(최초 연결) 시드를 한 번 넣어 줍니다.
    if ((videos.data?.length ?? 0) === 0) {
      const seed: DataSnapshot = {
        videos: JSON.parse(JSON.stringify(VIDEOS)),
        metrics: JSON.parse(JSON.stringify(WEEKLY_METRICS)),
        followers: JSON.parse(JSON.stringify(PLATFORM_FOLLOWERS)),
      };
      try {
        await this.save(seed);
      } catch (e: any) {
        throw new Error(explainSupabaseError(e));
      }
      return seed;
    }

    return {
      videos: (videos.data ?? []).map(toVideo),
      metrics: (metrics.data ?? []).map(toMetric),
      followers: (followers.data ?? []).map(toFollower),
    };
  }

  // 전체 스냅샷을 통째로 저장(upsert)합니다. 화면의 CRUD가 항상 전체 상태를 넘겨주므로
  // 이 방식이 가장 단순하고 안전합니다(부분 저장 실패로 데이터가 어긋나는 일이 없음).
  async save(data: DataSnapshot): Promise<void> {
    const v = await this.client.from('videos')
      .upsert(data.videos.map(fromVideo), { onConflict: 'id' });
    if (v.error) throw new Error(explainSupabaseError(v.error));

    const m = await this.client.from('weekly_metrics')
      .upsert(data.metrics.map(fromMetric), { onConflict: 'video_id,survey_date' });
    if (m.error) throw new Error(explainSupabaseError(m.error));

    const f = await this.client.from('platform_followers')
      .upsert(data.followers.map(fromFollower), { onConflict: 'platform,survey_date' });
    if (f.error) throw new Error(explainSupabaseError(f.error));
  }

  async reset(): Promise<DataSnapshot> {
    // 모든 행을 지우고 시드로 되돌립니다. (관리자 '초기화' 버튼용)
    await this.client.from('weekly_metrics').delete().neq('video_id', '');
    await this.client.from('platform_followers').delete().neq('platform', '');
    await this.client.from('videos').delete().neq('id', '');
    const seed: DataSnapshot = {
      videos: JSON.parse(JSON.stringify(VIDEOS)),
      metrics: JSON.parse(JSON.stringify(WEEKLY_METRICS)),
      followers: JSON.parse(JSON.stringify(PLATFORM_FOLLOWERS)),
    };
    await this.save(seed);
    return seed;
  }

  /** 개별 삭제 — 스냅샷 저장(upsert)만으로는 '삭제'가 반영되지 않으므로 별도 제공 */
  async deleteVideo(id: string): Promise<void> {
    await this.client.from('weekly_metrics').delete().eq('video_id', id);
    await this.client.from('videos').delete().eq('id', id);
  }
  async deleteMetric(videoId: string, surveyDate: string): Promise<void> {
    await this.client.from('weekly_metrics').delete()
      .eq('video_id', videoId).eq('survey_date', surveyDate);
  }
  async deleteSurveyDate(surveyDate: string): Promise<void> {
    await this.client.from('weekly_metrics').delete().eq('survey_date', surveyDate);
    await this.client.from('platform_followers').delete().eq('survey_date', surveyDate);
  }
}
