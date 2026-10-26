import {
  createColumnHelper,
  createPaginatedRowModel,
  createSortedRowModel,
  rowPaginationFeature,
  rowSortingFeature,
  tableFeatures,
  sortFns
} from '@tanstack/react-table'

// Fitur dideklarasikan sekali (TanStack Table v9). Pencarian dilakukan di luar tabel.
export const features = tableFeatures({
  rowSortingFeature,
  rowPaginationFeature,
  sortedRowModel: createSortedRowModel(),
  paginatedRowModel: createPaginatedRowModel(),
  sortFns
})
export type AppFeatures = typeof features

export const columnHelperFor = <TData extends Record<string, any>>() =>
  createColumnHelper<AppFeatures, TData>()