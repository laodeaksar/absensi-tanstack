import type { Table } from "@tanstack/react-table";

import { FlexRender } from "@tanstack/react-table";
import {
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
} from "lucide-react";

import type { AppFeatures } from "~/lib/table";

/* TanStack Table v9 */

export function DataTable<TData extends Record<string, any>>({
  table,
  emptyText,
}: {
  table: Table<AppFeatures, TData>;
  emptyText: string;
}) {
  const rows = table.getRowModel().rows;
  const headerGroups = table.getHeaderGroups();
  const colCount = table.getAllLeafColumns().length;

  return (
    <div className="overflow-x-auto">
      <table className="table table-zebra">
        <thead>
          {headerGroups.map((hg) => (
            <tr key={hg.id}>
              {hg.headers.map((h) => {
                const canSort = h.column.getCanSort();
                const sorted = h.column.getIsSorted();
                return (
                  <th
                    key={h.id}
                    colSpan={h.colSpan}
                  >
                    {h.isPlaceholder ? null : canSort ? (
                      <button
                        type="button"
                        className="inline-flex items-center gap-1"
                        onClick={h.column.getToggleSortingHandler()}
                      >
                        <FlexRender header={h} />
                        {sorted === "asc" ? (
                          <ArrowUp className="size-3.5" />
                        ) : sorted === "desc" ? (
                          <ArrowDown className="size-3.5" />
                        ) : (
                          <ChevronsUpDown className="size-3.5 opacity-30" />
                        )}
                      </button>
                    ) : (
                      <FlexRender header={h} />
                    )}
                  </th>
                );
              })}
            </tr>
          ))}
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td
                colSpan={colCount}
                className="p-8 text-center text-base-content/60"
              >
                {emptyText}
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr key={row.id}>
                {row.getAllCells().map((cell) => (
                  <td key={cell.id}>
                    <FlexRender cell={cell} />
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

export function Pager<TData extends Record<string, any>>({
  table,
}: {
  table: Table<AppFeatures, TData>;
}) {
  const pageCount = table.getPageCount();
  if (pageCount <= 1) return null;
  const { pageIndex } = table.atoms.pagination.get();

  return (
    <div className="no-print flex items-center justify-between border-t border-base-300 p-3 text-sm">
      <span className="text-base-content/60">
        Halaman {pageIndex + 1} dari {pageCount}
      </span>
      <div className="join">
        <button
          type="button"
          className="btn join-item btn-sm"
          disabled={!table.getCanPreviousPage()}
          onClick={() => table.previousPage()}
          aria-label="Sebelumnya"
        >
          <ChevronLeft className="size-4" />
        </button>
        <button
          type="button"
          className="btn join-item btn-sm"
          disabled={!table.getCanNextPage()}
          onClick={() => table.nextPage()}
          aria-label="Berikutnya"
        >
          <ChevronRight className="size-4" />
        </button>
      </div>
    </div>
  );
}
