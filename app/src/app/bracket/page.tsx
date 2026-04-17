'use client';

import PlayoffBracket from '@/components/PlayoffBracket';

export default function BracketPage() {
  return (
    <div className="min-h-screen bg-[#050a05]">
      <div className="max-w-7xl mx-auto px-4 py-6">
        <PlayoffBracket />
      </div>
    </div>
  );
}
