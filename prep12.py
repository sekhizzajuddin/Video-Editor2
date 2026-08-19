import re

with open('src/mobile/components/MobilePropertiesSheet.tsx', 'r', encoding='utf8') as f:
    mobile_code = f.read()

# We need to replace the flawed injected code.
# The flawed code starts with `{category === 'style' && currentSubTab === 'keyframes'`
# and ends right before `{category === 'style' && currentSubTab === 'opacity'` or `reframe`.
# Wait, where exactly did I inject it?
# In prep11.py, I did: target = "{category === 'style' && currentSubTab === 'reframe' && <SmartReframeSection selectedClip={clip} updateClip={updateClip} />}"
# target + "\n" + full_new_blocks

# Let's extract the exact blocks to remove:
target = r"\{category === 'style' && currentSubTab === 'keyframes'.*?\{category === 'style' && currentSubTab === 'crop'.*?\}\)\}"
match = re.search(target, mobile_code, flags=re.DOTALL)
if match:
    mobile_code = mobile_code[:match.start()] + mobile_code[match.end():]

# Now, we will inject the PROPER, SAFE code.
proper_code = """
        {category === 'style' && currentSubTab === 'keyframes' && (
          <div className="bg-[#1e1e1e] p-4 text-center rounded border border-[#3e3e3e]">
            <p className="text-sm text-[#a0a0a0]">Use the diamond icon next to properties to add keyframes.</p>
          </div>
        )}
        {category === 'style' && currentSubTab === 'flip' && (
          <div className="flex gap-3">
            <button
              onClick={() => {
                const cur = clip.transform.flipH ?? false;
                updateClip(clip.id, { transform: { ...clip.transform, flipH: !cur } });
              }}
              className={`flex-1 py-3 rounded-lg text-sm font-medium transition-colors ${
                clip.transform.flipH ? 'bg-amber-500 text-black' : 'bg-[#3e3e3e] text-white'
              }`}
            >
              Flip Horizontal
            </button>
            <button
              onClick={() => {
                const cur = clip.transform.flipV ?? false;
                updateClip(clip.id, { transform: { ...clip.transform, flipV: !cur } });
              }}
              className={`flex-1 py-3 rounded-lg text-sm font-medium transition-colors ${
                clip.transform.flipV ? 'bg-amber-500 text-black' : 'bg-[#3e3e3e] text-white'
              }`}
            >
              Flip Vertical
            </button>
          </div>
        )}
        {category === 'style' && currentSubTab === 'perspective' && (
          <div className="space-y-4">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={!!clip.transform.perspectivePin}
                onChange={(e) => {
                  const enabled = e.target.checked;
                  let updates: any = { transform: { ...clip.transform, perspectivePin: enabled } };
                  if (enabled && !clip.transform.perspectiveCorners) {
                    const aX = clip.transform.x;
                    const aY = clip.transform.y;
                    const baseW = 200;
                    const baseH = 200;
                    updates.transform.perspectiveCorners = {
                      x0: 427 + aX - baseW / 2, y0: 240 + aY - baseH / 2,
                      x1: 427 + aX + baseW / 2, y1: 240 + aY - baseH / 2,
                      x2: 427 + aX + baseW / 2, y2: 240 + aY + baseH / 2,
                      x3: 427 + aX - baseW / 2, y3: 240 + aY + baseH / 2
                    };
                  }
                  updateClip(clip.id, updates);
                }}
                className="w-5 h-5 rounded border-[#3e3e3e] text-amber-500 bg-[#1e1e1e]"
              />
              <span className="text-sm font-medium text-white">Enable Corner Pinning</span>
            </label>
            {clip.transform.perspectivePin && (
              <div className="pt-3 border-t border-[#3e3e3e]">
                <p className="text-xs text-[#a0a0a0] mb-3">Drag the 4 corner handles on the preview screen to adjust.</p>
                <button
                  onClick={() => {
                    const newAnimations = { ...(clip.animations || {}) };
                    for (let i = 0; i < 4; i++) {
                      delete newAnimations[`transform.perspectiveCorners.x${i}`];
                      delete newAnimations[`transform.perspectiveCorners.y${i}`];
                    }
                    const aX = clip.transform.x;
                    const aY = clip.transform.y;
                    const baseW = 200;
                    const baseH = 200;
                    updateClip(clip.id, {
                      transform: {
                        ...clip.transform,
                        perspectiveCorners: {
                          x0: 427 + aX - baseW / 2, y0: 240 + aY - baseH / 2,
                          x1: 427 + aX + baseW / 2, y1: 240 + aY - baseH / 2,
                          x2: 427 + aX + baseW / 2, y2: 240 + aY + baseH / 2,
                          x3: 427 + aX - baseW / 2, y3: 240 + aY + baseH / 2
                        }
                      },
                      animations: newAnimations
                    });
                  }}
                  className="w-full py-2 text-xs font-medium text-amber-500 border border-amber-500/30 rounded-lg hover:bg-amber-500/10"
                >
                  Reset Corners
                </button>
              </div>
            )}
          </div>
        )}
        {category === 'style' && currentSubTab === 'crop' && (
          <div className="space-y-4">
            {['left', 'right', 'top', 'bottom'].map((edge) => {
              const currentCrop = clip.crop || { top: 0, bottom: 0, left: 0, right: 0 };
              const propKey = `crop.${edge}`;
              const value = getPropVal(currentCrop[edge as keyof typeof currentCrop], propKey);
              return (
                <div key={edge} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-white capitalize">{edge}</span>
                    <span className="text-xs text-amber-500">{Math.round(value)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="90"
                    value={value}
                    onChange={(e) => {
                      const newVal = Number(e.target.value);
                      const proposedCrop = { ...currentCrop, [edge]: newVal };
                      setPropVal(propKey, newVal, { crop: proposedCrop });
                    }}
                    className="w-full accent-amber-500"
                  />
                </div>
              );
            })}
          </div>
        )}
"""

target_loc = "{category === 'style' && currentSubTab === 'reframe' && <SmartReframeSection selectedClip={clip} updateClip={updateClip} />}"
mobile_code = mobile_code.replace(target_loc, target_loc + "\n" + proper_code)

with open('src/mobile/components/MobilePropertiesSheet.tsx', 'w', encoding='utf8') as f:
    f.write(mobile_code)

