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

type ConfirmState =
  | { mode: 'delete'; id: string; title: string }
  | { mode: 'clear'; total: number };

export default function HistoryPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isClearing, setIsClearing] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login?callbackUrl=/history');
    }
  }, [status, router]);

  useEffect(() => {
    if (status === 'authenticated') {
      fetchHistory();
    }
  }, [status]);

  const fetchHistory = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/history');
      
      if (!response.ok) {
        throw new Error('Failed to fetch history');
      }

      const data = await response.json();
      setHistory(data.history);
    } catch (err) {
      setError('Failed to load history');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const deleteHistoryItem = async (id: string) => {
    try {
      setDeletingId(id);
      const response = await fetch(`/api/history?id=${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete');
      }

      // remove from local state
      setHistory(prev => prev.filter(item => item.id !== id));
      setToast({ message: 'Song removed from history', type: 'success' });
    } catch (err) {
      setToast({ message: 'Failed to delete item', type: 'error' });
      console.error(err);
    } finally {
      setDeletingId(null);
    }
  };

  const promptDelete = (item: HistoryItem) => {
    setConfirmState({ mode: 'delete', id: item.id, title: item.title });
  };

  const promptClearAll = () => {
    if (history.length === 0) return;
    setConfirmState({ mode: 'clear', total: history.length });
  };

  const handleConfirmAction = async () => {
    if (!confirmState) return;
    try {
      if (confirmState.mode === 'delete') {
        await deleteHistoryItem(confirmState.id);
      } else {
        await clearHistory();
      }
    } finally {
      setConfirmState(null);
    }
  };

  const handleCancelConfirm = () => {
    setConfirmState(null);
  };

  const clearHistory = async () => {
    try {
      setIsClearing(true);
      const response = await fetch('/api/history/clear', {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to clear history');
      }

      setHistory([]);
      setToast({ message: 'All history cleared', type: 'success' });
    } catch (err) {
      setToast({ message: 'Failed to clear history', type: 'error' });
      console.error(err);
    } finally {
      setIsClearing(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;
    
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    });
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return '';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const confirmMessage = confirmState
    ? confirmState.mode === 'delete'
      ? `Remove "${confirmState.title}" from your history?`
      : `Clear all ${confirmState.total} ${confirmState.total === 1 ? 'item' : 'items'} from your history?`
    : '';

  const confirmSubtext = confirmState
    ? confirmState.mode === 'delete'
      ? 'This match will be permanently removed.'
      : 'This action cannot be undone.'
    : '';

  const confirmActionLabel = confirmState?.mode === 'delete' ? 'Remove' : 'Clear All';
  const confirmProcessing = confirmState
    ? confirmState.mode === 'delete'
      ? deletingId === confirmState.id
      : isClearing
    : false;
  const confirmAccent = confirmState?.mode === 'delete' ? '#EF4444' : '#D1F577';

  if (status === 'loading' || (status === 'authenticated' && isLoading)) {
    return (
      <>
        <Header />
        <main className="min-h-screen bg-black pt-20 pb-12 px-4">
          <div className="max-w-4xl mx-auto">
            <div className="mb-8">
              <div className="h-10 w-64 rounded mb-2 animate-pulse" style={{ backgroundColor: '#1F1F1F' }} />
              <div className="h-6 w-32 rounded animate-pulse" style={{ backgroundColor: '#1F1F1F' }} />
            </div>
            <HistorySkeleton />
          </div>
        </main>
      </>
    );
  }

  if (!session) {
    return null;
  }

  return (
    <>
      <Header />
      <main className="min-h-screen bg-black pt-20 pb-12 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="mb-8 flex justify-between items-center">
            <div>
              <h1 className="text-4xl font-bold mb-2" style={{ color: '#D1F577' }}>
                Your History
              </h1>
              <p className="text-lg" style={{ color: '#EEECFF', opacity: 0.7 }}>
                {history.length} {history.length === 1 ? 'song' : 'songs'} identified
              </p>
            </div>
            
            {history.length > 0 && (
              <button
                onClick={promptClearAll}
                disabled={isClearing}
                className="px-4 py-2 rounded font-medium transition-all hover:opacity-80 disabled:opacity-50 flex items-center gap-2"
                style={{ color: '#EF4444', backgroundColor: '#1F1F1F' }}
              >
                {isClearing ? (
                  <>
                    <div className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#EF4444' }}></div>
                    Clearing...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    Clear All
                  </>
                )}
              </button>
            )}
          </div>

          {error && (
            <div className="mb-6 p-4 rounded" style={{ backgroundColor: '#EF4444', color: 'white' }}>
              {error}
            </div>
          )}

          {history.length === 0 ? (
            <div className="text-center py-16">
              <svg className="w-24 h-24 mx-auto mb-4" style={{ color: '#4A52EB', opacity: 0.3 }} fill="currentColor" viewBox="0 0 20 20">
                <path d="M10 12a2 2 0 100-4 2 2 0 000 4z"/>
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM7 9a3 3 0 016 0v2a3 3 0 11-6 0V9z" clipRule="evenodd"/>
              </svg>
              <h2 className="text-2xl font-bold mb-2" style={{ color: '#EEECFF' }}>
                No history yet
              </h2>
              <p className="mb-6" style={{ color: '#EEECFF', opacity: 0.7 }}>
                Start identifying songs to build your history
              </p>
              <Link
                href="/"
                className="inline-block px-6 py-3 rounded font-semibold text-white transition-all hover:opacity-90"
                style={{ backgroundColor: '#4A52EB' }}
              >
                Find a Song
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {history.map((item) => {
                const slug = slugify(item.title);
                const href = item.spotifyId ? `/song/${item.spotifyId}/${slug}` : null;
                
                const content = (
                  <>
                    <div className="flex-shrink-0">
                      {item.coverUrl ? (
                        <Image
                          src={item.coverUrl}
                          alt={item.album}
                          width={80}
                          height={80}
                          className="rounded object-cover"
                        />
                      ) : (
                        <div className="w-20 h-20 rounded flex items-center justify-center" style={{ backgroundColor: '#4A52EB' }}>
                          <svg className="w-10 h-10 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M18 3a1 1 0 00-1.196-.98l-10 2A1 1 0 006 5v9.114A4.369 4.369 0 005 14c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V7.82l8-1.6v5.894A4.37 4.37 0 0015 12c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V3z" />
                          </svg>
                        </div>
                      )}
                    </div>

                    <div className="flex-grow min-w-0">
                      <h3 className="text-xl font-bold truncate mb-1" style={{ color: '#D1F577' }}>
                        {item.title}
                      </h3>
                      <p className="text-md truncate mb-1" style={{ color: '#F1F1F3' }}>
                        {item.artists.join(', ')}
                      </p>
                      <p className="text-sm truncate mb-2" style={{ color: '#EEECFF', opacity: 0.7 }}>
                        {item.album}
                        {item.duration && ` • ${formatDuration(item.duration)}`}
                      </p>
                      <p className="text-xs" style={{ color: '#EEECFF', opacity: 0.5 }}>
                        {formatDate(item.searchedAt)}
                      </p>
                    </div>
                  </>
                );

                return (
                  <div
                    key={item.id}
                    className="p-4 rounded-lg flex gap-4 items-start justify-between"
                    style={{ backgroundColor: '#1F1F1F' }}
                  >
                    {href ? (
                      <Link href={href} className="flex-grow flex gap-4 items-start min-w-0 transition-all hover:opacity-80">
                        {content}
                      </Link>
                    ) : (
                      <div className="flex-grow flex gap-4 items-start min-w-0">
                        {content}
                      </div>
                    )}

                    <button
                      onClick={() => promptDelete(item)}
                      disabled={deletingId === item.id}
                      className="flex-shrink-0 p-2 rounded transition-all hover:opacity-80 disabled:opacity-50 z-10"
                      style={{ color: '#EF4444' }}
                      title="Delete"
                    >
                      {deletingId === item.id ? (
                        <div className="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#EF4444' }}></div>
                      ) : (
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
      
      {confirmState && (
        <div className="fixed inset-0 z-[60] flex items-start justify-center pt-24 px-4">
          <button
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            aria-label="Dismiss confirmation overlay"
            onClick={handleCancelConfirm}
          />
          <div
            className="relative w-full max-w-md px-5 py-4 rounded-lg shadow-2xl transition-all duration-300"
            style={{ backgroundColor: '#1F1F1F' }}
          >
            <button
              onClick={handleCancelConfirm}
              className="absolute top-3 right-3 hover:opacity-70"
              style={{ color: '#EEECFF', opacity: 0.5 }}
              aria-label="Dismiss confirmation"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 011.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
            <div className="flex gap-3 pr-6">
              <div className="flex-shrink-0 mt-1" style={{ color: confirmAccent }}>
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.72-1.36 3.485 0l6.518 11.59c.75 1.334-.213 3.01-1.742 3.01H3.48c-1.53 0-2.492-1.676-1.742-3.01l6.519-11.59zM11 14a1 1 0 10-2 0 1 1 0 002 0zm-.25-5.75a.75.75 0 00-1.5 0v3.5a.75.75 0 001.5 0v-3.5z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="flex-1">
                <p className="text-base font-semibold mb-1" style={{ color: '#EEECFF' }}>
                  {confirmMessage}
                </p>
                <p className="text-sm" style={{ color: '#EEECFF', opacity: 0.7 }}>
                  {confirmSubtext}
                </p>
                <div className="flex justify-end gap-3 mt-4">
                  <button
                    onClick={handleCancelConfirm}
                    className="px-4 py-2 rounded-md text-sm font-medium transition-all hover:opacity-80"
                    style={{ backgroundColor: '#2A2A2A', color: '#EEECFF' }}
                  >
                    Keep
                  </button>
                  <button
                    onClick={handleConfirmAction}
                    disabled={confirmProcessing}
                    className="px-4 py-2 rounded-md text-sm font-semibold flex items-center justify-center gap-2 transition-all disabled:opacity-60"
                    style={{ backgroundColor: confirmAccent, color: confirmState.mode === 'delete' ? '#1F1F1F' : '#0A0A0A' }}
                  >
                    {confirmProcessing ? (
                      <div className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#1F1F1F' }}></div>
                    ) : (
                      confirmActionLabel
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </>
  );
}