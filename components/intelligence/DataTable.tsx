// DataTable — the shared data-table primitive (ui-constraints §12 "data table"):
// Inter cells, secondary-text headers on the #EDEAE2 (base-secondary) zone, mono
// for numeric/evidence values, a cobalt-tinted highlight row for the own brand.
// Generic over a row type. Presentational. Tokens only.

import type { ReactNode } from "react";

export type Column<T> = {
  key: string;
  header: string;
  /** Render the cell. Return a string/number or any node. */
  cell: (row: T) => ReactNode;
  align?: "left" | "right" | "center";
  /** Use mono numerals for this column's cells. */
  mono?: boolean;
};

export function DataTable<T>({
  columns,
  rows,
  getRowKey,
  isHighlighted,
  emptyLabel = "No rows.",
}: {
  columns: Column<T>[];
  rows: T[];
  getRowKey: (row: T, index: number) => string;
  /** Own-brand row → cobalt-tinted highlight. */
  isHighlighted?: (row: T) => boolean;
  emptyLabel?: string;
}) {
  const alignClass = (a?: "left" | "right" | "center") =>
    a === "right" ? "text-right" : a === "center" ? "text-center" : "text-left";

  return (
    <div className="overflow-x-auto rounded-card border border-divider bg-card">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="bg-base-secondary">
            {columns.map((c) => (
              <th
                key={c.key}
                className={`px-4 py-2.5 text-xs font-medium text-ink-secondary ${alignClass(c.align)}`}
              >
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                className="px-4 py-8 text-center text-sm text-ink-faint"
              >
                {emptyLabel}
              </td>
            </tr>
          ) : (
            rows.map((row, i) => {
              const highlighted = isHighlighted?.(row) ?? false;
              return (
                <tr
                  key={getRowKey(row, i)}
                  className={[
                    "border-t border-divider",
                    highlighted ? "bg-cobalt/5" : "",
                  ].join(" ")}
                >
                  {columns.map((c) => (
                    <td
                      key={c.key}
                      className={[
                        "px-4 py-2.5 text-ink",
                        alignClass(c.align),
                        c.mono ? "font-mono text-[13px]" : "",
                        highlighted ? "font-medium" : "",
                      ].join(" ")}
                    >
                      {c.cell(row)}
                    </td>
                  ))}
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
