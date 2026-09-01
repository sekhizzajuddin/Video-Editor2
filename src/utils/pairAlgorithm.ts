import { SyncWord, SyncWordPair } from './syncStudioEngine';

export function pairWordsAlgorithm(sourceWords: SyncWord[], ttsWords: SyncWord[]): SyncWordPair[] {
  const uuidv4 = () => crypto.randomUUID();
  const pairs: SyncWordPair[] = [];
  
  let i = 0; // source index
  let j = 0; // tts index

  while (i < sourceWords.length || j < ttsWords.length) {
    const sWord = sourceWords[i];
    const tWord = ttsWords[j];

    if (sWord && tWord && sWord.word.toLowerCase() === tWord.word.toLowerCase()) {
      pairs.push({
        id: uuidv4(),
        sourceWord: sWord,
        ttsWord: tWord,
        confirmed: false
      });
      i++;
      j++;
    } else if (sWord && tWord) {
      // Lookahead to find match
      let matchFound = false;
      // Try to find if sWord matches future tWord
      for (let lookahead = 1; lookahead <= 3; lookahead++) {
        if (ttsWords[j + lookahead] && sWord.word.toLowerCase() === ttsWords[j + lookahead].word.toLowerCase()) {
          // TTS had extra words, add them as unmatched source? No, we skip TTS words
          // Actually if TTS has extra words, we might just skip them or add blank source
          j += lookahead;
          matchFound = true;
          break;
        }
      }
      if (!matchFound) {
        for (let lookahead = 1; lookahead <= 3; lookahead++) {
          if (sourceWords[i + lookahead] && sourceWords[i + lookahead].word.toLowerCase() === tWord.word.toLowerCase()) {
            // Source had extra words (TTS missed them)
            // Add as source word with missing TTS
            for (let k = 0; k < lookahead; k++) {
              pairs.push({
                id: uuidv4(),
                sourceWord: sourceWords[i + k],
                ttsWord: undefined,
                confirmed: false
              });
            }
            i += lookahead;
            matchFound = true;
            break;
          }
        }
      }

      if (!matchFound) {
        // Just pair them up as mismatched
        pairs.push({
          id: uuidv4(),
          sourceWord: sWord,
          ttsWord: tWord,
          confirmed: false
        });
        i++;
        j++;
      }
    } else if (sWord) {
      // No more TTS words
      pairs.push({
        id: uuidv4(),
        sourceWord: sWord,
        ttsWord: undefined,
        confirmed: false
      });
      i++;
    } else if (tWord) {
      // No more source words
      j++;
    }
  }

  return pairs;
}
