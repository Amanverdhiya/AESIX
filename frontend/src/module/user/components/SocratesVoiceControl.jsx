import React, { useState, useEffect, useRef } from 'react';
import { Volume2, Mic, MicOff, Square } from 'lucide-react';
import { useDashboardLanguage } from '../LanguageContext';

const LANG_CODES = {
  English: 'en-IN',
  Hindi: 'hi-IN',
  Bengali: 'bn-IN',
  Tamil: 'ta-IN',
};

const VOICE_LABELS = {
  English: {
    listen: 'Listen',
    stop: 'Stop',
    speak: 'Speak',
    listening: 'Listening...',
  },
  Hindi: {
    listen: 'सुनें',
    stop: 'रोकें',
    speak: 'बोलें',
    listening: 'सुन रहे हैं...',
  },
  Bengali: {
    listen: 'শুনুন',
    stop: 'থামুন',
    speak: 'বলুন',
    listening: 'শুনছি...',
  },
  Tamil: {
    listen: 'கேட்க',
    stop: 'நிறுத்து',
    speak: 'பேச',
    listening: 'கேட்கிறது...',
  }
};

const NUMBER_MAP = {
  // English
  '0': 0, 'zero': 0,
  '1': 1, 'one': 1,
  '2': 2, 'two': 2,
  '3': 3, 'three': 3,
  '4': 4, 'four': 4,
  '5': 5, 'five': 5,
  '6': 6, 'six': 6,
  '7': 7, 'seven': 7,
  '8': 8, 'eight': 8,
  '9': 9, 'nine': 9,
  '10': 10, 'ten': 10,
  // Hindi
  'शून्य': 0, 'जीरो': 0, 'एक': 1, 'दो': 2, 'तीन': 3, 'चार': 4, 'पांच': 5, 'पाँच': 5, 'छह': 6, 'छः': 6, 'सात': 7, 'आठ': 8, 'नौ': 9, 'दस': 10,
  // Bengali
  'শূন্য': 0, 'এক': 1, 'দুই': 2, 'তিন': 3, 'চার': 4, 'পাঁচ': 5, 'ছয়': 6, 'সাত': 7, 'আট': 8, 'নয়': 9, 'দশ': 10,
  // Tamil
  'பூஜ்யம்': 0, 'ஒன்று': 1, 'இரண்டு': 2, 'மூன்று': 3, 'நான்கு': 4, 'ஐந்து': 5, 'ஆறு': 6, 'ஏழு': 7, 'எட்டு': 8, 'ஒன்பது': 9, 'பத்து': 10
};

