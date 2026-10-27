import { useMemo } from 'react';
import { History } from 'lucide-react';
import type { AuditEntity } from '@/types';
import { fmtDateTime } from '@/domain/format';
import { useData } from '@/store/data';
import { useLookups } from '@/store/selectors';
import { EmptyState } from '@/components/ui';

/** Änderungsverlauf eines Datensatzes (aus dem Audit-Log) */
export function AuditList({ entity, entityId, extraIds = [] }: { entity: AuditEntity; entityId: string; extraIds?: string[] }) {
  const audit = useData((s) => s.audit);
  const l = useLookups();
  const entries = useMemo(() => {
    const ids = new Set([entityId, ...extraIds]);
    return audit.filter((e) => (e.entity === entity && e.entityId === entityId) || (extraIds.length && ids.has(e.entityId))).slice(0, 60);
  }, [audit, entity, entityId, extraIds]);

  if (!entries.length) return <EmptyState icon={<History size={22} />} title="Noch kein Verlauf" text="Änderungen an diesem Datensatz werden hier protokolliert." />;
  return (
    <ol className="relative ml-2 space-y-3 border-l border-line pl-5">
      {entries.map((e) => (
        <li key={e.id} className="relative">
          <span className="absolute -left-[25px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-surface bg-brand" />
          <div className="text-[13px] font-medium">{e.text}</div>
          <div className="text-[11.5px] text-subtle">
            {fmtDateTime(e.ts)} · {l.user.get(e.userId)?.name ?? 'System'}
          </div>
        </li>
      ))}
    </ol>
  );
}
