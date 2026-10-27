import { useRef, useState } from 'react';
import { FileText, Upload } from 'lucide-react';
import { cn } from '@/lib/cn';
import { formatBytes } from '@/lib/files';

/** Datei per Drag & Drop oder Klick wählen */
export function FileDropzone({ accept, file, onFile, title = 'Datei hierhin ziehen oder klicken', hint }: { accept: string; file: File | null; onFile: (f: File | null) => void; title?: string; hint?: string }) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => input.current?.click()}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && input.current?.click()}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        const f = e.dataTransfer.files?.[0];
        if (f) onFile(f);
      }}
      className={cn(
        'cursor-pointer rounded-xl border-2 border-dashed px-4 py-7 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40',
        over ? 'border-brand bg-brand-soft' : 'border-line hover:border-brand hover:bg-brand-soft/50',
      )}
    >
      {file ? (
        <div className="flex items-center justify-center gap-2 text-sm">
          <FileText size={20} className="text-brand" />
          <span className="font-semibold">{file.name}</span>
          <span className="text-muted">({formatBytes(file.size)})</span>
          <button
            type="button"
            className="ml-2 text-xs text-muted underline hover:text-red-600"
            onClick={(e) => {
              e.stopPropagation();
              onFile(null);
            }}
          >
            Entfernen
          </button>
        </div>
      ) : (
        <>
          <Upload size={24} className="mx-auto mb-2 text-subtle" />
          <div className="text-sm font-semibold">{title}</div>
          {hint && <div className="mt-1 text-xs text-muted">{hint}</div>}
        </>
      )}
      <input
        ref={input}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          onFile(e.target.files?.[0] ?? null);
          e.target.value = '';
        }}
      />
    </div>
  );
}
