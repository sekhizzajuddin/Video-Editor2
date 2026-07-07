export interface ParsedSubtitle {
  startTime: number; // in seconds
  duration: number;  // in seconds
  text: string;
}

/**
 * Parses an SRT subtitle string into an array of ParsedSubtitle objects.
 */
export function parseSRT(text: string): ParsedSubtitle[] {
  const normalizeTime = (timeStr: string): number => {
    // Expected format: "00:00:01,000" or "00:00:01.000"
    const parts = timeStr.trim().replace(',', '.').split(':');
    if (parts.length < 3) return 0;
    
    const hrs = parseFloat(parts[0]) || 0;
    const mins = parseFloat(parts[1]) || 0;
    const secs = parseFloat(parts[2]) || 0;
    
    return hrs * 3600 + mins * 60 + secs;
  };

  const blocks = text
    .trim()
    .replace(/\r\n/g, '\n')
    .split(/\n\s*\n/);
  
  const results: ParsedSubtitle[] = [];

  for (const block of blocks) {
    const lines = block.split('\n').map(l => l.trim()).filter(Boolean);
    const timeLineIndex = lines.findIndex(l => l.includes('-->'));
    if (timeLineIndex !== -1) {
      const timeLine = lines[timeLineIndex];
      const timeParts = timeLine.split('-->');
      const start = normalizeTime(timeParts[0]);
      const end = normalizeTime(timeParts[1]);
      const subText = lines.slice(timeLineIndex + 1).join('\n');
      
      results.push({
        startTime: start,
        duration: Math.max(0.2, end - start),
        text: subText,
      });
    }
  }

  return results;
}
