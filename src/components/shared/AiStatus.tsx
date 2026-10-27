import { Link } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import { useAiAvailability } from '@/lib/ai';
import { cn } from '@/lib/cn';
import { Badge } from '@/components/ui';

/** Kennzeichnung der Quelle eines Ergebnisses */
export function SourceBadge({ source }: { source: 'ki' | 'heuristik' | 'vorlage' | 'lokal' }) {
  return source === 'ki' ? (
    <Badge tone="indigo" icon={<Sparkles size={11} />}>
      KI (Claude)
    </Badge>
  ) : (
    <Badge tone="gray">{source === 'vorlage' ? 'Vorlage' : 'Lokale Erkennung'}</Badge>
  );
}

/** Kleiner Statushinweis in der Topbar */
export function AiStatusPill({ className }: { className?: string }) {
  const { available, loading, via } = useAiAvailability();
  if (loading) return null;
  return (
    <Link
      to="/einstellungen?tab=ki"
      title={available ? `KI aktiv (${via === 'server' ? 'Server-Schlüssel' : 'eigener Schlüssel'})` : 'KI nicht aktiv – lokale Erkennung wird verwendet'}
      className={cn(
        'hidden items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11.5px] font-semibold sm:inline-flex',
        available
          ? 'border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-900 dark:bg-indigo-950/60 dark:text-indigo-300'
          : 'border-line bg-surface-2 text-muted',
        className,
      )}
    >
      <Sparkles size={12} />
      {available ? 'KI aktiv' : 'KI aus'}
    </Link>
  );
}

/** Hinweis im Import-Dialog, wie ausgewertet wird */
export function AiModeHint() {
  const { available, loading } = useAiAvailability();
  if (loading) return null;
  return available ? (
    <span>
      Die Auswertung erfolgt per <strong>KI (Claude)</strong>. Inhalte werden dazu an Anthropic übermittelt (keine Speicherung zu Trainingszwecken).
    </span>
  ) : (
    <span>
      KI ist nicht aktiv – es wird die <strong>lokale Erkennung</strong> verwendet. Genauer (auch für Scans und Fotos) mit KI:{' '}
      <Link to="/einstellungen?tab=ki" className="font-semibold underline">
        Einstellungen → KI
      </Link>
      .
    </span>
  );
}
