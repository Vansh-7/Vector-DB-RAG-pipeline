import { useState, useEffect, useCallback, useRef } from 'react';

export function useVoiceInput(onTranscriptUpdate: (text: string) => void) {
  const [isRecording, setIsRecording] = useState(false);
  const [isSupported, setIsSupported] = useState(true);
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
      setIsSupported(false);
      return;
    }

    const rec = new SpeechRecognition();
    // Using false makes it wait until the user stops speaking, which is much more reliable
    // for appending to existing text without complex interim-state management.
    rec.continuous = false;
    rec.interimResults = false;
    rec.lang = 'en-US';

    rec.onresult = (event: any) => {
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
      console.warn('Speech recognition error', event.error);
      setIsRecording(false);
    };

    rec.onend = () => {
      setIsRecording(false);
    };

    setRecognition(rec);
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
      } catch (e) {}
    }
  }, [recognition]);

  return { isRecording, isSupported, start, stop };
}
