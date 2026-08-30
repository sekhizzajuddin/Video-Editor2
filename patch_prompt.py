import re
import sys

with open('d:/Video-Editor/src/utils/generateMotionGraphicsFromDialogue.ts', 'r', encoding='utf-8') as f:
    content = f.read()

STYLE_ART_DIRECTION_OLD = """const STYLE_ART_DIRECTION: Record<string, string> = {
  vox: `VOX EXPLAINER — True 3D Isometric HTML5 Game Style
  • CRITICAL REQUIREMENT: YOU MUST WRAP THE ENTIRE SCENE IN AN ISOMETRIC GROUP. 
    You must output: <g class="isometric-world">
    And in CSS: .isometric-world { transform: rotateX(60deg) rotateZ(-45deg); transform-style: preserve-3d; transform-origin: center center; }
  • ALL objects (buildings, cars, trees, mountains) MUST be constructed as 3D blocks using 3 polygons (top, left face, right face) with 3 different brightness shades (e.g., top=lightest, left=mid, right=dark).
  • DO NOT DRAW FLAT 2D OBJECTS. A house is not a flat rectangle; it is a 3D rectangular prism.
  • Build a miniature 3D city/world grid. Use <path> for thick roads.
  • Do not be lazy. You must build a FULLY DESIGNED, PROFESSIONAL-GRADE SCENE with recognizable 3D objects.
  • Data is physical: values become 3D towers, stacked cubes, floating spheres.
  • Annotation layer: 2px leader lines, floating labels (these must NOT be inside the isometric group so they face the camera).
  • Depth: Use Z-translation (transform: translateZ) for floating objects or heights.`,

  documentary: `DOCUMENTARY (Vox / Johnny Harris) — map-first vector journalism
  • ASSET LIBRARY: You have access to hundreds of Kenney Isometric City assets!
    Do NOT draw buildings or roads manually with polygons. Use the pre-made assets!
    Usage: <use href="#ASSET_ID" x="100" y="200" />
    The asset IDs follow the pattern 'buildingTiles_000' to 'buildingTiles_120', and 'cityTiles_000' to 'cityTiles_130'.
    Examples:  (you can guess other numbers).
    Place these assets inside an <svg> tag to build your city layout!
• Lead with a MAP or a MAP-LIKE DIAGRAM: coastline/country outlines as <path>, city dots,
  route lines that draw themselves, region fills that pop in one by one.
• Then build the subject on top: terrain, buildings, simple flat people, vehicles.
• Data becomes objects: bars as towers, populations as dot clusters, change as growing paths.
• Annotation layer: leader lines, pill labels, underlines, circled focus areas.
• Palette: cool neutrals + one hot accent (#f97316 or #fbbf24) for the thing being pointed at.
• Camera: slow pan/zoom achieved by transforming the world group, never by moving text.`,
"""

STYLE_ART_DIRECTION_NEW = """const STYLE_ART_DIRECTION: Record<string, string> = {
  vox: `VOX EXPLAINER — True 3D Isometric HTML5 Game Style
  • CRITICAL: DO NOT DRAW GEOMETRIC SHAPES! DO NOT USE <rect>, <polygon>, <circle>, or <path> to draw buildings/cities.
  • ASSET LIBRARY: You have access to hundreds of high-quality Kenney 3D Isometric City assets injected in <defs>!
    You MUST build your city/world using these assets via <use href="#ASSET_ID" x="..." y="..." />.
    Asset IDs available: 'buildingTiles_000' to 'buildingTiles_120', and 'cityTiles_000' to 'cityTiles_130'.
    Example usage:
      <use href="#cityTiles_045" x="200" y="300" />
      <use href="#buildingTiles_015" x="200" y="240" />
  • Build a vast, PROFESSIONAL-GRADE 3D city/world grid by placing these tiles at different x,y coordinates.
  • The assets are ALREADY ISOMETRIC. DO NOT apply 3D transforms like rotateX or rotateZ to the scene. Just place them on the 2D canvas in a staggered grid.
  • Data is physical: animate the <use> tags so buildings pop up from the ground (transform: scaleY or translateY).
  • Annotation layer: leader lines, floating text boxes pointing to specific buildings.
  • DO NOT BE LAZY. Generate a rich, detailed scene with DOZENS of <use> tags to form a beautiful city.`,

  documentary: `DOCUMENTARY (Vox / Johnny Harris) — map-first vector journalism
  • CRITICAL: DO NOT DRAW GEOMETRIC SHAPES! DO NOT USE <rect>, <polygon>, <circle>, or <path> to draw buildings/cities.
  • ASSET LIBRARY: You have access to hundreds of high-quality Kenney 3D Isometric City assets injected in <defs>!
    You MUST build your city/world using these assets via <use href="#ASSET_ID" x="..." y="..." />.
    Asset IDs available: 'buildingTiles_000' to 'buildingTiles_120', and 'cityTiles_000' to 'cityTiles_130'.
    Example usage:
      <use href="#cityTiles_045" x="200" y="300" />
      <use href="#buildingTiles_015" x="200" y="240" />
  • Lead with a MAP or a MAP-LIKE DIAGRAM: coastline/country outlines as <path>, city dots, route lines that draw themselves, region fills that pop in one by one.
  • Then build the subject on top using the Kenney assets.
  • Data becomes objects: animate the <use> tags so buildings pop up.
  • Annotation layer: leader lines, pill labels, underlines, circled focus areas.
  • Palette: cool neutrals + one hot accent (#f97316 or #fbbf24) for the thing being pointed at.
  • Camera: slow pan/zoom achieved by transforming the world group, never by moving text.`,
"""

