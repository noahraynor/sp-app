import type { SonioxToken } from './soniox';

interface SpeakerSegment {
  speaker: string;
  text: string;
}

export function formatTranscript(tokens: SonioxToken[]): string {
  if (tokens.length === 0) return '';

  const segments: SpeakerSegment[] = [];
  let currentSpeaker: string | null = null;
  let currentText = '';

  for (const token of tokens) {
    const speaker = token.speaker ?? 'Unknown';

    if (speaker !== currentSpeaker) {
      if (currentSpeaker !== null && currentText.trim()) {
        segments.push({ speaker: currentSpeaker, text: currentText.trim() });
      }
      currentSpeaker = speaker;
      currentText = token.text;
    } else {
      currentText += token.text;
    }
  }

  if (currentSpeaker !== null && currentText.trim()) {
    segments.push({ speaker: currentSpeaker, text: currentText.trim() });
  }

  return segments
    .map((seg) => `Speaker ${seg.speaker}: ${seg.text}`)
    .join('\n\n');
}
