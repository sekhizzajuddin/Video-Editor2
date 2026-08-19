import re

with open('src/components/properties/PropertiesPanel.tsx', 'r', encoding='utf-8') as f:
    code = f.read()

# 1. Speed tab:
# speed
code = code.replace(
    "{/* Speed range input */}\n          <div className=\"bg-[#2d2d2d] rounded border border-[#3e3e3e] p-2.5\">",
    "{/* Speed range input */}\n          {shouldShowSection('speed') && (\n          <div className=\"bg-[#2d2d2d] rounded border border-[#3e3e3e] p-2.5\">"
)
code = code.replace(
    "</div>\n          </div>\n\n          {/* Speed Ramping Toggle & Editor */}",
    "</div>\n          </div>\n          )}\n\n          {/* Speed Ramping Toggle & Editor */}"
)

# ramping & presets
code = code.replace(
    "{/* Speed Ramping Toggle & Editor */}\n          <div className=\"bg-[#2d2d2d] rounded border border-[#3e3e3e] p-2.5\">",
    "{/* Speed Ramping Toggle & Editor */}\n          {(shouldShowSection('ramping') || shouldShowSection('presets')) && (\n          <div className=\"bg-[#2d2d2d] rounded border border-[#3e3e3e] p-2.5\">"
)
code = code.replace(
    "</div>\n            )}\n          </div>\n        </div>\n      )}\n\n      {activePropertiesTab === 'audio' && (",
    "</div>\n            )}\n          </div>\n          )}\n        </div>\n      )}\n\n      {activePropertiesTab === 'audio' && ("
)

# 2. Audio tab:
# audioDucking
code = code.replace(
    "{/* AI Auto Audio Ducking */}\n            <div className=\"bg-[#1e1e1e] p-3 rounded border border-purple-500/30 mb-3 shadow-lg shadow-purple-900/20\">",
    "{/* AI Auto Audio Ducking */}\n            {shouldShowSection('audioDucking') && (\n            <div className=\"bg-[#1e1e1e] p-3 rounded border border-purple-500/30 mb-3 shadow-lg shadow-purple-900/20\">"
)
code = code.replace(
    "Analyze & Apply Ducking\n              </button>\n            </div>\n\n            {/* AI Sound Designer */}",
    "Analyze & Apply Ducking\n              </button>\n            </div>\n            )}\n\n            {/* AI Sound Designer */}"
)

# soundDesign
code = code.replace(
    "{/* AI Sound Designer */}\n            <div className=\"bg-[#1e1e1e] p-3 rounded border border-indigo-500/30 mb-3 shadow-lg shadow-indigo-900/20\">",
    "{/* AI Sound Designer */}\n            {shouldShowSection('soundDesign') && (\n            <div className=\"bg-[#1e1e1e] p-3 rounded border border-indigo-500/30 mb-3 shadow-lg shadow-indigo-900/20\">"
)
code = code.replace(
    "</div>\n              )}\n            </div>\n\n            {/* Clip Volume & Pan */}",
    "</div>\n              )}\n            </div>\n            )}\n\n            {/* Clip Volume & Pan */}"
)

# audioVolume
code = code.replace(
    "{/* Clip Volume & Pan */}\n            <div className=\"bg-[#2d2d2d] rounded border border-[#3e3e3e]\">\n              <button\n                onClick={() => toggleSection('audioVolume')}",
    "{/* Clip Volume & Pan */}\n            {shouldShowSection('audioVolume') && (\n            <div className=\"bg-[#2d2d2d] rounded border border-[#3e3e3e]\">\n              <button\n                onClick={() => toggleSection('audioVolume')}"
)
code = code.replace(
    "</div>\n              )}\n            </div>\n\n            {/* Vocal Tune & Character */}",
    "</div>\n              )}\n            </div>\n            )}\n\n            {/* Vocal Tune & Character */}"
)

# audioVocalTune
code = code.replace(
    "{/* Vocal Tune & Character */}\n            <div className=\"bg-[#2d2d2d] rounded border border-[#3e3e3e]\">\n              <button\n                onClick={() => toggleSection('audioVocalTune')}",
    "{/* Vocal Tune & Character */}\n            {shouldShowSection('audioVocalTune') && (\n            <div className=\"bg-[#2d2d2d] rounded border border-[#3e3e3e]\">\n              <button\n                onClick={() => toggleSection('audioVocalTune')}"
)
code = code.replace(
    "</div>\n              )}\n            </div>\n\n            {/* Audio Fades */}",
    "</div>\n              )}\n            </div>\n            )}\n\n            {/* Audio Fades */}"
)

# audioFades
code = code.replace(
    "{/* Audio Fades */}\n            <div className=\"bg-[#2d2d2d] rounded border border-[#3e3e3e]\">\n              <button\n                onClick={() => toggleSection('audioFades')}",
    "{/* Audio Fades */}\n            {shouldShowSection('audioFades') && (\n            <div className=\"bg-[#2d2d2d] rounded border border-[#3e3e3e]\">\n              <button\n                onClick={() => toggleSection('audioFades')}"
)
code = code.replace(
    "</div>\n              )}\n            </div>\n\n            {/* AI Audio Enhancements */}",
    "</div>\n              )}\n            </div>\n            )}\n\n            {/* AI Audio Enhancements */}"
)

