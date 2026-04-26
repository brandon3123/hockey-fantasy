'use client';

import { useState } from 'react';

interface InviteFormProps {
  draftId: string;
  onInviteSent: () => void;
}

export default function InviteForm({ draftId, onInviteSent }: InviteFormProps) {
  const [emailInput, setEmailInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<Array<{ email: string; status: string; note?: string }> | null>(null);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setResults(null);

    const emails = emailInput
      .split(/[,\n]/)
      .map((s: string) => s.trim())
      .filter(Boolean);

    if (emails.length === 0) {
      setLoading(false);
      return;
    }

    const res = await fetch('/api/invites', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ draft_id: draftId, emails }),
    });

    const data = await res.json();

    if (res.ok) {
      setResults(data.results);
      setEmailInput('');
      onInviteSent();
    }

    setLoading(false);
  };

  return (
    <div className="bg-[#050a05] border border-[#141e12] rounded-lg p-6">
      <h3 className="text-lg font-bold text-[#c8d9c3] mb-4">Invite Participants</h3>
      <form onSubmit={handleInvite}>
        <div className="mb-3">
          <label className="block text-sm font-medium mb-1 text-[#c8d9c3]">
            Email Addresses
          </label>
          <textarea
            value={emailInput}
            onChange={(e) => setEmailInput(e.target.value)}
            placeholder={'Enter emails separated by commas or new lines\n\njake@email.com\nuncle.mike@email.com\ndad@email.com'}
            rows={4}
            className="w-full px-3 py-2 border border-[#141e12] rounded-md bg-[#050a05] text-[#c8d9c3] focus:outline-none focus:ring-2 focus:ring-[#4a7c59] text-sm"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2 bg-[#4a7c59] text-[#c8d9c3] rounded-lg font-semibold hover:bg-[#3d664a] transition-colors disabled:opacity-50 text-sm"
        >
          {loading ? 'Sending...' : 'Send Invites'}
        </button>
      </form>

      {results && results.length > 0 && (
        <div className="mt-4 space-y-2">
          {results.map((r, i) => (
            <div
              key={i}
              className={`text-sm px-3 py-2 rounded ${
                r.status === 'invited'
                  ? 'bg-[#1a2f1a] text-[#6b9b7a]'
                  : r.status === 'invited_no_email'
                  ? 'bg-[#3d3a1a] text-[#9b8f6b]'
                  : 'bg-red-900/30 text-red-200'
              }`}
            >
              <span className="font-medium">{r.email}</span>
              {r.status === 'invited' && ' \u2014 Invite sent'}
              {r.status === 'invited_no_email' && ` \u2014 ${r.note}`}
              {r.status === 'error' && ' \u2014 Error'}
            </div>
          ))}
        </div>
      )}

      <div className="mt-4 pt-4 border-t border-[#141e12]">
        <p className="text-xs text-[#5a6b57]">
          Or share this link directly:{' '}
          <span className="text-[#6b9b7a] select-all">
            {typeof window !== 'undefined' ? `${window.location.origin}/join/${draftId}` : ''}
          </span>
        </p>
      </div>
    </div>
  );
}
