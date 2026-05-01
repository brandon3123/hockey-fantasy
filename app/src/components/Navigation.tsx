'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/auth-context';

export default function Navigation() {
  const pathname = usePathname();
  const { user, loading, signOut } = useAuth();
  const [externalOpen, setExternalOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) { setIsAdmin(false); return; }
    fetch('/api/drafts')
      .then(r => r.ok ? r.json() : null)
      .then(data => setIsAdmin((data?.drafts?.length ?? 0) > 0))
      .catch(() => setIsAdmin(false));
  }, [user]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setExternalOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  };

  const navLink = (href: string, label: string) => (
    <Link
      key={href}
      href={href}
      className={`px-4 py-2 text-sm font-medium transition-colors rounded-md ${
        isActive(href)
          ? 'bg-[#4a7c59] text-[#c8d9c3]'
          : 'text-[#5a6b57] hover:bg-[#141e12]'
      }`}
    >
      {label}
    </Link>
  );

  return (
    <nav className="bg-[#0a0f0a] border-b border-[#141e12]">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between py-2">
          <div className="flex items-center">
            <Link href="/" className="flex items-center">
              <img src="/logo/logo-horizontal.svg" alt="Top Shelf Draft" className="h-8 md:h-[55px]" />
            </Link>
          </div>

          <div className="hidden md:flex items-center gap-1">
            {navLink('/', 'Dashboard')}
            {navLink('/rankings', 'Rankings')}
            {navLink('/bracket', 'Bracket')}
            {user && isAdmin && (
              <>
                <span className="w-px h-5 bg-[#141e12] mx-2" />
                <div ref={dropdownRef} className="relative">
                  <button
                    onClick={() => setExternalOpen(!externalOpen)}
                    className={`px-4 py-2 text-sm font-medium transition-colors rounded-md ${
                      pathname === '/draft' || pathname === '/rosters'
                        ? 'bg-[#4a7c59] text-[#c8d9c3]'
                        : 'text-[#6b9b7a] border border-[#4a7c59] hover:bg-[#141e12]'
                    }`}
                  >
                    External Draft ▾
                  </button>
                  {externalOpen && (
                    <div className="absolute right-0 mt-1 w-44 bg-[#0a0f0a] border border-[#4a7c59] rounded-lg overflow-hidden z-50">
                      <Link
                        href="/draft"
                        onClick={() => setExternalOpen(false)}
                        className="block px-4 py-2.5 text-sm text-[#c8d9c3] hover:bg-[#141e12] transition-colors"
                      >
                        Draft Board
                      </Link>
                      <Link
                        href="/rosters"
                        onClick={() => setExternalOpen(false)}
                        className="block px-4 py-2.5 text-sm text-[#c8d9c3] hover:bg-[#141e12] transition-colors"
                      >
                        Team Rosters
                      </Link>
                    </div>
                  )}
                </div>
              </>
            )}
            <span className="w-px h-5 bg-[#141e12] mx-2" />
            <div className="flex items-center gap-3">
              {loading ? (
                <span className="text-sm text-[#5a6b57]">Loading...</span>
              ) : user ? (
                <>
                  <span className="text-sm text-[#c8d9c3]">{user.email}</span>
                  <button
                    onClick={signOut}
                    className="px-3 py-1.5 text-sm text-[#5a6b57] hover:text-[#c8d9c3] transition-colors"
                  >
                    Sign Out
                  </button>
                </>
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

          <button
            className="md:hidden p-2 text-[#6b9b7a]"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              {mobileOpen ? (
                <path d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>

        {mobileOpen && (
          <div className="md:hidden border-t border-[#141e12] py-2">
            <Link href="/" onClick={() => setMobileOpen(false)} className="block px-4 py-3 text-sm text-[#c8d9c3] hover:bg-[#141e12]">Dashboard</Link>
            <Link href="/rankings" onClick={() => setMobileOpen(false)} className="block px-4 py-3 text-sm text-[#5a6b57] hover:bg-[#141e12]">Rankings</Link>
            <Link href="/bracket" onClick={() => setMobileOpen(false)} className="block px-4 py-3 text-sm text-[#5a6b57] hover:bg-[#141e12]">Bracket</Link>
            {user && isAdmin && (
              <>
                <div className="h-px bg-[#141e12] my-1 mx-4" />
                <Link href="/draft" onClick={() => setMobileOpen(false)} className="block px-4 py-3 text-sm text-[#6b9b7a] hover:bg-[#141e12]">Draft Board</Link>
                <Link href="/rosters" onClick={() => setMobileOpen(false)} className="block px-4 py-3 text-sm text-[#6b9b7a] hover:bg-[#141e12]">Team Rosters</Link>
              </>
            )}
            <div className="h-px bg-[#141e12] my-1 mx-4" />
            {loading ? (
              <div className="px-4 py-3 text-sm text-[#5a6b57]">Loading...</div>
            ) : user ? (
              <div className="px-4 py-3 flex items-center justify-between">
                <span className="text-sm text-[#c8d9c3] truncate">{user.email}</span>
                <button onClick={() => { signOut(); setMobileOpen(false); }} className="text-sm text-[#5a6b57] ml-4">Sign Out</button>
              </div>
            ) : (
              <Link href="/auth/login" onClick={() => setMobileOpen(false)} className="block px-4 py-3 text-sm font-medium text-[#4a7c59] hover:bg-[#141e12]">Sign In</Link>
            )}
          </div>
        )}
      </div>
    </nav>
  );
}
