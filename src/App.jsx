// src/App.jsx
import { useState } from "react";
import Dropzone from "./components/Dropzone";
import ResultCard from "./components/ResultCard";
import { generateCaptions } from "./lib/generate";

const TONES = [
  { id: "punchy", label: "Punchy" },
  { id: "story", label: "Story" },
  { id: "minimal", label: "Minimal" },
  { id: "professional", label: "Professional" },
];

export default function App() {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [tone, setTone] = useState("punchy");
  const [status, setStatus] = useState("idle"); // idle | loading | done | error
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);

  const onSelect = (f) => {
    setFile(f);
    setPreview(URL.createObjectURL(f));
    setResults(null);
    setError(null);
    setStatus("idle");
  };

  const run = async () => {
    if (!file) return;
    setStatus("loading");
    setError(null);
    try {
      const data = await generateCaptions(file, tone);
      setResults(data);
      setStatus("done");
    } catch (err) {
      setError(err.message);
      setStatus("error");
    }
  };

  const reset = () => {
    setFile(null);
    setPreview(null);
    setResults(null);
    setError(null);
    setStatus("idle");
  };

  return (
    <div className="min-h-screen bg-ink text-paper">
      {/* Header */}
      <header className="border-b border-line">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
          <div className="flex items-center gap-3">
            <span className="h-2.5 w-2.5 rounded-full bg-amber" />
            <span className="font-display text-lg tracking-tight">Contact Sheet</span>
          </div>
          <span className="font-mono text-xs uppercase tracking-[0.2em] text-muted">
            caption · alt-text · tags
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-12">
        {/* Hero */}
        <div className="mb-10 max-w-xl">
          <h1 className="font-display text-4xl leading-[1.1] tracking-tight">
            Turn a photo into ready-to-post words.
          </h1>
          <p className="mt-3 text-muted">
            Drop an image, pick a voice, and get three captions, accessible alt-text, and
            relevant hashtags — drafted from what's actually in the frame.
          </p>
        </div>

        <div className="grid gap-10 md:grid-cols-2">
          {/* Left: image + controls */}
          <div className="space-y-5">
            {preview ? (
              <figure className="relative">
                <img
                  src={preview}
                  alt="Selected upload"
                  className="aspect-[4/3] w-full rounded-sm border border-line object-cover"
                />
                <button
                  onClick={reset}
                  className="absolute right-3 top-3 rounded-sm border border-line bg-ink/80 px-3 py-1 font-mono text-xs uppercase tracking-wider text-muted backdrop-blur transition-colors hover:border-amber/60 hover:text-amber"
                >
                  Replace
                </button>
              </figure>
            ) : (
              <Dropzone onSelect={onSelect} disabled={status === "loading"} />
            )}

            {/* Tone selector */}
            <div>
              <p className="mb-2 font-mono text-xs uppercase tracking-[0.2em] text-muted">Voice</p>
              <div className="flex flex-wrap gap-2">
                {TONES.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setTone(t.id)}
                    className={`rounded-sm border px-3 py-1.5 text-sm transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-amber
                      ${
                        tone === t.id
                          ? "border-amber bg-amber/10 text-amber"
                          : "border-line text-muted hover:border-amber/40 hover:text-paper"
                      }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={run}
              disabled={!file || status === "loading"}
              className="w-full rounded-sm bg-amber py-3 font-medium text-ink transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {status === "loading" ? "Developing…" : "Generate"}
            </button>
          </div>

          {/* Right: results */}
          <div>
            {status === "idle" && !results && (
              <div className="flex h-full min-h-[16rem] items-center justify-center rounded-sm border border-dashed border-line">
                <p className="px-8 text-center font-mono text-xs uppercase tracking-widest text-muted">
                  Results will appear here
                </p>
              </div>
            )}

            {status === "loading" && (
              <div className="flex h-full min-h-[16rem] items-center justify-center rounded-sm border border-line">
                <div className="flex flex-col items-center gap-3">
                  <span className="h-6 w-6 animate-spin rounded-full border-2 border-line border-t-amber" />
                  <p className="font-mono text-xs uppercase tracking-widest text-muted">Reading the frame</p>
                </div>
              </div>
            )}

            {status === "error" && (
              <div className="rounded-sm border border-amber/40 bg-amber/5 p-5">
                <p className="font-mono text-xs uppercase tracking-widest text-amber">Couldn't generate</p>
                <p className="mt-2 text-sm text-muted">{error}</p>
                <button
                  onClick={run}
                  className="mt-4 rounded-sm border border-line px-3 py-1.5 font-mono text-xs uppercase tracking-wider text-paper hover:border-amber/60 hover:text-amber"
                >
                  Try again
                </button>
              </div>
            )}

            {status === "done" && results && <ResultCard results={results} />}
          </div>
        </div>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto max-w-5xl px-6 py-5">
          <p className="font-mono text-xs text-muted">
            Built with React + Supabase Edge Functions + Claude vision. Key stays server-side.
          </p>
        </div>
      </footer>
    </div>
  );
}
