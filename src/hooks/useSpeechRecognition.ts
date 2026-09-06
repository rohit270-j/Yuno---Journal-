import { useState, useEffect, useCallback, useRef } from 'react';

declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

export function useSpeechRecognition(onResult: (text: string, isFinal: boolean) => void) {
  const [supported, setSupported] = useState(true);
  const [isListening, setIsListening] = useState(false);
  const [recognition, setRecognition] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const onResultRef = useRef(onResult);
  
  useEffect(() => {
    onResultRef.current = onResult;
  }, [onResult]);

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setSupported(false);
      return;
    }

    const rec = new SpeechRecognition();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = 'en-US';

    rec.onresult = (event: any) => {
      let interimTranscript = '';
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        } else {
          interimTranscript += event.results[i][0].transcript;
        }
      }
      
      if (finalTranscript) {
         onResultRef.current(finalTranscript, true);
      } else if (interimTranscript) {
         onResultRef.current(interimTranscript, false);
      }
    };

    rec.onerror = (event: any) => {
      console.error("Speech recognition error:", event.error);
      setIsListening(false);
      
      if (event.error === 'not-allowed') {
        setError('Microphone access denied.');
      } else {
        setError(`Error: ${event.error}`);
      }
    };

    rec.onend = () => {
      setIsListening(false);
    };

    setRecognition(rec);
    
    return () => {
      try {
        rec.stop();
      } catch (e) {
        // ignore
      }
    };
  }, []); // Run only once

  const startListening = useCallback(() => {
    if (!supported || !recognition || isListening) return;
    setError(null);
    try {
      recognition.start();
      setIsListening(true);
    } catch (err: any) {
      // If already started, ignore DOMException
      if (err?.name !== 'InvalidStateError') {
        console.error("Failed to start speech recognition:", err);
      }
    }
  }, [isListening, recognition, supported]);

  const stopListening = useCallback(() => {
    if (!supported || !recognition || !isListening) return;
    try {
      recognition.stop();
      setIsListening(false);
    } catch (err) {
      console.error("Failed to stop speech recognition:", err);
    }
  }, [isListening, recognition, supported]);

  const toggleListening = useCallback(() => {
    if (!supported || !recognition) return;
    setError(null);

    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  }, [isListening, startListening, stopListening, recognition, supported]);

  return {
    supported,
    isListening,
    toggleListening,
    startListening,
    stopListening,
    error
  };
}
