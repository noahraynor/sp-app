import { NextResponse } from 'next/server';
import { db } from '@/db';
import { sessions } from '@/db/schema';
import { createTranscription } from '@/lib/soniox';
import { desc } from 'drizzle-orm';
import type { CreateSessionRequest, CreateSessionResponse, SessionListItem, SessionListResponse, SessionStatus } from '@/types';

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const body = (await request.json()) as CreateSessionRequest;
    const { blobUrl, audioFileName, clinicianNotes, clinicianNotesFileName, title } = body;

    if (!blobUrl || !audioFileName) {
      return NextResponse.json({ error: 'blobUrl and audioFileName are required' }, { status: 400 });
    }

    const sessionTitle = title || `Session — ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`;

    const sonioxTranscriptionId = await createTranscription(blobUrl);

    const [session] = await db
      .insert(sessions)
      .values({
        title: sessionTitle,
        status: 'transcribing',
        audioFileName,
        audioBlobUrl: blobUrl,
        clinicianNotes: clinicianNotes ?? null,
        clinicianNotesFileName: clinicianNotesFileName ?? null,
        sonioxTranscriptionId,
      })
      .returning({ id: sessions.id, status: sessions.status });

    const response: CreateSessionResponse = {
      id: session.id,
      status: session.status as SessionStatus,
    };

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create session';
    console.error('POST /api/sessions error:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(): Promise<NextResponse> {
  try {
    const rows = await db
      .select({
        id: sessions.id,
        title: sessions.title,
        createdAt: sessions.createdAt,
        status: sessions.status,
        audioFileName: sessions.audioFileName,
      })
      .from(sessions)
      .orderBy(desc(sessions.createdAt));

    const response: SessionListResponse = {
      sessions: rows.map((row): SessionListItem => ({
        id: row.id,
        title: row.title,
        createdAt: row.createdAt.toISOString(),
        status: row.status as SessionStatus,
        audioFileName: row.audioFileName,
      })),
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('GET /api/sessions error:', error);
    return NextResponse.json({ error: 'Failed to list sessions' }, { status: 500 });
  }
}
