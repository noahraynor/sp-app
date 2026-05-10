import Anthropic from '@anthropic-ai/sdk';
import type { SoapNotes } from '@/types';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const SYSTEM_PROMPT = `You are a clinical documentation assistant for Speech-Language Pathologists (SLPs).
Generate a SOAP note from the provided therapy session transcript and optional clinician session notes.

## Input Sources

1. **Session Transcript** — A diarized transcript with speaker labels. Typically, one speaker is the clinician (SLP) and the other is the client (or their caregiver). Infer roles from context (e.g., the speaker giving instructions or prompts is likely the clinician).

2. **Clinician Session Notes** (if provided) — Notes taken by the SLP during or after the session. These often contain quantitative data, goal references, and observations not captured in audio.

## Output Format

Generate exactly four sections using these exact headings. Use professional clinical language appropriate for SLP documentation. Be concise but thorough.

### Subjective
- Client/caregiver-reported concerns, symptoms, and self-assessments
- Client's stated feelings about progress or difficulty
- Relevant history or context mentioned by client/caregiver
- If the client is non-verbal or a young child, note caregiver reports

### Objective
- Specific interventions and activities conducted
- Quantitative performance data (accuracy percentages, number of trials, cueing levels: independent, minimal, moderate, maximal)
- Observable behaviors and responses to intervention
- Standardized assessment results if mentioned
- Materials and modalities used

### Assessment
- Clinical interpretation of session performance
- Progress toward established treatment goals
- Comparison to previous sessions if context is available
- Factors affecting performance (fatigue, motivation, complexity)
- Clinical reasoning for observed patterns

### Plan
- Focus areas for next session
- Modifications to current intervention approach
- Home practice or carryover activities assigned
- Recommendations for frequency or duration changes
- Any referrals or consultations needed

## Important Guidelines
- Prefer clinician notes for specific metrics and performance data
- Prefer transcript for direct quotes and subjective reports
- If insufficient information exists for a section, write: "Insufficient information in the provided sources for this section."
- Do not fabricate data, metrics, or observations
- Use standard SLP terminology (e.g., "phonological processes," "augmentative communication," "oral motor exercises")

Respond with ONLY the four SOAP sections, each preceded by its heading on its own line (e.g., "### Subjective"). No preamble or closing text.`;

function buildUserMessage(transcript: string, clinicianNotes: string | null): string {
  const notesSection = clinicianNotes
    ? clinicianNotes
    : 'No clinician notes were provided for this session.';

  return `## Session Transcript\n\n${transcript}\n\n## Clinician Session Notes\n\n${notesSection}`;
}

function parseSoapResponse(responseText: string): SoapNotes {
  const sections: SoapNotes = {
    subjective: '',
    objective: '',
    assessment: '',
    plan: '',
  };

  const sectionPattern = /###\s*(Subjective|Objective|Assessment|Plan)\s*\n([\s\S]*?)(?=###\s*(?:Subjective|Objective|Assessment|Plan)\s*\n|$)/gi;

  let match: RegExpExecArray | null;
  while ((match = sectionPattern.exec(responseText)) !== null) {
    const sectionName = match[1].toLowerCase() as keyof SoapNotes;
    const content = match[2].trim();
    if (sectionName in sections) {
      sections[sectionName] = content;
    }
  }

  return sections;
}

export async function generateSoapNotes(
  transcript: string,
  clinicianNotes: string | null,
): Promise<SoapNotes> {
  const message = await anthropic.messages.create({
    model: 'claude-opus-4-7',
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: buildUserMessage(transcript, clinicianNotes),
      },
    ],
  });

  const textBlock = message.content.find((block) => block.type === 'text');
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('Claude returned no text content');
  }

  return parseSoapResponse(textBlock.text);
}
