import { useState, useEffect, useCallback } from 'react';

export function useVoiceInput(onTranscriptUpdate: (text: string) => void) {
  const [isRecording, setIsRecording] = useState(false);
  const [isSupported, setIsSupported] = useState(true);
  const [recognition, setRecognition] = useState<any>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setIsSupported(false);
      return;
    }

    const rec = new SpeechRecognition();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = 'en-US';

    rec.onresult = (event: any) => {
      let finalTranscript = '';
      let interimTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        } else {
          interimTranscript += event.results[i][0].transcript;
        }
      }
      
      const fullTranscript = finalTranscript + interimTranscript;
      if (fullTranscript) {
        onTranscriptUpdate(fullTranscript);
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
  }, [onTranscriptUpdate]);

  const start = useCallback(() => {
    if (recognition) {
      recognition.start();
      setIsRecording(true);
    }
  }, [recognition]);

  const stop = useCallback(() => {
    if (recognition) {
      recognition.stop();
      setIsRecording(false);
    }
  }, [recognition]);

  return { isRecording, isSupported, start, stop };
}
