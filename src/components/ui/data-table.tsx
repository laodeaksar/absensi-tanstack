import type { Table } from "@tanstack/react-table";
import type { ReactNode } from "react";

import { FlexRender } from "@tanstack/react-table";
import {
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
} from "lucide-react";
import { useState } from "react";

import type { AppFeatures } from "~/lib/table";

import { ResponsiveName } from "~/components/responsive-name";

/** Opsi per kolom lewat `columnDef.meta`. */
type CellMeta = {
  /** 1 | 2 | "col-1" | "col-2" | true | "left" */
  sticky?: unknown;
  /** Mobile hanya inisial, sm ke atas nama lengkap. Nilai sel harus string. */
  initials?: boolean;
  /** Baris kedua di bawah nama (mis. NIS). */
  subtitle?: (row: any) => ReactNode;
};

export function DataTable<TData extends Record<string, any>>({
  table,
  emptyText,
  empty,
  stickyHeader = true,
  stickyColumns,
  stickyCol1Width = "3rem",
}: {
  table: Table<AppFeatures, TData>;
  emptyText?: string;
  empty?: ReactNode;
  stickyHeader?: boolean;
  stickyColumns?: number | string[];
  stickyCol1Width?: string;
}) {
  const [compact, setCompact] = useState(false);
  const rows = table.getRowModel().rows;
  const headerGroups = table.getHeaderGroups();
  const colCount = table.getAllLeafColumns().length;

  const getStickyClass = (
    colIndex: number,
    columnId: string,
    metaSticky?: unknown,
  ): string => {
    if (metaSticky === "col-1" || metaSticky === 1) {
      return "table-sticky-col-1";
    }
    if (metaSticky === "col-2" || metaSticky === 2) {
      return "table-sticky-col-2 table-sticky-shadow";
    }
    if (metaSticky === true || metaSticky === "left") {
      return colIndex === 0
        ? "table-sticky-col-1 table-sticky-shadow"
        : "table-sticky-col-2 table-sticky-shadow";
    }

    if (typeof stickyColumns === "number") {
      if (colIndex === 0 && stickyColumns >= 1) {
        return stickyColumns === 1
          ? "table-sticky-col-1 table-sticky-shadow"
          : "table-sticky-col-1";
      }
      if (colIndex === 1 && stickyColumns >= 2) {
        return "table-sticky-col-2 table-sticky-shadow";
      }
    } else if (Array.isArray(stickyColumns)) {
      const idx = stickyColumns.indexOf(columnId);
      if (idx === 0) {
        return stickyColumns.length === 1
          ? "table-sticky-col-1 table-sticky-shadow"
          : "table-sticky-col-1";
      }
      if (idx === 1) {
        return "table-sticky-col-2 table-sticky-shadow";
      }
    }

    return "";
  };

  return (
    <div
      className="overflow-x-auto relative"
      onScroll={(e) => {
        const x = e.currentTarget.scrollLeft;
        setCompact((prev) => (prev ? x > 4 : x > 24));
      }}
      style={
        {
          "--sticky-col-1-width": stickyCol1Width,
        } as React.CSSProperties
      }
    >
      <table
        className={`table table-zebra ${stickyHeader ? "table-sticky-header" : ""}`}
      >
        <thead>
          {headerGroups.map((hg) => (
            <tr key={hg.id}>
              {hg.headers.map((h, i) => {
                const canSort = h.column.getCanSort();
                const sorted = h.column.getIsSorted();
                const stickyClass = getStickyClass(
                  i,
                  h.column.id,
                  (h.column.columnDef.meta as Record<string, any> | undefined)
                    ?.sticky,
                );
                return (
                  <th
                    key={h.id}
                    colSpan={h.colSpan}
                    className={stickyClass || undefined}
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
                className={
                  empty ? undefined : "p-8 text-center text-base-content/60"
                }
              >
                {empty ?? emptyText}
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr key={row.id}>
                {row.getAllCells().map((cell, i) => {
                  const meta = cell.column.columnDef.meta as
                    | CellMeta
                    | undefined;
                  const stickyClass = getStickyClass(
                    i,
                    cell.column.id,
                    meta?.sticky,
                  );
                  return (
                    <td
                      key={cell.id}
                      className={stickyClass || undefined}
                    >
                      {meta?.initials ? (
                        <ResponsiveName
                          name={String(cell.getValue() ?? "")}
                          subtitle={meta.subtitle?.(row.original)}
                          compact={compact}
                        />
                      ) : (
                        <FlexRender cell={cell} />
                      )}
                    </td>
                  );
                })}
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
