import { NextResponse } from 'next/server';
import { db } from '@/db';
import { sessions } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { del } from '@vercel/blob';
import type { SessionDetail, SessionStatus, SoapNotes } from '@/types';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const { id } = await params;

    const [session] = await db
      .select()
      .from(sessions)
      .where(eq(sessions.id, id))
      .limit(1);

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    const response: SessionDetail = {
      id: session.id,
      createdAt: session.createdAt.toISOString(),
      title: session.title,
      status: session.status as SessionStatus,
      audioFileName: session.audioFileName,
      audioBlobUrl: session.audioBlobUrl,
      audioDurationSeconds: session.audioDurationSeconds,
      clinicianNotesFileName: session.clinicianNotesFileName,
      clinicianNotes: session.clinicianNotes,
      transcriptFormatted: session.transcriptFormatted,
      soapNotes: (session.soapNotes as SoapNotes) ?? null,
      errorMessage: session.errorMessage,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('GET /api/sessions/[id] error:', error);
    return NextResponse.json({ error: 'Failed to fetch session' }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const { id } = await params;

    const [session] = await db
      .select({ audioBlobUrl: sessions.audioBlobUrl })
      .from(sessions)
      .where(eq(sessions.id, id))
      .limit(1);

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    await del(session.audioBlobUrl);
    await db.delete(sessions).where(eq(sessions.id, id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/sessions/[id] error:', error);
    return NextResponse.json({ error: 'Failed to delete session' }, { status: 500 });
  }
}
