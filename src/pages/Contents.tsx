// ────────────────────────────────────────────────────────────────
// 콘텐츠 페이지 — 전체 콘텐츠를 검색·필터·정렬해서 찾는 화면.
// 콘텐츠가 계속 늘어날 예정이므로(현재 62개) 탐색 기능이 핵심입니다.
// ────────────────────────────────────────────────────────────────
import { useState, useMemo } from 'react';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { PlatformBadge } from '../components/common/PlatformBadge';
import { DataTable, type Column } from '../components/common/DataTable';
import { EmptyState } from '../components/common/EmptyState';
import { TextField, SelectField } from '../components/common/Field';
import { useData } from '../store/DataContext';
import { buildVideoRows, surveyDatesDesc, type VideoRow } from '../lib/metrics';
import { colors, contentTypeLabels } from '../theme/theme';
import { fullNumber, formatDate } from '../lib/format';

type PlatformFilter = 'all' | 'youtube' | 'instagram' | 'tiktok' | 'facebook' | 'douyin';
type TypeFilter = 'all' | 'short' | 'long';
type SortKey = 'views' | 'likes' | 'comments' | 'engagement' | 'uploadDate' | 'title';

interface Props {
  onOpenVideo: (videoId: string) => void;
}

export function Contents({ onOpenVideo }: Props) {
  const { videos, metrics } = useData();
  const dates = surveyDatesDesc(metrics);
  const latest = dates[0];

  // 검색·필터·정렬 상태
  const [query, setQuery] = useState('');
  const [platform, setPlatform] = useState<PlatformFilter>('all');
  const [type, setType] = useState<TypeFilter>('all');
  const [sortKey, setSortKey] = useState<SortKey>('views');

  // 전체 콘텐츠(메인 콘텐츠 포함 — 여기서는 '전체 관리 목록'이므로 모두 보여줍니다)
  const allRows = useMemo(
    () => (latest ? buildVideoRows(videos, metrics, latest) : []),
    [videos, metrics, latest],
  );

  // 검색 + 필터 + 정렬 적용
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = allRows.filter((r) => {
      const matchQuery = !q
        || r.video.title.toLowerCase().includes(q)
        || r.video.id.toLowerCase().includes(q);
      const matchPlatform = platform === 'all' || r.video.platform === platform;
      const matchType = type === 'all' || r.video.contentType === type;
      return matchQuery && matchPlatform && matchType;
    });

    list = [...list].sort((a, b) => {
      switch (sortKey) {
        case 'views': return b.views - a.views;
        case 'likes': return b.likes - a.likes;
        case 'comments': return b.comments - a.comments;
        case 'engagement': return b.engagement - a.engagement;
        case 'uploadDate': return b.video.uploadDate.localeCompare(a.video.uploadDate);
        case 'title': return a.video.title.localeCompare(b.video.title);
      }
    });
    return list;
  }, [allRows, query, platform, type, sortKey]);

  const columns: Column<VideoRow>[] = [
    { key: 'rank', header: '#', width: '44px',
      render: (r) => <span style={{ color: colors.textFaint }}>{rows.indexOf(r) + 1}</span> },
    { key: 'title', header: '영상명',
      render: (r) => (
        <button onClick={() => onOpenVideo(r.video.id)}
          style={{ color: colors.accent, background: 'none', border: 'none', padding: 0,
                   cursor: 'pointer', fontSize: 14, textAlign: 'left' }}>
          {r.video.title}
          {r.video.managementGroup === 'main' && (
            <span style={{ marginLeft: 6, fontSize: 11, color: colors.highlight }}>⭐ 메인</span>
          )}
        </button>
      ) },
    { key: 'platform', header: '플랫폼', width: '120px',
      render: (r) => <PlatformBadge platform={r.video.platform} /> },
    { key: 'type', header: '유형', width: '64px',
      render: (r) => <span style={{ color: colors.textMuted }}>{contentTypeLabels[r.video.contentType]}</span> },
    { key: 'upload', header: '업로드일', width: '104px',
      render: (r) => <span style={{ color: colors.textMuted }}>{formatDate(r.video.uploadDate)}</span> },
    { key: 'views', header: '조회수', align: 'right', width: '96px',
      render: (r) => fullNumber(r.views) },
    { key: 'likes', header: '좋아요', align: 'right', width: '84px',
      render: (r) => fullNumber(r.likes) },
    { key: 'comments', header: '댓글', align: 'right', width: '64px',
      render: (r) => fullNumber(r.comments) },
    { key: 'link', header: '', align: 'right', width: '70px',
      render: (r) => <Button href={r.video.url}>열기 ↗</Button> },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-lg font-semibold" style={{ color: colors.text }}>콘텐츠</h1>
        <p className="text-xs mt-0.5" style={{ color: colors.textMuted }}>
          전체 {allRows.length}개 · {latest ? `${formatDate(latest)} 조사 기준` : '데이터 없음'}
        </p>
      </div>

      {/* 검색 · 필터 · 정렬 */}
      <Card>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <TextField
            label="검색 (영상명 · ID)"
            value={query}
            onChange={setQuery}
            placeholder="예: 60s MV"
          />
          <SelectField
            label="플랫폼"
            value={platform}
            onChange={setPlatform}
            options={[
              { value: 'all', label: '전체' },
              { value: 'youtube', label: '유튜브' },
              { value: 'instagram', label: '인스타그램' },
              { value: 'tiktok', label: '틱톡' },
              { value: 'facebook', label: '페이스북' },
              { value: 'douyin', label: '더우인' },
            ]}
          />
          <SelectField
            label="콘텐츠 유형"
            value={type}
            onChange={setType}
            options={[
              { value: 'all', label: '전체' },
              { value: 'short', label: '숏폼' },
              { value: 'long', label: '롱폼' },
            ]}
          />
          <SelectField
            label="정렬"
            value={sortKey}
            onChange={setSortKey}
            options={[
              { value: 'views', label: '조회수 높은 순' },
              { value: 'likes', label: '좋아요 높은 순' },
              { value: 'comments', label: '댓글 많은 순' },
              { value: 'engagement', label: '참여율 높은 순' },
              { value: 'uploadDate', label: '최근 업로드 순' },
              { value: 'title', label: '이름 순' },
            ]}
          />
        </div>
        <p className="text-xs mt-3" style={{ color: colors.textMuted }}>
          {rows.length}개 표시 중
          {(query || platform !== 'all' || type !== 'all') && ' (필터 적용됨)'}
        </p>
      </Card>

      {/* 목록 */}
      <Card style={{ padding: 8 }}>
        {rows.length === 0 ? (
          <EmptyState
            title="조건에 맞는 콘텐츠가 없습니다"
            description="검색어를 지우거나 필터를 '전체'로 바꿔보세요."
          />
        ) : (
          <DataTable columns={columns} rows={rows} rowKey={(r) => r.video.id} />
        )}
      </Card>
    </div>
  );
}
