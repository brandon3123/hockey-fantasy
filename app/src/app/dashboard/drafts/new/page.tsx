'use client';

import DraftSetupForm from '@/components/DraftSetupForm';

export default function NewDraftPage() {
  const handleCreate = async (data: Record<string, unknown>) => {
    const res = await fetch('/api/drafts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    const result = await res.json();

    if (!res.ok) {
      return { error: result.error || 'Failed to create draft' };
    }

    return { draft: result.draft };
  };

  return (
    <div className="min-h-screen bg-[#050a05]">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-[#c8d9c3] mb-6">Create New Draft</h1>
        <DraftSetupForm onSubmit={handleCreate} />
      </div>
    </div>
  );
}
