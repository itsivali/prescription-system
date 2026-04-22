import * as React from 'react';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

export type Column<T> = {
  key: string;
  header: string;
  render?: (row: T) => React.ReactNode;
  className?: string;
};

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (row: T) => string;
  emptyMessage?: string;
  emptyIcon?: React.ReactNode;
  isLoading?: boolean;
  onRowClick?: (row: T) => void;
}

export function DataTable<T>({
  columns,
  data,
  keyExtractor,
  emptyMessage = 'No data available.',
  emptyIcon,
  isLoading,
  onRowClick,
}: DataTableProps<T>) {
  return (
    <div className="w-full overflow-auto rounded-2xl border border-border/50 bg-card shadow-[var(--shadow-card)]">
      <table className="w-full caption-bottom text-sm">
        <thead>
          <tr className="border-b border-border/50 bg-muted/40">
            {columns.map((col) => (
              <th
                key={col.key}
                className={cn(
                  'h-11 px-4 text-left align-middle text-[11px] font-semibold uppercase tracking-wider text-muted-foreground',
                  col.className,
                )}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {isLoading ? (
            <tr>
              <td colSpan={columns.length} className="h-32 text-center">
                <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin text-primary/50" />
                  <span className="text-xs">Loading...</span>
                </div>
              </td>
            </tr>
          ) : data.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="h-32 text-center">
                <div className="flex flex-col items-center gap-1.5">
                  {emptyIcon}
                  <span className="text-sm text-muted-foreground">{emptyMessage}</span>
                </div>
              </td>
            </tr>
          ) : (
            data.map((row) => (
              <tr
                key={keyExtractor(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={cn(
                  'border-b border-border/40 transition-colors duration-200 last:border-0 hover:bg-accent/40',
                  onRowClick && 'cursor-pointer',
                )}
              >
                {columns.map((col) => (
                  <td key={col.key} className={cn('px-4 py-3 align-middle', col.className)}>
                    {col.render
                      ? col.render(row)
                      : String((row as Record<string, unknown>)[col.key] ?? '')}
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
