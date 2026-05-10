import { SessionDetail } from '@/components/session-detail';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function SessionPage({ params }: PageProps) {
  const { id } = await params;

  return <SessionDetail sessionId={id} />;
}
