// 공통 데이터 표 — 어떤 데이터든 '열 정의'만 넘기면 표로 그려주는 재사용 컴포넌트.
// (역할: TOP10, 영상 목록, 랭킹 등 모든 표를 하나의 컴포넌트로 통일)
//
// 제네릭 <T> 을 써서 어떤 형태의 행이든 받을 수 있습니다.
import type { ReactNode } from 'react';
import { colors } from '../../theme/theme';

export interface Column<T> {
  key: string;
  header: string;
  // 각 셀을 어떻게 그릴지 정의하는 함수
  render: (row: T) => ReactNode;
  align?: 'left' | 'right' | 'center';
  width?: string;
}

interface Props<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  emptyText?: string;
}

export function DataTable<T>({ columns, rows, rowKey, emptyText = '데이터가 없습니다.' }: Props<T>) {
  if (rows.length === 0) {
    return <p className="text-xs py-6 text-center" style={{ color: colors.textFaint }}>{emptyText}</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr>
            {columns.map((c) => (
              <th
                key={c.key}
                className="text-xs font-medium py-2 px-3"
                style={{
                  color: colors.textMuted,
                  textAlign: c.align ?? 'left',
                  width: c.width,
                  borderBottom: `1px solid ${colors.border}`,
                }}
              >
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={rowKey(row)}>
              {columns.map((c) => (
                <td
                  key={c.key}
                  className="py-2.5 px-3 tabular-nums"
                  style={{
                    color: colors.text,
                    textAlign: c.align ?? 'left',
                    borderBottom: `1px solid ${colors.border}`,
                  }}
                >
                  {c.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