export default function SocratesVoiceControl({
  questionId,
  getQuestionText,
  value,
  onValueChange,
  activeVoiceId,
  setActiveVoiceId,
  isNumberField = false,
  options = [],
  onOptionToggle = null
}) {
  const { language } = useDashboardLanguage();
  const [errorMsg, setErrorMsg] = useState('');
  const recognitionRef = useRef(null);
  const timerRef = useRef(null);
  // Auto-retry budget for transient Chrome speech-socket drops ('network').
  const retryRef = useRef(0);

  const langCode = LANG_CODES[language] || 'en-IN';
  const t = VOICE_LABELS[language] || VOICE_LABELS.English;

  const isListenActive = activeVoiceId === `${questionId}_listen`;
  const isSpeakActive = activeVoiceId === `${questionId}_speak`;

  const clearSpeakTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  // Stop recognition and synthesis if another control becomes active
  useEffect(() => {
    if (!isListenActive && !isSpeakActive) {
      clearSpeakTimer();
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch (e) {}
        recognitionRef.current = null;
      }
    }
  }, [activeVoiceId, isListenActive, isSpeakActive]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      clearSpeakTimer();
      if (window.speechSynthesis) {
        try { window.speechSynthesis.cancel(); } catch (e) {}
      }
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch (e) {}
        recognitionRef.current = null;
      }
    };
  }, []);

  const clearError = () => {
    setTimeout(() => setErrorMsg(''), 4000);
  };

  // 1. LISTEN (Text-to-Speech)
  const handleListenToggle = (e) => {
    e.preventDefault();
    setErrorMsg('');
    clearSpeakTimer();

    if (isListenActive) {
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      setActiveVoiceId(null);
      return;
    }

    // Stop all synthesis & recognition
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch (err) {}
      recognitionRef.current = null;
    }

    const textToRead = getQuestionText ? getQuestionText() : '';
    if (!textToRead || !textToRead.trim()) {
      setErrorMsg('No question text to read.');
      clearError();
      return;
    }

    if (!('speechSynthesis' in window)) {
      setErrorMsg('Text-to-speech is not supported in this browser.');
      clearError();
      return;
    }

    // Clean up text (remove markdown symbols or asterisks)
    const cleanText = textToRead.replace(/[*#]/g, '').trim();

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = langCode;
    utterance.rate = 0.95;

    utterance.onend = () => {
      setActiveVoiceId(null);
    };

    utterance.onerror = (err) => {
      console.warn('SpeechSynthesis error:', err);
      setActiveVoiceId(null);
    };

    setActiveVoiceId(`${questionId}_listen`);
    window.speechSynthesis.speak(utterance);
  };

  // 2. SPEAK (Speech-to-Text)
  const handleSpeakToggle = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (isSpeakActive) {
      clearSpeakTimer();
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch (err) {}
        recognitionRef.current = null;
      }
      setActiveVoiceId(null);
      return;
    }

    // Stop all synthesis & active recognition
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch (err) {}
      recognitionRef.current = null;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setErrorMsg('Speech recognition is not supported in this browser. Please use Chrome or Edge.');
      clearError();
      return;
    }

    // Fail fast when plainly offline — Chrome's recognizer streams to
    // Google servers, so it can never work without internet.
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      setErrorMsg('You appear to be offline. Voice recognition needs an internet connection.');
      clearError();
      return;
    }

    // Explicitly warm up microphone permissions to prevent Chrome Speech API network drop
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const tempStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        tempStream.getTracks().forEach((track) => track.stop());
      }
    } catch (micErr) {
      console.warn('Microphone permission check error:', micErr);
      setErrorMsg('Microphone access denied. Please allow microphone permissions.');
      clearError();
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = langCode;
      recognition.continuous = false; // Disable continuous to avoid Chrome webkitSpeech API network socket drop
      recognition.interimResults = true;

      recognition.onstart = () => {
        setActiveVoiceId(`${questionId}_speak`);

        // Automatically stop recording after 7 seconds
        clearSpeakTimer();
        timerRef.current = setTimeout(() => {
          if (recognitionRef.current) {
            try { recognitionRef.current.stop(); } catch (err) {}
          }
          setActiveVoiceId(null);
        }, 7000);
      };

      recognition.onresult = (event) => {
        // A result means the speech socket is healthy — restore retry budget.
        retryRef.current = 0;
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }

        if (!transcript.trim()) return;

        const textSpoken = transcript.trim();

        if (isNumberField) {
          // Parse rating 0-10
          let foundNum = null;
          const words = textSpoken.toLowerCase().split(/\s+/);
          for (const w of words) {
            const clean = w.replace(/[^\p{L}\p{N}]/gu, '');
            if (NUMBER_MAP[clean] !== undefined) {
              foundNum = NUMBER_MAP[clean];
              break;
            }
            const parsedInt = parseInt(clean, 10);
            if (!isNaN(parsedInt) && parsedInt >= 0 && parsedInt <= 10) {
              foundNum = parsedInt;
              break;
            }
          }
          if (foundNum !== null) {
            onValueChange(foundNum);
          } else {
            // Also check digits in full text
            const match = textSpoken.match(/\b([0-9]|10)\b/);
            if (match) {
              onValueChange(parseInt(match[1], 10));
            }
          }
        } else {
          // Check options matching if applicable
          if (options && options.length > 0 && onOptionToggle) {
            let matchedOption = false;
            for (const opt of options) {
              if (textSpoken.toLowerCase().includes(opt.toLowerCase())) {
                onOptionToggle(opt);
                matchedOption = true;
              }
            }
            if (!matchedOption) {
              // Replace or set value
              onValueChange(textSpoken);
            }
          } else {
            // Append or set value
            onValueChange(textSpoken);
          }
        }
      };

      recognition.onerror = (event) => {
        clearSpeakTimer();
        console.warn('SpeechRecognition error:', event.error);
        // Our own stop() call surfaces as 'aborted' — not an error.
        if (event.error === 'aborted') {
          setActiveVoiceId(null);
          return;
        }
        if (event.error === 'network' && retryRef.current < 1) {
          // Transient Chrome speech-socket drop: one silent re-connect.
          retryRef.current += 1;
          try {
            recognition.start();
            return;
          } catch (retryErr) {
            console.warn('Speech retry failed:', retryErr);
          }
        }
        retryRef.current = 0;
        if (event.error === 'network') {
          setErrorMsg('Voice service unreachable. Check your internet, then tap Speak to try again.');
          clearError();
        } else if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
          setErrorMsg('Microphone access denied. Please check browser permissions.');
          clearError();
        } else if (event.error === 'audio-capture') {
          setErrorMsg('No microphone found or mic is busy.');
          clearError();
        } else if (event.error !== 'no-speech') {
          setErrorMsg(`Voice error: ${event.error}`);
          clearError();
        }
        setActiveVoiceId(null);
      };

      recognition.onend = () => {
        clearSpeakTimer();
        setActiveVoiceId(null);
      };

      recognitionRef.current = recognition;
      retryRef.current = 0; // fresh tap = fresh retry budget
      recognition.start();
    } catch (err) {
      clearSpeakTimer();
      console.error('Failed to start speech recognition:', err);
      setErrorMsg('Could not access microphone.');
      clearError();
      setActiveVoiceId(null);
    }
  };

  return (
    <div className="socrates-voice-wrapper" style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.2rem' }}>
      <div className="socrates-voice-controls" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }} data-no-translate translate="no">
        {/* Listen Button */}
        <button
          type="button"
          onClick={handleListenToggle}
          className={`socrates-voice-btn listen ${isListenActive ? 'active' : ''}`}
          title="Read question aloud"
          aria-label="Listen to question"
        >
          {isListenActive ? (
            <>
              <Square size={13} className="voice-icon-pulse" />
              <span>{t.stop}</span>
            </>
          ) : (
            <>
              <Volume2 size={14} />
              <span>{t.listen}</span>
            </>
          )}
        </button>

        {/* Speak Button */}
        <button
          type="button"
          onClick={handleSpeakToggle}
          className={`socrates-voice-btn speak ${isSpeakActive ? 'active' : ''}`}
          title="Answer with voice"
          aria-label="Speak answer"
        >
          {isSpeakActive ? (
            <>
              <MicOff size={14} className="voice-icon-pulse" />
              <span>{t.listening}</span>
            </>
          ) : (
            <>
              <Mic size={14} />
              <span>{t.speak}</span>
            </>
          )}
        </button>
      </div>

      {errorMsg && (
        <span style={{ fontSize: '0.72rem', color: '#EF4444', fontWeight: 600, marginTop: '0.1rem' }}>
          {errorMsg}
        </span>
      )}
    </div>
  );
}
