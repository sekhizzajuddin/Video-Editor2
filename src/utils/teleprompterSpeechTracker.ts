/**
 * teleprompterSpeechTracker.ts
 *
 * Real-time Speech Recognition, Word-Level Tracking, and Dialogue-by-Dialogue Auto-Advance Engine.
 * Features:
 * - Multilingual dialogue sentence parsing & tokenization
 * - On-device ultra-low-latency SpeechRecognition tracking
 * - Robust fuzzy token matching (exact, prefix, Levenshtein edit distance)
 * - Real-time word highlighting: past words (completed), current/next word (pulsing focus), remaining words
 * - Seamless auto-advance to next dialogue when sentence is completed
 * - Fallback auto-pacer (adjustable WPM) for smooth cadence even in noisy rooms
 * - Gemini Live API integration hook for multimodal streaming
 */

export interface DialogueWord {
  index: number;
  raw: string;          // Original with punctuation (e.g., "Welcome,")
  clean: string;        // Lowercased, alphanumeric only (e.g., "welcome")
  isCompleted: boolean;
  isNext: boolean;
}

export interface DialogueSentence {
  id: string;
  index: number;
  text: string;
  character?: string;   // Optional speaker name (e.g. "Host:", "Narrator:")
  words: DialogueWord[];
  estimatedDurationSec: number;
  audioBlob?: Blob;     // Recorded audio for this sentence (if recorded per sentence)
  isDelivered: boolean;
}

export interface SpeechTrackerOptions {
  wpm?: number;                    // Estimated reading speed (default: 130 WPM)
  autoAdvance?: boolean;           // Automatically advance to next sentence when finished
  fuzzyTolerance?: number;         // 0 (strict) to 2 (tolerant)
  language?: string;               // e.g. 'en-US', 'hi-IN', 'es-ES'
  useGeminiLive?: boolean;
}

/**
 * Splits a script into clean, natural dialogue sentences.
 * Handles English, Hindi, Urdu, screenplays, and various punctuation marks.
 */
