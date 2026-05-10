# SP-App: Speech Pathologist SOAP Notes Generator

## Context

Speech-Language Pathologists (SLPs) spend significant time writing clinical documentation after therapy sessions. SOAP notes (Subjective, Objective, Assessment, Plan) are the standard format. This app automates that process: the SLP uploads a session recording and optional handwritten notes, and the app produces a structured SOAP note from the combined inputs.

**Target user:** A single SLP (no multi-tenancy, no auth).
**Core value:** Save documentation time while maintaining clinical accuracy.

## Architecture

**Next.js monolith** deployed on Vercel (Pro tier for 60s function timeout).

```
┌──────────────────────────────────────────────┐
│                   Vercel                      │
│  ┌────────────┐    ┌──────────────────────┐  │
│  │  Next.js   │    │   Next.js API Routes │  │
│  │  Frontend  │───▶│   /api/*             │  │
│  │  (React +  │    │                      │  │
│  │  shadcn)   │    └───────┬──────────────┘  │
│  └────────────┘            │                 │
└────────────────────────────┼─────────────────┘
                             │
              ┌──────────────┼──────────────┐
              ▼              ▼              ▼
        ┌──────────┐  ┌──────────┐  ┌────────────┐
        │  Vercel  │  │   Neon   │  │  External  │
        │  Blob    │  │ Postgres │  │   APIs     │
        │ (audio)  │  │ (data)   │  │ Soniox,    │
        └──────────┘  └──────────┘  │ Claude     │
                                    └────────────┘
```

### Technology Choices

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Framework | Next.js (App Router) | Single deployment, shared types, Vercel-native |
| Frontend | React + shadcn/ui + Tailwind | Functional UI, fast to build, good defaults |
| Database | Neon Postgres | Managed serverless Postgres, Vercel integration |
| ORM | Drizzle ORM | Lightweight, type-safe, good Neon support |
| Audio Storage | Vercel Blob | Client-side upload, no serverless body-size limits |
| Transcription | Soniox (`@soniox/node`) | Async transcription with speaker diarization |
| SOAP Generation | Claude Opus 4.7 (`@anthropic-ai/sdk`) | Best reasoning model for clinical documentation |
| Deployment | Vercel (Pro tier) | 60s function timeout for combined pipeline steps |

## Data Model

Single `sessions` table in Neon Postgres:

```sql
CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'transcribing',
  -- status enum: 'transcribing' | 'generating_notes' | 'completed' | 'error'

  -- Audio
  audio_file_name TEXT NOT NULL,
  audio_blob_url TEXT NOT NULL,
  audio_duration_seconds INTEGER,

  -- Clinician Notes (optional)
  clinician_notes_file_name TEXT,
  clinician_notes TEXT,

  -- Transcription
  soniox_transcription_id TEXT,
  transcript_raw JSONB,
  transcript_formatted TEXT,

  -- SOAP Notes
  soap_notes JSONB,
  -- shape: { subjective: string, objective: string, assessment: string, plan: string }

  -- Error handling
  error_message TEXT
);
```

### Drizzle Schema (TypeScript)

```typescript
// Defined in src/db/schema.ts
import { pgTable, uuid, text, timestamp, integer, jsonb } from 'drizzle-orm/pg-core';

export const sessions = pgTable('sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  title: text('title').notNull(),
  status: text('status').notNull().default('transcribing'),

  audioFileName: text('audio_file_name').notNull(),
  audioBlobUrl: text('audio_blob_url').notNull(),
  audioDurationSeconds: integer('audio_duration_seconds'),

  clinicianNotesFileName: text('clinician_notes_file_name'),
  clinicianNotes: text('clinician_notes'),

  sonioxTranscriptionId: text('soniox_transcription_id'),
  transcriptRaw: jsonb('transcript_raw'),
  transcriptFormatted: text('transcript_formatted'),

  soapNotes: jsonb('soap_notes'),

  errorMessage: text('error_message'),
});
```

### TypeScript Types

```typescript
// Derived from Drizzle schema
type SessionStatus = 'transcribing' | 'generating_notes' | 'completed' | 'error';

interface SoapNotes {
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
}

// API response type (inferred from Drizzle select)
type Session = typeof sessions.$inferSelect;
```

## Processing Pipeline

