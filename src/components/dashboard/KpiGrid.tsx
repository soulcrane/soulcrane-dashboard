// 대시보드 상단 KPI 4장을 격자로 배치 (조회수/좋아요/댓글/콘텐츠 수)
import { KpiCard } from '../common/KpiCard';
import type { KpiValue } from '../../types';

export function KpiGrid({ kpis }: { kpis: KpiValue[] }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {kpis.map((k) => <KpiCard key={k.label} kpi={k} />)}
    </div>
  );
}
