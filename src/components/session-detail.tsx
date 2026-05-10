'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ProcessingStatus } from './processing-status';
import { SoapNotesDisplay } from './soap-notes-display';
import type { SessionDetail as SessionDetailType, SessionStatusResponse, SoapNotes } from '@/types';

const POLL_INTERVAL_MS = 5000;

interface SessionDetailProps {
  sessionId: string;
}

export function SessionDetail({ sessionId }: SessionDetailProps) {
  const router = useRouter();
  const [session, setSession] = useState<SessionDetailType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSession = useCallback(async () => {
    try {
      const response = await fetch(`/api/sessions/${sessionId}`);
      if (!response.ok) throw new Error('Failed to fetch session');
      const data: SessionDetailType = await response.json();
      setSession(data);
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load session');
      return null;
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    fetchSession();
  }, [fetchSession]);

  useEffect(() => {
    if (!session) return;
    if (session.status === 'completed' || session.status === 'error') return;

    const interval = setInterval(async () => {
      try {
        const statusResponse = await fetch(`/api/sessions/${sessionId}/status`);
        if (!statusResponse.ok) return;
        const statusData: SessionStatusResponse = await statusResponse.json();

        setSession((prev) =>
          prev
            ? { ...prev, status: statusData.status, errorMessage: statusData.errorMessage ?? null }
            : prev,
        );

        if (statusData.status === 'completed' || statusData.status === 'error') {
          clearInterval(interval);
          await fetchSession();
        }
      } catch {
        // Polling failure is non-fatal; next tick will retry
      }
    }, POLL_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [session?.status, sessionId, fetchSession]);

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-8 w-48 rounded bg-gray-200" />
        <div className="h-64 rounded bg-gray-200" />
      </div>
    );
  }

  if (error || !session) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{error || 'Session not found'}</AlertDescription>
      </Alert>
    );
  }

  const isProcessing = session.status === 'transcribing' || session.status === 'generating_notes';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Button
            variant="ghost"
            onClick={() => router.push('/')}
            className="mb-2 -ml-2 text-sm"
          >
            &larr; Back to Sessions
          </Button>
          <h2 className="text-xl font-semibold text-gray-900">{session.title}</h2>
          <p className="text-sm text-gray-500">
            {session.audioFileName} &middot;{' '}
            {new Date(session.createdAt).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
              hour: 'numeric',
              minute: '2-digit',
            })}
            {session.audioDurationSeconds != null &&
              ` · ${Math.floor(session.audioDurationSeconds / 60)}m ${session.audioDurationSeconds % 60}s`}
          </p>
        </div>
        <Badge
          variant={
            session.status === 'completed'
              ? 'default'
              : session.status === 'error'
                ? 'destructive'
                : 'secondary'
          }
        >
          {session.status === 'completed'
            ? 'Completed'
            : session.status === 'error'
              ? 'Error'
              : 'Processing'}
        </Badge>
      </div>

      {session.status === 'error' && session.errorMessage && (
        <Alert variant="destructive">
          <AlertDescription>{session.errorMessage}</AlertDescription>
        </Alert>
      )}

      {isProcessing && <ProcessingStatus currentStatus={session.status} />}

      {session.status === 'completed' && session.soapNotes && session.transcriptFormatted && (
        <Tabs defaultValue="soap">
          <TabsList>
            <TabsTrigger value="soap">SOAP Notes</TabsTrigger>
            <TabsTrigger value="transcript">Transcript</TabsTrigger>
            {session.clinicianNotes && (
              <TabsTrigger value="notes">Clinician Notes</TabsTrigger>
            )}
          </TabsList>
          <TabsContent value="soap" className="mt-4">
            <SoapNotesDisplay soapNotes={session.soapNotes as SoapNotes} />
          </TabsContent>
          <TabsContent value="transcript" className="mt-4">
            <div className="rounded-lg border bg-white p-6">
              <h3 className="mb-4 font-medium text-gray-900">Session Transcript</h3>
              <div className="max-h-[600px] overflow-y-auto whitespace-pre-wrap text-sm text-gray-700">
                {session.transcriptFormatted}
              </div>
            </div>
          </TabsContent>
          {session.clinicianNotes && (
            <TabsContent value="notes" className="mt-4">
              <div className="rounded-lg border bg-white p-6">
                <h3 className="mb-4 font-medium text-gray-900">
                  Clinician Notes
                  {session.clinicianNotesFileName && ` (${session.clinicianNotesFileName})`}
                </h3>
                <div className="whitespace-pre-wrap text-sm text-gray-700">
                  {session.clinicianNotes}
                </div>
              </div>
            </TabsContent>
          )}
        </Tabs>
      )}
    </div>
  );
}
