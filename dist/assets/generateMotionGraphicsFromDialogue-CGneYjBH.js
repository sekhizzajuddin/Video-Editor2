const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["assets/index-6HkEPUIT.js","assets/vendor-ui-DYiKrtW2.js","assets/vendor-core-5dh1FbWQ.js","assets/vendor-ai-DDwuhaKh.js","assets/vendor-icons-C1CdJeAR.js","assets/index-BZ4lis5S.css"])))=>i.map(i=>d[i]);
import{_ as U}from"./vendor-ai-DDwuhaKh.js";import{j as P}from"./index-6HkEPUIT.js";import{compileStoryboard as j}from"./storyboardCompiler-BsVTor8x.js";import{p as F,r as H,s as Y}from"./index-3khOuiy_.js";import{g as z}from"./cloudflareClient-BimOxO0m.js";import"./vendor-ui-DYiKrtW2.js";import"./vendor-core-5dh1FbWQ.js";import"./vendor-icons-C1CdJeAR.js";import"./webm-muxer-OYb_j2Zh.js";const B=["gemini-3.5-flash-lite","gemini-2.5-flash","gemini-2.5-flash-lite"],V=["llama-3.3-70b-versatile","llama-3.1-8b-instant"],O={vox:`VOX EXPLAINER — flat vector world-building (this is the house style)
• Build a miniature world you can look into: ground plane, horizon band, sky strip,
  hills, roads, buildings, trees, vehicles, people as 4-6 shape silhouettes, map outlines.
• Flat fills, no photographic realism. Large shapes get ONE darker shade polygon for depth.
• Palette: one dominant + two accents on a light neutral (e.g. #0f172a / #38bdf8 / #facc15).
• Data is physical: values become towers, dot grids, stacked blocks, flowing paths — never bare numerals.
• Annotation layer: 2px leader lines + small pill labels, hand-drawn underlines and circles
  around the thing being discussed, arrows that draw themselves.
• Depth: exactly 3 layers (far / mid / near), each entering with its own stagger.
• Camera: a slow push-in (scale the whole world group 1.00 → 1.06 over the scene).`,documentary:`DOCUMENTARY (Vox / Johnny Harris) — map-first vector journalism
• Lead with a MAP or a MAP-LIKE DIAGRAM: coastline/country outlines as <path>, city dots,
  route lines that draw themselves, region fills that pop in one by one.
• Then build the subject on top: terrain, buildings, simple flat people, vehicles.
• Data becomes objects: bars as towers, populations as dot clusters, change as growing paths.
• Annotation layer: leader lines, pill labels, underlines, circled focus areas.
• Palette: cool neutrals + one hot accent (#f97316 or #fbbf24) for the thing being pointed at.
• Camera: slow pan/zoom achieved by transforming the world group, never by moving text.`,kurzgesagt:`KURZGESAGT — bright isometric vector diorama
• Isometric/2.5D: everything sits on a rhombus ground plate; objects are extruded
  (top face + two side faces in 3 shades of the same hue).
• Saturated palette, thick rounded strokes, soft outer glow on the hero object.
• Tiny detailed characters (head + body + limbs as separate shapes).
• Circular motifs: orbits, rings, radial bursts behind the hero object.
• Everything is chunky and readable at a glance; fill the frame with objects, not words.`,mrbeast:`MRBEAST HYPE — bold pop
• Huge outlined headline text (thick stroke + hard drop shadow) but it sits ON TOP of
  a busy background of comic bursts, starbursts, confetti shards and chunky 3D-ish blocks.
• Primary red/yellow/white/black. Extreme scale overshoot, screen shake on impacts.
• Every beat gets a physical object: a stack of cash, a rocket, a trophy, a bar that slams up.`,hormozi:`ALEX HORMUZI — offer/snapping badges
• Dark slate base + lime/amber accent. Value props snap in as thick rounded badges with
  a hard shadow offset; numbers count up inside pill containers.
• Chunky arrows slam in pointing at the number that matters; a progress bar fills.
• Everything snaps with a fast overshoot (0.25-0.35s) and a tiny bounce.`,cyberpunk:`NEON CYBERPUNK HUD
• Perspective grid floor, horizon glow, scanlines, corner brackets, monospace labels.
• Neon strokes (#22d3ee / #f0abfc / #a3e635) with glow via feGaussianBlur or a blurred duplicate shape.
• Data as HUD panels: bar graphs, radar arcs, streaming ticker rows, glitch-offset duplicates.`,minimal:`MINIMAL / SWISS — restrained vector typography
• Very few elements, huge negative space, one accent colour.
• Thin rules, small circles and simple geometric marks that underline the words.
• Slow, elegant easing (cubic-bezier(.16,1,.3,1)); nothing bounces.`,editorial:`VINTAGE NEWSPAPER / PAPER CUTOUT
• Torn-paper shapes, halftone dot pattern (SVG <pattern>), ink-black serif headlines,
  aged cream paper scraps rotated a few degrees, red stamp circle, crop marks.
• Photos are simulated as duotone rects with a halftone overlay, never real images.`,mixed:`MIXED — you choose the strongest vector style for the dialogue, but it MUST still be
a built scene (objects, map, diagram or data made physical), not just animated words.`};function I(a){return a==="vox"||a==="kurzgesagt"||a==="documentary"?12:a==="minimal"?5:8}const _=/<(polygon|path|rect|circle|ellipse|line|polyline|use)\b/gi;function M(a){if(!a)return 0;const t=a.match(_);return t?t.length:0}function G(a,t){const o=[];a.htmlCssScenes.length===0&&o.push("No htmlCssScenes were produced at all — the result is typography only. Every scene must be built from SVG vector artwork.");const e=I(t);return a.htmlCssScenes.forEach((i,n)=>{const s=M(i.htmlCss);s<e&&o.push(`Scene ${n+1} ("${i.description||"untitled"}") contains only ${s} SVG shape elements, but a "${t}" scene needs at least ${e}. Add real artwork: <polygon>, <path>, <rect>, <circle>, <ellipse>, <line> arranged into recognisable objects (terrain, buildings, people, maps, charts) — not more text.`)}),o}async function le(a,t,o,e){const i=o.provider||"gemini";let n=o.targetDuration||t||5;const s=o.dialogueText||"";let p=[],u=null,v=null;if(a){e("Extracting video frames and audio",10);const r=document.createElement("video");try{r.crossOrigin="anonymous",r.muted=!0,r.playsInline=!0,r.preload="auto",r.src=a,await new Promise(f=>{if(r.readyState>=1){f();return}let b=!1;const m=()=>{b||(b=!0,f())};r.onloadedmetadata=m,r.oncanplay=m,r.onerror=m,setTimeout(m,3e3)});const g=r.duration&&!isNaN(r.duration)&&isFinite(r.duration)?r.duration:n;if(n=g,p=await j(r,0,Math.min(g,30),f=>e("Extracting video frames",Math.round(10+f*5)),1),i==="gemini"){e("Preparing audio for Gemini",18);try{const b=await(await fetch(a)).blob();if(b.size<15*1024*1024){const m=await b.arrayBuffer(),y=new Uint8Array(m);let E="";for(let C=0;C<y.byteLength;C+=8192)E+=String.fromCharCode.apply(null,Array.from(y.subarray(C,C+8192)));u=btoa(E),v=b.type||"video/mp4"}}catch(f){console.warn("[generateMotionGraphicsFromDialogue] Audio extraction failed:",f)}}}catch(g){console.warn("[generateMotionGraphicsFromDialogue] Frame extraction warning:",g)}finally{try{r.removeAttribute("src"),r.load()}catch{}}e("Frames extracted",20)}else e("Preparing motion design",20);e("AI Designing visual scenes",40);const w=o.style||"mixed";let h=!0;try{h=(await F()).svgOk}catch{h=!0}const l=K(s,n,o,p.length>0,h),d=[];if(u&&v&&i==="gemini"&&(d.push({inlineData:{mimeType:v,data:u}}),d.push({text:"Please transcribe the audio from the provided media file and use it as the dialogue for the motion graphics. Then output the JSON as instructed."})),i==="gemini")for(const r of p)d.push({inlineData:{mimeType:"image/jpeg",data:r.base64Image}});let c=await $(i,[...d,{text:l}],o.signal),S=R(c,n,h),A=G(S,w);if(A.length>0){e("Refining design (adding vector artwork)",52),console.warn("[generateMotionGraphicsFromDialogue] Design rejected:",A);try{const r=await $(i,[...d,{text:X(A,w,n,s)}],o.signal),g=R(r,n,h),f=G(g,w);f.length<A.length&&(c=r,S=g,A=f)}catch(r){console.warn("[generateMotionGraphicsFromDialogue] Correction pass failed:",r)}}e("Validating design specification",55);let x=s;if(typeof c?.transcribedText=="string"&&c.transcribedText.trim()&&(x=c.transcribedText),Array.isArray(c?.imageAssets)&&c.imageAssets.length>0){e("Generating AI image assets (Cloudflare)",60);try{const{useEditorStore:r}=await U(async()=>{const{useEditorStore:m}=await import("./index-6HkEPUIT.js").then(y=>y.au);return{useEditorStore:m}},__vite__mapDeps([0,1,2,3,4,5])),g=r.getState(),f=g.settings?.cloudflareAccountId||"4cd6b61444868f5d26e6a771bdf74e07",b=g.settings?.cloudflareApiToken||"cfat_8Y5rwWyTfHZ4sz0ZMvld9Wtocvj8zW8i1QF6HuzK9a172cb0";if(f&&b){for(const m of c.imageAssets)if(m.prompt&&m.id)try{const y=await z(m.prompt,f,b);if(Array.isArray(c.htmlCssScenes))for(const E of c.htmlCssScenes)typeof E.htmlCss=="string"&&(E.htmlCss=E.htmlCss.split(`{{IMAGE_${m.id}}}`).join(y),E.htmlCss=E.htmlCss.split(m.id).join(y))}catch(y){console.warn("[generateMotionGraphicsFromDialogue] Cloudflare image generation warning:",y)}}}catch(r){console.warn("[generateMotionGraphicsFromDialogue] Cloudflare assets lookup error:",r)}}S=R(c,n,h),e("Rendering vector animation video",70);let D=null;try{D=await H(S,(r,g)=>{e(r,Math.round(70+g/100*28))},{transparent:o.transparent!==!1,signal:o.signal})}catch(r){throw r?.name==="AbortError"?r:(console.error("[generateMotionGraphicsFromDialogue] Rendering error:",r),new Error(`Failed to render motion graphics to video: ${r instanceof Error?r.message:String(r)}`))}return e("Complete",100),{spec:S,transcribedText:x||o.dialogueText||"",video:D,designNotes:A}}async function $(a,t,o){const e=t.filter(n=>typeof n.text=="string").map(n=>n.text).join(`

`),i=a==="gemini"?await W(t,o):await J(e,o);return q(i)}function L(a,t){return a===404?!0:/is not found|not supported for generateContent|model.*not found|unsupported model/i.test(t||"")}async function W(a,t){let o="";for(const e of B){const i=await P(s=>`https://generativelanguage.googleapis.com/v1beta/models/${e}:generateContent?key=${s}`,{method:"POST",headers:{"Content-Type":"application/json"},signal:t,body:JSON.stringify({contents:[{role:"user",parts:a}],generationConfig:{temperature:.4,responseMimeType:"application/json",maxOutputTokens:65536}})},"gemini");if(i.ok){const p=(await i.json())?.candidates?.[0];if(p?.finishReason==="MAX_TOKENS"){o="AI response was truncated before it could finish the scene code.";continue}const v=(p?.content?.parts||[]).map(w=>typeof w?.text=="string"?w.text:"").filter(Boolean).join(`
`);if(v.trim())return v;o="AI returned an empty response.";continue}const n=await i.text().catch(()=>"");if(L(i.status,n)){o=`Model ${e} unavailable (${i.status}).`;continue}throw new Error(`Gemini API call failed (${i.status}): ${n||i.statusText}`)}throw new Error(o||"Gemini API call failed for every available model.")}async function J(a,t){let o="";for(const e of V){const i=await P(()=>"https://api.groq.com/openai/v1/chat/completions",{method:"POST",headers:{"Content-Type":"application/json"},signal:t,body:JSON.stringify({model:e,messages:[{role:"system",content:"You are an elite motion graphics designer. You must return ONLY valid JSON adhering strictly to the MotionGraphicSpec schema."},{role:"user",content:a}],temperature:.4,max_tokens:32768,response_format:{type:"json_object"}})},"groq");if(i.ok){const s=await i.json(),p=s?.choices?.[0]?.finish_reason,u=s?.choices?.[0]?.message?.content||"";if(u.trim()&&p!=="length")return u;o="AI response was truncated before it could finish the scene code.";continue}const n=await i.text().catch(()=>"");if(L(i.status,n)){o=`Model ${e} unavailable (${i.status}).`;continue}throw new Error(`Groq API call failed (${i.status}): ${n||i.statusText}`)}throw new Error(o||"Groq API call failed for every available model.")}const k=`<div style="position:relative;width:1920px;height:1080px;overflow:hidden;background:transparent;font-family:Arial,Helvetica,sans-serif;">
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
</div>`;function K(a,t,o,e,i=!0){const n=t.toFixed(1),s=o.style||"mixed",p=O[s]||O.mixed,u=I(s);return`You are an elite Motion Graphics Director. You build WORLDS OUT OF VECTOR SHAPES that explain the dialogue — you are not a subtitle generator.

TOTAL DURATION: ${n} seconds
STAGE: 1920x1080 (30 FPS)
STYLE KEY: "${s}"
LAYOUT: "${o.layout}"
${o.customPrompt?`USER INSTRUCTIONS: "${o.customPrompt}"`:""}
${a?`DIALOGUE / SCRIPT: "${a}"`:""}
${e?"NOTE: Video frames are provided so the graphics can match the footage.":""}

═══════════════════════════════════════════════════════════════════════════════
RULE #0 — ARTWORK FIRST, TEXT SECOND (THIS IS WHAT "VOX STYLE" MEANS)
═══════════════════════════════════════════════════════════════════════════════
A Vox/Kurzgesagt piece is a SCENE YOU CAN LOOK AT, not words flying around.
Your job per scene:
  1. Decide what OBJECT/WORLD represents this beat (a coastline, a city, a market,
     a server rack, a human body, a chart made physical…).
  2. Draw it with ${u}+ SVG shape elements: <polygon>, <path>, <rect>, <circle>, <ellipse>, <line>.
  3. Animate those shapes entering in a staggered sequence.
  4. ONLY THEN add a short label/caption if the dialogue needs one.
TEXT BUDGET: visible text must cover at most ~25% of the frame. A scene made only of
animated words is a FAILURE and will be rejected by the validator.

ART DIRECTION FOR THIS JOB:
${p}

═══════════════════════════════════════════════════════════════════════════════
RULE #1 — THE OUTPUT MUST BE TRANSPARENT (NON-NEGOTIABLE)
═══════════════════════════════════════════════════════════════════════════════
The finished video is placed ON TOP of the user's footage.
  • NEVER paint a full-screen background: no <div style="width:1920px;height:1080px;background:#0b1020">,
    no <rect width="1920" height="1080" fill="#...">, no full-frame gradients, no body background.
  • For contrast behind text use a semi-transparent pill sized to the TEXT only.
  • Vignettes/scrims covering more than ~70% of the frame are forbidden.

${i?`═══════════════════════════════════════════════════════════════════════════════
HOW TO CODE htmlCssScenes (THE PRIMARY OUTPUT)
═══════════════════════════════════════════════════════════════════════════════
Self-contained HTML/CSS/SVG with CSS @keyframes. Rules:
1. Root wrapper: <div style="position:relative;width:1920px;height:1080px;overflow:hidden;background:transparent;">
2. NO external assets: no <img src="http...">, no <link>, no @import, no web fonts.
   Only web-safe fonts (Arial, Helvetica, Impact, "Courier New", Georgia).
3. Artwork MUST live inside ONE <svg width="1920" height="1080" viewBox="0 0 1920 1080"
   style="position:absolute;top:0;left:0;overflow:visible;"> … </svg>
4. Animate transform/opacity with cubic-bezier springs. Always set "transform-origin"
   (e.g. "center bottom" for things that grow up from the ground).
5. Every animated element needs "animation-fill-mode: both" so it is invisible before
   its delay and stays visible after it finishes.
6. Scene timing: "enterAt"/"exitAt" are seconds. Scene-local CSS time starts at enterAt,
   so an element that should appear 1.5s into the scene gets "animation-delay: 1.5s".
7. Use 2-5 scenes for a ${n}s clip; together they must cover 0 → ${n}.
8. Keep each scene under ~9000 characters of HTML/CSS.

REFERENCE SCENE (note: ${M(k)} shapes, transparent, staggered):
${k}

═══════════════════════════════════════════════════════════════════════════════
OPTIONAL SUPPORTING LAYER — canvasElements
═══════════════════════════════════════════════════════════════════════════════
These are simple canvas overlays. They are a GARNISH, never the meal — if you use them,
you must STILL deliver full htmlCssScenes vector artwork.
  • "KineticWord" · "VoiceSyncHighlight" · "MotionArrow" · "AnimatedBarChart"
  • "AnimatedLineGraph" · "AnimatedCounter" · "LowerThird" · "TitleCard"
  • "ParticleBurst" · "CircleHighlight" · "VectorShape"

`:`}

