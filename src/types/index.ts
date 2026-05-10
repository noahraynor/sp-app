export type SessionStatus = 'transcribing' | 'generating_notes' | 'completed' | 'error';

export interface SoapNotes {
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
}

export interface CreateSessionRequest {
  blobUrl: string;
  audioFileName: string;
  clinicianNotes?: string;
  clinicianNotesFileName?: string;
  title?: string;
}

export interface CreateSessionResponse {
  id: string;
  status: SessionStatus;
}

export interface SessionStatusResponse {
  status: SessionStatus;
  errorMessage?: string;
}

export interface SessionListItem {
  id: string;
  title: string;
  createdAt: string;
  status: SessionStatus;
  audioFileName: string;
}

export interface SessionListResponse {
  sessions: SessionListItem[];
}

export interface SessionDetail {
  id: string;
  createdAt: string;
  title: string;
  status: SessionStatus;
  audioFileName: string;
  audioBlobUrl: string;
  audioDurationSeconds: number | null;
  clinicianNotesFileName: string | null;
  clinicianNotes: string | null;
  transcriptFormatted: string | null;
  soapNotes: SoapNotes | null;
  errorMessage: string | null;
}
