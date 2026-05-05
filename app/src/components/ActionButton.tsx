'use client';

import Link from 'next/link';
import { useState, useCallback } from 'react';

type Variant = 'primary' | 'secondary' | 'amber';

const baseClasses: Record<Variant, string> = {
  primary: 'bg-[#4a7c59] text-[#c8d9c3] hover:bg-[#c8d9c3] hover:text-[#4a7c59]',
  secondary: 'border border-[#4a7c59] text-[#6b9b7a] hover:bg-[#4a7c59] hover:text-[#c8d9c3]',
  amber: 'border border-[#9b8f6b] text-[#9b8f6b] hover:bg-[#9b8f6b] hover:text-[#0a0f0a]',
};

interface ActionLinkProps {
  href: string;
  children: React.ReactNode;
  variant?: Variant;
  className?: string;
}

export function ActionLink({ href, children, variant = 'primary', className = '' }: ActionLinkProps) {
  const [loading, setLoading] = useState(false);
  const handleClick = useCallback(() => setLoading(true), []);

  return (
    <Link
      href={href}
      onClick={handleClick}
      className={`inline-flex items-center justify-center rounded-lg font-medium transition-all duration-150 ${baseClasses[variant]} ${loading ? 'opacity-70 pointer-events-none' : ''} ${className}`}
    >
      {loading ? <span className="animate-pulse">Loading...</span> : children}
    </Link>
  );
}

interface ActionButtonProps {
  onClick: () => void;
  children: React.ReactNode;
  variant?: Variant;
  loading?: boolean;
  disabled?: boolean;
  className?: string;
  type?: 'button' | 'submit';
}

export function ActionButton({ onClick, children, variant = 'primary', loading, disabled, className = '', type = 'button' }: ActionButtonProps) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={loading || disabled}
      className={`inline-flex items-center justify-center rounded-lg font-medium transition-all duration-150 ${baseClasses[variant]} ${loading || disabled ? 'opacity-70 cursor-not-allowed' : ''} ${className}`}
    >
      {loading ? <span className="animate-pulse">Loading...</span> : children}
    </button>
  );
}
