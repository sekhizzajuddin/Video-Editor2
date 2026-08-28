import{j as x,U as B,R as C,_ as G,$ as M}from"./index-D809v_z6.js";function U(){return G()||M()}function Y(){return B()||C()}const E="gemini-3.5-flash-lite",A="llama-3.2-11b-vision-preview",q="llama-3.3-70b-versatile";function v(r){const e=r.indexOf(",");return e!==-1?r.slice(e+1):r}function j(r,e){const t=new AbortController,c=Math.min(9e4,3e4+r*e*800),s=setTimeout(()=>t.abort(),c);return{controller:t,clear:()=>clearTimeout(s)}}async function J(r,e,t="gemini",c=1){const s=v(r),n=1/c,a=Math.round(e*c),l=`You are a Hollywood-level Sound Supervisor and Music Supervisor creating a full audio brief for a ${e.toFixed(1)}-second video clip.

STORYBOARD: Chronological grid of ${a} frames. Frames go LEFT→RIGHT then TOP→BOTTOM. Each frame = ${n.toFixed(3)} seconds. Yellow timestamps in corners show exact timing.

═══════════════════════════════════
YOUR JOB: Generate a COMPLETE audio design with BOTH BGM and SFX.
═══════════════════════════════════

MANDATORY RULES:
1. You MUST include at least 1 BGM cue that covers the majority of the clip (e.g., start=0, end=${e.toFixed(1)}).
2. You MUST include SFX for every visible physical action (footsteps, impacts, doors, vehicles, crowds, water, fire, etc.).
3. You MUST add ambient atmosphere SFX if the scene has an identifiable environment (city, nature, room, street).
4. If the clip is longer than 5 seconds, include at least 3 cues total.
5. ALL timestamps must be between 0.0 and ${e.toFixed(2)}.

BGM SEARCH QUERY RULES (for music):
- Use ONLY 1 or 2 generic genre/mood tags. Freesound will return 0 results if you use full sentences or too many words.
- Good examples: "cinematic", "ambient chill", "orchestral", "lofi", "upbeat funk"
- BAD examples: "dramatic background music for city", "epic orchestral tense"

SFX SEARCH QUERY RULES (for effects):
- Use ONLY 1 or 2 generic nouns for the physical sound.
- Good examples: "rain", "crowd", "door", "car engine", "footsteps"
- BAD examples: "heavy rain thunder storm urban", "loud door slam wooden"

SCENE ANALYSIS APPROACH:
1. What is the overall emotional tone? (tense, joyful, dramatic, calm, mysterious) → use for BGM
2. What environment is it? (urban, nature, indoor, outdoor, studio) → use for ambient SFX
3. What physical actions are visible? → use for specific SFX
4. Are there any cuts, transitions or emotional peaks that need a sting/impact?

Return ONLY this exact JSON (no markdown, no explanation):
{
  "cues": [
    {
      "start": <number 0–${e.toFixed(2)}>,
      "end": <number 0–${e.toFixed(2)}>,
      "query": "<Freesound.org search keywords>",
      "type": "sfx" | "bgm",
      "reason": "<one sentence: exactly what you saw and why this sound fits>"
    }
  ]
}`,p=`You are a world-class Hollywood Sound Supervisor and Music Supervisor with 20+ years experience.
You analyze video storyboards and produce a COMPLETE audio brief including BOTH background music (BGM) and sound effects (SFX).

CRITICAL OUTPUT RULES:
- Return ONLY valid JSON in the exact format requested. No markdown. No explanation. No commentary.
- ALWAYS include at least 1 BGM cue with music genre keywords (e.g. "cinematic orchestral epic tension", "dark ambient electronic drone", "upbeat funk groove")
- ALWAYS include SFX for any visible actions, environments, or transitions
- BGM queries must be music-specific: include genre words like orchestral, electronic, hip-hop, ambient, jazz, rock, cinematic, lo-fi
- SFX queries must be action-specific: footsteps wood, rain heavy, crowd cheer, explosion debris, etc.
- If you return an empty cues array or omit BGM, you have FAILED your job`,i={"Content-Type":"application/json"};let o={};t==="gemini"?o={contents:[{parts:[{text:l},{inlineData:{mimeType:"image/jpeg",data:s}}]}],generationConfig:{responseMimeType:"application/json",temperature:.5,maxOutputTokens:3e3}}:o={model:A,messages:[{role:"system",content:p},{role:"user",content:[{type:"text",text:l},{type:"image_url",image_url:{url:`data:image/jpeg;base64,${s}`}}]}],response_format:{type:"json_schema",json_schema:{name:"cues_schema",strict:!1,schema:{type:"object",properties:{cues:{type:"array",items:{type:"object",properties:{start:{type:"number"},end:{type:"number"},query:{type:"string"},type:{type:"string"},reason:{type:"string"}},required:["start","end","query","type","reason"]}}},required:["cues"]}}},temperature:.4,max_tokens:3e3};const{controller:d,clear:w}=j(c,e);let m;try{m=await x(y=>t==="groq"?(i.Authorization=`Bearer ${y}`,"https://api.groq.com/openai/v1/chat/completions"):`https://generativelanguage.googleapis.com/v1beta/models/${E}:generateContent?key=${y}`,{method:"POST",headers:i,body:JSON.stringify(o),signal:d.signal},t)}finally{w()}if(!m.ok){const y=await m.text(),k=t==="gemini"?"Gemini":"Groq";throw new Error(`${k} API error: ${m.status} - ${y}`)}const h=await m.json();let f="";if(t==="gemini"?f=h?.candidates?.[0]?.content?.parts?.[0]?.text||"":f=h?.choices?.[0]?.message?.content||"",!f)throw new Error(`${t.toUpperCase()} Vision returned an empty response. The image may be too large or content was blocked.`);try{const y=f.match(/(\{[\s\S]*\}|\[[\s\S]*\])/),N=(y?y[0]:f).replace(/^```(json)?/m,"").replace(/```$/m,"").trim(),b=JSON.parse(N),S=Array.isArray(b)?b:b.cues??[];if(!Array.isArray(S))throw new Error("Response cues is not an array");return S.length===0&&e>3&&S.unshift({start:0,end:e,query:"cinematic ambient background atmospheric",type:"bgm",reason:"Background music layer auto-added to fill the full clip duration."}),S}catch{throw new Error(`Failed to parse ${t.toUpperCase()} storyboard response as JSON. Raw: ${f.slice(0,300)}`)}}async function D(r,e="sfx"){const t={model:q,messages:[{role:"system",content:`You are an expert audio library search optimizer for Freesound.org.
Your ONLY job is to convert a sound description into a primary query (1-3 words) and 3 alternative queries.

CRITICAL RULES FOR FREESOUND:
1. Freesound uses exact text matching. Using long specific phrases will return ZERO results.
2. You MUST use 1 to 3 broad, generic nouns/tags max per query (e.g., "city night", "rain").
3. NEVER use full sentences or highly descriptive adjectives.

${e==="bgm"?`MUSIC (BGM) KEYWORDS:
- Use 1 broad genre and optionally 1 mood (e.g. "orchestral dark", "ambient chill", "lofi").
- Must be musical instruments, melody, rhythm. NEVER ambient noise.`:`SFX KEYWORDS:
- Use 1 or 2 generic nouns for the physical sound.`}

Return ONLY valid JSON (no markdown):
{
  "keywords": "primary 1-3 words",
  "alternatives": ["alt1", "alt2", "alt3"]
}`},{role:"user",content:`Convert this ${e==="bgm"?"music/BGM":"sound effect/SFX"} description to Freesound.org search keywords:
"${r}"`}],response_format:{type:"json_schema",json_schema:{name:"refinement_schema",strict:!1,schema:{type:"object",properties:{keywords:{type:"string"},alternatives:{type:"array",items:{type:"string"}}},required:["keywords","alternatives"]}}},temperature:.1,max_tokens:150},c=new AbortController,s=setTimeout(()=>c.abort(),15e3);let n;try{n=await x(i=>"https://api.groq.com/openai/v1/chat/completions",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(t),signal:c.signal},"groq")}finally{clearTimeout(s)}if(!n.ok){const i=await n.text();throw new Error(`Groq API error: ${n.status} - ${i}`)}const a=await n.json(),l={keywords:r,alternatives:[]},p=a?.choices?.[0]?.message?.content?.trim();if(!p)return l;if(p.startsWith("{")||p.startsWith("["))try{const i=p.replace(/^```(json)?/m,"").replace(/```$/m,"").trim(),o=JSON.parse(i);return{keywords:o.keywords||r,alternatives:Array.isArray(o.alternatives)?o.alternatives:[]}}catch{return l}return{keywords:p||r,alternatives:[]}}async function H(r,e,t){const c=`You are a professional Sound Editor (Double Automation).
I have provided ${r.length} alternate audio clips for a video scene.
SCENE CONTEXT: "${e}" (Audio type needed: ${t.toUpperCase()})

Listen to all provided audio clips.
YOUR JOB:
1. Pick the ONE audio clip that sounds the most realistic and best fits the scene context.
2. Identify the exact timestamp (in seconds) where the primary action/music actually begins (skipping any dead air or silence at the start).

Return ONLY valid JSON (no markdown):
{
  "selectedIndex": <number 0 to ${r.length-1}>,
  "trimOffset": <number in seconds (e.g. 0.5, 2.1)>,
  "reason": "<short explanation why this clip is best>"
}`,s=r.map(o=>({inlineData:{mimeType:"audio/mp3",data:v(o)}})),n={contents:[{parts:[{text:c},...s]}],generationConfig:{responseMimeType:"application/json",temperature:.1}},a=await x(o=>`https://generativelanguage.googleapis.com/v1beta/models/${E}:generateContent?key=${o}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(n)},"gemini");if(!a.ok){const o=await a.text();throw new Error(`[Gemini Audio Analysis] HTTP ${a.status}: ${o}`)}const p=(await a.json())?.candidates?.[0]?.content?.parts?.[0]?.text||"";if(!p)throw new Error("Empty response from Gemini Audio Analysis");const i=p.replace(/^```(json)?/m,"").replace(/```$/m,"").trim();return JSON.parse(i)}async function W(r,e,t="gemini"){const c=v(r),s=`You are a world-class professional video editor and motion graphics director.

CONTEXT: This is a chronological storyboard grid from a ${e.toFixed(1)}-second video segment.
Frames go LEFT-TO-RIGHT then TOP-TO-BOTTOM. Use the yellow timestamps in each corner to identify timing.

YOUR MISSION: Suggest 2–4 perfectly timed motion graphics overlays to dramatically improve this video's production value.

AVAILABLE TEMPLATES (use ONLY these exact IDs):
- "kinetic_typewriter": Typewriter effect. Best for: narrative captions, subtitles, date/location cards.
- "kinetic_bounce": Bold bounce-in title. Best for: energetic announcements, action moments, product reveals.
- "lower_third_classic": Professional lower-third bar. Best for: introducing a person (name + role), location labels.
- "cinematic_title": Elegant slow-reveal title. Best for: scenic beauty shots, documentary intros, travel establishing shots.
- "subtitle_bar": Clean subtitle bar. Best for: translations, spoken dialogue subtitles, informational text.
- "kinetic_pop": Quick pop-art effect. Best for: humorous moments, viral-style emphasis.
- "subscribe_bell": Animated subscribe call-to-action. Best for: end screens, engagement moments.

RULES:
1. Timestamps must be between 0 and ${e.toFixed(2)} seconds.
2. Each overlay duration should be 2.5–6 seconds.
3. suggestedText MUST be specific to the actual video content (real person's name, city, product, quote) — NOT generic placeholders like "Title Here".
4. Vary your template choices — do NOT suggest the same templateId twice.
5. Only suggest overlays that genuinely match the scene.

Return ONLY this JSON format, no markdown:
{
  "suggestions": [
    {
      "templateId": "<exact ID from list above>",
      "start": "<number>",
      "end": "<number>",
      "suggestedText": "<specific text for overlay>",
      "reason": "<one sentence: what you saw and why this template fits>"
    }
  ]
}`,n={"Content-Type":"application/json"};let a={};t==="gemini"?a={contents:[{parts:[{text:s},{inlineData:{mimeType:"image/jpeg",data:c}}]}],generationConfig:{responseMimeType:"application/json",temperature:.5,maxOutputTokens:1024}}:a={model:A,messages:[{role:"system",content:"You are a professional motion graphics director. Analyze video storyboards and suggest overlays as strict JSON only. No markdown, no commentary."},{role:"user",content:[{type:"text",text:s},{type:"image_url",image_url:{url:`data:image/jpeg;base64,${c}`}}]}],response_format:{type:"json_schema",json_schema:{name:"suggestions_schema",strict:!1,schema:{type:"object",properties:{suggestions:{type:"array",items:{type:"object",properties:{templateId:{type:"string"},start:{type:"number"},end:{type:"number"},suggestedText:{type:"string"},reason:{type:"string"}},required:["templateId","start","end","suggestedText","reason"]}}},required:["suggestions"]}}},temperature:.4,max_tokens:1024};const{controller:l,clear:p}=j(1,e);let i;try{i=await x(m=>t==="groq"?(n.Authorization=`Bearer ${m}`,"https://api.groq.com/openai/v1/chat/completions"):`https://generativelanguage.googleapis.com/v1beta/models/${E}:generateContent?key=${m}`,{method:"POST",headers:n,body:JSON.stringify(a),signal:l.signal},t)}finally{p()}if(!i.ok){const m=await i.text(),h=t==="gemini"?"Gemini":"Groq";throw new Error(`${h} API error: ${i.status} - ${m}`)}const o=await i.json();let d="";if(t==="gemini"?d=o?.candidates?.[0]?.content?.parts?.[0]?.text||"":d=o?.choices?.[0]?.message?.content||"",!d)throw new Error(`${t.toUpperCase()} returned an empty motion graphics response.`);const w=new Set(["kinetic_typewriter","kinetic_bounce","lower_third_classic","cinematic_title","subtitle_bar","kinetic_pop","subscribe_bell"]);try{const m=d.replace(/^```(json)?/m,"").replace(/```$/m,"").trim(),h=JSON.parse(m),f=Array.isArray(h)?h:h.suggestions??[];if(!Array.isArray(f))throw new Error("suggestions is not an array");return f.filter(y=>w.has(y.templateId))}catch{throw new Error(`Failed to parse ${t.toUpperCase()} motion graphics response. Raw: ${d.slice(0,300)}`)}}async function z(r,e,t="gemini"){if(!(t==="gemini"?U():Y()))throw new Error(`${t.toUpperCase()} API key is required. Please set it in Settings.`);const s=`You are an expert Foley Artist and Sound Designer.
Your job is to analyze ${r.frames.length} frames (representing a ${e}s chunk at 5fps) along with timeline metadata, and generate precise Sound Effects (SFX).

RULES:
1. Generate SFX for visual actions, transitions, text appearance, and environments.
2. DO NOT GENERATE BGM (Background Music). ONLY SFX.
3. Keep the "query" extremely concise, clear, and under 45 characters. 
   - Formula: [Descriptor] + [Object/Material] + [Action/Sound-Type].
   - DO NOT use filler words like "a", "the", "sound of", "effect of", "textures".
   - Good: "heavy metallic door slamming"
   - Good: "futuristic digital glitch static"
   - Good: "soft cinematic whoosh"
4. Timestamps must be relative to the chunk (0 to ${e}).
5. Only return the JSON. No markdown wrappers, no explanations.

METADATA (Timeline Events):
${r.metadata.map(o=>`[${(o.time-r.metadata[0]?.time||0).toFixed(2)}s] ${o.description}`).join(`
`)}

Output format MUST exactly match this JSON schema:
{
  "cues": [
    {
      "start": "<number>",
      "end": "<number>",
      "query": "<descriptive prompt for text-to-audio model>",
      "type": "sfx",
      "scene": "<one sentence describing exactly what visual action or event is happening in the video at this time>",
      "reason": "<why this sound fits this scene>"
    }
  ]
}`;let n={};const a={"Content-Type":"application/json"};if(t==="gemini"){const o=r.frames.map(d=>({inlineData:{mimeType:"image/jpeg",data:v(d)}}));n={contents:[{parts:[{text:s},...o]}],generationConfig:{responseMimeType:"application/json",temperature:.4,maxOutputTokens:3e3}}}else{const o=r.frames.map(d=>({type:"image_url",image_url:{url:`data:image/jpeg;base64,${v(d)}`}}));n={model:A,messages:[{role:"system",content:"You are an expert Foley Artist and Sound Designer. You return only valid JSON."},{role:"user",content:[{type:"text",text:s},...o]}],response_format:{type:"json_schema",json_schema:{name:"canvas_cues_schema",strict:!1,schema:{type:"object",properties:{cues:{type:"array",items:{type:"object",properties:{start:{type:"number"},end:{type:"number"},query:{type:"string"},type:{type:"string"},scene:{type:"string"},reason:{type:"string"}},required:["start","end","query","type","scene","reason"]}}},required:["cues"]}}},temperature:.4,max_tokens:3e3}}const l=await x(o=>t==="groq"?(a.Authorization=`Bearer ${o}`,"https://api.groq.com/openai/v1/chat/completions"):`https://generativelanguage.googleapis.com/v1beta/models/${E}:generateContent?key=${o}`,{method:"POST",headers:a,body:JSON.stringify(n)},t);if(!l.ok){const o=await l.text();throw new Error(`[${t.toUpperCase()} API Error] ${l.status} - ${o}`)}const p=await l.json();let i="";t==="gemini"?i=p.candidates?.[0]?.content?.parts?.[0]?.text||"":i=p.choices?.[0]?.message?.content||"";try{const o=i.replace(/^```(json)?/m,"").replace(/```$/m,"").trim();return JSON.parse(o).cues||[]}catch{throw new Error(`Failed to parse ${t.toUpperCase()} response: ${i.substring(0,200)}`)}}async function X(r,e){const c=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=${e}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({contents:[{role:"user",parts:[{text:`You are an expert AI Video and Image prompt engineer. Enhance the following basic prompt into a highly detailed, cinematic, and professional prompt suitable for advanced AI video generators like Sora, Kling, or Midjourney. Focus on lighting, camera angles, atmosphere, and visual fidelity. Return ONLY the enhanced prompt string without any conversational filler or quotes.

User Prompt: ${r}`}]}]})});if(!c.ok)throw new Error("Failed to enhance prompt");return(await c.json()).candidates?.[0]?.content?.parts?.[0]?.text??""}function L(r){if(!r||typeof r!="string")throw new Error("Empty JSON string provided");let e=r.trim();e=e.replace(/^```(?:json)?\s*/i,"").replace(/\s*```$/i,"").trim();try{return JSON.parse(e)}catch{}e=e.replace(/([{,]\s*)([a-zA-Z0-9_$]+)\s*:/g,'$1"$2":'),e=e.replace(/,\s*([\]}])/g,"$1"),e=e.replace(/'([^'\\]*(\\.[^'\\]*)*)'/g,'"$1"');try{return JSON.parse(e)}catch{}let t=!1,c="";const s=[];for(let n=0;n<e.length;n++){const a=e[n],l=n>0?e[n-1]:"";(a==='"'||a==="'")&&l!=="\\"?t?a===c&&(t=!1):(t=!0,c=a):t||(a==="{"||a==="["?s.push(a==="{"?"}":"]"):(a==="}"||a==="]")&&s.length>0&&s[s.length-1]===a&&s.pop())}for(t&&(e+='"'),e=e.replace(/,\s*("[^"]*"?\s*:?\s*)?$/,"");s.length>0;)e+=s.pop();e=e.replace(/,\s*([\]}])/g,"$1");try{return JSON.parse(e)}catch(n){throw console.error("[aiClient] JSON repair failed. Snippet:",r.substring(0,300)),new Error(`Invalid response format from AI: ${n.message}`)}}async function V(r,e,t,c,s,n,a){const l="gemini-2.5-flash-lite",p=JSON.stringify(e.slice(0,200)),i=a==="vox_vintage",o=a==="vox_realistic",d=a==="ultra_realistic",w=a==="style_anime",m=a==="style_watercolor",h=a==="style_papercut",f=i?"vintage newspaper collage, halftone texture, aged paper, old magazine — NO people, pure background texture":o?"cinematic photograph, realistic background, moody lighting, no foreground subjects, photorealistic environment":d?"ultra realistic 4k cinematic stock footage description of a background setting or environment, no specific subjects, just scenery":w?"anime background art, detailed painterly environment, no characters, atmospheric":m?"watercolor painting background, loose brushstrokes, artistic texture, no subjects":h?"paper art installation background, layered paper textures, no subjects":"cinematic documentary background, moody lighting, high detail, no foreground subjects",y=i?"vintage cutout illustration, halftone print style, isolated object on solid pure #00FF00 green screen, no text":o?"photorealistic image, high quality photograph, isolated subject on solid pure #00FF00 green screen, clean edges":d?"short cinematic stock footage description of an object or subject, real life 4k video concept":w?"anime illustration, vibrant colors, isolated character or object on solid pure #00FF00 green screen":m?"watercolor illustration, artistic style, isolated subject on solid pure #00FF00 green screen":h?"paper cut art style, layered paper look, isolated subject on solid pure #00FF00 green screen":"realistic photo, isolated subject on solid pure #00FF00 green screen",N={contents:[{role:"user",parts:[{text:`${`You are an expert Vox-style documentary video director and AI image prompt engineer.

Script total audio duration: ${t.toFixed(1)} seconds. Word timestamps provided.

RETURN JSON with:
1. "storyTheme": One sentence — the overarching theme of the entire script.
2. "globalBackgrounds": Array of EXACTLY 2 objects {prompt}. Full-screen BACKDROP images only (no subjects). Style: ${f}
3. "scenes": One per 3–7 second segment summing to ${t.toFixed(1)}s total.
   Each scene: narration, startTime, endTime, duration (3-7s), selectedBackgroundIndex (0 or 1), pipItems (2-4 items).

PIP ITEM RULES — each pipItem must have:
- "source": either "ai_image" or "map"
- "prompt": For ai_image: AI generation prompt (${y}). For map: plain text location description (e.g. "Cairo, Egypt").
- "animDirection": ONE of: slideInLeft | slideInRight | zoomIn | zoomOut | floatUp | floatDown | kenBurns | pop | drift | rotate | none
  Choose based on the emotional direction of the narration (e.g. entering → slideInLeft, revealing → zoomIn, calm → kenBurns, dramatic → pop).
- "chromaHint": ONLY for ai_image sources — "green" if the image uses a #00FF00 green screen background (most cases), "blue" if blue screen, "none" if it is a realistic photo without a colour-key background.
- For map items: omit chromaHint (maps never have chroma key).
- For map items ONLY, also include:
  - "mapWaypoints": Array of {lat, lng, label?} objects (1-3 waypoints)
  - "mapZoom": integer zoom level (4=continent, 8=country, 12=city, 15=street)
  - "mapStyle": one of "standard", "satellite", "dark", "vintage"
  - "mapAnimType": one of "route", "flyTo", "highlight"

WHEN TO USE MAP SOURCE:
- Use source="map" when the narration mentions a specific country, city, region, route, territory, border, or geographic location.
- Use source="ai_image" for concepts, people, objects, ideas, and abstract topics.
- You may mix map and ai_image pipItems in the same scene.
- Every scene must have at least one ai_image pipItem.

GLOBAL RULES:
- globalBackgrounds = backdrops only. No subjects.
- Every scene needs 2-4 pipItems.
- Vary selectedBackgroundIndex based on emotional tone — choose a DIFFERENT background index when the narration theme shifts.
- Durations must sum to exactly ${t.toFixed(1)}s.
${s?`CUSTOM: ${s}`:""}
${n?`CHARACTER: ${n}`:""}
Return ONLY valid JSON.`}

Script:
${r}

Word Timestamps:
${p}`}]}],generationConfig:{responseMimeType:"application/json",responseSchema:{type:"OBJECT",properties:{storyTheme:{type:"STRING"},characterDescription:{type:"STRING"},globalBackgrounds:{type:"ARRAY",items:{type:"OBJECT",properties:{prompt:{type:"STRING"}},required:["prompt"]}},scenes:{type:"ARRAY",items:{type:"OBJECT",properties:{narration:{type:"STRING"},startTime:{type:"NUMBER"},endTime:{type:"NUMBER"},duration:{type:"NUMBER"},selectedBackgroundIndex:{type:"INTEGER"},pipItems:{type:"ARRAY",items:{type:"OBJECT",properties:{source:{type:"STRING",enum:["ai_image","map"]},prompt:{type:"STRING"},animDirection:{type:"STRING",enum:["slideInLeft","slideInRight","zoomIn","zoomOut","floatUp","floatDown","kenBurns","pop","drift","rotate","none"]},chromaHint:{type:"STRING",enum:["green","blue","none"]},mapZoom:{type:"INTEGER"},mapStyle:{type:"STRING"},mapAnimType:{type:"STRING"},mapWaypoints:{type:"ARRAY",items:{type:"OBJECT",properties:{lat:{type:"NUMBER"},lng:{type:"NUMBER"},label:{type:"STRING"}},required:["lat","lng"]}}},required:["source","prompt","animDirection","chromaHint"]}}},required:["narration","startTime","endTime","duration","selectedBackgroundIndex","pipItems"]}}},required:["storyTheme","globalBackgrounds","scenes"]},temperature:.3,maxOutputTokens:8192}},b=await x(u=>`https://generativelanguage.googleapis.com/v1beta/models/${l}:generateContent?key=${u}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(N)},"gemini");if(!b.ok){const u=await b.text();throw new Error(`Failed to generate V2 blueprint: ${u}`)}const I=(await b.json()).candidates?.[0]?.content?.parts?.[0]?.text??"{}";try{const u=L(I);(!u.globalBackgrounds||u.globalBackgrounds.length<2)&&(u.globalBackgrounds=[{prompt:u.globalBackgrounds?.[0]?.prompt||"cinematic documentary background, high detail, moody lighting"},{prompt:i?"vintage newspaper collage, halftone dots, aged paper texture":"modern documentary set, soft bokeh, studio lighting"}]);const R=(u.scenes||[]).reduce((T,O)=>T+(O.duration||5),0),F=R>0?t/R:1;let $=0;return u.scenes=(u.scenes||[]).map(T=>{const O=Math.min(7,Math.max(3,(T.duration||5)*F)),_={...T,startTime:$,duration:parseFloat(O.toFixed(2)),endTime:parseFloat(($+O).toFixed(2)),selectedBackgroundIndex:Math.max(0,Math.min(u.globalBackgrounds.length-1,T.selectedBackgroundIndex??0)),pipItems:(T.pipItems||[]).slice(0,4).map(g=>({...g,source:g.source==="map"?"map":"ai_image",animDirection:g.animDirection??"floatUp",chromaHint:g.source==="map"?"none":g.chromaHint??"green",mapZoom:g.source==="map"?g.mapZoom??8:void 0,mapStyle:g.source==="map"?g.mapStyle??"standard":void 0,mapAnimType:g.source==="map"?g.mapAnimType??"flyTo":void 0,mapWaypoints:g.source==="map"?g.mapWaypoints??[{lat:0,lng:0,label:g.prompt}]:void 0}))};return $+=O,_}),u}catch(u){throw console.error("V2 blueprint parse error:",I.substring(0,500)),new Error(`AI returned invalid V2 blueprint: ${u.message}`)}}const K=Object.freeze(Object.defineProperty({__proto__:null},Symbol.toStringTag,{value:"Module"}));export{H as a,V as b,z as c,Y as d,X as e,J as f,U as g,W as h,D as r,K as t};