```
User Action                    System                          External
───────────                    ──────                          ────────
1. Select audio file ──────▶ Validate file type
   Select notes file (opt) ─▶ Read text content

2. Click "Start" ──────────▶ Upload audio to ──────────────▶ Vercel Blob
                              Vercel Blob (client-side)        returns URL
                              
3.                            POST /api/sessions ─────────────▶ Soniox
                              • Create session record             async
                                (status: 'transcribing')          transcribe
                              • Store notes text in DB
                              • Send blob URL to Soniox
                              • Store soniox_transcription_id
                              • Return session ID
                              
4. Frontend polls ──────────▶ GET /api/sessions/:id/status
   every 5 seconds            • Query Soniox for status ──────▶ Soniox
                              • If not done: return status
                              
5.                            • If done:
                                - Fetch transcript from Soniox ─▶ Soniox
                                - Save raw + formatted to DB
                                - Update status: 'generating_notes'
                                - Send transcript + notes ──────▶ Claude
                                  to Claude Opus 4.7              Opus 4.7
                                - Save SOAP notes to DB
                                - Update status: 'completed'
                                
6. Frontend receives ◀──────  Return { status: 'completed' }
   'completed' status
   Navigates to detail view
```

### Error Handling

- **Upload failure:** Show error toast, allow retry. No session record created.
- **Soniox failure:** Poll returns error status from Soniox → update session status to `error`, store error message. UI shows error with option to delete and re-upload.
- **Claude failure:** Transcript is already saved. Update status to `error`. User retains transcript even if SOAP generation fails.
- **Network errors during polling:** Frontend retries automatically. Polling is idempotent.

## API Routes

```
POST   /api/upload              → Vercel Blob client upload token
POST   /api/sessions            → Create session, initiate transcription
GET    /api/sessions            → List all sessions (id, title, date, status)
GET    /api/sessions/:id        → Full session detail (transcript + SOAP notes)
GET    /api/sessions/:id/status → Poll processing status (triggers pipeline)
DELETE /api/sessions/:id        → Delete session + audio blob
```

### Request/Response Shapes

**POST /api/sessions**
```typescript
// Request
{ blobUrl: string; audioFileName: string; clinicianNotes?: string; clinicianNotesFileName?: string; title?: string; }

// Response
{ id: string; status: SessionStatus; }
```

**GET /api/sessions**
```typescript
// Response
{ sessions: { id: string; title: string; createdAt: string; status: SessionStatus; audioFileName: string; }[] }
```

**GET /api/sessions/:id**
```typescript
// Response: full Session object from DB
```

**GET /api/sessions/:id/status**
```typescript
// Response
{ status: SessionStatus; errorMessage?: string; }
```

## Frontend

### Pages

**1. Dashboard (`/`)**
- App header: "SP Notes"
- Primary action button: "Upload Recording" → opens upload form
- Session list: cards showing title, date, status badge, audio file name
- Status badges: colored by state (blue=processing, green=completed, red=error)
- Click card → navigates to `/sessions/[id]`
- Empty state: message encouraging first upload

**2. Upload Form (modal or inline on Dashboard)**
- Audio file input (required): accepts `.mp3, .wav, .aac, .flac, .ogg, .webm, .m4a`
- Notes file input (optional): accepts `.txt, .md`
- Title input (optional): defaults to "Session — {date}"
- Submit button: "Start Processing"
- Upload progress indicator
- On submit: uploads audio, creates session, navigates to session detail with polling

**3. Session Detail (`/sessions/[id]`)**
- Back button to dashboard
- Header: title, date, status
- If processing: animated progress showing current step
- If completed:
  - **Transcript section:** full diarized transcript with speaker labels, scrollable
  - **SOAP Notes section:** four labeled subsections (S, O, A, P), each in its own card
  - If clinician notes were provided: collapsible section showing original notes
- If error: error message with delete option

### shadcn Components Used

- `Button`, `Card`, `Badge`, `Input`, `Label` — core building blocks
- `Dialog` or inline form — for upload
- `Tabs` — for switching between transcript and SOAP notes views
- `Skeleton` — loading states
- `Alert` — error display

## Claude SOAP Note Prompt

