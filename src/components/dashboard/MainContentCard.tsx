// ★ 메인 콘텐츠(LF. 공식 본편) 강조 카드 — 대시보드에서 별도 영역으로 크게 표시.
// 클릭하면 전용 상세 페이지로 이동합니다.
// (플랫폼 콘텐츠와 시각적으로 확실히 구분되도록 골드 톤 강조를 사용)
import { Card } from '../common/Card';
import { TrendBadge } from '../common/TrendBadge';
import { Button } from '../common/Button';
import { colors } from '../../theme/theme';
import { fullNumber, formatDate } from '../../lib/format';
import type { MainContentPerformance } from '../../types';

interface Props {
  data: MainContentPerformance;
  onOpen?: () => void;   // 상세 페이지로 이동
}

export function MainContentCard({ data, onOpen }: Props) {
  const { video } = data;

  // 강조 영역 안에서 반복되는 작은 지표 한 칸
  const Stat = ({ label, value, hint }: { label: string; value: string; hint?: string }) => (
    <div>
      <p className="text-xs mb-1" style={{ color: colors.textMuted }}>{label}</p>
      <p className="text-lg font-semibold tabular-nums" style={{ color: colors.text }}>{value}</p>
      {hint && <p className="text-[11px] mt-0.5" style={{ color: colors.textFaint }}>{hint}</p>}
    </div>
  );

  return (
    <Card
      interactive
      onClick={onOpen}
      style={{
        background: colors.highlightSoft,
        border: `1px solid ${colors.highlightBorder}`,
      }}
    >
      {/* 헤더: 별표 + 제목 + 상세 이동 */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <p className="text-xs font-medium mb-1" style={{ color: colors.highlight }}>
            ⭐ 메인 콘텐츠
          </p>
          <h3 className="text-base font-semibold" style={{ color: colors.text }}>
            {video.title}
          </h3>
          <p className="text-xs mt-1" style={{ color: colors.textMuted }}>
            업로드 {formatDate(video.uploadDate)} · 유튜브 롱폼
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button href={video.url}>영상 열기 ↗</Button>
          <Button variant="primary" onClick={onOpen}>상세 보기</Button>
        </div>
      </div>

      {/* 핵심 지표 5칸 */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Stat label="조회수" value={fullNumber(data.views)} />
        <Stat label="좋아요" value={fullNumber(data.likes)} />
        <Stat label="댓글" value={fullNumber(data.comments)} />
        <Stat label="업로드 후" value={`${data.daysSinceUpload}일`} hint="조사일 기준" />
        <div>
          <p className="text-xs mb-1" style={{ color: colors.textMuted }}>주간 증가 / 성장률</p>
          <p className="text-lg font-semibold tabular-nums" style={{ color: colors.text }}>
            {data.weeklyViewGain === null ? '—' : `+${fullNumber(data.weeklyViewGain)}`}
          </p>
          <div className="mt-0.5">
            <TrendBadge changePct={data.weeklyGrowthPct} />
          </div>
        </div>
      </div>

      {/* 1주차 안내 */}
      {data.weeklyViewGain === null && (
        <p className="text-[11px] mt-3" style={{ color: colors.textFaint }}>
          다음 주 데이터가 입력되면 주간 증가량과 성장률이 표시됩니다.
        </p>
      )}
    </Card>
  );
}
