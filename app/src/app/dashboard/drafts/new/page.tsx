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
        <div className="text-center mb-8">
          <div className="text-xs uppercase tracking-widest text-[#5a6b57] mb-1">New Draft</div>
          <h1 className="text-2xl md:text-3xl font-bold text-[#c8d9c3]">Create a Draft</h1>
        </div>
        <DraftSetupForm onSubmit={handleCreate} />
      </div>
    </div>
  );
}
