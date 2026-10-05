import { useState, useEffect, useCallback, useRef } from 'react';

export function useVoiceInput(onTranscriptUpdate: (text: string) => void) {
  const [isRecording, setIsRecording] = useState(false);
  const [isSupported] = useState(() => typeof window !== 'undefined' && Boolean((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition));
  const [recognition, setRecognition] = useState<any>(null);
  
  // Use a ref to keep the latest callback without re-triggering the useEffect
  const callbackRef = useRef(onTranscriptUpdate);
  useEffect(() => {
    callbackRef.current = onTranscriptUpdate;
  }, [onTranscriptUpdate]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      return;
    }

    const rec = new SpeechRecognition();
    let active = true;
    // Using false makes it wait until the user stops speaking, which is much more reliable
    // for appending to existing text without complex interim-state management.
    rec.continuous = false;
    rec.interimResults = false;
    rec.lang = 'en-US';

    rec.onresult = (event: any) => {
      if (!active) return;
      let finalTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        }
      }
      
      if (finalTranscript.trim()) {
        callbackRef.current(finalTranscript.trim());
      }
    };

    rec.onerror = (event: any) => {
      if (!active) return;
      console.warn('Speech recognition error', event.error);
      setIsRecording(false);
    };

    rec.onend = () => {
      if (active) setIsRecording(false);
    };

    setRecognition(rec);
    return () => {
      // A late device result must not edit a draft after this composer is replaced.
      active = false;
      rec.onresult = null;
      rec.onerror = null;
      rec.onend = null;
      try { rec.abort(); } catch { /* Already stopped or unavailable. */ }
    };
  }, []);

  const start = useCallback(() => {
    if (recognition) {
      try {
        recognition.start();
        setIsRecording(true);
      } catch (e) {
        console.warn("Could not start speech recognition", e);
      }
    }
  }, [recognition]);

  const stop = useCallback(() => {
    if (recognition) {
      try {
        recognition.stop();
        setIsRecording(false);
      } catch {
        setIsRecording(false);
      }
    }
  }, [recognition]);

  return { isRecording, isSupported, start, stop };
}
