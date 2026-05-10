import { pgTable, uuid, text, timestamp, integer, jsonb } from 'drizzle-orm/pg-core';
import type { SoapNotes } from '@/types';

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

  soapNotes: jsonb('soap_notes').$type<SoapNotes>(),

  errorMessage: text('error_message'),
});

export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;
