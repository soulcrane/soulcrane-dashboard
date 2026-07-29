// 이번 주 TOP 10 영상 표. 공통 DataTable 을 재사용하고, '열 정의'만 여기서 지정합니다.
import { DataTable, type Column } from '../common/DataTable';
import { PlatformBadge } from '../common/PlatformBadge';
import { Button } from '../common/Button';
import { colors, contentTypeLabels } from '../../theme/theme';
import { fullNumber } from '../../lib/format';
import type { RankedVideo } from '../../types';

export function TopVideosTable({ rows }: { rows: RankedVideo[] }) {
  // 표에 그릴 열을 선언적으로 정의 → 나중에 열 추가/변경이 쉬움
  const columns: Column<RankedVideo>[] = [
    {
      key: 'rank', header: '#', width: '40px',
      render: (r) => <span style={{ color: colors.textFaint }}>{r.rank}</span>,
    },
    {
      key: 'title', header: '영상명',
      render: (r) => <span style={{ color: colors.text }}>{r.video.title}</span>,
    },
    {
      key: 'platform', header: '플랫폼', width: '120px',
      render: (r) => <PlatformBadge platform={r.video.platform} />,
    },
    {
      key: 'type', header: '유형', width: '70px',
      render: (r) => (
        <span style={{ color: colors.textMuted }}>{contentTypeLabels[r.video.contentType]}</span>
      ),
    },
    {
      key: 'views', header: '조회수', align: 'right', width: '110px',
      render: (r) => <span style={{ color: colors.text }}>{fullNumber(r.views)}</span>,
    },
    {
      key: 'link', header: '', align: 'right', width: '70px',
      render: (r) => <Button href={r.video.url}>열기 ↗</Button>,
    },
  ];

  return <DataTable columns={columns} rows={rows} rowKey={(r) => r.video.id} />;
}
