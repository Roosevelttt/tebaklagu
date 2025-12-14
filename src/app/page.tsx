'use client';
import { useState, useRef, useEffect } from 'react';
import {
  getOptimalAudioConstraints,
  getSupportedAudioMimeType,
  checkAudioDecodingSupport,
  normalizeAudioVolume,
  VOLUME_BOOST,
  convertToWav,
  canDecodeAudio
} from '@/lib/audioUtils';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import Header from '@/components/Header';

const RECOGNITION_TIMEOUT_MS = 30000;

interface Artist { name: string }
interface Album { name: string }

interface SongResult {
  title: string;
  artists: Artist[];
  album: Album;
  source?: 'music' | 'humming';
  error?: string;
  spotifyId?: string;
}

interface Recommendation {
  title: string;
  artists: Artist[];
  album: Album;
  spotifyId: string;
  preview_url: string | null;
  spotifyUrl: string;
}

export default function HomePage() {
  const { data: session } = useSession();
  const [isRecording, setIsRecording] = useState(false);
  const [isRecognizing, setIsRecognizing] = useState(false);
  const [isLoadingRecs, setIsLoadingRecs] = useState(false);
  const [result, setResult] = useState<SongResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const resultRef = useRef<SongResult | null>(null);
  const isRecognizingRef = useRef<boolean>(false);

  useEffect(() => { resultRef.current = result; }, [result]);
  useEffect(() => { isRecognizingRef.current = isRecognizing; }, [isRecognizing]);
  useEffect(() => { checkAudioDecodingSupport(); }, []);

  /* ================= LOGIC TIDAK DIUBAH ================= */

  const handleStartRecording = async () => {
    setResult(null);
    resultRef.current = null;
    setError(null);
    setIsRecognizing(false);
    isRecognizingRef.current = false;
    setRecommendations([]);

    try {
      const audioConstraints = getOptimalAudioConstraints();
      const stream = await navigator.mediaDevices.getUserMedia({ audio: audioConstraints });
      streamRef.current = stream;

      let mimeType: string | undefined = 'audio/wav';
      if (!MediaRecorder.isTypeSupported('audio/wav')) {
        mimeType = getSupportedAudioMimeType();
      }

      mediaRecorderRef.current = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);

      mediaRecorderRef.current.ondataavailable = async (event) => {
        if (resultRef.current) return;
        if (event.data.size > 0) {
          let processedBlob = event.data;
          try {
            const canDecode = await canDecodeAudio(event.data);
            processedBlob = canDecode
              ? await normalizeAudioVolume(event.data, VOLUME_BOOST.MUSIC, false)
              : await convertToWav(event.data);
          } catch {
            processedBlob = event.data;
          }
          if (!resultRef.current) recognizeSong(processedBlob);
        }
      };

      mediaRecorderRef.current.start(10000);
      setIsRecording(true);

      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        if (result) return;
        setError("Couldn't find a match. Try getting closer or humming clearly!");
        handleStopRecording();
      }, RECOGNITION_TIMEOUT_MS);

    } catch {
      setError("Microphone access denied.");
    }
  };

  const handleStopRecording = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (mediaRecorderRef.current?.state === 'recording') mediaRecorderRef.current.stop();
    streamRef.current?.getTracks().forEach(t => t.stop());
    setIsRecording(false);
    setIsRecognizing(false);
  };

  const recognizeSong = async (audioBlob: Blob) => {
    if (isRecognizingRef.current || resultRef.current) return;
    setIsRecognizing(true);
    isRecognizingRef.current = true;

    const formData = new FormData();
    formData.append('sample', audioBlob, 'recording.wav');

    try {
      const response = await fetch('/api/recognize', { method: 'POST', body: formData });
      if (response.status === 204) return;

      const data: SongResult = await response.json();
      if (response.ok && data.title) {
        setResult(data);
        resultRef.current = data;
        handleStopRecording();
        if (data.title && data.artists?.length) {
          setIsLoadingRecs(true);
          await fetchRecommendations(data.title, data.artists[0].name);
        }
      }
    } catch {
      setError('Recognition failed.');
      handleStopRecording();
    } finally {
      setIsRecognizing(false);
      isRecognizingRef.current = false;
      setIsLoadingRecs(false);
    }
  };

  const fetchRecommendations = async (title: string, artistName: string) => {
    try {
      const qs = new URLSearchParams({ track: title, artist: artistName });
      const res = await fetch(`/api/similarity?${qs}`);
      const recs: Recommendation[] = await res.json();
      if (res.ok) setRecommendations(recs);
    } catch {}
  };

  const getStatusText = () => {
    if (error) return '';
    if (isRecording) return isRecognizing ? 'Analyzing…' : 'Listening…';
    if (result) return 'Result found!';
    return 'Tap to start listening';
  };

  /* ================= UI ================= */

  return (
    <>
      <Header />
      <main className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-black flex flex-col items-center justify-center pt-32 px-6 text-center">

        <h1 className="text-5xl font-black text-white mb-4">
          Find a Song
        </h1>

        <p className={`text-lg text-gray-300 mb-12 ${isRecording && 'animate-pulse'}`}>
          {getStatusText()}
        </p>

        {/* RECORD BUTTON */}
        <div className="relative mb-10">
          {isRecording && !error && (
            <>
              <div className="absolute inset-0 rounded-full animate-ping bg-blue-500/30" />
              <div className="absolute inset-[-20px] rounded-full animate-ping bg-purple-500/20 delay-200" />
            </>
          )}

          <button
            onClick={isRecording ? handleStopRecording : handleStartRecording}
            className={`relative w-24 h-24 rounded-full flex items-center justify-center
                        bg-gradient-to-br from-blue-500 to-purple-600
                        hover:scale-105 transition shadow-2xl`}
          >
            {isRecording ? (
              <div className="w-6 h-6 bg-white rounded-sm" />
            ) : (
              <svg className="w-10 h-10 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 14a3 3 0 100-6 3 3 0 000 6z" />
                <path d="M12 2a10 10 0 100 20 10 10 0 000-20z" />
              </svg>
            )}
          </button>
        </div>

        {/* RESULT CARD */}
        {result && (
          <div className="w-full max-w-md backdrop-blur-xl bg-black/40 border border-blue-500/20 rounded-2xl p-6 shadow-2xl">
            <h2 className="text-2xl font-bold text-white">{result.title}</h2>
            <p className="text-gray-300">
              {result.artists.map(a => a.name).join(', ')}
            </p>
            <p className="text-gray-400 text-sm">
              Album: {result.album.name}
            </p>
            {session && (
              <p className="text-blue-400 mt-3 text-sm font-semibold">
                ✓ Saved to your history
              </p>
            )}
          </div>
        )}

        {/* RECOMMENDATIONS */}
        {(isLoadingRecs || recommendations.length > 0) && (
          <div className="mt-10 w-full max-w-3xl">
            <h3 className="text-xl font-bold text-white mb-4">
              {isLoadingRecs ? 'Finding recommendations…' : 'You may also like'}
            </h3>

            <div className="grid sm:grid-cols-2 gap-4">
              {recommendations.map(rec => (
                <div
                  key={rec.spotifyId}
                  className="backdrop-blur-xl bg-black/40 border border-gray-700 rounded-xl p-4 text-left"
                >
                  <h4 className="text-white font-semibold">{rec.title}</h4>
                  <p className="text-gray-300 text-sm">
                    {rec.artists.map(a => a.name).join(', ')}
                  </p>
                  <p className="text-gray-400 text-xs">
                    Album: {rec.album.name}
                  </p>

                  <a
                    href={rec.spotifyUrl}
                    target="_blank"
                    className="text-green-400 underline mt-2 inline-block text-sm"
                  >
                    Open in Spotify
                  </a>

                  {rec.preview_url && (
                    <audio controls className="w-full mt-2" src={rec.preview_url} />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ERROR */}
        {error && (
          <p className="mt-6 text-red-400 font-semibold">
            {error}
          </p>
        )}

        {/* LOGIN PROMPT */}
        {!session && !result && (
          <div className="mt-10 backdrop-blur-xl bg-black/40 p-4 rounded-xl border border-gray-700">
            <p className="text-gray-300 text-sm">
              <Link href="/login" className="text-blue-400 font-semibold hover:underline">
                Sign in
              </Link>{' '}
              to save your history
            </p>
          </div>
        )}

      </main>
    </>
  );
}