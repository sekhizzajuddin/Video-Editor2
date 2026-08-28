/**
 * A hand-authored, transparent, Vox-style demo scene.
 *
 * Used by the workspace self-test to prove the CSS → video pipeline works on the
 * current browser without spending an AI call, and as a reference example of
 * what the AI is asked to produce (transparent stage, staggered spring
 * easings, `animation-fill-mode: both`, inline SVG artwork only).
 */
export const DEMO_SCENE_DESCRIPTION =
  'Reference scene: transparent vector landscape that assembles piece by piece.';

export const DEMO_SCENE_HTML = `
<div style="position:relative;width:1920px;height:1080px;overflow:hidden;background:transparent;font-family:Arial,Helvetica,sans-serif;">

  <svg width="1920" height="1080" viewBox="0 0 1920 1080" style="position:absolute;top:0;left:0;overflow:visible;">
    <defs>
      <linearGradient id="skyMount" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#64748b"/>
        <stop offset="100%" stop-color="#1e293b"/>
      </linearGradient>
      <linearGradient id="skyMount2" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#94a3b8"/>
        <stop offset="100%" stop-color="#334155"/>
      </linearGradient>
    </defs>

    <!-- Sun -->
    <circle class="sun" cx="1420" cy="300" r="96" fill="#fde047"/>
    <circle class="sun-ring" cx="1420" cy="300" r="130" fill="none" stroke="#fde047" stroke-width="6" stroke-opacity="0.5"/>

    <!-- Back range -->
    <polygon class="m2" points="120,1080 620,420 1120,1080" fill="url(#skyMount2)"/>
    <!-- Front range -->
    <polygon class="m1" points="700,1080 1180,520 1660,1080" fill="url(#skyMount)"/>
    <!-- Snow caps -->
    <polygon class="cap" points="1180,520 1070,650 1290,650" fill="#e2e8f0"/>
    <polygon class="cap" points="620,420 540,530 700,530" fill="#cbd5e1"/>

    <!-- Ground -->
    <rect class="ground" x="0" y="900" width="1920" height="180" fill="#0f172a"/>

    <!-- Village -->
    <g class="hut1">
      <rect x="300" y="800" width="120" height="100" fill="#78350f"/>
      <polygon points="285,800 360,740 435,800" fill="#92400e"/>
      <rect x="340" y="840" width="40" height="60" fill="#fbbf24"/>
    </g>
    <g class="hut2">
      <rect x="480" y="820" width="96" height="80" fill="#7c2d12"/>
      <polygon points="468,820 528,770 588,820" fill="#9a3412"/>
      <rect x="510" y="852" width="32" height="48" fill="#fde68a"/>
    </g>

    <!-- Data bars -->
    <g class="bars">
      <rect x="1300" y="780" width="70" height="120" rx="8" fill="#38bdf8"/>
      <rect x="1400" y="700" width="70" height="200" rx="8" fill="#22d3ee"/>
      <rect x="1500" y="620" width="70" height="280" rx="8" fill="#facc15"/>
    </g>

    <!-- Connector -->
    <path class="arrow" d="M980 300 L1240 180" stroke="#fbbf24" stroke-width="10" stroke-linecap="round" fill="none"/>
    <polygon class="arrow" points="1240,180 1206,168 1216,206" fill="#fbbf24"/>
  </svg>

  <!-- Kinetic title -->
  <div class="badge">DATA STORY</div>
  <h1 class="title">THE WORLD<br/><span class="accent">IS CHANGING</span></h1>
  <p class="sub">Every element enters on its own spring curve.</p>

  <style>
    @keyframes popSpring { 0% { transform: scale(0); opacity: 0 } 70% { transform: scale(1.12); opacity: 1 } 100% { transform: scale(1); opacity: 1 } }
    @keyframes growUp   { 0% { transform: scaleY(0); opacity: 0 } 100% { transform: scaleY(1); opacity: 1 } }
    @keyframes slideIn  { 0% { transform: translateX(-80px); opacity: 0 } 100% { transform: translateX(0); opacity: 1 } }
    @keyframes fadeUp   { 0% { transform: translateY(40px); opacity: 0 } 100% { transform: translateY(0); opacity: 1 } }
    @keyframes drawLine { 0% { stroke-dasharray: 0 600; opacity: 0 } 30% { opacity: 1 } 100% { stroke-dasharray: 600 0; opacity: 1 } }

    .sun      { transform-origin: 1420px 300px; animation: popSpring 0.9s cubic-bezier(.2,1.3,.4,1) 0.2s both; }
    .sun-ring { transform-origin: 1420px 300px; animation: popSpring 1.1s cubic-bezier(.2,1.3,.4,1) 0.45s both; }
    .m2       { transform-origin: 620px 1080px;  animation: growUp 0.9s cubic-bezier(.2,.9,.3,1) 0.35s both; }
    .m1       { transform-origin: 1180px 1080px; animation: growUp 1.0s cubic-bezier(.2,.9,.3,1) 0.6s both; }
    .cap      { animation: popSpring 0.6s cubic-bezier(.2,1.4,.4,1) 1.5s both; transform-box: fill-box; transform-origin: center bottom; }
    .ground   { transform-origin: center bottom; animation: growUp 0.7s ease-out 0.9s both; }
    .hut1     { transform-box: fill-box; transform-origin: center bottom; animation: popSpring 0.7s cubic-bezier(.2,1.5,.4,1) 1.15s both; }
    .hut2     { transform-box: fill-box; transform-origin: center bottom; animation: popSpring 0.7s cubic-bezier(.2,1.5,.4,1) 1.3s both; }
    .bars rect { transform-box: fill-box; transform-origin: center bottom; animation: growUp 0.7s cubic-bezier(.2,.9,.3,1) both; }
    .bars rect:nth-child(1) { animation-delay: 1.6s }
    .bars rect:nth-child(2) { animation-delay: 1.75s }
    .bars rect:nth-child(3) { animation-delay: 1.9s }
    .arrow    { animation: drawLine 0.8s ease-out 2.0s both; }

    .badge {
      position: absolute; left: 140px; top: 150px;
      background: rgba(15, 23, 42, 0.72); color: #fbbf24;
      border: 3px solid #fbbf24; border-radius: 8px;
      padding: 10px 22px; font-size: 34px; font-weight: 800; letter-spacing: 6px;
      animation: slideIn 0.6s cubic-bezier(.2,1.2,.4,1) 0.1s both;
    }
    .title {
      position: absolute; left: 140px; top: 330px; margin: 0;
      font-size: 132px; line-height: 0.98; font-weight: 900; color: #f8fafc;
      text-shadow: 0 10px 30px rgba(0,0,0,0.55);
      animation: fadeUp 0.8s cubic-bezier(.2,1.1,.4,1) 0.75s both;
    }
    .accent { color: #facc15; }
    .sub {
      position: absolute; left: 148px; top: 640px; margin: 0;
      font-size: 44px; font-weight: 600; color: #e2e8f0;
      text-shadow: 0 6px 20px rgba(0,0,0,0.6);
      animation: fadeUp 0.7s ease-out 1.35s both;
    }
  </style>
</div>
`.trim();
