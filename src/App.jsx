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
  const [cache, setCache] = useState({}); // { [toneId]: result } — per image, per tone
  const [loadingTone, setLoadingTone] = useState(null); // tone currently generating, or null
  const [error, setError] = useState(null); // error for the current attempt
  const [selectError, setSelectError] = useState(null); // bad file type/size at pick time

  const currentResult = cache[tone];
  const isLoading = loadingTone === tone;

  const onSelect = (f) => {
    setFile(f);
    setPreview(URL.createObjectURL(f));
    setCache({}); // a new image invalidates every tone's cached result
    setError(null);
    setSelectError(null);
    setLoadingTone(null);
  };

  const selectTone = (id) => {
    setTone(id);
    setError(null); // an error on the previous tone shouldn't bleed into this one
  };

  // Generate (or regenerate) for the currently selected tone and cache it.
  const run = async () => {
    if (!file || loadingTone) return;
    const forTone = tone; // pin the tone for this async call
    setLoadingTone(forTone);
    setError(null);
    try {
      const data = await generateCaptions(file, forTone);
      setCache((prev) => ({ ...prev, [forTone]: data }));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingTone(null);
    }
  };

  const reset = () => {
    setFile(null);
    setPreview(null);
    setCache({});
    setError(null);
    setSelectError(null);
    setLoadingTone(null);
  };

  return (
    <div className="min-h-screen bg-ink text-paper">
      {/* Header */}
      <header className="border-b border-line">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
          <div className="flex items-center gap-3">
            <span className="h-2.5 w-2.5 rounded-full bg-amber" />
            <span className="font-display text-lg tracking-tight">CaptionThis</span>
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
                  className="absolute right-3 top-3 rounded-sm border border-line bg-ink/80 px-3 py-1 font-mono text-xs uppercase tracking-wider text-muted backdrop-blur transition-colors hover:border-amber/60 hover:text-amber focus:outline-none focus-visible:ring-1 focus-visible:ring-amber"
                >
                  Replace
                </button>
              </figure>
            ) : (
              <Dropzone
                onSelect={onSelect}
                onError={setSelectError}
                disabled={Boolean(loadingTone)}
              />
            )}

            {selectError && !preview && (
              <p role="alert" className="text-sm text-amber">
                {selectError}
              </p>
            )}

            {/* Tone selector */}
            <div>
              <p className="mb-2 font-mono text-xs uppercase tracking-[0.2em] text-muted">Voice</p>
              <div className="flex flex-wrap gap-2">
                {TONES.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => selectTone(t.id)}
                    disabled={Boolean(loadingTone)}
                    className={`rounded-sm border px-3 py-1.5 text-sm transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-amber disabled:cursor-not-allowed disabled:opacity-50
                      ${
                        tone === t.id
                          ? "border-amber bg-amber/10 text-amber"
                          : "border-line text-muted hover:border-amber/40 hover:text-paper"
                      }`}
                  >
                    {t.label}
                    {cache[t.id] && tone !== t.id && (
                      <span className="ml-1.5 text-amber/70" aria-label="cached">
                        ·
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={run}
              disabled={!file || isLoading}
              className="w-full rounded-sm bg-amber py-3 font-medium text-ink transition-opacity hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber focus-visible:ring-offset-2 focus-visible:ring-offset-ink disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isLoading ? "Developing…" : currentResult ? "Regenerate" : "Generate"}
            </button>
          </div>

          {/* Right: results */}
          <div aria-live="polite">
            {isLoading && (
              <div className="flex h-full min-h-[16rem] items-center justify-center rounded-sm border border-line">
                <div className="flex flex-col items-center gap-3">
                  <span className="h-6 w-6 animate-spin rounded-full border-2 border-line border-t-amber" />
                  <p className="font-mono text-xs uppercase tracking-widest text-muted">Reading the frame</p>
                </div>
              </div>
            )}

            {!isLoading && error && (
              <div className="rounded-sm border border-amber/40 bg-amber/5 p-5">
                <p className="font-mono text-xs uppercase tracking-widest text-amber">Couldn't generate</p>
                <p className="mt-2 text-sm text-muted">{error}</p>
                <button
                  onClick={run}
                  className="mt-4 rounded-sm border border-line px-3 py-1.5 font-mono text-xs uppercase tracking-wider text-paper hover:border-amber/60 hover:text-amber focus:outline-none focus-visible:ring-1 focus-visible:ring-amber"
                >
                  Try again
                </button>
              </div>
            )}

            {!isLoading && !error && currentResult && <ResultCard results={currentResult} />}

            {!isLoading && !error && !currentResult && (
              <div className="flex h-full min-h-[16rem] items-center justify-center rounded-sm border border-dashed border-line">
                <p className="px-8 text-center font-mono text-xs uppercase tracking-widest text-muted">
                  {file ? "Press Generate to develop this voice" : "Results will appear here"}
                </p>
              </div>
            )}
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