```
System prompt:

You are a clinical documentation assistant for Speech-Language Pathologists (SLPs).
Generate a SOAP note from the provided therapy session transcript and optional
clinician session notes.

## Input Sources

1. **Session Transcript** — A diarized transcript with speaker labels. Typically,
   one speaker is the clinician (SLP) and the other is the client (or their
   caregiver). Infer roles from context (e.g., the speaker giving instructions
   or prompts is likely the clinician).

2. **Clinician Session Notes** (if provided) — Handwritten notes taken by the SLP
   during or after the session. These often contain quantitative data, goal
   references, and observations not captured in audio.

## Output Format

Generate exactly four sections. Use professional clinical language appropriate
for SLP documentation. Be concise but thorough.

### Subjective (S)
- Client/caregiver-reported concerns, symptoms, and self-assessments
- Client's stated feelings about progress or difficulty
- Relevant history or context mentioned by client/caregiver
- If the client is non-verbal or a young child, note caregiver reports

### Objective (O)
- Specific interventions and activities conducted
- Quantitative performance data (accuracy percentages, number of trials,
  cueing levels: independent, minimal, moderate, maximal)
- Observable behaviors and responses to intervention
- Standardized assessment results if mentioned
- Materials and modalities used

### Assessment (A)
- Clinical interpretation of session performance
- Progress toward established treatment goals
- Comparison to previous sessions if context is available
- Factors affecting performance (fatigue, motivation, complexity)
- Clinical reasoning for observed patterns

### Plan (P)
- Focus areas for next session
- Modifications to current intervention approach
- Home practice or carryover activities assigned
- Recommendations for frequency or duration changes
- Any referrals or consultations needed

## Important Guidelines
- Prefer clinician notes for specific metrics and performance data
- Prefer transcript for direct quotes and subjective reports
- If insufficient information exists for a section, write:
  "Insufficient information in the provided sources for this section."
- Do not fabricate data, metrics, or observations
- Use standard SLP terminology (e.g., "phonological processes,"
  "augmentative communication," "oral motor exercises")

Respond with ONLY the four SOAP sections, each preceded by its heading
(Subjective, Objective, Assessment, Plan). No preamble or closing.
```

User message format:
```
## Session Transcript

{transcriptFormatted}

## Clinician Session Notes

{clinicianNotes || "No clinician notes were provided for this session."}
```

## Environment Variables

```
# Vercel Blob
BLOB_READ_WRITE_TOKEN=        # Vercel Blob storage token

# Neon Postgres
DATABASE_URL=                   # Neon connection string (pooled)

# Soniox
SONIOX_API_KEY=                 # Soniox API key

# Anthropic
ANTHROPIC_API_KEY=              # Claude API key
```

## Project Structure

```
sp-app/
├── src/
│   ├── app/
│   │   ├── layout.tsx                 # Root layout
│   │   ├── page.tsx                   # Dashboard (session list + upload)
│   │   ├── sessions/
│   │   │   └── [id]/
│   │   │       └── page.tsx           # Session detail view
│   │   └── api/
│   │       ├── upload/
│   │       │   └── route.ts           # Vercel Blob upload handler
│   │       └── sessions/
│   │           ├── route.ts           # POST (create) + GET (list)
│   │           └── [id]/
│   │               ├── route.ts       # GET (detail) + DELETE
│   │               └── status/
│   │                   └── route.ts   # GET (poll status + trigger pipeline)
│   ├── components/
│   │   ├── upload-form.tsx            # Audio + notes file upload form
│   │   ├── session-list.tsx           # Dashboard session cards
│   │   ├── session-detail.tsx         # Transcript + SOAP display
│   │   ├── processing-status.tsx      # Progress indicator during processing
│   │   └── soap-notes-display.tsx     # Four-section SOAP note renderer
│   ├── db/
│   │   ├── index.ts                   # Drizzle client + Neon connection
│   │   └── schema.ts                  # Drizzle schema definition
│   ├── lib/
│   │   ├── soniox.ts                  # Soniox API wrapper (create, poll, fetch transcript)
│   │   ├── claude.ts                  # Claude API wrapper (generate SOAP notes)
│   │   └── transcript-formatter.ts    # Format raw Soniox response to readable text
│   └── types/
│       └── index.ts                   # Shared TypeScript types (SessionStatus, SoapNotes, etc.)
├── drizzle/
│   └── migrations/                    # Generated migration files
├── drizzle.config.ts                  # Drizzle Kit config
├── components.json                    # shadcn config
├── tailwind.config.ts
├── next.config.ts
├── package.json
└── tsconfig.json
```

## Verification Plan

### Local Development Testing
1. Set up environment variables (Soniox key, Anthropic key, Neon DB URL, Blob token)
2. Run `npm run dev` and open `localhost:3000`
3. Upload a sample audio file (30-60 sec speech therapy clip or any speech audio)
4. Verify file uploads to Vercel Blob successfully
5. Verify session appears in dashboard with "transcribing" status
6. Wait for transcription to complete — verify transcript appears in DB and UI
7. Verify SOAP notes are generated and all four sections populated
8. Verify session detail page shows transcript and SOAP notes correctly
9. Test with and without clinician notes file
10. Test error states: upload invalid file type, simulate Soniox failure

### Edge Cases
- Upload without notes file (notes should be null, Claude prompt adjusts)
- Very short recording (< 1 min)
- Audio with single speaker (no diarization separation)
- Poor audio quality / mostly silence
- Large file upload (100MB+)

### Deployment Testing
1. Deploy to Vercel
2. Verify environment variables configured in Vercel dashboard
3. Repeat upload flow on deployed URL
4. Verify Vercel Blob, Neon, Soniox, and Claude all work in production
