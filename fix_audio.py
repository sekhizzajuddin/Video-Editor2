import re

with open('src/hooks/useMediaPlayback.ts', 'r') as f:
    content = f.read()

helper = """
const setAudioParam = (param: AudioParam, target: number, ctxTime: number, rampTime: number = 0.08, threshold: number = 0.005) => {
  const currentTarget = (param as any)._procutTarget;
  if (currentTarget === undefined || Math.abs(currentTarget - target) > threshold) {
    (param as any)._procutTarget = target;
    param.setTargetAtTime(target, ctxTime, rampTime);
  }
};
"""

content = re.sub(r'(import .*?;)', r'\1\n' + helper, content, count=1)

pattern1 = r'if\s*\(\s*Math\.abs\(\s*([\w\.]+)\.value\s*-\s*([\w\.]+)\s*\)\s*>\s*([\d\.]+)\s*\)\s*\n?\s*\1\.setTargetAtTime\(\2,\s*ctxTime,\s*rampTime\);'
content = re.sub(pattern1, r'setAudioParam(\1, \2, ctxTime, rampTime, \3);', content)

pattern2 = r'if\s*\(\s*Math\.abs\(\s*node\.gain\.value\s*-\s*val\s*\)\s*>\s*0\.005\s*\)\s*node\.gain\.setTargetAtTime\(\s*val,\s*ctxTime,\s*rampTime\);'
content = re.sub(pattern2, r'setAudioParam(node.gain, val, ctxTime, rampTime, 0.005);', content)

pattern3 = r'if\s*\(\s*Math\.abs\(\s*([\w\.]+)\.value\s*-\s*([\w\.]+)\s*\)\s*>\s*([\d\.]+)\s*\)\s*\{\s*\n?\s*\1\.setTargetAtTime\(\2,\s*ctxTime,\s*rampTime\);\s*\n?\s*\}'
content = re.sub(pattern3, r'setAudioParam(\1, \2, ctxTime, rampTime, \3);', content)

with open('src/hooks/useMediaPlayback.ts', 'w') as f:
    f.write(content)
