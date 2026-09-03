import re

with open('src/utils/apiKeyManager.ts', 'r', encoding='utf-8') as f:
    content = f.read()

# We want to replace `return await fetch(url, fetchOptions);` 
# inside `const executeFetch = async (keyToUse: string) => { ... }`

old_line = "return await fetch(url, fetchOptions);"
new_line = """let retries = 0;
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
    return await fetch(url, fetchOptions);"""

# There might be multiple occurrences of `return await fetch(url, fetchOptions);`, but the first one is the one we want.
content = content.replace(old_line, new_line, 1)

with open('src/utils/apiKeyManager.ts', 'w', encoding='utf-8') as f:
    f.write(content)
print("Patched retry logic!")