content = content.replace(STYLE_ART_DIRECTION_OLD, STYLE_ART_DIRECTION_NEW)

EXAMPLE_SCENE_OLD = """const EXAMPLE_SCENE = `<div style="position:relative;width:1920px;height:1080px;overflow:hidden;background:transparent;font-family:Arial,Helvetica,sans-serif;">
  <svg width="1920" height="1080" viewBox="0 0 1920 1080" style="position:absolute;top:0;left:0;overflow:visible;">
    <polygon class="hill" points="0,1080 420,640 900,1080" fill="#1e293b"/>
    <polygon class="hill" points="760,1080 1240,520 1740,1080" fill="#334155"/>
    <polygon class="hill" points="1500,1080 1920,700 1920,1080" fill="#0f172a"/>
    <rect class="road" x="0" y="960" width="1920" height="46" fill="#475569"/>
    <rect class="tower" x="360" y="700" width="60" height="260" fill="#facc15"/>
    <rect class="tower" x="470" y="780" width="60" height="180" fill="#fbbf24"/>
    <rect class="tower" x="580" y="840" width="60" height="120" fill="#f59e0b"/>
    <polygon class="house" points="1100,960 1160,880 1220,960" fill="#b45309"/>
    <rect class="house" x="1100" y="960" width="120" height="70" fill="#78350f"/>
    <rect class="house" x="1140" y="990" width="34" height="40" fill="#fde68a"/>
    <circle class="dot" cx="1300" cy="500" r="18" fill="#38bdf8"/>
    <circle class="dot" cx="1400" cy="470" r="18" fill="#38bdf8"/>
    <circle class="dot" cx="1500" cy="430" r="18" fill="#38bdf8"/>
    <circle class="dot" cx="1600" cy="380" r="18" fill="#38bdf8"/>
    <path class="route" d="M1300 500 C1420 380 1560 340 1720 250" stroke="#f97316" stroke-width="8" fill="none"/>
    <circle class="marker" cx="1720" cy="250" r="26" fill="#f97316"/>
    <line class="leader" x1="1720" y1="250" x2="1560" y2="150" stroke="#f8fafc" stroke-width="4"/>
    <ellipse class="shadow" cx="1160" cy="1040" rx="90" ry="18" fill="#020617"/>
  </svg>
  <div class="label">GROWTH 2010 → 2024</div>
  <style>
    @keyframes growUp { from { transform: scaleY(0); opacity: 0 } to { transform: scaleY(1); opacity: 1 } }
    @keyframes popSpring { 0% { transform: scale(0); opacity: 0 } 70% { transform: scale(1.12); opacity: 1 } 100% { transform: scale(1); opacity: 1 } }
    .hill   { transform-origin: center bottom; animation: growUp .8s cubic-bezier(.2,.9,.3,1) both; }
    .hill:nth-of-type(2) { animation-delay: .12s }
    .hill:nth-of-type(3) { animation-delay: .24s }
    .road   { transform-origin: left center; animation: growUp .6s ease-out .3s both; }
    .tower  { transform-origin: center bottom; animation: growUp .55s cubic-bezier(.2,.9,.3,1) both; }
    .tower:nth-of-type(2) { animation-delay: .5s }
    .tower:nth-of-type(3) { animation-delay: .62s }
    .house  { transform-origin: center bottom; animation: popSpring .6s cubic-bezier(.2,1.5,.4,1) .8s both; }
    .dot    { transform-origin: center; animation: popSpring .45s cubic-bezier(.2,1.5,.4,1) both; }
    .dot:nth-of-type(2) { animation-delay: 1.0s } .dot:nth-of-type(3) { animation-delay: 1.1s } .dot:nth-of-type(4) { animation-delay: 1.2s }
    .route  { animation: growUp .7s ease-out 1.3s both; }
    .marker { transform-origin: center; animation: popSpring .5s cubic-bezier(.2,1.6,.4,1) 1.7s both; }
    .leader { animation: growUp .3s ease-out 1.9s both; }
    .shadow { transform-origin: center; animation: popSpring .6s ease-out .9s both; }
    .label  { position:absolute; left:1200px; top:120px; background:rgba(15,23,42,.78); color:#fbbf24;
              border:3px solid #fbbf24; border-radius:8px; padding:8px 18px; font-size:32px; font-weight:800;
              animation: popSpring .5s cubic-bezier(.2,1.4,.4,1) 2.0s both; }
  </style>
</div>`;"""

