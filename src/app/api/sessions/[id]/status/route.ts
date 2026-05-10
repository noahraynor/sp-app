import { NextResponse } from 'next/server';
import { db } from '@/db';
import { sessions } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { getTranscriptionStatus, getTranscript } from '@/lib/soniox';
import { formatTranscript } from '@/lib/transcript-formatter';
import { generateSoapNotes } from '@/lib/claude';
import type { SessionStatusResponse } from '@/types';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const { id } = await params;

    const [session] = await db
      .select({
        status: sessions.status,
        sonioxTranscriptionId: sessions.sonioxTranscriptionId,
        transcriptFormatted: sessions.transcriptFormatted,
        clinicianNotes: sessions.clinicianNotes,
        errorMessage: sessions.errorMessage,
      })
      .from(sessions)
      .where(eq(sessions.id, id))
      .limit(1);

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    if (session.status === 'completed' || session.status === 'error') {
      return NextResponse.json({
        status: session.status,
        errorMessage: session.errorMessage ?? undefined,
      } satisfies SessionStatusResponse);
    }

    if (session.status === 'transcribing' && session.sonioxTranscriptionId) {
      const sonioxStatus = await getTranscriptionStatus(session.sonioxTranscriptionId);

      if (sonioxStatus.status === 'queued' || sonioxStatus.status === 'processing') {
        return NextResponse.json({ status: 'transcribing' } satisfies SessionStatusResponse);
      }

      if (sonioxStatus.status === 'error') {
        await db
          .update(sessions)
          .set({
            status: 'error',
            errorMessage: sonioxStatus.error_message ?? 'Transcription failed',
          })
          .where(and(eq(sessions.id, id), eq(sessions.status, 'transcribing')));

        return NextResponse.json({
          status: 'error',
          errorMessage: sonioxStatus.error_message ?? 'Transcription failed',
        } satisfies SessionStatusResponse);
      }

      if (sonioxStatus.status === 'completed') {
        const transcript = await getTranscript(session.sonioxTranscriptionId);
        const formattedTranscript = formatTranscript(transcript.tokens);

        const [updated] = await db
          .update(sessions)
          .set({
            status: 'generating_notes',
            transcriptRaw: transcript,
            transcriptFormatted: formattedTranscript,
            audioDurationSeconds: sonioxStatus.audio_duration_ms
              ? Math.round(sonioxStatus.audio_duration_ms / 1000)
              : null,
          })
          .where(and(eq(sessions.id, id), eq(sessions.status, 'transcribing')))
          .returning({ id: sessions.id });

        if (!updated) {
          const [current] = await db
            .select({ status: sessions.status })
            .from(sessions)
            .where(eq(sessions.id, id))
            .limit(1);
          return NextResponse.json({
            status: current.status as SessionStatusResponse['status'],
          } satisfies SessionStatusResponse);
        }

        try {
          const soapNotes = await generateSoapNotes(formattedTranscript, session.clinicianNotes);
          await db
            .update(sessions)
            .set({ status: 'completed', soapNotes })
            .where(eq(sessions.id, id));

          return NextResponse.json({ status: 'completed' } satisfies SessionStatusResponse);
        } catch (claudeError) {
          console.error('Claude SOAP generation failed:', claudeError);
          await db
            .update(sessions)
            .set({
              status: 'error',
              errorMessage: 'SOAP note generation failed. Transcript was saved successfully.',
            })
            .where(eq(sessions.id, id));

          return NextResponse.json({
            status: 'error',
            errorMessage: 'SOAP note generation failed. Transcript was saved successfully.',
          } satisfies SessionStatusResponse);
        }
      }
    }

    // Retry Claude generation if previous attempt timed out mid-generation
    if (session.status === 'generating_notes' && session.transcriptFormatted) {
      try {
        const soapNotes = await generateSoapNotes(
          session.transcriptFormatted,
          session.clinicianNotes,
        );
        await db
          .update(sessions)
          .set({ status: 'completed', soapNotes })
          .where(eq(sessions.id, id));

        return NextResponse.json({ status: 'completed' } satisfies SessionStatusResponse);
      } catch (claudeError) {
        console.error('Claude SOAP generation retry failed:', claudeError);
        await db
          .update(sessions)
          .set({
            status: 'error',
            errorMessage: 'SOAP note generation failed after retry.',
          })
          .where(eq(sessions.id, id));

        return NextResponse.json({
          status: 'error',
          errorMessage: 'SOAP note generation failed after retry.',
        } satisfies SessionStatusResponse);
      }
    }

    return NextResponse.json({
      status: session.status as SessionStatusResponse['status'],
    } satisfies SessionStatusResponse);
  } catch (error) {
    console.error('GET /api/sessions/[id]/status error:', error);
    return NextResponse.json({ error: 'Failed to check status' }, { status: 500 });
  }
}
