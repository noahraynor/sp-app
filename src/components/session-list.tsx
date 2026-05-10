'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { SessionListItem, SessionListResponse, SessionStatus } from '@/types';

const STATUS_STYLES: Record<SessionStatus, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  transcribing: { label: 'Transcribing', variant: 'secondary' },
  generating_notes: { label: 'Generating Notes', variant: 'secondary' },
  completed: { label: 'Completed', variant: 'default' },
  error: { label: 'Error', variant: 'destructive' },
};

export function SessionList() {
  const [sessions, setSessions] = useState<SessionListItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchSessions() {
      try {
        const response = await fetch('/api/sessions');
        if (response.ok) {
          const data: SessionListResponse = await response.json();
          setSessions(data.sessions);
        }
      } catch (err) {
        console.error('Failed to fetch sessions:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchSessions();
  }, []);

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-20 animate-pulse rounded-lg bg-gray-200" />
        ))}
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div className="rounded-lg border-2 border-dashed border-gray-300 p-12 text-center">
        <p className="text-gray-500">No sessions yet. Upload a recording to get started.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {sessions.map((session) => {
        const style = STATUS_STYLES[session.status];
        return (
          <Link key={session.id} href={`/sessions/${session.id}`}>
            <Card className="cursor-pointer transition-colors hover:bg-gray-50">
              <CardContent className="flex items-center justify-between py-4">
                <div>
                  <p className="font-medium text-gray-900">{session.title}</p>
                  <p className="text-sm text-gray-500">
                    {session.audioFileName} ·{' '}
                    {new Date(session.createdAt).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
                <Badge variant={style.variant}>{style.label}</Badge>
              </CardContent>
            </Card>
          </Link>
        );
      })}
    </div>
  );
}
