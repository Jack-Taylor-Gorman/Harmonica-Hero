import { useEffect, useRef, useState, useCallback } from 'react';
import { audioContextManager } from './AudioContext';
import { HARMONICA_KEY_C, type NoteDefinition } from '../game/Constants';

// Optional config to avoid excessive re-renders when exact Hz isn't needed (e.g. Game loop)
interface PitchDetectorConfig {
    reportHz?: boolean;
}

export function usePitchDetector(config: PitchDetectorConfig = { reportHz: true }) {
    const [currentNote, setCurrentNote] = useState<NoteDefinition | null>(null);
    const [pitch, setPitch] = useState<number>(0);
    const [isListening, setIsListening] = useState(false);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
    const animationFrameRef = useRef<number | null>(null);

    // Buffer for smoothing
    const pitchBufferRef = useRef<number[]>([]);
    const SMOOTHING_WINDOW = 5;

    const autoCorrelate = (buffer: Float32Array, sampleRate: number) => {
        const SIZE = buffer.length;

        // 1. RMS Check
        let rms = 0;
        for (let i = 0; i < SIZE; i++) {
            const val = buffer[i];
            rms += val * val;
        }
        rms = Math.sqrt(rms / SIZE);
        if (rms < 0.015) return -1;

        // 2. Frequency Range
        const MIN_FREQ = 100;
        const MAX_FREQ = 3000;
        const minLag = Math.floor(sampleRate / MAX_FREQ);
        const maxLag = Math.floor(sampleRate / MIN_FREQ);

        let bestCorrelation = 0;
        let globalMaxLag = -1;

        // First Pass: Find Global Maximum to set threshold
        // Note: For extreme efficiency, we could just bias the loop, but finding true max is safer.
        // Array of correlations is small (~400 items)
        const correlations = new Float32Array(maxLag + 1);

        for (let lag = minLag; lag <= maxLag; lag++) {
            let sum = 0;
            // Unnormalized Correlation
            for (let i = 0; i < SIZE - lag; i++) {
                sum += buffer[i] * buffer[i + lag];
            }
            correlations[lag] = sum;

            if (sum > bestCorrelation) {
                bestCorrelation = sum;
                globalMaxLag = lag;
            }
        }

        if (bestCorrelation < 0.01) return -1; // No correlation

        // 3. Peak Picking (Favor Small Lags / High Frequencies)
        // We look for the FIRST peak (smallest lag) that is "strong enough"
        // relative to the global maximum.
        const THRESHOLD = 0.85; // If a higher note is 85% as strong as the lower note, pick it.

        for (let lag = minLag; lag <= maxLag; lag++) {
            // Is it a local peak?
            if (correlations[lag] > correlations[lag - 1] && correlations[lag] > correlations[lag + 1]) {
                // Is it strong enough?
                if (correlations[lag] > bestCorrelation * THRESHOLD) {
                    return sampleRate / lag;
                }
            }
        }

        return sampleRate / globalMaxLag;
    };

    const matchNote = (frequency: number): NoteDefinition | null => {
        if (frequency === -1 || frequency < 100 || frequency > 3000) return null;

        let closestNote: NoteDefinition | null = null;
        let minDiff = Infinity;

        for (const note of HARMONICA_KEY_C) {
            const diff = Math.abs(note.frequency - frequency);
            if (diff < minDiff) {
                minDiff = diff;
                closestNote = note;
            }
        }

        // Expanded threshold for better "feel" (5%)
        if (closestNote && minDiff < closestNote.frequency * 0.05) {
            return closestNote;
        }
        return null;
    };

    const startListening = useCallback(async () => {
        try {
            const stream = await audioContextManager.getMicrophoneStream();
            const audioCtx = audioContextManager.getAudioContext();
            await audioContextManager.resume();

            sourceRef.current = audioCtx.createMediaStreamSource(stream);
            analyserRef.current = audioCtx.createAnalyser();
            analyserRef.current.fftSize = 2048; // Keep 2048 for good bass resolution if needed

            sourceRef.current.connect(analyserRef.current);

            setIsListening(true);
            updatePitch();
        } catch (e) {
            console.error("Failed to start listening", e);
        }
    }, []);

    const updatePitch = () => {
        if (!analyserRef.current) return;
        const buffer = new Float32Array(analyserRef.current.fftSize);
        analyserRef.current.getFloatTimeDomainData(buffer);

        const rawPitch = autoCorrelate(buffer, audioContextManager.getAudioContext().sampleRate);

        // Smoothing
        if (rawPitch !== -1) {
            pitchBufferRef.current.push(rawPitch);
            if (pitchBufferRef.current.length > SMOOTHING_WINDOW) {
                pitchBufferRef.current.shift();
            }
        } else {
            // Decay buffer on silence so we don't get stuck, but slowly
            if (pitchBufferRef.current.length > 0) pitchBufferRef.current.shift();
        }

        // Get median pitch
        let smoothedPitch = -1;
        if (pitchBufferRef.current.length > 0) {
            const sorted = [...pitchBufferRef.current].sort((a, b) => a - b);
            smoothedPitch = sorted[Math.floor(sorted.length / 2)];
        }

        if (smoothedPitch !== -1) {
            if (config.reportHz) setPitch(smoothedPitch);
            const note = matchNote(smoothedPitch);
            setCurrentNote(note);
        } else {
            if (config.reportHz) setPitch(0);
            setCurrentNote(null);
        }

        animationFrameRef.current = requestAnimationFrame(updatePitch);
    };

    const stopListening = useCallback(() => {
        if (sourceRef.current) {
            sourceRef.current.disconnect();
        }
        if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
        }
        setIsListening(false);
        pitchBufferRef.current = [];
    }, []);

    useEffect(() => {
        return () => {
            stopListening();
        };
    }, []);

    return { isListening, startListening, stopListening, pitch, currentNote };
}
