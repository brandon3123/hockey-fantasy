'use client';

import { useState, useCallback } from 'react';

interface DraftStartModalProps {
  draftId: string;
  participants: Array<{ id: string; team_name: string; draft_position: number | null }>;
  onStart: () => void;
  onClose: () => void;
}

export default function DraftStartModal({
  draftId,
  participants,
  onStart,
  onClose,
}: DraftStartModalProps) {
  const [positions, setPositions] = useState<Map<string, number>>(() => {
    const map = new Map<string, number>();
    participants.forEach((p, i) => map.set(p.id, i + 1));
    return map;
  });
  const [mode, setMode] = useState<'admin_only' | 'self_draft'>('admin_only');
  const [timerEnabled, setTimerEnabled] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(60);
  const [randomize, setRandomize] = useState(true);
  const [loading, setLoading] = useState(false);

  const handleRandomize = useCallback(() => {
    const indices = participants.map((_, i) => i + 1);
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    const map = new Map<string, number>();
    participants.forEach((p, i) => map.set(p.id, indices[i]));
    setPositions(map);
    setRandomize(true);
  }, [participants]);

  const handleManualPosition = useCallback(
    (participantId: string, pos: number) => {
      setPositions((prev) => {
        const map = new Map(prev);
        map.set(participantId, pos);
        return map;
      });
      setRandomize(false);
    },
    []
  );

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const positionArray = participants.map((p) => ({
        participant_id: p.id,
        draft_position: positions.get(p.id) || 1,
      }));

      const res = await fetch(`/api/drafts/${draftId}/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          positions: positionArray,
          pick_entry_mode: mode,
          pick_timer_seconds: timerEnabled ? timerSeconds : null,
        }),
      });

      if (res.ok) {
        onStart();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to start draft');
      }
    } catch (err) {
      alert('Failed to start draft');
    } finally {
      setLoading(false);
    }
  };

  const timerOptions = [30, 60, 90, 120];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
      <div className="bg-[#0a0f0a] rounded-lg border border-[#141e12] max-w-lg w-full mx-4 max-h-[85vh] overflow-hidden">
        <div className="p-6 border-b border-[#141e12] bg-[#4a7c59]">
          <h3 className="text-xl font-bold text-[#c8d9c3]">Start Draft</h3>
          <p className="text-sm text-[#c8d9c3] opacity-80 mt-1">
            Configure draft order and settings
          </p>
        </div>

        <div className="p-6 overflow-y-auto max-h-[60vh] space-y-6">
          <div>
            <label className="block text-sm font-semibold text-[#6b9b7a] mb-2">
              Draft Order
            </label>
            <div className="flex gap-2 mb-3">
              <button
                onClick={handleRandomize}
                className={`px-3 py-1.5 text-xs font-semibold rounded transition-colors ${
                  randomize
                    ? 'bg-[#4a7c59] text-[#c8d9c3]'
                    : 'bg-[#050a05] text-[#5a6b57] border border-[#141e12] hover:bg-[#141e12]'
                }`}
              >
                Randomize
              </button>
              <button
                onClick={() => setRandomize(false)}
                className={`px-3 py-1.5 text-xs font-semibold rounded transition-colors ${
                  !randomize
                    ? 'bg-[#4a7c59] text-[#c8d9c3]'
                    : 'bg-[#050a05] text-[#5a6b57] border border-[#141e12] hover:bg-[#141e12]'
                }`}
              >
                Manual
              </button>
            </div>

            <div className="space-y-2">
              {participants.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between p-2 bg-[#050a05] border border-[#141e12] rounded"
                >
                  <span className="text-sm text-[#c8d9c3]">{p.team_name}</span>
                  {randomize ? (
                    <span className="text-sm font-bold text-[#6b9b7a]">
                      #{positions.get(p.id) || '-'}
                    </span>
                  ) : (
                    <select
                      value={positions.get(p.id) || 1}
                      onChange={(e) =>
                        handleManualPosition(p.id, parseInt(e.target.value))
                      }
                      className="px-2 py-1 text-sm bg-[#141e12] text-[#c8d9c3] border border-[#141e12] rounded focus:outline-none focus:ring-1 focus:ring-[#4a7c59]"
                    >
                      {participants.map((_, i) => (
                        <option key={i + 1} value={i + 1}>
                          #{i + 1}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-[#6b9b7a] mb-2">
              Pick Entry Mode
            </label>
            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer p-2 bg-[#050a05] border border-[#141e12] rounded">
                <input
                  type="radio"
                  name="pickMode"
                  checked={mode === 'admin_only'}
                  onChange={() => setMode('admin_only')}
                  className="accent-[#4a7c59]"
                />
                <div>
                  <div className="text-sm text-[#c8d9c3]">Admin Only</div>
                  <div className="text-xs text-[#5a6b57]">
                    Only you enter picks from the TV/laptop
                  </div>
                </div>
              </label>
              <label className="flex items-center gap-2 cursor-pointer p-2 bg-[#050a05] border border-[#141e12] rounded">
                <input
                  type="radio"
                  name="pickMode"
                  checked={mode === 'self_draft'}
                  onChange={() => setMode('self_draft')}
                  className="accent-[#4a7c59]"
                />
                <div>
                  <div className="text-sm text-[#c8d9c3]">Self Draft</div>
                  <div className="text-xs text-[#5a6b57]">
                    Participants pick from their own phone on their turn
                  </div>
                </div>
              </label>
            </div>
          </div>

          <div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={timerEnabled}
                onChange={(e) => setTimerEnabled(e.target.checked)}
                className="accent-[#4a7c59]"
              />
              <span className="text-sm font-semibold text-[#6b9b7a]">
                Enable Pick Timer
              </span>
            </label>
            {timerEnabled && (
              <div className="flex gap-2 mt-2">
                {timerOptions.map((sec) => (
                  <button
                    key={sec}
                    onClick={() => setTimerSeconds(sec)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded transition-colors ${
                      timerSeconds === sec
                        ? 'bg-[#4a7c59] text-[#c8d9c3]'
                        : 'bg-[#050a05] text-[#5a6b57] border border-[#141e12] hover:bg-[#141e12]'
                    }`}
                  >
                    {sec}s
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="p-4 border-t border-[#141e12] flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 text-sm font-medium text-[#5a6b57] bg-[#050a05] border border-[#141e12] rounded-lg hover:bg-[#141e12] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="flex-1 px-4 py-2 text-sm font-medium text-[#c8d9c3] bg-[#4a7c59] rounded-lg hover:bg-[#3d664a] transition-colors disabled:opacity-50"
          >
            {loading ? 'Starting...' : 'Start Draft'}
          </button>
        </div>
      </div>
    </div>
  );
}
