'use client';
import { useState, useRef, useEffect, useCallback } from 'react';
import {
  getOptimalAudioConstraints,
  getSupportedAudioMimeType,
  checkAudioDecodingSupport,
  normalizeAudioVolume,
  VOLUME_BOOST,
  convertToWav,
  canDecodeAudio,
} from '@/lib/audioUtils';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import Header from '@/components/Header';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { slugify } from '@/lib/slugify';

// --- Constants ---
// const RECORDING_INTERVAL_MS = 10000;
const RECOGNITION_TIMEOUT_MS = 30000;
const VISUALIZER_CANVAS_SIZE = 200;
const VISUALIZER_INNER_RADIUS = 55;
const VISUALIZER_MAX_BAR_HEIGHT = 70;
const VISUALIZER_BAR_WIDTH = 3;
const VISUALIZER_FFT_SIZE = 256;

// --- Type Definitions ---
interface SongResult {
  title: string;
  artists: { name: string }[];
  album: { name: string };
  source?: 'music' | 'humming';
  error?: string;
  spotifyId?: string | null;
}

export default function HomePage() {
  const { data: session } = useSession();
  const [isRecording, setIsRecording] = useState(false);
  const [isRecognizing, setIsRecognizing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const router = useRouter();

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const resultFoundRef = useRef<boolean>(false);
  const isRecognizingRef = useRef<boolean>(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const visualizerDataArrayRef = useRef<Uint8Array | null>(null);
  const rotationOffsetRef = useRef(0);

  useEffect(() => {
    isRecognizingRef.current = isRecognizing;
  }, [isRecognizing]);

  // Check audio codec support on mount (for debugging)
  useEffect(() => {
    checkAudioDecodingSupport();
  }, []);

  const drawVisualizer = useCallback(() => {
    if (
      !analyserRef.current ||
      !visualizerDataArrayRef.current ||
      !canvasRef.current
    ) {
      return;
    }

    const analyser = analyserRef.current;
    const dataArray = visualizerDataArrayRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    if (!ctx) return;

    rotationOffsetRef.current += 0.001;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    analyser.getByteFrequencyData(dataArray as any);

    const bufferLength = analyser.frequencyBinCount;
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.lineWidth = VISUALIZER_BAR_WIDTH;
    ctx.lineCap = 'round';

    for (let i = 0; i < bufferLength; i++) {
      const barHeight =
        (dataArray[i] / 255) * VISUALIZER_MAX_BAR_HEIGHT;

      if (barHeight < 0.1) continue;

      const angle =
        (i / bufferLength) * Math.PI * 2 + rotationOffsetRef.current;

      const x1 = centerX + Math.cos(angle) * VISUALIZER_INNER_RADIUS;
      const y1 = centerY + Math.sin(angle) * VISUALIZER_INNER_RADIUS;
      const x2 =
        centerX + Math.cos(angle) * (VISUALIZER_INNER_RADIUS + barHeight);
      const y2 =
        centerY + Math.sin(angle) * (VISUALIZER_INNER_RADIUS + barHeight);

      const barGradient = ctx.createLinearGradient(x1, y1, x2, y2);
      barGradient.addColorStop(0, '#3B82F6');
      barGradient.addColorStop(0.6, '#8B5CF6');
      barGradient.addColorStop(1, 'rgba(139,92,246,0)');

      ctx.strokeStyle = barGradient;

      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }

    animationFrameRef.current = requestAnimationFrame(drawVisualizer);
  }, []);

  // --- Start Recording ---
  const handleStartRecording = async () => {
    setError(null);
    setIsRecognizing(false);
    isRecognizingRef.current = false;
    resultFoundRef.current = false;

    try {
      const audioConstraints = getOptimalAudioConstraints();
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: audioConstraints,
      });
      streamRef.current = stream;

      let mimeType: string | undefined = 'audio/wav';
      if (!MediaRecorder.isTypeSupported('audio/wav')) {
        mimeType = getSupportedAudioMimeType();
      }

      mediaRecorderRef.current = new MediaRecorder(
        stream,
        mimeType ? { mimeType } : undefined
      );

      mediaRecorderRef.current.ondataavailable = async (event) => {
        if (resultFoundRef.current) return;
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
          if (!resultFoundRef.current) recognizeSong(processedBlob);
        }
      };

      const AudioContextPolyfill =
        window.AudioContext ||
        (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

      const audioContext = new AudioContextPolyfill();
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = VISUALIZER_FFT_SIZE;

      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);

      audioContextRef.current = audioContext;
      analyserRef.current = analyser;
      sourceNodeRef.current = source;
      visualizerDataArrayRef.current = new Uint8Array(analyser.frequencyBinCount);

      mediaRecorderRef.current.start(10000);
      setIsRecording(true);
      animationFrameRef.current = requestAnimationFrame(drawVisualizer);

      timeoutRef.current = setTimeout(() => {
        if (resultFoundRef.current) return;
        setError("Couldn't find a match. Try again!");
        handleStopRecording();
      }, RECOGNITION_TIMEOUT_MS);

    } catch {
      setError('Microphone access denied.');
    }
  };

  // --- Stop Recording ---
  const handleStopRecording = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    resultFoundRef.current = true;

    mediaRecorderRef.current?.stop();
    streamRef.current?.getTracks().forEach(t => t.stop());
    audioContextRef.current?.close();

    setIsRecording(false);
    setIsRecognizing(false);
  };

  // --- Recognize Song ---
  const recognizeSong = async (audioBlob: Blob) => {
    if (isRecognizingRef.current || resultFoundRef.current) return;

    setIsRecognizing(true);
    isRecognizingRef.current = true;

    const formData = new FormData();
    formData.append('sample', audioBlob, 'recording.wav');

    try {
      const res = await fetch('/api/recognize', { method: 'POST', body: formData });
      if (res.status === 204) return;

      const data: SongResult = await res.json();

      if (res.ok && data.title && data.spotifyId) {
        resultFoundRef.current = true;
        handleStopRecording();

        sessionStorage.setItem(
          'transitionData',
          JSON.stringify({
            title: data.title,
            artists: data.artists.map(a => a.name).join(', ')
          })
        );

        router.push(`/song/${data.spotifyId}/${slugify(data.title)}`);
      }
    } catch {
      setError('Recognition failed.');
      handleStopRecording();
    } finally {
      if (!resultFoundRef.current) {
        setIsRecognizing(false);
        isRecognizingRef.current = false;
      }
    }
  };

  return (
    <>
      <Header />
      <main className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-black flex flex-col items-center justify-center pt-32 px-6 text-center">

        {/* LOGO */}
        <div className="flex justify-center -mt-6 mb-8">
          <Link href="/" className="flex items-center gap-4">
            <Image
              src="/svg/tebaklagu-default.svg"
              alt="logo"
              width={44}
              height={44}
              priority
            />
            <span className="text-5xl font-black text-white">
              <span className="text-white">tebak</span>
              <span className="text-lime-400">lagu</span>
            </span>
          </Link>
        </div>

        {/* DIVIDER */}
        {/* <div className="w-24 h-[2px] bg-gradient-to-r from-blue-500 to-purple-500 mb-8" /> */}

        <p className="text-lg text-gray-300 mb-10">
          {!error && 'Tap to start listening'}
        </p>

        {/* RECORD BUTTON */}
        <div className="relative mb-6">
          {isRecording && (
            <>
              <div className="absolute inset-0 rounded-full animate-ping bg-blue-500/30" />
              <div className="absolute inset-[-20px] rounded-full animate-ping bg-purple-500/20 delay-200" />
            </>
          )}

          {isRecording && (
            <canvas
              ref={canvasRef}
              width={VISUALIZER_CANVAS_SIZE}
              height={VISUALIZER_CANVAS_SIZE}
              className="absolute inset-0"
            />
          )}

          <button
            onClick={isRecording ? handleStopRecording : handleStartRecording}
            className="relative w-24 h-24 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-2xl hover:scale-105 transition"
            disabled={isRecognizing}
          >
            {isRecording ? (
              <div className="w-6 h-6 bg-white rounded-sm" />
            ) : (
              <svg className="w-10 h-10 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 14a3 3 0 003-3V5a3 3 0 00-6 0v6a3 3 0 003 3z" />
                <path d="M19 11a1 1 0 10-2 0 5 5 0 01-10 0 1 1 0 10-2 0 7 7 0 006 6.92V21a1 1 0 102 0v-3.08A7 7 0 0019 11z" />
              </svg>
            )}
          </button>
        </div>

        {error && (
          <p className="text-red-400 font-semibold mt-4">
            {error}
          </p>
        )}

        {!session && !error && !isRecording && (
          <div className="mt-8 backdrop-blur-xl bg-black/40 border border-gray-700 rounded-xl p-4">
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
