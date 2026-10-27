import { Link } from 'react-router-dom';
import { Briefcase, Building2, CalendarClock, User } from 'lucide-react';
import type { EntityRef } from '@/types';
import { fullName } from '@/domain/format';
import { useLookups } from '@/store/selectors';

const ROUTES = { candidate: '/kandidaten', company: '/unternehmen', job: '/vakanzen', assignment: '/einsaetze' } as const;

/** Bezeichnung + Route eines Bezugs */
export function useEntityInfo(ref: EntityRef | null | undefined): { label: string; to: string; icon: JSX.Element } | null {
  const l = useLookups();
  if (!ref) return null;
  const to = `${ROUTES[ref.typ]}/${ref.id}`;
  switch (ref.typ) {
    case 'candidate': {
      const c = l.candidate.get(ref.id);
      return c ? { label: fullName(c), to, icon: <User size={12} /> } : null;
    }
    case 'company': {
      const f = l.company.get(ref.id);
      return f ? { label: f.name, to, icon: <Building2 size={12} /> } : null;
    }
    case 'job': {
      const j = l.job.get(ref.id);
      return j ? { label: j.titel, to, icon: <Briefcase size={12} /> } : null;
    }
    case 'assignment': {
      const a = l.assignment.get(ref.id);
      return a ? { label: `Einsatz ${a.nr} · ${fullName(l.candidate.get(a.candidateId))}`, to, icon: <CalendarClock size={12} /> } : null;
    }
  }
}

export function EntityLink({ refTo, className }: { refTo: EntityRef | null | undefined; className?: string }) {
  const info = useEntityInfo(refTo);
  if (!info) return null;
  return (
    <Link to={info.to} className={className ?? 'inline-flex items-center gap-1 text-brand hover:underline'}>
      {info.icon}
      {info.label}
    </Link>
  );
}
