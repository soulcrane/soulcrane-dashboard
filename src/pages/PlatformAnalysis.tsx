// ────────────────────────────────────────────────────────────────
// 플랫폼 분석 페이지
// 플랫폼(유튜브/인스타/틱톡/페이스북)을 탭으로 골라 성과와 콘텐츠 순위를 봅니다.
// 데이터는 전역 스토어(useData)에서 가져오므로, 주간 입력에서 저장하면 즉시 반영됩니다.
// ────────────────────────────────────────────────────────────────
import { useState, useMemo } from 'react';
import { Card } from '../components/common/Card';
import { SectionHeading } from '../components/common/SectionHeading';
import { KpiCard } from '../components/common/KpiCard';
import { Tabs } from '../components/common/Tabs';
import { Button } from '../components/common/Button';
import { DataTable, type Column } from '../components/common/DataTable';
import { useData } from '../store/DataContext';
import { buildVideoRows, surveyDatesDesc, platformVideos, mainVideos, PLATFORMS, type VideoRow } from '../lib/metrics';
import { colors, platformColors, platformLabels, contentTypeLabels } from '../theme/theme';
import { fullNumber, compactNumber, formatDate } from '../lib/format';
import type { Platform } from '../types';

interface Props {
  /** 콘텐츠 클릭 시 영상 상세로 이동 */
  onOpenVideo: (videoId: string) => void;
}

