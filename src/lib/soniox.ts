import { SonioxNodeClient } from '@soniox/node';

const client = new SonioxNodeClient({
  api_key: process.env.SONIOX_API_KEY,
});

const SONIOX_API_BASE = 'https://api.soniox.com/v1';

export async function createTranscription(audioUrl: string): Promise<string> {
  const transcription = await client.stt.create({
    model: 'stt-async-v4',
    audio_url: audioUrl,
    enable_speaker_diarization: true,
  });
  return transcription.id;
}

interface SonioxStatusResponse {
  id: string;
  status: 'queued' | 'processing' | 'completed' | 'error';
  error_message?: string;
  audio_duration_ms?: number;
}

export async function getTranscriptionStatus(transcriptionId: string): Promise<SonioxStatusResponse> {
  const response = await fetch(`${SONIOX_API_BASE}/transcriptions/${transcriptionId}`, {
    headers: {
      'Authorization': `Bearer ${process.env.SONIOX_API_KEY}`,
    },
  });
  if (!response.ok) {
    throw new Error(`Soniox status check failed: ${response.status} ${response.statusText}`);
  }
  return response.json();
}

export interface SonioxToken {
  text: string;
  start_ms: number;
  end_ms: number;
  confidence: number;
  speaker?: string | null;
}

interface SonioxTranscriptResponse {
  id: string;
  text: string;
  tokens: SonioxToken[];
}

export async function getTranscript(transcriptionId: string): Promise<SonioxTranscriptResponse> {
  const response = await fetch(`${SONIOX_API_BASE}/transcriptions/${transcriptionId}/transcript`, {
    headers: {
      'Authorization': `Bearer ${process.env.SONIOX_API_KEY}`,
    },
  });
  if (!response.ok) {
    throw new Error(`Soniox transcript fetch failed: ${response.status} ${response.statusText}`);
  }
  return response.json();
}
