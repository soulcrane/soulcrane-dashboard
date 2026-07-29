// ────────────────────────────────────────────────────────────────
// Supabase 저장소 구현
//
// LocalRepository 와 '완전히 같은 인터페이스(DataRepository)'를 따릅니다.
// ────────────────────────────────────────────────────────────────

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Video, WeeklyMetric, PlatformFollower } from '../types';
import type { DataRepository, DataSnapshot } from './repository';
import { VIDEOS, WEEKLY_METRICS, PLATFORM_FOLLOWERS } from '../data/seed';

const toVideo = (r: any): Video => ({
  id: r.id,
  platform: r.platform,
  contentType: r.content_type,
  managementGroup: r.management_group,
  title: r.title,
  contentGroup: r.content_group,
  uploadDate: r.upload_date,
  url: r.url ?? '',
  externalVideoId: r.external_video_id ?? null,
  sourceTitle: r.source_title ?? null,
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
  external_video_id: v.externalVideoId ?? null,
  source_title: v.sourceTitle ?? null,
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


function explainSupabaseError(err: any): string {
  const code = err?.code ?? '';
  const msg = String(err?.message ?? err ?? '');

  if (
    code === '42P01' ||
    code === 'PGRST205' ||
    /relation .* does not exist|Could not find the table/i.test(msg)
  ) {
    return '연결은 됐지만 Supabase 테이블이 없습니다.';
  }

  if (
    code === '42501' ||
    code === 'PGRST301' ||
    /permission denied|JWT|Invalid API key|No API key|row-level security/i.test(msg)
  ) {
    return 'Supabase 권한 설정을 확인해주세요.';
  }

  if (/Failed to fetch|NetworkError|ENOTFOUND|fetch failed/i.test(msg)) {
    return 'Supabase 연결 정보를 확인해주세요.';
  }

  return `Supabase 오류: ${msg}`;
}


export class SupabaseRepository implements DataRepository {

  constructor(private client: SupabaseClient) {}


  async load(): Promise<DataSnapshot> {

    const [videos, metrics, followers] = await Promise.all([
      this.client.from('videos').select('*'),
      this.client.from('weekly_metrics').select('*'),
      this.client.from('platform_followers').select('*'),
    ]);


    const firstError =
      videos.error ||
      metrics.error ||
      followers.error;


    if (firstError) {
      throw new Error(explainSupabaseError(firstError));
    }


    if ((videos.data?.length ?? 0) === 0) {

      const seed: DataSnapshot = {
        videos: JSON.parse(JSON.stringify(VIDEOS)),
        metrics: JSON.parse(JSON.stringify(WEEKLY_METRICS)),
        followers: JSON.parse(JSON.stringify(PLATFORM_FOLLOWERS)),
      };


      await this.save(seed);

      return seed;
    }


    return {
      videos: (videos.data ?? []).map(toVideo),
      metrics: (metrics.data ?? []).map(toMetric),
      followers: (followers.data ?? []).map(toFollower),
    };
  }



  async save(data: DataSnapshot): Promise<void> {

    const v = await this.client
      .from('videos')
      .upsert(data.videos.map(fromVideo), {
        onConflict: 'id',
      });

    if (v.error) {
      throw new Error(explainSupabaseError(v.error));
    }


    const m = await this.client
      .from('weekly_metrics')
      .upsert(data.metrics.map(fromMetric), {
        onConflict: 'video_id,survey_date',
      });

    if (m.error) {
      throw new Error(explainSupabaseError(m.error));
    }


    const f = await this.client
      .from('platform_followers')
      .upsert(data.followers.map(fromFollower), {
        onConflict: 'platform,survey_date',
      });

    if (f.error) {
      throw new Error(explainSupabaseError(f.error));
    }
  }



  async reset(): Promise<DataSnapshot> {

    await this.client.from('weekly_metrics')
      .delete()
      .neq('video_id', '');

    await this.client.from('platform_followers')
      .delete()
      .neq('platform', '');

    await this.client.from('videos')
      .delete()
      .neq('id', '');


    const seed: DataSnapshot = {
      videos: JSON.parse(JSON.stringify(VIDEOS)),
      metrics: JSON.parse(JSON.stringify(WEEKLY_METRICS)),
      followers: JSON.parse(JSON.stringify(PLATFORM_FOLLOWERS)),
    };


    await this.save(seed);

    return seed;
  }



  async deleteVideo(id: string): Promise<void> {

    await this.client
      .from('weekly_metrics')
      .delete()
      .eq('video_id', id);


    await this.client
      .from('videos')
      .delete()
      .eq('id', id);
  }



  async deleteMetric(
    videoId: string,
    surveyDate: string
  ): Promise<void> {

    await this.client
      .from('weekly_metrics')
      .delete()
      .eq('video_id', videoId)
      .eq('survey_date', surveyDate);
  }



  async deleteSurveyDate(
    surveyDate: string
  ): Promise<void> {

    await this.client
      .from('weekly_metrics')
      .delete()
      .eq('survey_date', surveyDate);


    await this.client
      .from('platform_followers')
      .delete()
      .eq('survey_date', surveyDate);
  }
}