export function PlatformAnalysis({ onOpenVideo }: Props) {
  const { videos, metrics, followers } = useData();
  const [platform, setPlatform] = useState<Platform>('youtube');

  const dates = surveyDatesDesc(metrics);
  const latest = dates[0];

  // 이 플랫폼의 '플랫폼 콘텐츠'(순위·목록용, 메인 제외)
  const rows = useMemo(() => {
    if (!latest) return [];
    const targets = platformVideos(videos).filter((v) => v.platform === platform);
    return buildVideoRows(targets, metrics, latest).sort((a, b) => b.views - a.views);
  }, [videos, metrics, latest, platform]);

  // 이 플랫폼의 '메인 콘텐츠'(있으면) — 유튜브의 LF. 공식 본편
  const mainRows = useMemo(() => {
    if (!latest) return [];
    const targets = mainVideos(videos).filter((v) => v.platform === platform);
    return buildVideoRows(targets, metrics, latest).sort((a, b) => b.views - a.views);
  }, [videos, metrics, latest, platform]);

  // ★ 플랫폼 총 성과 = 플랫폼 콘텐츠 + 메인 콘텐츠 (요청 반영)
  const allRows = [...rows, ...mainRows];
  const totalViews = allRows.reduce((a, r) => a + r.views, 0);
  const totalLikes = allRows.reduce((a, r) => a + r.likes, 0);
  const totalComments = allRows.reduce((a, r) => a + r.comments, 0);
  // 평균은 순위 비교용이라 플랫폼 콘텐츠(숏폼)만 기준으로 둡니다.
  const avgViews = rows.length ? Math.round(rows.reduce((a, r) => a + r.views, 0) / rows.length) : 0;
  const bestRow = rows[0];
  const follower = followers.find((f) => f.platform === platform && f.surveyDate === latest);

  // 표 열 정의
  const columns: Column<VideoRow>[] = [
    { key: 'rank', header: '#', width: '44px',
      render: (r) => <span style={{ color: colors.textFaint }}>{rows.indexOf(r) + 1}</span> },
    { key: 'title', header: '영상명',
      render: (r) => (
        <button onClick={() => onOpenVideo(r.video.id)}
          style={{ color: colors.accent, background: 'none', border: 'none', padding: 0,
                   cursor: 'pointer', fontSize: 14, textAlign: 'left' }}>
          {r.video.title}
        </button>
      ) },
    { key: 'type', header: '유형', width: '70px',
      render: (r) => <span style={{ color: colors.textMuted }}>{contentTypeLabels[r.video.contentType]}</span> },
    { key: 'upload', header: '업로드일', width: '110px',
      render: (r) => <span style={{ color: colors.textMuted }}>{formatDate(r.video.uploadDate)}</span> },
    { key: 'views', header: '조회수', align: 'right', width: '100px',
      render: (r) => fullNumber(r.views) },
    { key: 'likes', header: '좋아요', align: 'right', width: '90px',
      render: (r) => fullNumber(r.likes) },
    { key: 'comments', header: '댓글', align: 'right', width: '70px',
      render: (r) => fullNumber(r.comments) },
    { key: 'link', header: '', align: 'right', width: '70px',
      render: (r) => <Button href={r.video.url}>열기 ↗</Button> },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-lg font-semibold" style={{ color: colors.text }}>플랫폼 분석</h1>
        <p className="text-xs mt-0.5" style={{ color: colors.textMuted }}>
          {latest ? `${formatDate(latest)} 조사 기준` : '데이터 없음'} · 플랫폼을 선택해 성과를 확인하세요
        </p>
      </div>

      {/* 플랫폼 탭 */}
      <Tabs
        value={platform}
        onChange={setPlatform}
        options={PLATFORMS.map((p) => ({
          value: p, label: platformLabels[p], color: platformColors[p],
        }))}
      />

      {allRows.length === 0 ? (
        // 기능은 활성화되어 있고 데이터만 없는 상태 (예: 더우인)
        <Card>
          <div className="text-center py-10">
            <p className="text-sm font-medium mb-2" style={{ color: colors.text }}>
              데이터 입력 대기 중
            </p>
            <p className="text-xs leading-relaxed max-w-md mx-auto" style={{ color: colors.textMuted }}>
              {platformLabels[platform]}은 분석 기능이 이미 활성화되어 있으며, 아직 실제 데이터만 입력되지 않은 상태입니다.
              <br />
              [주간 데이터 입력]에서 콘텐츠를 등록하고 수치를 저장하면
              이 화면과 대시보드·주간 비교·AI 분석에 자동으로 반영됩니다.
            </p>
          </div>
        </Card>
      ) : (
        <>
          {/* 플랫폼 KPI */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <KpiCard kpi={{ label: '총 조회수', value: totalViews, changePct: null }} />
            <KpiCard kpi={{ label: '총 좋아요', value: totalLikes, changePct: null }} />
            <KpiCard kpi={{ label: '총 댓글', value: totalComments, changePct: null }} />
            <KpiCard kpi={{ label: '평균 조회수', value: avgViews, changePct: null }} />
            <KpiCard kpi={{ label: '팔로워', value: follower?.followers ?? 0, changePct: null }} />
          </div>

          {/* ★ 이 플랫폼에 메인 콘텐츠(공식 본편)가 있으면, 유형을 나눠서 보여줍니다.
              유튜브 = 공식 본편(롱폼) + Shorts(숏폼) 으로 구분 확인 */}
          {mainRows.length > 0 && (
            <div>
              <SectionHeading
                title="콘텐츠 유형 구분"
                subtitle={`${platformLabels[platform]} 총 성과는 아래 두 유형을 합한 값입니다`}
              />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* 공식 본편 (롱폼) */}
                {mainRows.map((r) => (
                  <Card key={r.video.id}
                    style={{ background: colors.highlightSoft, border: `1px solid ${colors.highlightBorder}` }}>
                    <p className="text-xs font-medium mb-1" style={{ color: colors.highlight }}>
                      ⭐ LF. 공식 본편 (롱폼)
                    </p>
                    <p className="text-sm font-semibold mb-2" style={{ color: colors.text }}>{r.video.title}</p>
                    <div className="flex gap-4 text-xs mb-2" style={{ color: colors.textMuted }}>
                      <span>조회 {fullNumber(r.views)}</span>
                      <span>좋아요 {fullNumber(r.likes)}</span>
                      <span>댓글 {fullNumber(r.comments)}</span>
                    </div>
                    <p className="text-[11px]" style={{ color: colors.textFaint }}>
                      업로드 {formatDate(r.video.uploadDate)}
                    </p>
                    <div className="flex gap-2 mt-3">
                      <Button href={r.video.url}>영상 열기 ↗</Button>
                      <Button variant="primary" onClick={() => onOpenVideo(r.video.id)}>주간 성과 상세</Button>
                    </div>
                  </Card>
                ))}
                {/* Shorts 등 플랫폼 콘텐츠 합계 (숏폼) */}
                <Card>
                  <p className="text-xs font-medium mb-1" style={{ color: colors.accent }}>
                    {platformLabels[platform]} Shorts (숏폼 {rows.length}개 합계)
                  </p>
                  <p className="text-sm font-semibold mb-2" style={{ color: colors.text }}>일반 콘텐츠 전체</p>
                  <div className="flex gap-4 text-xs mb-2" style={{ color: colors.textMuted }}>
                    <span>조회 {fullNumber(rows.reduce((a, r) => a + r.views, 0))}</span>
                    <span>좋아요 {fullNumber(rows.reduce((a, r) => a + r.likes, 0))}</span>
                    <span>댓글 {fullNumber(rows.reduce((a, r) => a + r.comments, 0))}</span>
                  </div>
                  <p className="text-[11px]" style={{ color: colors.textFaint }}>
                    아래 순위표에서 개별 콘텐츠를 확인할 수 있습니다
                  </p>
                </Card>
              </div>
            </div>
          )}

          {/* 최고 성과 콘텐츠 (Shorts 중 1위) */}
          {bestRow && (
            <Card style={{ background: colors.accentSoft, border: `1px solid ${colors.border}` }}>
              <p className="text-xs mb-1" style={{ color: colors.accent }}>최고 성과 콘텐츠 (숏폼)</p>
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <p className="text-base font-semibold" style={{ color: colors.text }}>{bestRow.video.title}</p>
                  <p className="text-xs mt-1" style={{ color: colors.textMuted }}>
                    조회 {fullNumber(bestRow.views)} · 좋아요 {fullNumber(bestRow.likes)} · 댓글 {fullNumber(bestRow.comments)}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button href={bestRow.video.url}>영상 열기 ↗</Button>
                  <Button variant="primary" onClick={() => onOpenVideo(bestRow.video.id)}>상세 보기</Button>
                </div>
              </div>
            </Card>
          )}

          {/* 콘텐츠 순위 */}
          <div>
            <SectionHeading
              title="콘텐츠별 순위"
              subtitle={`${rows.length}개 · 조회수 기준 내림차순 · 영상명을 누르면 상세로 이동`}
            />
            <Card style={{ padding: 8 }}>
              <DataTable columns={columns} rows={rows} rowKey={(r) => r.video.id} />
            </Card>
          </div>

          <p className="text-xs" style={{ color: colors.textFaint }}>
            합계 {compactNumber(totalViews)}회 · 이 플랫폼의 콘텐츠 {rows.length}개 기준입니다.
          </p>
        </>
      )}
    </div>
  );
}
