'use client';

import { useSession, signOut } from 'next-auth/react';
import Link from 'next/link';
import { useState } from 'react';
import Image from 'next/image';

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
        <div className="flex h-16 items-center justify-between">

          {/* LOGO */}
          <Link href="/" className="flex items-center gap-3">
            <Image
              src="/svg/tebaklagu-default.svg"
              alt="TebakLagu Logo"
              width={26}
              height={26}
              priority
            />

            <span className="text-2xl font-germagont leading-none">
              <span className="text-white">tebak</span>
              <span className="text-lime-400">lagu</span>
            </span>
          </Link>

          {/* NAV */}
          <nav className="flex items-center gap-2">
            {status === 'loading' ? (
              <div
                className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin"
                style={{ borderColor: '#4A52EB' }}
              />
            ) : session ? (
              <>
                <Link
                  href="/history"
                  className="
                    px-4 py-2 rounded-md text-sm font-medium
                    text-gray-200 hover:text-white
                    hover:bg-white/5 transition
                  "
                >
                  History
                </Link>

                {/* USER DROPDOWN */}
                <div className="relative">
                  <button
                    onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                    className="
                      flex items-center justify-center w-10 h-10
                      rounded-full transition hover:opacity-90
                      bg-black/40
                    "
                  >
                    <div
                      className="
                        w-8 h-8 rounded-full flex items-center justify-center
                        font-semibold text-sm text-white
                        bg-gradient-to-br from-blue-500 to-purple-600
                      "
                    >
                      {session.user?.name?.charAt(0).toUpperCase() ||
                        session.user?.email?.charAt(0).toUpperCase()}
                    </div>
                  </button>

                  {isDropdownOpen && (
                    <div
                      className="
                        absolute right-0 mt-3 w-52 rounded-xl
                        shadow-2xl overflow-hidden
                        bg-gradient-to-br from-black via-[#1A0033] to-black
                        border border-white/10
                      "
                    >
                      <div className="px-4 py-3">
                        <p className="text-sm font-medium text-white">
                          {session.user?.name}
                        </p>
                        <p className="text-xs text-white/60 truncate">
                          {session.user?.email}
                        </p>
                      </div>

                      <button
                        onClick={handleSignOut}
                        className="
                          w-full px-4 py-3 text-left text-sm
                          text-red-400 hover:bg-white/5 transition
                        "
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
                  className="
                    px-4 py-2 rounded-md text-sm font-medium
                    text-gray-200 hover:text-white
                    hover:bg-white/5 transition
                  "
                >
                  Sign in
                </Link>

                <Link
                  href="/register"
                  className="
                    px-4 py-2 rounded-md text-sm font-semibold text-white
                    bg-gradient-to-r from-blue-500 to-purple-600
                    hover:opacity-90 transition
                  "
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