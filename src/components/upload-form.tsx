'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { upload } from '@vercel/blob/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import type { CreateSessionResponse } from '@/types';

const ACCEPTED_AUDIO = '.mp3,.wav,.aac,.flac,.ogg,.webm,.m4a';
const ACCEPTED_NOTES = '.txt,.md';

export function UploadForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [statusText, setStatusText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const notesInputRef = useRef<HTMLInputElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setUploading(true);
    setUploadProgress(0);
    setStatusText('Uploading audio...');

    try {
      const audioFile = audioInputRef.current?.files?.[0];
      if (!audioFile) {
        throw new Error('Please select an audio file');
      }

      const notesFile = notesInputRef.current?.files?.[0];
      let clinicianNotes: string | undefined;
      let clinicianNotesFileName: string | undefined;

      if (notesFile) {
        clinicianNotes = await notesFile.text();
        clinicianNotesFileName = notesFile.name;
      }

      const blob = await upload(audioFile.name, audioFile, {
        access: 'public',
        handleUploadUrl: '/api/upload',
        onUploadProgress: (progress) => {
          setUploadProgress(progress.percentage);
        },
      });

      setUploadProgress(100);
      setStatusText('Starting transcription...');

      const response = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          blobUrl: blob.url,
          audioFileName: audioFile.name,
          clinicianNotes,
          clinicianNotesFileName,
          title: titleInputRef.current?.value || undefined,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create session');
      }

      const session: CreateSessionResponse = await response.json();
      setOpen(false);
      router.push(`/sessions/${session.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
      setUploadProgress(0);
      setStatusText('');
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button />}>
        Upload Recording
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Upload Therapy Session</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="audio">Audio Recording *</Label>
            <Input
              id="audio"
              type="file"
              accept={ACCEPTED_AUDIO}
              ref={audioInputRef}
              required
              disabled={uploading}
            />
            <p className="text-xs text-gray-500">
              Accepts MP3, WAV, AAC, FLAC, OGG, WebM, M4A
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Session Notes (optional)</Label>
            <Input
              id="notes"
              type="file"
              accept={ACCEPTED_NOTES}
              ref={notesInputRef}
              disabled={uploading}
            />
            <p className="text-xs text-gray-500">
              Plain text (.txt) or Markdown (.md) file
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="title">Session Title (optional)</Label>
            <Input
              id="title"
              type="text"
              placeholder={`Session — ${new Date().toLocaleDateString()}`}
              ref={titleInputRef}
              disabled={uploading}
            />
          </div>

          {uploading && (
            <div className="space-y-1">
              <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
                <div
                  className="h-full bg-blue-600 transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
              <p className="text-xs text-gray-500">{statusText}</p>
            </div>
          )}

          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}

          <Button type="submit" disabled={uploading} className="w-full">
            {uploading ? 'Processing...' : 'Start Processing'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
