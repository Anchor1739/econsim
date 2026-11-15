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
      const maxLen = parseInt(el.getAttribute('maxlength') || '4000', 10);
      const currentLen = el.value.length;

      if (currentLen >= maxLen) {
        this.stop();
        if (window.api && window.api.toast) {
          window.api.toast(`🛑 Maximum character limit reached (${maxLen.toLocaleString()} chars). Voice dictation stopped.`, 'warning');
        }
        this.notify('max_reached', { max: maxLen });
        return;
      }

      // If incoming text exceeds remaining room, truncate to fit maxLen
      const remaining = maxLen - currentLen;
      let safeText = textToInsert;
      let reachedLimit = false;
      if (safeText.length > remaining) {
        safeText = safeText.substring(0, remaining);
        reachedLimit = true;
      }

      if (typeof el.selectionStart === 'number' && typeof el.selectionEnd === 'number') {
        const start = el.selectionStart;
        const end = el.selectionEnd;
        const val = el.value;
        const before = val.substring(0, start);
        const after = val.substring(end);
        
        // Add a space before if needed
        const needsSpace = before.length > 0 && !before.endsWith(' ') && !before.endsWith('\n');
        const inserted = (needsSpace ? ' ' : '') + safeText;

        el.value = (before + inserted + after).substring(0, maxLen);
        el.selectionStart = el.selectionEnd = Math.min(maxLen, start + inserted.length);
      } else {
        el.value = (el.value + (el.value.length > 0 ? ' ' : '') + safeText).substring(0, maxLen);
      }

      // Trigger input event to update counters & validation
      el.dispatchEvent(new Event('input', { bubbles: true }));

      if (reachedLimit || el.value.length >= maxLen) {
        this.stop();
        if (window.api && window.api.toast) {
          window.api.toast(`🛑 Maximum character limit reached (${maxLen.toLocaleString()} chars). Voice recording stopped automatically so you can review and submit your memo.`, 'warning');
        }
        this.notify('max_reached', { max: maxLen });
      }
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
      
      let raw = text.trim();
      
      // If already formatted with numbered points, preserve
      if (/^\s*1[\.\)]\s+/m.test(raw)) {
        return raw;
      }

      let items = [];

      // 1. Try splitting on standard sentence terminators (. ! ?)
      let sentenceCandidates = raw.split(/[.!?]+[\s\n]+/);
      if (sentenceCandidates.length >= 2 && sentenceCandidates.every(s => s.trim().length > 4)) {
        items = sentenceCandidates.map(s => s.trim()).filter(Boolean);
      } else {
        // 2. Mobile speech-to-text without punctuation: split on discourse markers & conjunctions
        const markerRegex = /\b(?:first(?:ly)?|second(?:ly)?|third(?:ly)?|finally|furthermore|moreover|in addition|also|we should|i recommend|my recommendation is|option [ab]|regarding|on the other hand)\b/gi;
        
        let splitIndices = [];
        let match;
        while ((match = markerRegex.exec(raw)) !== null) {
          if (match.index > 15) {
            splitIndices.push(match.index);
          }
        }

        if (splitIndices.length >= 1) {
          let lastIdx = 0;
          for (let idx of splitIndices) {
            let chunk = raw.substring(lastIdx, idx).trim();
            if (chunk) items.push(chunk);
            lastIdx = idx;
          }
          let lastChunk = raw.substring(lastIdx).trim();
          if (lastChunk) items.push(lastChunk);
        } else {
          // 3. Fallback for continuous unpunctuated voice stream: chunk every 16-22 words
          let words = raw.split(/\s+/);
          if (words.length > 12) {
            let chunkSize = Math.max(12, Math.min(20, Math.ceil(words.length / 3)));
            for (let i = 0; i < words.length; i += chunkSize) {
              items.push(words.slice(i, i + chunkSize).join(' '));
            }
          } else {
            items = [raw];
          }
        }
      }

      if (items.length <= 1) {
        let clean = items[0] || raw;
        return `1. ${clean.charAt(0).toUpperCase() + clean.slice(1).replace(/[.]+$/, '')}.`;
      }

      return items.map((item, idx) => {
        let clean = item.trim().replace(/^[\d\.\-\*\•\)\s]+/, '');
        clean = clean.charAt(0).toUpperCase() + clean.slice(1).replace(/[.]+$/, '');
        return `${idx + 1}. ${clean}.`;
      }).join('\n\n');
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

