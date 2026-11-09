// EconSim Voice-to-Text & Speech Modeling Engine
// Specialized for African & Nigerian English Accents (en-NG, en-GH, en-KE, en-ZA)

(function(window) {
  'use strict';

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

  const ACCENTS = {
    'en-NG': { label: '🇳🇬 Nigerian English', description: 'Tuned for Nigerian accents, inflections & pidgin business terminology' },
    'en-GH': { label: '🇬🇭 Ghanaian English', description: 'Tuned for West African Ghanaian English' },
    'en-KE': { label: '🇰🇪 East African (KE)', description: 'Tuned for East African & Kenyan English' },
    'en-ZA': { label: '🇿🇦 South African (ZA)', description: 'Tuned for South African English' },
    'en-GB': { label: '🇬🇧 British English', description: 'Standard Commonwealth English' },
    'en-US': { label: '🇺🇸 Global English', description: 'Standard General American English' }
  };

  class VoiceEngine {
    constructor() {
      this.recognition = null;
      this.isRecording = false;
      this.shouldKeepListening = false;
      this.targetElement = null;
      this.currentLang = localStorage.getItem('econsim-voice-accent') || 'en-NG';
      this.dictationUsed = false;
      this.spokenWordCount = 0;
      this.lastFinalTranscript = '';
      this.subscribers = new Set();
      this.initRecognition();
    }

    isSupported() {
      return Boolean(SpeechRecognition);
    }

    getAccents() {
      return ACCENTS;
    }

    getCurrentLanguage() {
      return this.currentLang;
    }

    setLanguage(langCode) {
      if (ACCENTS[langCode]) {
        this.currentLang = langCode;
        localStorage.setItem('econsim-voice-accent', langCode);
        if (this.recognition) {
          this.recognition.lang = langCode;
        }
        this.notify('languageChange', { lang: langCode, label: ACCENTS[langCode].label });
      }
    }

    subscribe(callback) {
      this.subscribers.add(callback);
      return () => this.subscribers.delete(callback);
    }

    notify(event, data) {
      this.subscribers.forEach(cb => {
        try { cb(event, data); } catch (e) { console.error('Voice subscriber err:', e); }
      });
    }

    initRecognition() {
      if (!this.isSupported()) return;

      this.recognition = new SpeechRecognition();
      this.recognition.continuous = true;
      this.recognition.interimResults = true;
      this.recognition.maxAlternatives = 1;
      this.recognition.lang = this.currentLang;

      this.recognition.onstart = () => {
        this.isRecording = true;
        this.notify('start', { lang: this.currentLang, target: this.targetElement });
      };

      this.recognition.onresult = (event) => {
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const result = event.results[i];
          const text = result[0].transcript;
          if (result.isFinal) {
            finalTranscript += this.cleanAndPunctuate(text);
          } else {
            interimTranscript += text;
          }
        }

        if (finalTranscript) {
          this.insertText(finalTranscript);
          this.dictationUsed = true;
          this.spokenWordCount += finalTranscript.trim().split(/\s+/).length;
          this.notify('finalResult', { text: finalTranscript, totalSpoken: this.spokenWordCount });
        }

        if (interimTranscript) {
          this.notify('interimResult', { text: interimTranscript });
        }
      };

      this.recognition.onerror = (event) => {
        console.warn('Voice recognition error:', event.error);
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
          this.shouldKeepListening = false;
          this.isRecording = false;
          this.notify('error', {
            error: event.error,
            message: 'Microphone permission denied. Please allow microphone access in your browser settings to dictate your strategy memo.'
          });
        } else if (event.error === 'no-speech') {
          // Normal silence, keep listening
        } else {
          this.notify('error', { error: event.error, message: `Voice input: ${event.error}` });
        }
      };

      this.recognition.onend = () => {
        if (this.shouldKeepListening && this.isRecording) {
          try {
            this.recognition.start();
          } catch (e) {}
        } else {
          this.isRecording = false;
          this.notify('stop', { target: this.targetElement, dictationUsed: this.dictationUsed });
        }
      };
    }

    cleanAndPunctuate(rawText) {
      if (!rawText) return '';
      let text = rawText.trim();

      // Nigerian & African currency and business phonetic mappings
      text = text.replace(/\b(naira|nairas)\b/gi, '₦');
      text = text.replace(/\b(kobo)\b/gi, 'k');
      text = text.replace(/\b(cbn|central bank of nigeria)\b/gi, 'CBN');
      text = text.replace(/\b(mpr|monetary policy rate)\b/gi, 'MPR');
      text = text.replace(/\b(fx|foreign exchange)\b/gi, 'FX');
      text = text.replace(/\b(fintech)\b/gi, 'Fintech');

      // Voice punctuation commands
      text = text.replace(/\s+(full stop|period)\b/gi, '.');
      text = text.replace(/\s+(comma)\b/gi, ',');
      text = text.replace(/\s+(colon)\b/gi, ':');
      text = text.replace(/\s+(semicolon)\b/gi, ';');
      text = text.replace(/\s+(question mark)\b/gi, '?');
      text = text.replace(/\s+(exclamation mark)\b/gi, '!');
      text = text.replace(/\s+(new line|next line)\b/gi, '\n');
      text = text.replace(/\s+(new paragraph)\b/gi, '\n\n');
      text = text.replace(/\s+(bullet point|bullet)\b/gi, '\n• ');
      text = text.replace(/\s+(percent|percentage)\b/gi, '%');

      // Capitalize first letter of complete sentences
      text = text.replace(/(^\s*|[.!?]\s+)([a-z])/g, (m, p1, p2) => p1 + p2.toUpperCase());

      return text + ' ';
    }

    insertText(textToInsert) {
      if (!this.targetElement) return;

      const el = this.targetElement;
      if (typeof el.selectionStart === 'number' && typeof el.selectionEnd === 'number') {
        const start = el.selectionStart;
        const end = el.selectionEnd;
        const val = el.value;
        const before = val.substring(0, start);
        const after = val.substring(end);
        
        // Add a space before if needed
        const needsSpace = before.length > 0 && !before.endsWith(' ') && !before.endsWith('\n');
        const inserted = (needsSpace ? ' ' : '') + textToInsert;

        el.value = before + inserted + after;
        el.selectionStart = el.selectionEnd = start + inserted.length;
      } else {
        el.value += (el.value.length > 0 ? ' ' : '') + textToInsert;
      }

      // Trigger input event to update counters & validation
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }

    start(targetElementOrId) {
      if (!this.isSupported()) {
        if (window.api && window.api.toast) {
          window.api.toast('Voice dictation requires Chrome, Safari, Edge, or an Android browser.', 'warning');
        }
        return false;
      }

      const el = typeof targetElementOrId === 'string' 
        ? document.getElementById(targetElementOrId) 
        : targetElementOrId;

      if (!el) {
        console.error('Voice dictation target not found:', targetElementOrId);
        return false;
      }

      this.targetElement = el;
      this.shouldKeepListening = true;

      try {
        this.recognition.lang = this.currentLang;
        this.recognition.start();
        return true;
      } catch (err) {
        // Recognition might already be running
        if (err.name === 'InvalidStateError') {
          this.isRecording = true;
          return true;
        }
        console.error('Failed to start speech recognition:', err);
        return false;
      }
    }

    stop() {
      this.shouldKeepListening = false;
      if (this.recognition && this.isRecording) {
        try {
          this.recognition.stop();
        } catch (e) {}
      }
      this.isRecording = false;
      this.notify('stop', { target: this.targetElement, dictationUsed: this.dictationUsed });
    }

    toggle(targetElementOrId) {
      if (this.isRecording) {
        this.stop();
        return false;
      } else {
        return this.start(targetElementOrId);
      }
    }

    formatAsExecutiveMemo(text) {
      if (!text || !text.trim()) return text;
      let lines = text.split('\n').map(l => l.trim()).filter(Boolean);
      
      // Auto-structure sentences into executive memo bullet points if it's one large unstructured paragraph
      if (lines.length === 1 && lines[0].split(/[.!?]\s+/).length > 2) {
        const sentences = lines[0].split(/(?<=[.!?])\s+/);
        return sentences.map((s, idx) => {
          s = s.trim();
          if (!s) return '';
          return `${idx + 1}. ${s.charAt(0).toUpperCase() + s.slice(1)}`;
        }).join('\n\n');
      }
      return text;
    }

    getStats() {
      return {
        used: this.dictationUsed,
        wordCount: this.spokenWordCount,
        language: this.currentLang
      };
    }
  }

  // Export singleton instance
  window.VoiceEngine = new VoiceEngine();
})(window);
