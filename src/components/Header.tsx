'use client';

import { useSession, signOut } from 'next-auth/react';
import Link from 'next/link';
import { useState } from 'react';

export default function Header() {
  const { data: session, status } = useSession();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut({ callbackUrl: '/' });
  };

  return (
    <header
      className="fixed top-0 left-0 right-0 z-50
             bg-black/40 backdrop-blur-xl
             border-b"
      style={{
        borderImage: 'linear-gradient(to right, #3B82F6, #8B5CF6) 1',
  }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center">
            <span className="text-2xl font-extrabold tracking-tight text-white">
              Find a Song!
            </span>
          </Link>

          {/* Navigation */}
          <nav className="flex items-center gap-4">
            {status === 'loading' ? (
              <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : session ? (
              <>
                <Link
                  href="/history"
                  className="px-4 py-2 rounded-lg text-sm font-medium text-gray-300
                             hover:bg-white/10 transition-all"
                >
                  History
                </Link>

                {/* User dropdown */}
                <div className="relative">
                  <button
                    onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg
                               text-gray-200 hover:bg-white/10 transition-all"
                  >
                    <div
                      className="w-8 h-8 rounded-full
                                 bg-gradient-to-br from-blue-500 to-purple-600
                                 flex items-center justify-center
                                 text-sm font-bold text-white"
                    >
                      {session.user?.name?.charAt(0).toUpperCase() ||
                        session.user?.email?.charAt(0).toUpperCase()}
                    </div>

                    <span className="hidden sm:inline text-sm font-medium">
                      {session.user?.name || 'Account'}
                    </span>

                    <svg
                      className={`w-4 h-4 transition-transform ${
                        isDropdownOpen ? 'rotate-180' : ''
                      }`}
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </button>

                  {isDropdownOpen && (
                    <div
                      className="absolute right-0 mt-3 w-56 rounded-xl
                                 bg-black/70 backdrop-blur-xl
                                 border border-white/10 shadow-2xl overflow-hidden"
                    >
                      <div className="px-4 py-3 border-b border-white/10">
                        <p className="text-sm font-medium text-white">
                          {session.user?.name}
                        </p>
                        <p className="text-xs text-gray-400 truncate">
                          {session.user?.email}
                        </p>
                      </div>

                      <button
                        onClick={handleSignOut}
                        className="w-full text-left px-4 py-3 text-sm
                                   text-red-400 hover:bg-white/10 transition-colors"
                      >
                        Sign out
                      </button>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  className="px-4 py-2 rounded-lg text-sm font-medium text-gray-300
                             hover:bg-white/10 transition-all"
                >
                  Sign in
                </Link>
                <Link
                  href="/register"
                  className="px-4 py-2 rounded-lg text-sm font-semibold text-white
                             bg-gradient-to-r from-blue-500 to-purple-600
                             hover:from-blue-600 hover:to-purple-700 transition-all"
                >
                  Sign up
                </Link>
              </>
            )}
          </nav>
        </div>
      </div>
    </header>
  );
}