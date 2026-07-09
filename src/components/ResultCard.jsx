// src/components/ResultCard.jsx
import { useState } from "react";

export default function ResultCard({ results }) {
  return (
    <div className="space-y-8">
      <Section label="Captions">
        <div className="space-y-3">
          {results.captions.map((c, i) => (
            <CopyRow key={i} index={i + 1} text={c} />
          ))}
        </div>
      </Section>

      <Section label="Alt-text">
        <CopyRow text={results.altText} />
      </Section>

      <Section label="Hashtags">
        <CopyRow text={results.hashtags.join(" ")} mono />
      </Section>
    </div>
  );
}

function Section({ label, children }) {
  return (
    <div>
      <div className="mb-3 flex items-center gap-3">
        <span className="font-mono text-xs uppercase tracking-[0.2em] text-amber">{label}</span>
        <span className="h-px flex-1 bg-line" />
      </div>
      {children}
    </div>
  );
}

function CopyRow({ text, index, mono }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  };

  return (
    <div className="group flex items-start gap-3 rounded-sm border border-line bg-ink-soft p-4">
      {index != null && (
        <span className="mt-0.5 font-mono text-xs text-muted">{String(index).padStart(2, "0")}</span>
      )}
      <p className={`flex-1 text-paper ${mono ? "font-mono text-sm leading-relaxed" : "leading-relaxed"}`}>
        {text}
      </p>
      <button
        onClick={copy}
        className="shrink-0 rounded-sm border border-line px-3 py-1 font-mono text-xs uppercase tracking-wider text-muted transition-colors hover:border-amber/60 hover:text-amber focus:outline-none focus-visible:ring-1 focus-visible:ring-amber"
      >
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}
