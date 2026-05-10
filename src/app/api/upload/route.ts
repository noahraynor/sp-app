import { put } from '@vercel/blob';
import { NextResponse } from 'next/server';

const ALLOWED_AUDIO_TYPES = new Set([
  'audio/mpeg',
  'audio/wav',
  'audio/x-wav',
  'audio/aac',
  'audio/flac',
  'audio/ogg',
  'audio/webm',
  'audio/mp4',
  'audio/x-m4a',
]);

const ALLOWED_EXTENSIONS = new Set([
  '.mp3', '.wav', '.aac', '.flac', '.ogg', '.webm', '.m4a',
]);

function hasAllowedAudioType(file: File): boolean {
  if (ALLOWED_AUDIO_TYPES.has(file.type)) return true;
  const ext = file.name.toLowerCase().match(/\.[^.]+$/)?.[0];
  return ext ? ALLOWED_EXTENSIONS.has(ext) : false;
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (!hasAllowedAudioType(file)) {
      return NextResponse.json(
        { error: `Invalid file type: ${file.type} (${file.name}). Accepted: MP3, WAV, AAC, FLAC, OGG, WebM, M4A` },
        { status: 400 },
      );
    }

    const blob = await put(file.name, file, {
      access: 'public',
      addRandomSuffix: true,
    });

    return NextResponse.json({ url: blob.url, pathname: blob.pathname });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Upload failed';
    console.error('Upload error:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
