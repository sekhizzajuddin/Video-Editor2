import re

with open('src/utils/apiKeyManager.ts', 'r', encoding='utf-8') as f:
    content = f.read()

old_exec = """  const executeFetch = async (keyToUse: string) => {
    const url = urlBuilder(keyToUse);
    const fetchOptions = { ...options };

    if (provider === 'groq') {
      // Every Groq request (chat, whisper, /models, feature calls) shares the
      // same per-key 30 RPM budget - count them all against one limiter.
      await globalRateLimiter.waitForSlot();
      globalRateLimiter.recordCall();
      const existingHeaders = (fetchOptions.headers as Record<string, string>) || {};
      fetchOptions.headers = {
        ...existingHeaders,
        'Authorization': `Bearer ${keyToUse}`
      };
    }

    return await fetch(url, fetchOptions);
  };"""

new_exec = """  const executeFetch = async (keyToUse: string) => {
    const url = urlBuilder(keyToUse);
    const fetchOptions = { ...options };

    if (provider === 'groq') {
      // Every Groq request (chat, whisper, /models, feature calls) shares the
      // same per-key 30 RPM budget - count them all against one limiter.
      await globalRateLimiter.waitForSlot();
      globalRateLimiter.recordCall();
      const existingHeaders = (fetchOptions.headers as Record<string, string>) || {};
      fetchOptions.headers = {
        ...existingHeaders,
        'Authorization': `Bearer ${keyToUse}`
      };
    }

    let retries = 0;
    while (retries < 3) {
      const res = await fetch(url, fetchOptions);
      if (provider === 'gemini' && (res.status === 503 || res.status === 429)) {
        console.warn(`[GEMINI] Got ${res.status}. Retrying in ${Math.pow(2, retries) * 2}s...`);
        await new Promise(r => setTimeout(r, Math.pow(2, retries) * 2000));
        retries++;
        continue;
      }
      return res;
    }
    
    return await fetch(url, fetchOptions);
  };"""

# I need to match the specific dash character in the comment exactly, as the previous regex failed because of "?" which is an em-dash or something.
# Let's use a simpler replace strategy for just the return statement inside the function block.