═══════════════════════════════════════════════════════════════════════════════
THIS BROWSER CANNOT RASTERIZE HTML/CSS SCENES (verified at runtime).
═══════════════════════════════════════════════════════════════════════════════
Anything you put in htmlCssScenes would render as a completely EMPTY overlay, so
leave htmlCssScenes as an empty array and build the ENTIRE animation out of
canvasElements, composing several components per beat:
  • "VectorShape" — flat vector artwork (circle / rect / polygon / line). Use MANY
    of them to build a simplified map, skyline, chart or scene.
  • "AnimatedBarChart" / "AnimatedLineGraph" / "AnimatedCounter" — data made visible
  • "KineticWord" / "LowerThird" / "TitleCard" — the caption layer (keep it small)
  • "MotionArrow" / "CircleHighlight" / "ParticleBurst" — emphasis and annotation
Give every element explicit enterAt/exitAt so the composition moves across the full
${n} seconds, and stagger them so it reads as an animation rather than a slideshow.
These components are now the MEAL, not a garnish.

`}
OUTPUT: ONLY a single valid JSON object (no markdown fences, no backticks, no comments):
{
  "transcribedText": string,
  "width": 1920,
  "height": 1080,
  "fps": 30,
  "duration": ${n},
  "canvasElements": [
    { "component": "…", "enterAt": number (0 to ${n}), "exitAt": number,
      "config": object, "position": { "x": number, "y": number } }
  ],
  "htmlCssScenes": ${i?`[
    { "enterAt": number, "exitAt": number, "description": string, "htmlCss": string }
  ]`:"[]"}
}`}function X(a,t,o,e){const i=o.toFixed(1),n=I(t),s=O[t]||O.mixed;return`Your previous design was REJECTED by the motion graphics validator:

${a.map(p=>`• ${p}`).join(`
`)}

You produced animated TYPOGRAPHY. The user asked for a "${t}" VECTOR SCENE and got words.
Rewrite the JSON from scratch and fix every issue above.

NON-NEGOTIABLE FOR THIS RETRY (all ${i}s of it):
1. Every scene is a drawn world inside <svg viewBox="0 0 1920 1080"> with ${n}+ shape
   elements (polygon/path/rect/circle/ellipse/line). No scene may be text-only.
2. Text is a caption, not the content: at most ~25% of the frame.
3. The stage stays TRANSPARENT — no full-frame background of any kind.
4. Keep the same duration (${i}s) and the same dialogue${e?`: "${e}"`:""}.
5. Stagger the entrances (spring/grow-up easings, "animation-fill-mode: both").

ART DIRECTION:
${s}

REFERENCE DENSITY (${M(k)} shapes):
${k}

Return ONLY the corrected JSON object.`}function q(a){let t=(a||"").trim();if(!t)return{};t.startsWith("```")&&(t=t.replace(/^```[a-zA-Z]*\s*\n?/,"").replace(/\n?\s*```$/,"").trim());try{return JSON.parse(t)}catch{}const o=t.indexOf("{");if(o!==-1){const e=t.lastIndexOf("}"),i=e>o?t.slice(o,e+1):t.slice(o);try{return JSON.parse(i)}catch{try{return JSON.parse(Z(i))}catch{}}}return console.warn("[generateMotionGraphicsFromDialogue] JSON parse error, returning fallback."),{}}function Z(a){let t=a;const o=t.lastIndexOf('"},');o!==-1&&(t=t.slice(0,o+2));const e=[];let i=!1,n=!1;for(const s of t){if(i){n?n=!1:s==="\\"?n=!0:s==='"'&&(i=!1);continue}s==='"'?i=!0:s==="{"||s==="["?e.push(s):(s==="}"||s==="]")&&e.pop()}i&&(t+='"'),t=t.replace(/,\s*$/,"");for(let s=e.length-1;s>=0;s--)t+=e[s]==="{"?"}":"]";return t}function R(a,t,o=!0){const e=Math.max(.5,Number(a?.duration)||t||5),i=1920,n=1080,s=30,u=(Array.isArray(a?.canvasElements)?a.canvasElements:[]).map(l=>{const d=N(Number(l?.enterAt)||0,0,Math.max(0,e-.1));let c=N(Number(l?.exitAt)||e,0,e);c<=d&&(c=Math.min(e,d+1));const S=typeof l?.component=="string"&&l.component?l.component:"KineticWord",A=l?.config&&typeof l.config=="object"?l.config:{},x=l?.position&&typeof l.position=="object"&&typeof l.position.x=="number"?{x:l.position.x,y:Number(l.position.y)||n/2}:void 0;return{component:S,enterAt:T(d),exitAt:T(c),config:A,position:x}}),w=(Array.isArray(a?.htmlCssScenes)?a.htmlCssScenes:[]).map(l=>{const d=N(Number(l?.enterAt)||0,0,Math.max(0,e-.1));let c=N(Number(l?.exitAt)||e,0,e);return c<=d&&(c=Math.min(e,d+1)),{enterAt:T(d),exitAt:T(c),description:typeof l?.description=="string"?l.description:"HTML Scene",htmlCss:Y(typeof l?.htmlCss=="string"?l.htmlCss:"")}}).filter(l=>l.htmlCss.trim().length>0).sort((l,d)=>l.enterAt-d.enterAt),h=o?w:[];if(h.length>0){h[0].enterAt=0;for(let l=0;l<h.length-1;l++){const d=h[l+1].enterAt;h[l].exitAt<d&&(h[l].exitAt=d)}h[h.length-1].exitAt=T(e)}return h.length===0&&u.length<=2&&u.push({component:"TitleCard",enterAt:0,exitAt:T(e),config:{title:a?.transcribedText||"Motion Graphics",subtitle:"ProCut AI Generated",titleColor:"#ffe600",subtitleColor:"#ffffff",accentColor:"#00ffff"},position:{x:i/2,y:n/2}}),{width:i,height:n,fps:s,duration:e,canvasElements:u,htmlCssScenes:h}}function N(a,t,o){return Number.isFinite(a)?Math.min(o,Math.max(t,a)):t}function T(a){return Number(a.toFixed(2))}export{le as generateMotionGraphicsFromDialogue,q as parseJsonSafely,R as sanitizeMotionGraphicSpec,G as validateSceneQuality};