# audioEnhancements
code = code.replace(
    "{/* AI Audio Enhancements */}\n            <div className=\"bg-[#2d2d2d] rounded border border-[#3e3e3e]\">\n              <button\n                onClick={() => toggleSection('audioEnhancements')}",
    "{/* AI Audio Enhancements */}\n            {shouldShowSection('audioEnhancements') && (\n            <div className=\"bg-[#2d2d2d] rounded border border-[#3e3e3e]\">\n              <button\n                onClick={() => toggleSection('audioEnhancements')}"
)
code = code.replace(
    "</div>\n              )}\n            </div>\n\n            {/* Equalizer (EQ) */}",
    "</div>\n              )}\n            </div>\n            )}\n\n            {/* Equalizer (EQ) */}"
)

# audioEQ
code = code.replace(
    "{/* Equalizer (EQ) */}\n            <div className=\"bg-[#2d2d2d] rounded border border-[#3e3e3e]\">\n              <button\n                onClick={() => toggleSection('audioEQ')}",
    "{/* Equalizer (EQ) */}\n            {shouldShowSection('audioEQ') && (\n            <div className=\"bg-[#2d2d2d] rounded border border-[#3e3e3e]\">\n              <button\n                onClick={() => toggleSection('audioEQ')}"
)
code = code.replace(
    "</div>\n              )}\n            </div>\n\n            {/* AI Vocal / BGM Separation */}",
    "</div>\n              )}\n            </div>\n            )}\n\n            {/* AI Vocal / BGM Separation */}"
)

# aiVocalSeparation
code = code.replace(
    "{/* AI Vocal / BGM Separation */}\n            <div className=\"bg-[#2d2d2d] rounded border border-[#3e3e3e]\">\n              <button\n                onClick={() => toggleSection('aiVocalSeparation')}",
    "{/* AI Vocal / BGM Separation */}\n            {shouldShowSection('aiVocalSeparation') && (\n            <div className=\"bg-[#2d2d2d] rounded border border-[#3e3e3e]\">\n              <button\n                onClick={() => toggleSection('aiVocalSeparation')}"
)
code = code.replace(
    "</div>\n              )}\n            </div>\n\n            {/* Speed Pitch Settings */}",
    "</div>\n              )}\n            </div>\n            )}\n\n            {/* Speed Pitch Settings */}"
)

# audioSpeedPitch
code = code.replace(
    "{/* Speed Pitch Settings */}\n            <div className=\"bg-[#2d2d2d] rounded border border-[#3e3e3e]\">\n              <button\n                onClick={() => toggleSection('audioSpeedPitch')}",
    "{/* Speed Pitch Settings */}\n            {shouldShowSection('audioSpeedPitch') && (\n            <div className=\"bg-[#2d2d2d] rounded border border-[#3e3e3e]\">\n              <button\n                onClick={() => toggleSection('audioSpeedPitch')}"
)
code = code.replace(
    "</div>\n              )}\n            </div>\n          </div>\n        )}\n\n        {/*  Text Tab",
    "</div>\n              )}\n            </div>\n            )}\n          </div>\n        )}\n\n        {/*  Text Tab"
)

# 3. Effects / AI tab:
# kinetic
code = code.replace(
    "{/* AI Kinetic Typography */}\n            <KineticTypographySection selectedClip={selectedClip} />",
    "{/* AI Kinetic Typography */}\n            {shouldShowSection('kinetic') && <KineticTypographySection selectedClip={selectedClip} />}"
)
# beatsync
code = code.replace(
    "{/* Auto Beat Sync & Rhythm Detection */}\n            <BeatSyncSection selectedClip={selectedClip} />",
    "{/* Auto Beat Sync & Rhythm Detection */}\n            {shouldShowSection('beatsync') && <BeatSyncSection selectedClip={selectedClip} />}"
)
# sfx
code = code.replace(
    "{/* AI Sound Designer & SFX Generator */}\n            <AISFXSection selectedClip={selectedClip} />",
    "{/* AI Sound Designer & SFX Generator */}\n            {shouldShowSection('sfx') && <AISFXSection selectedClip={selectedClip} />}"
)
# designer
code = code.replace(
    "{/* AI Text & Motion Graphics */}\n            <AIMotionGraphicsSection selectedClip={selectedClip} />",
    "{/* AI Text & Motion Graphics */}\n            {shouldShowSection('designer') && <AIMotionGraphicsSection selectedClip={selectedClip} />}"
)

with open('src/components/properties/PropertiesPanel.tsx', 'w', encoding='utf-8') as f:
    f.write(code)

print("Remaining sections wrapped successfully!")
