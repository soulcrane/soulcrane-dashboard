// 플랫폼별 성과 카드. 클릭하면 해당 플랫폼 분석 화면으로 이동합니다.
// 아직 데이터가 없는 플랫폼(예: 더우인)은 '데이터 입력 대기 중'으로 표시합니다.
//  → 기능이 없는 게 아니라 데이터만 없는 상태라는 걸 명확히 구분해서 보여주기 위함입니다.
import { Card } from '../common/Card';
import { PlatformBadge } from '../common/PlatformBadge';
import { TrendBadge } from '../common/TrendBadge';
import { colors, platformColors } from '../../theme/theme';
import { compactNumber, fullNumber } from '../../lib/format';
import type { PlatformSummary } from '../../types';

interface Props {
  summaries: PlatformSummary[];
  onSelect?: (platform: string) => void; // 2단계 연결 지점
}

export function PlatformSummaryCards({ summaries, onSelect }: Props) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {summaries.map((s) => {
        // 콘텐츠도 없고 조회수도 없으면 '데이터 입력 대기 중' 상태
        const waiting = s.contentCount === 0 && s.totalViews === 0;
        return (
          <Card key={s.platform} interactive onClick={() => onSelect?.(s.platform)}>
            {/* 상단: 플랫폼 이름 + 콘텐츠 수 */}
            <div className="flex items-center justify-between mb-3">
              <PlatformBadge platform={s.platform} />
              <span className="text-xs" style={{ color: colors.textFaint }}>
                콘텐츠 {s.contentCount}{s.mainCount ? ` + 본편 ${s.mainCount}` : ''}
              </span>
            </div>

            {waiting ? (
              // 기능은 활성화, 데이터만 없음
              <div className="mb-3">
                <p className="text-sm font-medium" style={{ color: colors.textMuted }}>
                  데이터 입력 대기 중
                </p>
                <p className="text-[11px] mt-1" style={{ color: colors.textFaint }}>
                  입력하면 통합 성과에 자동 반영됩니다
                </p>
              </div>
            ) : (
              <>
                {/* 조회수(대표 지표) */}
                <div className="flex items-end justify-between gap-2 mb-3">
                  <span className="text-xl font-semibold tabular-nums" style={{ color: colors.text }}>
                    {compactNumber(s.totalViews)}
                  </span>
                  <TrendBadge changePct={s.weeklyGrowthPct} />
                </div>
                {/* 하단 보조 지표 */}
                <div className="flex justify-between text-xs" style={{ color: colors.textMuted }}>
                  <span>팔로워 {fullNumber(s.followers)}</span>
                  <span>좋아요 {compactNumber(s.totalLikes)}</span>
                </div>
              </>
            )}

            {/* 카드 하단 얇은 색 라인 = 플랫폼 아이덴티티 */}
            <div className="mt-3 h-0.5 rounded-full"
              style={{ background: platformColors[s.platform], opacity: waiting ? 0.35 : 1 }} />
          </Card>
        );
      })}
    </div>
  );
}
