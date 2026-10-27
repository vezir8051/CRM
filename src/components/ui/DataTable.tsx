/* ============================================================
   Tabelle mit Sortierung, Klick-Zeilen und Leerzustand.

   <DataTable
     rows={candidates}
     rowKey={(c) => c.id}
     onRowClick={(c) => navigate(`/kandidaten/${c.id}`)}
     columns={[
       { key: 'name', header: 'Name', cell: (c) => …, sortValue: (c) => c.nachname },
       { key: 'aktionen', header: '', cell: (c) => <IconButton …/>, align: 'right' },
     ]}
     empty={<EmptyState … />}
   />
   Klicks auf Buttons/Links in einer Zeile lösen onRowClick nicht aus.
   ============================================================ */
import { useMemo, useState, type ReactNode } from 'react';
import { ArrowDown, ArrowUp } from 'lucide-react';
import { cn } from '@/lib/cn';

export interface Column<T> {
  key: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  /** Wert für die Sortierung; ohne Angabe nicht sortierbar */
  sortValue?: (row: T) => string | number | null | undefined;
  align?: 'left' | 'right' | 'center';
  className?: string;
  /** Auf kleinen Bildschirmen ausblenden */
  hideOnMobile?: boolean;
}

export interface DataTableProps<T> {
  rows: T[];
  columns: Column<T>[];
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  empty?: ReactNode;
  defaultSort?: { key: string; dir: 'asc' | 'desc' };
  rowClassName?: (row: T) => string | undefined;
  footer?: ReactNode;
  className?: string;
}

export function DataTable<T>({ rows, columns, rowKey, onRowClick, empty, defaultSort, rowClassName, footer, className }: DataTableProps<T>) {
  const [sort, setSort] = useState(defaultSort ?? null);

  const sorted = useMemo(() => {
    if (!sort) return rows;
    const col = columns.find((c) => c.key === sort.key);
    if (!col?.sortValue) return rows;
    const dir = sort.dir === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => {
      const va = col.sortValue!(a);
      const vb = col.sortValue!(b);
      if (va === vb) return 0;
      if (va === null || va === undefined || va === '') return 1;
      if (vb === null || vb === undefined || vb === '') return -1;
      return (typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va).localeCompare(String(vb), 'de-CH', { numeric: true })) * dir;
    });
  }, [rows, columns, sort]);

  const toggle = (key: string) =>
    setSort((s) => (s?.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }));

  if (!rows.length && empty) return <>{empty}</>;

  return (
    <div className={cn('overflow-x-auto', className)}>
      <table className="w-full border-collapse text-[13.5px]">
        <thead>
          <tr>
            {columns.map((c) => (
              <th
                key={c.key}
                scope="col"
                className={cn(
                  'whitespace-nowrap border-b border-line bg-surface-2 px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-subtle',
                  c.align === 'right' ? 'text-right' : c.align === 'center' ? 'text-center' : 'text-left',
                  c.sortValue && 'cursor-pointer select-none hover:text-fg',
                  c.hideOnMobile && 'hidden md:table-cell',
                )}
                onClick={c.sortValue ? () => toggle(c.key) : undefined}
              >
                <span className="inline-flex items-center gap-1">
                  {c.header}
                  {sort?.key === c.key && (sort.dir === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row) => (
            <tr
              key={rowKey(row)}
              onClick={
                onRowClick
                  ? (e) => {
                      if ((e.target as HTMLElement).closest('button, a, input, select, label')) return;
                      onRowClick(row);
                    }
                  : undefined
              }
              className={cn('border-b border-line last:border-0 transition-colors hover:bg-brand-soft/60', onRowClick && 'cursor-pointer', rowClassName?.(row))}
            >
              {columns.map((c) => (
                <td
                  key={c.key}
                  className={cn(
                    'px-4 py-2.5 align-middle',
                    c.align === 'right' ? 'text-right' : c.align === 'center' ? 'text-center' : 'text-left',
                    c.hideOnMobile && 'hidden md:table-cell',
                    c.className,
                  )}
                >
                  {c.cell(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        {footer && <tfoot>{footer}</tfoot>}
      </table>
    </div>
  );
}

/** Hauptzeile + Unterzeile in einer Zelle */
export function CellStack({ main, sub, className }: { main: ReactNode; sub?: ReactNode; className?: string }) {
  return (
    <div className={cn('min-w-0', className)}>
      <div className="truncate font-semibold">{main}</div>
      {sub && <div className="truncate text-xs text-muted">{sub}</div>}
    </div>
  );
}
