// src/components/Dropzone.jsx
import { useCallback, useState } from "react";
import { ACCEPTED_TYPES, validateFile } from "../lib/image";

// The real control is the (screen-reader-only) file input; the visible dropzone
// is its <label>. That gives us native keyboard activation (Tab to focus,
// Enter/Space opens the picker) and a genuine label/input pairing for free —
// no role="button" emulation needed.
export default function Dropzone({ onSelect, onError, disabled }) {
  const [dragging, setDragging] = useState(false);

  const handleFiles = useCallback(
    (files) => {
      const file = files?.[0];
      if (!file) return;
      try {
        validateFile(file); // throws a human-readable message on bad type/size
      } catch (err) {
        onError?.(err.message);
        return;
      }
      onSelect(file);
    },
    [onSelect, onError]
  );

  return (
    <div className="relative">
      <input
        id="photo-input"
        type="file"
        accept={ACCEPTED_TYPES.join(",")}
        className="peer sr-only"
        disabled={disabled}
        onChange={(e) => handleFiles(e.target.files)}
      />
      <label
        htmlFor="photo-input"
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (!disabled) handleFiles(e.dataTransfer.files);
        }}
        className={`group relative flex aspect-[4/3] cursor-pointer flex-col items-center justify-center rounded-sm border transition-colors peer-focus-visible:ring-1 peer-focus-visible:ring-amber peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-ink peer-disabled:cursor-not-allowed peer-disabled:opacity-50
          ${dragging ? "border-amber bg-amber/5" : "border-line hover:border-amber/60"}`}
      >
        {/* corner frame marks — like registration marks on a print */}
        <Corner className="left-3 top-3 border-l border-t" />
        <Corner className="right-3 top-3 border-r border-t" />
        <Corner className="bottom-3 left-3 border-b border-l" />
        <Corner className="bottom-3 right-3 border-b border-r" />

        <div className="flex h-12 w-12 items-center justify-center rounded-full border border-line text-amber transition-colors group-hover:border-amber/60">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
            <path d="M12 16V4m0 0L7 9m5-5l5 5" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M4 17v2a1 1 0 001 1h14a1 1 0 001-1v-2" strokeLinecap="round" />
          </svg>
        </div>
        <span className="mt-4 font-display text-lg text-paper">Drop a photo here</span>
        <span className="mt-1 font-mono text-xs uppercase tracking-widest text-muted">
          JPEG · PNG · WebP · or click to browse
        </span>
      </label>
    </div>
  );
}

function Corner({ className }) {
  return <span className={`pointer-events-none absolute h-4 w-4 border-line ${className}`} />;
}
