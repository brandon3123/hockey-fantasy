'use client';

import { useState } from 'react';

interface InjuryBadgeProps {
  status: string;
  description?: string | null;
  size?: 'xs' | 'sm';
}

export default function InjuryBadge({ status, description, size = 'sm' }: InjuryBadgeProps) {
  const [show, setShow] = useState(false);

  if (status === 'healthy') return null;

  const isOut = status.toLowerCase().includes('out') && status !== 'day-to-day';
  const label =
    status === 'day-to-day' ? 'DTD' :
    status === 'week-to-week' ? 'WTW' :
    isOut ? 'OUT' : null;
  if (!label) return null;

  const color =
    status === 'day-to-day' ? 'bg-[#854d0e] text-[#fbbf24]' :
    status === 'week-to-week' ? 'bg-[#9a3412] text-[#fb923c]' :
    'bg-[#7f1d1d] text-[#fca5a5]';

  const textSize = size === 'xs' ? 'text-[8px] px-1 py-0.5' : 'text-[10px] px-1.5 py-0.5';
  const iconSize = size === 'xs' ? 'w-3 h-3 text-[7px]' : 'w-3.5 h-3.5 text-[8px]';
  const hasDesc = !!description;

  return (
    <div
      className="relative inline-flex items-center gap-1"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      <span className={`font-bold rounded ${textSize} ${color}`}>{label}</span>
      {hasDesc && (
        <span className={`inline-flex items-center justify-center rounded-full bg-[#4a7c59] text-[#c8d9c3] font-semibold cursor-help hover:bg-[#6b9b7a] transition-colors ${iconSize}`}>i</span>
      )}
      {show && hasDesc && (
        <div className="absolute z-50 bottom-full mb-2 left-1/2 -translate-x-1/2 w-48 p-2 bg-[#4a7c59] text-[#c8d9c3] text-[10px] rounded-lg shadow-xl border border-[#6b9b7a]">
          {description}
          <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 w-2 h-2 bg-[#4a7c59] border-r border-b border-[#6b9b7a] transform rotate-45" />
        </div>
      )}
    </div>
  );
}
