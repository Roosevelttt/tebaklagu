'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import HistorySkeleton from '@/components/HistorySkeleton';
import Toast from '@/components/Toast';
import Link from 'next/link';
import Image from 'next/image';
import { slugify } from '@/lib/slugify';

interface HistoryItem {
  id: string;
  title: string;
  artists: string[];
  album: string;
  releaseDate: string | null;
  coverUrl: string | null;
  duration: number | null;
  searchedAt: string;
  spotifyId: string | null;
}

export default function HistoryPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isClearing, setIsClearing] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login?callbackUrl=/history');
    }
  }, [status, router]);

  useEffect(() => {
    if (status === 'authenticated') fetchHistory();
  }, [status]);

  const fetchHistory = async () => {
    try {
      setIsLoading(true);
      const res = await fetch('/api/history');
      const data = await res.json();
      setHistory(data.history);
    } catch {
      setToast({ message: 'Failed to load history', type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  const deleteHistoryItem = async (id: string) => {
    try {
      setDeletingId(id);
      await fetch(`/api/history?id=${id}`, { method: 'DELETE' });
      setHistory(prev => prev.filter(i => i.id !== id));
      setToast({ message: 'Song removed', type: 'success' });
    } catch {
      setToast({ message: 'Failed to delete song', type: 'error' });
    } finally {
      setDeletingId(null);
    }
  };

  const clearHistory = async () => {
    try {
      setIsClearing(true);
      await fetch('/api/history/clear', { method: 'DELETE' });
      setHistory([]);
      setToast({ message: 'All history cleared', type: 'success' });
    } catch {
      setToast({ message: 'Failed to clear history', type: 'error' });
    } finally {
      setIsClearing(false);
    }
  };

  const formatDate = (d: string) => {
    const date = new Date(d);
    const diff = Math.floor((Date.now() - date.getTime()) / 1000);
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
    return date.toLocaleDateString();
  };

  const formatDuration = (s: number | null) => {
    if (!s) return '';
    return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
  };

  if (status === 'loading' || isLoading) {
    return (
      <>
        <Header />
        <main className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-black pt-24 px-6">
          <div className="max-w-4xl mx-auto">
            <HistorySkeleton />
          </div>
        </main>
      </>
    );
  }

  if (!session) return null;

  return (
    <>
      <Header />

      <main className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-black pt-24 px-6 pb-16">
        <div className="max-w-4xl mx-auto">

          {/* HEADER */}
          <div className="flex justify-between items-center mb-10">
            <div>
              <h1 className="text-4xl font-black text-white mb-1">Your History</h1>
              <p className="text-gray-400">
                {history.length} {history.length === 1 ? 'song' : 'songs'} identified
              </p>
            </div>

            {history.length > 0 && (
              <button
                onClick={clearHistory}
                disabled={isClearing}
                className="px-4 py-2 rounded-xl font-semibold
                           bg-red-500/10 text-red-400
                           border border-red-500/30
                           hover:bg-red-500/20
                           flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9z"
                    clipRule="evenodd"
                  />
                </svg>
                Clear All
              </button>
            )}
          </div>

          {/* LIST */}
          <div className="space-y-4">
            {history.map(item => {
              const href = item.spotifyId
                ? `/song/${item.spotifyId}/${slugify(item.title)}`
                : null;

              const Content = (
                <>
                  {item.coverUrl ? (
                    <Image src={item.coverUrl} alt={item.album} width={80} height={80} className="rounded-xl" />
                  ) : (
                    <div className="w-20 h-20 rounded-xl flex items-center justify-center bg-gradient-to-br from-blue-500 to-purple-600">
                      <svg className="w-10 h-10 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M18 3a1 1 0 00-1.196-.98l-10 2A1 1 0 006 5v9.114A4.369 4.369 0 005 14c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V7.82l8-1.6v5.894A4.37 4.37 0 0015 12c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V3z" />
                      </svg>
                    </div>
                  )}

                  <div className="min-w-0">
                    <h3 className="text-xl font-bold text-white truncate">{item.title}</h3>
                    <p className="text-gray-300 truncate">{item.artists.join(', ')}</p>
                    <p className="text-sm text-gray-400">
                      {item.album}{item.duration && ` • ${formatDuration(item.duration)}`}
                    </p>
                    <p className="text-xs text-gray-500">{formatDate(item.searchedAt)}</p>
                  </div>
                </>
              );

              return (
                <div
                  key={item.id}
                  className="p-4 rounded-2xl flex gap-4 justify-between
                             backdrop-blur-xl bg-black/40
                             border border-blue-500/20"
                >
                  {href ? (
                    <Link href={href} className="flex gap-4 flex-grow min-w-0">
                      {Content}
                    </Link>
                  ) : (
                    <div className="flex gap-4 flex-grow min-w-0">
                      {Content}
                    </div>
                  )}

                  {/* DELETE BUTTON */}
                  <button
                    onClick={() => deleteHistoryItem(item.id)}
                    disabled={deletingId === item.id}
                    className="p-2 rounded-lg
                               text-red-400 hover:text-red-300
                               hover:bg-red-500/10
                               transition-all"
                  >
                    {deletingId === item.id ? (
                      <div className="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin border-red-400" />
                    ) : (
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path
                          fillRule="evenodd"
                          d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9z
                             M7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"
                          clipRule="evenodd"
                        />
                      </svg>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </main>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </>
  );
}