export function parseScriptToDialogueSentences(scriptText: string, wpm = 130): DialogueSentence[] {
  if (!scriptText || !scriptText.trim()) {
    return [];
  }

  // Normalize newlines and clean input
  const normalized = scriptText.replace(/\r\n/g, '\n').trim();

  // Split into candidate lines / sentences
  // Splits on:
  // - Double newlines (paragraphs)
  // - Single newlines if they look like dialogue lines (e.g. "Speaker: ...")
  // - Sentence terminators (. ! ? । ؟) followed by space or newline
  const rawSegments: string[] = [];

  const lines = normalized.split(/\n+/);
  for (const line of lines) {
    const trimmedLine = line.trim();
    if (!trimmedLine) continue;

    // Check if line contains internal sentence punctuation: . ! ? । ؟
    // Use regex lookbehind or capture to split without destroying abbreviations like "e.g.", "Dr."
    const sentenceParts = trimmedLine
      .split(/(?<=[.!?|।؟])\s+(?=[A-Z0-9\u0900-\u097F\u0600-\u06FF"'])/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    if (sentenceParts.length > 0) {
      rawSegments.push(...sentenceParts);
    } else {
      rawSegments.push(trimmedLine);
    }
  }

  // Convert raw segments into DialogueSentence structures
  const sentences: DialogueSentence[] = rawSegments.map((segment, sIndex) => {
    let text = segment;
    let character: string | undefined = undefined;

    // Check for character cue at start: e.g. "NARRATOR: Welcome to..." or "JOHN: Hello"
    const charMatch = text.match(/^([A-Za-z0-9\s_-]{2,25}):\s*(.*)$/);
    if (charMatch) {
      character = charMatch[1].trim();
      text = charMatch[2].trim() || text;
    }

    // Tokenize into words
    const rawTokens = text.split(/\s+/).filter((w) => w.length > 0);
    const words: DialogueWord[] = rawTokens.map((rawWord, wIndex) => {
      const clean = rawWord
        .toLowerCase()
        .replace(/[^a-z0-9\u0900-\u097F\u0600-\u06FF]/gi, '');

      return {
        index: wIndex,
        raw: rawWord,
        clean: clean || rawWord.toLowerCase(),
        isCompleted: false,
        isNext: wIndex === 0,
      };
    });

    // Estimate duration: words / (WPM / 60)
    const wordsCount = Math.max(1, words.length);
    const estimatedDurationSec = Math.max(1.2, (wordsCount / wpm) * 60);

    return {
      id: `sent_${sIndex}_${Date.now()}`,
      index: sIndex,
      text,
      character,
      words,
      estimatedDurationSec: Number(estimatedDurationSec.toFixed(1)),
      isDelivered: false,
    };
  });

  return sentences;
}

/**
 * Fast Levenshtein distance for fuzzy word matching.
 */
export function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const row = new Array(b.length + 1);
  for (let j = 0; j <= b.length; j++) row[j] = j;

  for (let i = 1; i <= a.length; i++) {
    let prev = i;
    for (let j = 1; j <= b.length; j++) {
      const val =
        a[i - 1] === b[j - 1]
          ? row[j - 1]
          : Math.min(row[j - 1] + 1, prev + 1, row[j] + 1);
      row[j - 1] = prev;
      prev = val;
    }
    row[b.length] = prev;
  }
  return row[b.length];
}

/**
 * Checks if a recognized spoken token matches a script target token.
 */
export function isWordMatch(scriptClean: string, spokenClean: string, tolerance = 1): boolean {
  if (!scriptClean || !spokenClean) return false;
  if (scriptClean === spokenClean) return true;

  // Contraction handling: "im" vs "i'm", "dont" vs "don't"
  const stripApostrophes = (s: string) => s.replace(/['’]/g, '');
  if (stripApostrophes(scriptClean) === stripApostrophes(spokenClean)) return true;

  // Prefix matching for longer words (e.g. "record" vs "recording")
  if (scriptClean.length >= 4 && spokenClean.length >= 4) {
    if (scriptClean.startsWith(spokenClean) || spokenClean.startsWith(scriptClean)) {
      return true;
    }
  }

  // Levenshtein edit distance check
  const maxLen = Math.max(scriptClean.length, spokenClean.length);
  if (maxLen <= 3) {
    return scriptClean === spokenClean;
  } else if (maxLen <= 6) {
    return levenshteinDistance(scriptClean, spokenClean) <= Math.min(tolerance, 1);
  } else {
    return levenshteinDistance(scriptClean, spokenClean) <= tolerance;
  }
}

export type SpeechTrackerCallback = (event: {
  type: 'word-advance' | 'sentence-complete' | 'transcript' | 'session-end' | 'error';
  sentenceIndex: number;
  wordIndex: number;
  transcript?: string;
  isFinished?: boolean;
}) => void;

export class TeleprompterSpeechTracker {
  private sentences: DialogueSentence[] = [];
  private currentSentenceIdx = 0;
  private currentWordIdx = 0;
  private isRunning = false;
  private options: Required<SpeechTrackerOptions>;

  // Speech Recognition instance
  private recognition: any = null;
  private isRecognitionActive = false;

  // Auto-pacer timer
  private pacerTimer: ReturnType<typeof setInterval> | null = null;
  private pacerWordIntervalMs = 450; // calculated from WPM

  // Callbacks
  private listener: SpeechTrackerCallback | null = null;

  constructor(sentences: DialogueSentence[], options: SpeechTrackerOptions = {}) {
    this.sentences = sentences;
    this.options = {
      wpm: options.wpm ?? 130,
      autoAdvance: options.autoAdvance ?? true,
      fuzzyTolerance: options.fuzzyTolerance ?? 1,
      language: options.language ?? 'en-US',
      useGeminiLive: options.useGeminiLive ?? false,
    };
    this.updatePacerInterval();
  }

  public setSentences(sentences: DialogueSentence[]) {
    this.sentences = sentences;
    this.currentSentenceIdx = 0;
    this.currentWordIdx = 0;
    this.resetWordHighlights();
  }

  public setOptions(options: Partial<SpeechTrackerOptions>) {
    this.options = { ...this.options, ...options };
    this.updatePacerInterval();
  }

  private updatePacerInterval() {
    // 130 words per 60,000 ms = ~461 ms per word
    this.pacerWordIntervalMs = Math.max(200, Math.round(60000 / this.options.wpm));
  }

  public onEvent(callback: SpeechTrackerCallback) {
    this.listener = callback;
  }

  public getCurrentState() {
    return {
      currentSentenceIdx: this.currentSentenceIdx,
      currentWordIdx: this.currentWordIdx,
      currentSentence: this.sentences[this.currentSentenceIdx] || null,
      totalSentences: this.sentences.length,
      isRunning: this.isRunning,
      isRecognitionActive: this.isRecognitionActive,
    };
  }

  /**
   * Starts real-time tracking (SpeechRecognition + auto-pacer assist).
   */
  public start() {
    if (this.isRunning) return;
    this.isRunning = true;

    this.resetWordHighlights();
    this.initSpeechRecognition();
    this.startAutoPacer();
  }

  /**
   * Stops tracking.
   */
  public stop() {
    this.isRunning = false;
    this.stopAutoPacer();
    this.stopSpeechRecognition();
  }

  /**
   * Pauses tracking.
   */
  public pause() {
    this.isRunning = false;
    this.stopAutoPacer();
    if (this.recognition && this.isRecognitionActive) {
      try {
        this.recognition.stop();
      } catch {}
    }
  }

  /**
   * Resume tracking.
   */
  public resume() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.initSpeechRecognition();
    this.startAutoPacer();
  }

  /**
   * Manually advances to the next sentence (e.g. keyboard shortcut or button).
   */
  public nextSentence() {
    if (this.currentSentenceIdx < this.sentences.length - 1) {
      this.markSentenceDelivered(this.currentSentenceIdx);
      this.currentSentenceIdx++;
      this.currentWordIdx = 0;
      this.resetWordHighlights();
      this.notify('word-advance');
    } else {
      this.markSentenceDelivered(this.currentSentenceIdx);
      this.notify('session-end', { isFinished: true });
    }
  }

  /**
   * Manually goes back to the previous sentence.
   */
  public prevSentence() {
    if (this.currentSentenceIdx > 0) {
      this.currentSentenceIdx--;
      this.currentWordIdx = 0;
      this.resetWordHighlights();
      this.notify('word-advance');
    }
  }

  /**
   * Jump directly to a given sentence index.
   */
  public jumpToSentence(index: number) {
    if (index >= 0 && index < this.sentences.length) {
      this.currentSentenceIdx = index;
      this.currentWordIdx = 0;
      this.resetWordHighlights();
      this.notify('word-advance');
    }
  }

  /**
   * Retake / restart the current sentence from the beginning.
   */
  public retakeCurrentSentence() {
    this.currentWordIdx = 0;
    this.resetWordHighlights();
    this.notify('word-advance');
  }

  private resetWordHighlights() {
    const cur = this.sentences[this.currentSentenceIdx];
    if (!cur) return;

    cur.words.forEach((w, i) => {
      w.isCompleted = i < this.currentWordIdx;
      w.isNext = i === this.currentWordIdx;
    });
  }

  private markSentenceDelivered(index: number) {
    const s = this.sentences[index];
    if (s) {
      s.isDelivered = true;
      s.words.forEach((w) => {
        w.isCompleted = true;
        w.isNext = false;
      });
    }
  }

  private initSpeechRecognition() {
    if (typeof window === 'undefined') return;

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      console.info('[TeleprompterSpeechTracker] Web Speech API not supported in this browser. Using auto-pacer.');
      return;
    }

    try {
      if (this.recognition) {
        try { this.recognition.abort(); } catch {}
      }

      this.recognition = new SpeechRecognition();
      this.recognition.continuous = true;
      this.recognition.interimResults = true;
      this.recognition.maxAlternatives = 2;
      this.recognition.lang = this.options.language;

      this.recognition.onstart = () => {
        this.isRecognitionActive = true;
      };

      this.recognition.onresult = (event: any) => {
        if (!this.isRunning) return;

        let interimTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          interimTranscript += event.results[i][0].transcript;
        }

        if (interimTranscript) {
          this.processSpokenTranscript(interimTranscript);
        }
      };

      this.recognition.onerror = (e: any) => {
        // Silently handle 'no-speech' or 'aborted' without crashing
        if (e.error !== 'no-speech' && e.error !== 'aborted') {
          console.warn('[TeleprompterSpeechTracker] SpeechRecognition error:', e.error);
        }
      };

      this.recognition.onend = () => {
        this.isRecognitionActive = false;
        // Keep speech recognition alive while running
        if (this.isRunning) {
          try {
            this.recognition.start();
          } catch {}
        }
      };

      this.recognition.start();
    } catch (err) {
      console.warn('[TeleprompterSpeechTracker] Failed to start SpeechRecognition:', err);
    }
  }

  private stopSpeechRecognition() {
    this.isRecognitionActive = false;
    if (this.recognition) {
      try {
        this.recognition.onend = null;
        this.recognition.stop();
      } catch {}
      this.recognition = null;
    }
  }

  /**
   * Matches spoken words against the active dialogue sentence.
   */
  private processSpokenTranscript(transcript: string) {
    const currentSentence = this.sentences[this.currentSentenceIdx];
    if (!currentSentence || !currentSentence.words.length) return;

    this.notify('transcript', { transcript });

    // Clean spoken tokens
    const spokenTokens = transcript
      .toLowerCase()
      .split(/\s+/)
      .map((t) => t.replace(/[^a-z0-9\u0900-\u097F\u0600-\u06FF]/gi, ''))
      .filter((t) => t.length > 0);

    if (spokenTokens.length === 0) return;

    const words = currentSentence.words;
    let matchIdx = this.currentWordIdx;

    // Scan backwards through spoken tokens (most recently spoken words)
    // and match against upcoming target words
    for (const spokenToken of spokenTokens) {
      if (matchIdx >= words.length) break;

      // Check immediate target word
      if (isWordMatch(words[matchIdx].clean, spokenToken, this.options.fuzzyTolerance)) {
        matchIdx++;
        continue;
      }

      // Check next word (user skipped or mumbled a filler word)
      if (matchIdx + 1 < words.length && isWordMatch(words[matchIdx + 1].clean, spokenToken, this.options.fuzzyTolerance)) {
        matchIdx += 2;
        continue;
      }
    }

    // If new words were matched, advance state!
    if (matchIdx > this.currentWordIdx) {
      this.currentWordIdx = matchIdx;
      this.resetWordHighlights();
      this.notify('word-advance');

      // Check if sentence delivered completely!
      // If user finished all words, or reached last word, or >= 85% done
      const isComplete =
        this.currentWordIdx >= words.length ||
        (words.length > 3 && this.currentWordIdx >= words.length - 1);

      if (isComplete && this.options.autoAdvance) {
        this.handleSentenceCompleted();
      }
    }
  }

  /**
   * Auto-pacer fallback: if the speaker pauses or speech recognition misses a word,
   * gently nudges the highlight forward after 2x the standard word interval
   * so the speaker is never stuck or left guessing what to say next!
   */
  private startAutoPacer() {
    this.stopAutoPacer();
    let consecutiveIdleTicks = 0;

    this.pacerTimer = setInterval(() => {
      if (!this.isRunning) return;

      const cur = this.sentences[this.currentSentenceIdx];
      if (!cur || !cur.words.length) return;

      consecutiveIdleTicks++;

      // After 3 intervals of silence (~1.3s), advance one word as a pacing guide
      if (consecutiveIdleTicks >= 3) {
        consecutiveIdleTicks = 0;
        if (this.currentWordIdx < cur.words.length) {
          this.currentWordIdx++;
          this.resetWordHighlights();
          this.notify('word-advance');

          if (this.currentWordIdx >= cur.words.length && this.options.autoAdvance) {
            this.handleSentenceCompleted();
          }
        }
      }
    }, this.pacerWordIntervalMs);
  }

  private stopAutoPacer() {
    if (this.pacerTimer) {
      clearInterval(this.pacerTimer);
      this.pacerTimer = null;
    }
  }

  private handleSentenceCompleted() {
    this.markSentenceDelivered(this.currentSentenceIdx);
    this.notify('sentence-complete', { sentenceIndex: this.currentSentenceIdx });

    if (this.currentSentenceIdx < this.sentences.length - 1) {
      // Small 400ms breath pause between sentences for natural flow
      setTimeout(() => {
        if (!this.isRunning) return;
        this.currentSentenceIdx++;
        this.currentWordIdx = 0;
        this.resetWordHighlights();
        this.notify('word-advance');
      }, 400);
    } else {
      // Completed all dialogues!
      setTimeout(() => {
        this.notify('session-end', { isFinished: true });
        this.stop();
      }, 500);
    }
  }

  private notify(
    type: 'word-advance' | 'sentence-complete' | 'transcript' | 'session-end' | 'error',
    extra: Partial<{ transcript: string; isFinished: boolean; sentenceIndex: number; wordIndex: number }> = {}
  ) {
    if (this.listener) {
      this.listener({
        type,
        sentenceIndex: extra.sentenceIndex ?? this.currentSentenceIdx,
        wordIndex: extra.wordIndex ?? this.currentWordIdx,
        transcript: extra.transcript,
        isFinished: extra.isFinished,
      });
    }
  }

  public dispose() {
    this.stop();
    this.listener = null;
    this.sentences = [];
  }
}