EXAMPLE_SCENE_NEW = """const EXAMPLE_SCENE = `<div style="position:relative;width:1920px;height:1080px;overflow:hidden;background:transparent;font-family:Arial,Helvetica,sans-serif;">
  <svg width="1920" height="1080" viewBox="0 0 1920 1080" style="position:absolute;top:0;left:0;overflow:visible;">
    <use href="#cityTiles_045" x="200" y="300" class="asset" />
    <use href="#cityTiles_045" x="328" y="364" class="asset" />
    <use href="#cityTiles_045" x="456" y="428" class="asset" />
    <use href="#cityTiles_045" x="584" y="492" class="asset" />
    <use href="#buildingTiles_015" x="328" y="300" class="asset" />
    <use href="#buildingTiles_022" x="456" y="364" class="asset" />
    <use href="#buildingTiles_041" x="584" y="428" class="asset" />
    <circle class="dot" cx="1300" cy="500" r="18" fill="#38bdf8"/>
    <circle class="dot" cx="1400" cy="470" r="18" fill="#38bdf8"/>
    <path class="route" d="M1300 500 C1420 380 1560 340 1720 250" stroke="#f97316" stroke-width="8" fill="none"/>
    <circle class="marker" cx="1720" cy="250" r="26" fill="#f97316"/>
    <line class="leader" x1="1720" y1="250" x2="1560" y2="150" stroke="#f8fafc" stroke-width="4"/>
  </svg>
  <div class="label">GROWTH 2010 → 2024</div>
  <style>
    @keyframes growUp { from { transform: scaleY(0); opacity: 0 } to { transform: scaleY(1); opacity: 1 } }
    @keyframes popSpring { 0% { transform: scale(0); opacity: 0 } 70% { transform: scale(1.12); opacity: 1 } 100% { transform: scale(1); opacity: 1 } }
    @keyframes dropIn { 0% { transform: translateY(-200px); opacity: 0 } 70% { transform: translateY(20px); opacity: 1 } 100% { transform: translateY(0); opacity: 1 } }
    .asset  { transform-origin: center bottom; animation: dropIn .8s cubic-bezier(.2,.9,.3,1) both; }
    .asset:nth-of-type(2) { animation-delay: .12s }
    .asset:nth-of-type(3) { animation-delay: .24s }
    .asset:nth-of-type(4) { animation-delay: .36s }
    .asset:nth-of-type(5) { animation-delay: .48s }
    .asset:nth-of-type(6) { animation-delay: .60s }
    .asset:nth-of-type(7) { animation-delay: .72s }
    .dot    { transform-origin: center; animation: popSpring .45s cubic-bezier(.2,1.5,.4,1) both; }
    .dot:nth-of-type(2) { animation-delay: 1.0s }
    .route  { animation: growUp .7s ease-out 1.3s both; }
    .marker { transform-origin: center; animation: popSpring .5s cubic-bezier(.2,1.6,.4,1) 1.7s both; }
    .leader { animation: growUp .3s ease-out 1.9s both; }
    .label  { position:absolute; left:1200px; top:120px; background:rgba(15,23,42,.78); color:#fbbf24;
              border:3px solid #fbbf24; border-radius:8px; padding:8px 18px; font-size:32px; font-weight:800;
              animation: popSpring .5s cubic-bezier(.2,1.4,.4,1) 2.0s both; }
  </style>
</div>`;"""

content = content.replace(EXAMPLE_SCENE_OLD, EXAMPLE_SCENE_NEW)

# We also need to fix RULE #0
RULE_0_OLD = """  2. Draw it with ${minimum}+ SVG shape elements: <polygon>, <path>, <rect>, <circle>, <ellipse>, <line>.
  3. Animate those shapes entering in a staggered sequence."""

RULE_0_NEW = """  2. Draw it with ${minimum}+ SVG shape elements. FOR BUILDINGS/CITIES YOU MUST USE <use href="#ASSET_ID" /> (e.g. Kenney assets). For abstract charts use <polygon>, <path>, <rect>, <circle>, <ellipse>, <line>.
  3. Animate those shapes entering in a staggered sequence."""

content = content.replace(RULE_0_OLD, RULE_0_NEW)

with open('d:/Video-Editor/src/utils/generateMotionGraphicsFromDialogue.ts', 'w', encoding='utf-8') as f:
    f.write(content)
print("generateMotionGraphicsFromDialogue.ts updated successfully.")
