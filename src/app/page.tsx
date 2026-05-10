import { UploadForm } from '@/components/upload-form';
import { SessionList } from '@/components/session-list';

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Sessions</h2>
        <UploadForm />
      </div>
      <SessionList />
    </div>
  );
}
