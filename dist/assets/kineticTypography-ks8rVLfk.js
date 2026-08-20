const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["assets/index-CaMVYybS.js","assets/vendor-ui-DYiKrtW2.js","assets/vendor-core-5dh1FbWQ.js","assets/vendor-ai-DDwuhaKh.js","assets/vendor-icons-DkI2_SpH.js","assets/index-yk_S5y_b.css"])))=>i.map(i=>d[i]);
import{_ as ge}from"./vendor-ai-DDwuhaKh.js";import{u as j}from"./index-CaMVYybS.js";import{extractFramesFromVideo as ye}from"./frameExtractor-CTXk_-lN.js";import{TEXT_TEMPLATES as re}from"./textTemplates-BoBUbneO.js";import{transcribeAudioWithGroq as we,analyzeReasoningWithGroq as be}from"./groqClient-CCxyOGCP.js";let C=null,$=0,ae="";function Ee(r="Update property",g=300){const n=performance.now(),i=n-$,u=j.getState();if(ae=r,i>=g){C!==null&&(clearTimeout(C),C=null),u.saveSnapshot(r),$=n;return}C!==null&&clearTimeout(C),C=setTimeout(()=>{u.saveSnapshot(ae),$=performance.now(),C=null},g)}const R=()=>crypto.randomUUID();async function Se(r,g,n,i){const u=j.getState(),I=n.provider||"gemini",w=u.mediaLibrary.find(e=>e.id===r.mediaId);if(!w||!w.url||w.url==="PENDING_RESTORE")throw new Error("Media not available for analysis");i(10);const f=await ye(w.url,1,r.trimStart,r.trimStart+r.duration);i(30);const y=await Te(w.url,r.trimStart,r.duration);let a=null;if(y){const e=await Oe(y);a=e.split(",")[1]||e}i(50);let d="";n.script==="roman_urdu_hindi"?d="Transcribe in Roman Urdu/Hindi (i.e. Urdu/Hindi written in English/Latin letters, e.g. 'aur all loving hai', 'kya baat hai'). Preserve the spoken language's rhythm and emphasis.":n.script==="hindi"?d="Transcribe in Devanagari Hindi script (e.g. 'और ऑल लविंग है', 'क्या बात है'). Preserve emphasis and spoken rhythm.":n.script==="english"?d="Transcribe in English. Preserve natural spoken rhythms and contractions (e.g., don't, I'm, we're).":d=`Translate and transcribe the spoken words into the ${n.script.toUpperCase()} script/language. Preserve emphasis and rhythm.`;const E=n.casing||n.englishCasing||"none";let N="";(n.script==="english"||n.script==="roman_urdu_hindi")&&(E==="all_caps"?N="Convert ALL words to strictly UPPERCASE (e.g. 'HELLO', 'WORLD', 'AAJ', 'MERA').":E==="first_letter_caps"&&(N="Capitalize ONLY the first letter of each word (e.g. 'Hello', 'World', 'Aaj', 'Mera')."));const L=n.styleSelection||"random",M=n.animationSelection||"random",ie=n.referenceScript?`

USER-PROVIDED GROUND-TRUTH REFERENCE SCRIPT:
"${n.referenceScript}"

CRITICAL INSTRUCTION FOR GROUND-TRUTH REFERENCE SCRIPT:
- The user has provided the exact ground-truth script spoken in the video/audio.
- You MUST use the exact words, spelling, and order from this reference script for the "text" properties of the generated typography objects.
- Align each word from the reference script to its corresponding spoken audio timestamp.
- This corrects any phonetic transcription errors from automated speech recognition.`:"",H=`You are a world-class Kinetic Typography Director and Motion Graphics Designer.
I am providing audio and visual frames of a video clip (Duration: ${r.duration.toFixed(2)} seconds).

PRIMARY TASK: Generate a JSON array of text animation clips, STRICTLY WORD-BY-WORD.
- CRITICAL: You MUST generate EXACTLY ONE JSON object for EVERY SINGLE SPOKEN WORD.
- Do NOT skip any words. Do NOT group multiple words into one object. Missing words will break the video sync.
- Every word must have a precise, short duration matching the real audio timing.

SPOKEN SCRIPT & LANGUAGE:
- ${d}
${N?`- ${N}`:""}${ie}

LAYOUT REQUIREMENTS:
${n.typoLayout==="column"?'- COLUMN WISE (9:16 Short Video): Keep lines extremely short (1-3 words max). It is CRITICAL to set "breakAfter": true on words where a line break should naturally occur for dramatic pacing.':'- ROW WISE (16:9 Landscape): Keep text flowing in wide lines. Set "breakAfter": true on words only when grammatically or visually necessary to prevent lines from exceeding 6-8 words.'}

DESIGNING AN EMOTIONALLY EXPRESSIVE TYPOGRAPHY FLOW (CRITICAL RULES):
1. SEMANTIC WEIGHT: Identify KEY emotional/emphatic words (nouns, verbs like 'NEVER', 'EXPLODE', 'LOVE', 'ROKNA').
   - Key words: fontSize 85–120, bold vibrant color, dramatic animation (bounce, zoom, slideUp).
   - Filler words (is, a, the, to, and, aur, ki, ka): fontSize 45–60, muted/white color, simple fadeIn.
2. KINETIC DRIFT: Stagger positions word-by-word so they POP in different screen locations.
   - x: between 30 and 70 (center screen, vary left/right)
   - y: between 35 and 65 (vary upper/lower)
   - Never place two consecutive words at the same x,y position.
3. VIBRANT COLORS: Use high-contrast palette:
   - Key words: '#fbbf24' yellow, '#22d3ee' cyan, '#f43f5e' rose-pink, '#a855f7' purple, '#22c55e' emerald.
   - Filler words: '#ffffff' white or '#94a3b8' slate gray.
4. TIMING PRECISION:
   - Each word's start/end should be tight (0.05–0.4s max for normal speech; 0.4–0.8s for slow/dramatic speech).
   - Do not leave gaps between words unless there is a genuine silence in audio.
5. FONT HIERARCHY:
   - Key words: 'Anton', 'Bebas Neue', 'Impact', 'Oswald'.
   - Filler words: 'Inter', 'Outfit', 'Montserrat'.

${L!=="random"?`STYLE PRESET PREFERENCE: Lean towards "${L}" style where possible.`:""}
${M!=="random"?`ANIMATION PREFERENCE: Prefer "${M}" for animation where applicable.`:""}

For each word, define:
- "text": The single spoken word.
- "start": Start time (seconds, 0–${r.duration.toFixed(2)}).
- "end": End time (seconds, 0–${r.duration.toFixed(2)}).
- "fontSize": 45–120.
- "fontFamily": 'Anton', 'Oswald', 'Bebas Neue', 'Impact', 'Outfit', 'Inter', 'Montserrat', or 'Georgia'.
- "color": A vibrant hex color string.
- "x": X position (30–70, as percentage of screen width).
- "y": Y position (35–65, as percentage of screen height).
- "breakAfter": true or false (AI intelligently decides line breaks based on layout requirements).
- "animationIn": Choose from:
  Basic: 'fadeIn', 'zoom', 'bounce', 'typewriter', 'slideUp', 'slideDown', 'slideLeft', 'slideRight'
  Cinematic (prefer these for KEY words): 'elastic' (spring pop - best for hype/energy words), 'splitReveal' (cinematic title reveal - best for dramatic statements), 'revealWipe' (curtain wipe - best for reveals/announcements), 'rollUp' (film credit roll - best for lists/credits), 'scaleFlip' (dramatic snap - best for shocking words), 'zoomBlur' (blockbuster zoom - best for openers/big moments), 'glitch' (cyber jitter - best for tech/error/intensity words), 'letterSpacing' (expand in - best for brand names/titles)
- "animationOut": Choose from:
  Basic: 'fadeOut', 'zoom', 'slideUp', 'slideDown', 'slideLeft', 'slideRight'
  Cinematic: 'elastic', 'splitReveal', 'revealWipe', 'rollUp', 'scaleFlip', 'zoomBlur', 'glitch', 'letterSpacing'
- "stylePreset": Choose from: 'MrBeast Hype', 'Alex Hormozi Impact', 'Modern Shorts Pill', 'Neon Cyberpunk', 'Cyber Neon', 'Yellow Warning', 'Golden Glow', 'Bouncy Pop', 'Neon Pink Glow', 'Ruby Red', 'Vibrant Pink', 'Sunset Orange', 'Forest Emerald', 'Electric Indigo', 'Typewriter Green', 'Chunky Shadow', 'Glitch Cyber', 'Bubble Caption'.

Output ONLY a valid JSON array, no markdown, no explanation:
[{"text":"Wow","start":0.5,"end":0.85,"fontSize":98,"fontFamily":"Anton","color":"#fbbf24","x":52,"y":48,"breakAfter":false,"animationIn":"zoom","animationOut":"fadeOut","stylePreset":"Bouncy Pop"}]`;let x="";if(I==="groq"){if(!y)console.warn("[Kinetic Typography] Audio extraction failed. Groq path requires audio; falling back to basic timestamp estimation."),x=JSON.stringify(Ie(r.duration));else{const e=await we(y);i(65);const t=e.words?JSON.stringify(e.words,null,2):JSON.stringify(e.segments||e.text,null,2),o=`You are a world-class Kinetic Typography Director.
You have precise word-level timestamps from Whisper transcription. Your job is to create stunning, emotionally expressive typography animations.
Rules:
- Use the Whisper timestamps as the SOURCE OF TRUTH for word timing.
- CRITICAL: You MUST generate EXACTLY ONE JSON object for EVERY SINGLE WORD present in the Whisper transcription. Do NOT skip any words. Do NOT group words. Missing words will break the video sync.
- Return ONLY a valid JSON array of word typography objects.
- Each object MUST have all required fields: text, start, end, fontSize, fontFamily, color, x, y, breakAfter, animationIn, animationOut, stylePreset.
- Do NOT include any text, explanation, or markdown outside the JSON array.

ANIMATION SELECTION GUIDE (pick cinematically for each word's emotional weight):
  Basic IN:  fadeIn, zoom, bounce, typewriter, slideUp, slideDown, slideLeft, slideRight
  Cinematic IN (PREFER for KEY/EMOTIONAL words):
    elastic      = spring overshoot pop (hype, energy, excitement words)
    splitReveal  = cinematic title scale-reveal (dramatic statements, main subjects)
    revealWipe   = curtain wipe left-to-right (announcements, reveals)
    rollUp       = hard film-credit roll from below (list items, credits)
    scaleFlip    = dramatic Y-snap pop (shock, surprise words)
    zoomBlur     = blockbuster zoom slam (openers, powerful verbs)
    glitch       = cyber XY jitter (tech, error, intensity, danger words)
    letterSpacing= letters expand from compressed (brand names, titles)
  OUT: fadeOut, zoom, slideUp/Down/Left/Right, elastic, splitReveal, revealWipe, rollUp, scaleFlip, zoomBlur, glitch, letterSpacing`,l=`${H}

---
WHISPER WORD TIMESTAMPS (use these for precise timing):
${t}

Generate the kinetic typography JSON array now:`;x=await be(l,o)}i(85)}else{const{getLocalGeminiKey:e,getEnvGeminiKey:t}=await ge(async()=>{const{getLocalGeminiKey:p,getEnvGeminiKey:b}=await import("./index-CaMVYybS.js").then(D=>D.av);return{getLocalGeminiKey:p,getEnvGeminiKey:b}},__vite__mapDeps([0,1,2,3,4,5])),o=e()||t();if(!o)throw new Error("Gemini API Key is missing.");const l=[{text:H}];a&&l.push({inlineData:{mimeType:"audio/wav",data:a}});for(const p of f){const b=p.replace(/^data:image\/(png|jpeg|webp);base64,/,"");l.push({inlineData:{mimeType:"image/jpeg",data:b}})}const m={contents:[{parts:l}],generationConfig:{temperature:.3,responseMimeType:"application/json"}},c=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${o}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(m)});if(!c.ok){const p=await c.text();throw new Error(`Gemini API Error: ${c.status} - ${p}`)}const s=await c.json();if(i(85),x=s.candidates?.[0]?.content?.parts?.[0]?.text,!x)throw new Error("No valid response from Gemini.")}x=x.replace(/^```(json)?/,"").replace(/```$/,"").trim();let J=[];try{J=JSON.parse(x)}catch{throw new Error(`Failed to parse AI typography response: ${x}`)}const O=[];for(const e of J){const t=(e.text||"").trim();if(!t)continue;const o=t.split(/\s+/),l=(e.end-e.start)/Math.max(1,o.length);o.forEach((m,c)=>{let s=m;(n.script==="english"||n.script==="roman_urdu_hindi")&&(E==="all_caps"?s=s.toUpperCase():E==="first_letter_caps"&&(s=s.charAt(0).toUpperCase()+s.slice(1).toLowerCase()));const p=L!=="random"?L:e.stylePreset||"Bubble Caption",b=M!=="random"?M:e.animationIn||"slideUp";O.push({...e,text:s,stylePreset:p,animationIn:b,start:e.start+c*l,end:e.start+(c+1)*l})})}const V=n.typoType||"hybrid",v=[],Y={};if(V==="word")O.forEach(e=>{const t=re.find(s=>s.name.toLowerCase()===(e.stylePreset||"").toLowerCase()),o=e.fontSize||60,l=e.fontFamily||"Anton",m=e.color||"#ffffff",c={text:e.text,fontSize:t&&t.settings.fontSize?Math.round(t.settings.fontSize*.9):o,fontFamily:t?.settings.fontFamily||l,color:t?.settings.color||m,backgroundColor:t?.settings.backgroundColor||"transparent",bold:t&&t.settings.bold!==void 0?t.settings.bold:!0,italic:t&&t.settings.italic||!1,underline:t&&t.settings.underline||!1,shadow:t&&t.settings.shadow!==void 0?t.settings.shadow:!0,shadowColor:t?.settings.shadowColor||"#000000",shadowBlur:10,textAlign:"center",animation:{in:e.animationIn==="pop"?"zoom":e.animationIn||"slideUp",out:e.animationOut||"fadeOut",inDuration:.1,outDuration:.1}};t?.settings.strokeColor&&(c.strokeColor=t.settings.strokeColor,c.strokeWidth=t.settings.strokeWidth||2),v.push({id:R(),mediaId:"generator:kinetic",trackId:"",startTime:r.startTime+e.start,duration:Math.max(.1,e.end-e.start),trimStart:0,trimEnd:Math.max(.1,e.end-e.start),opacity:1,transform:{x:Math.round((e.x-50)*8.54),y:Math.round((e.y-50)*4.8),scale:100,rotation:0},speed:1,effects:[],textSettings:c})});else if(V==="sentence"){const e=[];let t=[];O.forEach((o,l)=>{t.push(o);const m=/[.?!;:]$/.test(o.text),c=O[l+1],s=c?c.start-o.end>.4:!0,p=t.length>=7;(m||s||p||l===O.length-1)&&(e.push([...t]),t=[])}),e.forEach(o=>{if(o.length===0)return;const l=o.map(b=>b.text).join(" "),m=o[0].start,c=o[o.length-1].end,s=Math.max(.2,c-m),p=o[0];v.push({id:R(),mediaId:"generator:kinetic-sentence",trackId:"",startTime:r.startTime+m,duration:s,trimStart:0,trimEnd:s,opacity:1,transform:{x:0,y:160,scale:100,rotation:0},speed:1,effects:[],textSettings:{text:l,fontSize:54,fontFamily:p.fontFamily||"Inter",color:p.color||"#ffffff",backgroundColor:"transparent",bold:!0,italic:!1,underline:!1,shadow:!0,shadowColor:"#000000",shadowBlur:10,textAlign:"center",animation:{in:p.animationIn||"slideUp",out:"fadeOut",inDuration:.15,outDuration:.15}}})})}else{const e=[];let t=[];O.forEach((o,l)=>{t.push(o);const m=/[.?!;:]$/.test(o.text),c=O[l+1],s=c?c.start-o.end>.4:!0,p=t.length>=8;(m||s||p||l===O.length-1)&&(e.push([...t]),t=[])}),e.forEach(o=>{if(o.length===0)return;const l=o.map(S=>S.text).join(" "),m=o[0].start,c=o[o.length-1].end,s=Math.max(.2,c-m),p=R(),b=R(),D={id:p,mediaId:"generator:kinetic-hybrid-sentence",trackId:"",startTime:r.startTime+m,duration:s,trimStart:0,trimEnd:s,opacity:1,transform:{x:0,y:0,scale:100,rotation:0},speed:1,effects:[],pipWindowIds:[b],textSettings:{text:l,fontSize:1,fontFamily:"Inter",color:"transparent",backgroundColor:"transparent",bold:!1,italic:!1,underline:!1,shadow:!1,textAlign:"center"}};v.push(D);const q=[],le={id:b,parentClipId:p,relativeStartTime:0,tracks:q,duration:s,zIndex:Object.keys(u.pipWindows||{}).length+Object.keys(Y).length+1},X=n.typoLayout==="column",ce=X?420:860,Q=l.length;let k=54;X?k=Math.min(68,Math.max(42,Math.floor(500/Math.max(1,Q*.4)))):k=Math.min(54,Math.max(36,Math.floor(760/Math.max(1,Q*.52))));const de=k*.65,W=k*.4,z=k*1.35,h=[[]];let _=0;o.forEach(S=>{const U=h[h.length-1].length>0?h[h.length-1][h[h.length-1].length-1].word:null,F=Math.round(S.text.length*de),G=U&&U.breakAfter===!0,K=_+W+F>ce;h[h.length-1].length>0&&(K||G)&&(h.push([]),_=0),h[h.length-1].push({word:S,width:F}),_+=(h[h.length-1].length===1?0:W)+F});const pe=-(h.length*z)/2+z/2;D.kineticLineStructure=h.map(S=>S.length),h.forEach((S,U)=>{let G=-(S.reduce((T,B)=>T+B.width,0)+(S.length-1)*W)/2;const K=Math.round(pe+U*z);S.forEach(({word:T,width:B})=>{const ue=Math.round(G+B/2),fe=K;G+=B+W;const Z=Math.max(0,T.start-m),ee=Math.max(.1,s-Z),te=re.find(he=>he.name.toLowerCase()===(T.stylePreset||"").toLowerCase()),me=te?.settings.color||T.color||"#fbbf24",ne={id:R(),mediaId:"generator:kinetic-word",trackId:"",startTime:Z,duration:ee,trimStart:0,trimEnd:ee,opacity:1,transform:{x:ue,y:fe,scale:100,rotation:0},speed:1,effects:[],animations:{"transform.scale":[{time:0,value:135,easing:"easeOut"},{time:.12,value:100,easing:"easeOut"}],opacity:[{time:0,value:0,easing:"linear"},{time:.06,value:1,easing:"linear"}]},textSettings:{text:T.text,fontSize:k,fontFamily:te?.settings.fontFamily||T.fontFamily||"Inter",color:me,backgroundColor:"transparent",bold:!0,italic:!1,underline:!1,shadow:!0,shadowColor:"#000000",shadowBlur:12,textAlign:"center",animation:{in:T.animationIn||"bounce",out:"fadeOut",inDuration:.1,outDuration:.1}}},oe=R();ne.trackId=oe,q.push({id:oe,name:`Word (${T.text})`,type:"text",clips:[ne],locked:!1,muted:!1,hidden:!1})})}),Y[b]=le})}let A=u.tracks.find(e=>e.type==="text"&&!e.hidden),P=[...u.tracks];if(A){const e={...A,clips:[...A.clips,...v.map(t=>({...t,trackId:A.id}))]};P=P.map(t=>t.id===A.id?e:t)}else{const e=R(),t={id:e,name:"Kinetic Typography",type:"text",locked:!1,muted:!1,hidden:!1,clips:v.map(o=>({...o,trackId:e}))};P.push(t)}const se={...u.pipWindows||{},...Y};j.setState({tracks:P,pipWindows:se}),Ee("Generate Kinetic Typography"),i(100)}function Ie(r,g){const n=Math.max(3,Math.round(r*2.5)),i=r/n,u=["Bouncy Pop","Cyber Neon","Yellow Warning","Golden Glow","Bubble Caption"],I=["zoom","slideUp","bounce","fadeIn","slideRight"],w=["#fbbf24","#22d3ee","#f43f5e","#a855f7","#22c55e"],f=["Anton","Bebas Neue","Impact","Inter","Outfit"];return Array.from({length:n},(y,a)=>({text:"...",start:a*i,end:(a+1)*i,fontSize:70,fontFamily:f[a%f.length],color:w[a%w.length],x:35+a%5*8,y:45+a%3*8,animationIn:I[a%I.length],animationOut:"fadeOut",stylePreset:u[a%u.length]}))}async function Te(r,g,n){try{const i=new AudioContext,I=await(await fetch(r)).arrayBuffer(),w=await i.decodeAudioData(I),f=16e3,y=new OfflineAudioContext(1,f*n,f),a=y.createBufferSource();a.buffer=w,a.connect(y.destination),a.start(0,g,n);const d=await y.startRendering();return i.close(),xe(d)}catch(i){return console.warn("Could not extract audio for clip, returning null",i),null}}function xe(r){const g=r.numberOfChannels,n=r.length*g*2+44,i=new ArrayBuffer(n),u=new DataView(i),I=[];let w=0,f=0;function y(d){u.setUint16(f,d,!0),f+=2}function a(d){u.setUint32(f,d,!0),f+=4}a(1179011410),a(n-8),a(1163280727),a(544501094),a(16),y(1),y(g),a(r.sampleRate),a(r.sampleRate*2*g),y(g*2),y(16),a(1635017060),a(n-f-4);for(let d=0;d<r.numberOfChannels;d++)I.push(r.getChannelData(d));for(;f<n;){for(let d=0;d<g;d++){let E=Math.max(-1,Math.min(1,I[d][w]));E=(.5+E<0?E*32768:E*32767)|0,u.setInt16(f,E,!0),f+=2}w++}return new Blob([i],{type:"audio/wav"})}function Oe(r){return new Promise((g,n)=>{const i=new FileReader;i.onloadend=()=>g(i.result),i.onerror=n,i.readAsDataURL(r)})}const Le=Object.freeze(Object.defineProperty({__proto__:null,generateKineticTypography:Se},Symbol.toStringTag,{value:"Module"}));export{Se as g,Le as k,Ee as s};
