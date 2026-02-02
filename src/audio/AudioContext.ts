class AudioContextManager {
    private static instance: AudioContextManager;
    private audioContext: AudioContext | null = null;
    private micStream: MediaStream | null = null;
    private constructor() { }

    public static getInstance(): AudioContextManager {
        if (!AudioContextManager.instance) {
            AudioContextManager.instance = new AudioContextManager();
        }
        return AudioContextManager.instance;
    }

    public getAudioContext(): AudioContext {
        if (!this.audioContext) {
            const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
            this.audioContext = new AudioContextClass();
        }
        return this.audioContext;
    }

    public async getMicrophoneStream(): Promise<MediaStream> {
        if (this.micStream) {
            // Check if active?
            try {
                if (this.micStream.active === false) {
                    this.micStream = null;
                }
            } catch (e) { }

            if (this.micStream) return this.micStream;
        }
        try {
            this.micStream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: false,
                    autoGainControl: false,
                    noiseSuppression: false, // We want raw audio for better pitch detection
                },
            });
            return this.micStream;
        } catch (error) {
            console.error('Error accessing microphone:', error);
            throw error;
        }
    }

    public async resume() {
        if (this.audioContext?.state === 'suspended') {
            await this.audioContext.resume();
        }
    }

    public stopMicrophoneStream() {
        if (this.micStream) {
            try {
                this.micStream.getTracks().forEach(track => track.stop());
            } catch (e) { console.error("Error stopping tracks", e); }
            this.micStream = null;
        }
    }
}

export const audioContextManager = AudioContextManager.getInstance();
