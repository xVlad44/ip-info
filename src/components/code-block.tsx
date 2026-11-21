import { CopyButton } from './copy-button';

export function CodeBlock({ code, label, copy = true }: { code: string; label: string; copy?: boolean }) {
  return (
    <div className="relative rounded-lg border border-border bg-card">
      <pre className="max-h-[28rem] overflow-auto p-4 pr-12 font-mono text-[13px] leading-relaxed">
        <code>{code}</code>
      </pre>
      {copy && (
        <div className="absolute right-1.5 top-1.5">
          <CopyButton value={code} label={label} />
        </div>
      )}
    </div>
  );
}
