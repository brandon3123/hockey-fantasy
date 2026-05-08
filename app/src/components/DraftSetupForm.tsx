'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface DraftSetupFormProps {
  initialData?: {
    name?: string;
    season_type?: string;
    draft_date?: string;
    draft_time?: string;
    location?: string;
    entry_fee?: number;
    currency?: string;
    payment_method?: string;
    payment_info?: string;
    notes?: string;
    players_per_team?: number;
    scoring_format?: string;
  };
  onSubmit: (data: Record<string, unknown>) => Promise<{ error?: string; draft?: Record<string, unknown> }>;
  submitLabel?: string;
  isEditing?: boolean;
}

export default function DraftSetupForm({ initialData, onSubmit, submitLabel = 'Create Draft', isEditing }: DraftSetupFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState(initialData?.name ?? '');
  const [seasonType, setSeasonType] = useState(initialData?.season_type ?? 'playoffs');
  const [draftDate, setDraftDate] = useState(initialData?.draft_date ?? '');
  const [draftTime, setDraftTime] = useState(initialData?.draft_time ?? '');
  const [location, setLocation] = useState(initialData?.location ?? '');
  const [entryFee, setEntryFee] = useState(initialData?.entry_fee ?? 0);
  const [currency, setCurrency] = useState(initialData?.currency ?? 'CAD');
  const [paymentMethod, setPaymentMethod] = useState(initialData?.payment_method ?? 'e-transfer');
  const [paymentInfo, setPaymentInfo] = useState(initialData?.payment_info ?? '');
  const [notes, setNotes] = useState(initialData?.notes ?? '');
  const [playersPerTeam, setPlayersPerTeam] = useState(initialData?.players_per_team ?? 10);
  const [scoringFormat, setScoringFormat] = useState(initialData?.scoring_format ?? '1pt_per_goal_assist');

  const today = new Date().toISOString().split('T')[0];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const result = await onSubmit({
      name,
      season_type: seasonType,
      draft_date: draftDate || null,
      draft_time: draftTime || null,
      location: location || null,
      entry_fee: entryFee,
      currency,
      payment_method: paymentMethod,
      payment_info: paymentInfo || null,
      notes: notes || null,
      players_per_team: playersPerTeam,
      scoring_format: scoringFormat,
    });

    if (result.error) {
      setError(result.error);
      setLoading(false);
      return;
    }

    if (!isEditing && result.draft?.id) {
      router.push(`/dashboard/drafts/${result.draft.id}`);
    }

    setLoading(false);
  };

  const inputClass = 'w-full px-3 py-2 border border-[#141e12] rounded-md bg-[#050a05] text-[#c8d9c3] focus:outline-none focus:ring-2 focus:ring-[#4a7c59]';
  const labelClass = 'block text-sm font-medium mb-1 text-[#c8d9c3]';
  const selectClass = 'w-full px-3 py-2 border border-[#141e12] rounded-md bg-[#050a05] text-[#c8d9c3] focus:outline-none focus:ring-2 focus:ring-[#4a7c59]';

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="bg-red-900/30 border border-red-700 text-red-200 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      <div className="bg-[#0a0f0a] border border-[#141e12] rounded-xl p-5">
        <div className="flex items-center justify-center gap-3 mb-5">
          <div className="h-px flex-1 bg-[#1a2f1a]" />
          <h3 className="text-xs font-bold text-[#5a6b57] uppercase tracking-widest">Draft Details</h3>
          <div className="h-px flex-1 bg-[#1a2f1a]" />
        </div>
        <div className="space-y-4">
          <div>
            <label className={labelClass}>Draft Name</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} required placeholder="e.g. Stanley Cup Playoff Draft 2026" className={inputClass} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Season Type</label>
              <select value={seasonType} onChange={(e) => setSeasonType(e.target.value)} className={selectClass}>
                <option value="playoffs">Playoffs</option>
                <option value="regular_season">Regular Season</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>Scoring Format</label>
              <select value={scoringFormat} onChange={(e) => setScoringFormat(e.target.value)} className={selectClass}>
                <option value="1pt_per_goal_assist">1 pt per Goal/Assist</option>
                <option value="2pt_goals_1pt_assists">2 pts Goals, 1 pt Assists</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Date</label>
              <input type="date" value={draftDate} onChange={(e) => setDraftDate(e.target.value)} min={today} className={inputClass} style={{ colorScheme: 'dark' }} />
            </div>
            <div>
              <label className={labelClass}>Time</label>
              <input type="time" value={draftTime} onChange={(e) => setDraftTime(e.target.value)} className={inputClass} />
            </div>
          </div>
          <div>
            <label className={labelClass}>Location</label>
            <input type="text" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Brandon's House - 123 Main St" className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Players Per Team</label>
            <input type="number" value={playersPerTeam} onChange={(e) => setPlayersPerTeam(parseInt(e.target.value, 10))} min={3} max={30} className={inputClass} />
          </div>
        </div>
      </div>

      <div className="bg-[#0a0f0a] border border-[#141e12] rounded-xl p-5">
        <div className="flex items-center justify-center gap-3 mb-5">
          <div className="h-px flex-1 bg-[#1a2f1a]" />
          <h3 className="text-xs font-bold text-[#5a6b57] uppercase tracking-widest">Payment Details</h3>
          <div className="h-px flex-1 bg-[#1a2f1a]" />
        </div>
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className={labelClass}>Entry Fee</label>
              <input type="number" value={entryFee} onChange={(e) => setEntryFee(parseInt(e.target.value, 10))} min={0} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Currency</label>
              <select value={currency} onChange={(e) => setCurrency(e.target.value)} className={selectClass}>
                <option value="CAD">CAD</option>
                <option value="USD">USD</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>Payment Method</label>
              <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className={selectClass}>
                <option value="e-transfer">E-Transfer</option>
                <option value="cash">Cash</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>
          <div>
            <label className={labelClass}>Payment Email / Instructions</label>
            <input type="text" value={paymentInfo} onChange={(e) => setPaymentInfo(e.target.value)} placeholder="e.g. brandon@email.com" className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Notes</label>
            <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. Please send payment by April 25th. Pizza provided!" className={inputClass} />
          </div>
        </div>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full py-3 bg-[#4a7c59] text-[#c8d9c3] rounded-lg font-semibold hover:bg-[#3d664a] transition-colors disabled:opacity-50"
      >
        {loading ? 'Saving...' : submitLabel}
      </button>
    </form>
  );
}
