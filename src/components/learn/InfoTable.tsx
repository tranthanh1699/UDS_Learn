import type { ReactNode } from 'react';

/** Bảng thông tin đơn giản, cuộn ngang trên màn hình hẹp. */
export function InfoTable({ headers, rows, monoCols = [] }: { headers: string[]; rows: ReactNode[][]; monoCols?: number[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead className="bg-surface-2 text-left text-xs text-muted">
          <tr>
            {headers.map((h) => (
              <th key={h} className="px-3 py-2 font-semibold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-t border-border align-top">
              {row.map((cell, j) => (
                <td key={j} className={monoCols.includes(j) ? 'hex whitespace-nowrap px-3 py-2' : 'px-3 py-2'}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
