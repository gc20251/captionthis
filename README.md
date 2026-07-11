# CaptionThis — AI caption & metadata generator

Drop in a photo → get three captions, accessible alt-text, and relevant hashtags,
drafted by Claude from what's actually in the frame. Built as a portfolio piece:
**React + Supabase Edge Functions + Claude vision**, with the API key kept server-side.

---

## Why it's built this way

The browser **never** sees your Anthropic API key. The React app sends the image to a
Supabase Edge Function, which holds the key as a server secret and calls Claude. That one
architectural choice is the difference between a tutorial demo and something that could ship.

```
[ React app ]  --image-->  [ Supabase Edge Function ]  --image-->  [ Anthropic API ]
   (public)                  (holds ANTHROPIC_API_KEY)              (Claude vision)
       ^------------------------ JSON results ------------------------------|
```

---

## Setup (about 20 minutes)

### 1. Install the frontend

```bash
npm install
cp .env.example .env.local   # then fill in the two values (see step 4)
```

### 2. Create a Supabase project

Make a free project at supabase.com. Note your **Project URL** and **anon public key**
(Project Settings → API).

### 3. Deploy the edge function + set the secret

Install the Supabase CLI, then from the project root:

```bash
supabase login
supabase link --project-ref YOUR-PROJECT-REF
supabase secrets set ANTHROPIC_API_KEY=sk-ant-your-key-here
supabase functions deploy generate-captions
```

### 4. Wire the frontend env vars

In `.env.local`:

```
VITE_SUPABASE_URL=https://YOUR-PROJECT-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key
```

### 5. Run it

```bash
npm run dev
```

Open the local URL, drop in a photo, pick a voice, hit **Generate**.

---

## Project structure

```
captionthis/
├── index.html
├── package.json
├── tailwind.config.js          # darkroom palette (ink / paper / amber)
├── .env.example
├── src/
│   ├── App.jsx                 # orchestrates upload → tone → generate → results
│   ├── lib/generate.js         # file→base64 + calls the edge function
│   └── components/
│       ├── Dropzone.jsx        # drag-and-drop upload
│       └── ResultCard.jsx      # captions / alt-text / hashtags + copy buttons
└── supabase/
    ├── config.toml
    └── functions/generate-captions/
        └── index.ts            # the Anthropic vision proxy (server-side key)
```

---

## How this maps to your Week 4 build plan

- **Day 1** — React scaffold + drag-and-drop UI → `App.jsx`, `Dropzone.jsx` ✓ (done here)
- **Day 2** — Edge Function calling Anthropic with a test image → `index.ts` ✓ (done here)
- **Day 3** — Wire frontend → function → `generate.js` ✓ (done here)
- **Day 4** — Prompt engineering for structured JSON + tone → tune `buildPrompt()` in `index.ts`
- **Day 5** — Polish, copy buttons, loading + error states → mostly in place; refine to taste
- **Day 6** — Deploy (Vercel/Netlify for the frontend), write this README, record a 30-sec demo
- **Day 7** — LinkedIn post + resume line

So Days 1–3 are scaffolded. Your real learning happens in **Day 4** — shaping the prompt so the
JSON comes back clean and the tones feel distinct. That's the DeepLearning.AI course applied.

---

## Customization ideas

- **Cheaper/faster:** change `MODEL` in `index.ts` to the Haiku model string once your prompt is tuned.
- **Lock down CORS:** replace `"*"` in the edge function with your deployed domain.
- **Re-skin:** the architecture is identical for a disc-golf, pickleball, or dog-training-log
  version — swap the prompt in `buildPrompt()` and the copy in `App.jsx`.

---

## Deploy the frontend

```bash
npm run build        # outputs to dist/
```

Drop the repo into Vercel or Netlify, add the two `VITE_` env vars in their dashboard, and ship.

> Note: this scaffold uses placeholder credentials. Nothing calls a live API until you complete
> the Supabase steps above with your own keys.
