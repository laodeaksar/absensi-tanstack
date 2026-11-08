import {
  createColumnHelper,
  createPaginatedRowModel,
  createSortedRowModel,
  rowPaginationFeature,
  rowSortingFeature,
  tableFeatures,
  sortFn_alphanumeric,
  sortFn_basic,
  sortFn_datetime,
  sortFn_text,
} from "@tanstack/react-table";

// Fitur dideklarasikan sekali (TanStack Table v9). Pencarian dilakukan di luar tabel.
export const features = tableFeatures({
  rowSortingFeature,
  rowPaginationFeature,
  sortedRowModel: createSortedRowModel(),
  paginatedRowModel: createPaginatedRowModel(),
  sortFns: {
    alphanumeric: sortFn_alphanumeric,
    basic: sortFn_basic,
    datetime: sortFn_datetime,
    text: sortFn_text,
  },
});
export type AppFeatures = typeof features;

export const columnHelperFor = <TData extends Record<string, any>>() =>
  createColumnHelper<AppFeatures, TData>();
