'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/auth-context';

export default function Navigation() {
  const pathname = usePathname();
  const { user, loading, signOut } = useAuth();

  const navItems = user
    ? [
        { href: '/dashboard', label: 'Dashboard' },
        { href: '/', label: 'Player Rankings' },
        { href: '/draft', label: 'Draft Board' },
        { href: '/rosters', label: 'Team Rosters' },
        { href: '/bracket', label: 'Playoff Bracket' },
      ]
    : [
        { href: '/', label: 'Player Rankings' },
        { href: '/draft', label: 'Draft Board' },
        { href: '/rosters', label: 'Team Rosters' },
        { href: '/bracket', label: 'Playoff Bracket' },
      ];

  return (
    <nav className="bg-[#0a0f0a] border-b border-[#141e12]">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-3">
            <span className="text-2xl">&#127953;</span>
            <span className="font-bold text-xl text-[#c8d9c3]">
              Hockey Draft
            </span>
          </div>
          <div className="flex items-center gap-1">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`px-4 py-2 text-sm font-medium transition-colors rounded-md ${
                    isActive
                      ? 'bg-[#4a7c59] text-[#c8d9c3]'
                      : 'text-[#5a6b57] hover:bg-[#141e12]'
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
            <div className="ml-4 pl-4 border-l border-[#141e12]">
              {loading ? (
                <span className="text-sm text-[#5a6b57]">Loading...</span>
              ) : user ? (
                <div className="flex items-center gap-3">
                  <span className="text-sm text-[#c8d9c3]">
                    {user.email}
                  </span>
                  <button
                    onClick={signOut}
                    className="px-3 py-1 text-sm text-[#5a6b57] hover:text-[#c8d9c3] transition-colors"
                  >
                    Sign Out
                  </button>
                </div>
              ) : (
                <Link
                  href="/auth/login"
                  className="px-4 py-2 text-sm font-medium bg-[#4a7c59] text-[#c8d9c3] rounded-md hover:bg-[#3d664a] transition-colors"
                >
                  Sign In
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}
