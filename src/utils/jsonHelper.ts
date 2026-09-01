export function extractJsonFromLlmResponse(response: string): string {
  // First, try to extract from a markdown code block (most reliable)
  const codeBlockMatch = response.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (codeBlockMatch) {
    return codeBlockMatch[1].trim();
  }

  // Fallback: Find the first { or [ and try to parse substrings from the back
  const startObj = response.indexOf('{');
  const startArr = response.indexOf('[');
  
  let startIdx = -1;
  if (startObj !== -1 && startArr !== -1) {
    startIdx = Math.min(startObj, startArr);
  } else if (startObj !== -1) {
    startIdx = startObj;
  } else if (startArr !== -1) {
    startIdx = startArr;
  }

  if (startIdx === -1) return response.trim(); // No JSON found, return as is

  const isArr = response[startIdx] === '[';
  const endChar = isArr ? ']' : '}';
  
  // Find all possible end indices
  const endIndices: number[] = [];
  for (let i = response.length - 1; i > startIdx; i--) {
    if (response[i] === endChar) {
      endIndices.push(i);
    }
  }

  // Try parsing from the outermost brackets inwards
  for (const endIdx of endIndices) {
    const substr = response.substring(startIdx, endIdx + 1);
    try {
      JSON.parse(substr); // Validate it
      return substr;      // If valid, return it!
    } catch (e) {
      // Continue to next inner bracket
    }
  }

  // If all fails, return the original string trimmed
  return response.trim();
}
