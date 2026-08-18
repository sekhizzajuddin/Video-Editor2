const y={enabled:!1,mode:"removeVocals",strength:80,frequencyBands:{low:100,mid:100,high:100}};function A(e){return!e||!e.vocalSeparation?y:{...y,...e.vocalSeparation}}async function x(e,t){if(e.audioWorklet)try{const o=URL.createObjectURL(new Blob([b],{type:"application/javascript"}));await e.audioWorklet.addModule(o),URL.revokeObjectURL(o);const n=new AudioWorkletNode(e,"vocal-separation-processor",{numberOfInputs:1,numberOfOutputs:1,outputChannelCount:[2],channelCount:2});return m(n,"mode",t.mode),m(n,"strength",t.strength/100),t.frequencyBands&&(m(n,"lowBand",t.frequencyBands.low/100),m(n,"midBand",t.frequencyBands.mid/100),m(n,"highBand",t.frequencyBands.high/100)),n}catch(o){console.warn("AudioWorklet separation failed, falling back to ScriptProcessor:",o)}return S(e,t)}function m(e,t,o){if(!e||!e.parameters)return;const n=e.parameters.get?.(t);n&&typeof o=="number"&&n.setValueAtTime(o,e.context.currentTime),e.port.postMessage({type:"setParam",name:t,value:o})}function S(e,t){const n=e.createScriptProcessor(4096,2,2);let i=t.mode,a=t.strength/100,l=(t.frequencyBands?.low??100)/100,g=(t.frequencyBands?.mid??100)/100;return(t.frequencyBands?.high??100)/100,n.onaudioprocess=s=>{const v=s.inputBuffer.numberOfChannels===1,w=s.outputBuffer.numberOfChannels===1,h=s.inputBuffer.getChannelData(0),V=v?h:s.inputBuffer.getChannelData(1),B=s.outputBuffer.getChannelData(0),L=w?B:s.outputBuffer.getChannelData(1);if(v){B.set(h),w||L.set(V);return}for(let u=0;u<h.length;u++){const R=h[u],M=V[u],c=(R+M)*.5,d=(R-M)*.5;let p,f;if(i==="removeVocals"){const r=1-a;p=d+c*r*l,f=-d+c*r*l}else if(i==="removeBgm"){const r=1-a;p=c+d*r*g,f=c-d*r*g}else{const r=1-a*.5;p=c*a+d*r,f=c*a-d*r}B[u]=p,L[u]=f}},n}const b=`
class VocalSeparationProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: 'mode', defaultValue: 0, minValue: 0, maxValue: 2 }, // 0=removeVocals, 1=removeBgm, 2=separateBoth
      { name: 'strength', defaultValue: 0.8, minValue: 0, maxValue: 1 },
      { name: 'lowBand', defaultValue: 1.0, minValue: 0, maxValue: 1 },
      { name: 'midBand', defaultValue: 1.0, minValue: 0, maxValue: 1 },
      { name: 'highBand', defaultValue: 1.0, minValue: 0, maxValue: 1 }
    ];
  }

  constructor() {
    super();
    this.mode = 0;
    this.strength = 0.8;
    this.lowBand = 1.0;
    this.midBand = 1.0;
    this.highBand = 1.0;

    this.port.onmessage = (e) => {
      if (e.data.type === 'setParam') {
        if (e.data.name === 'mode') {
          const modes = ['removeVocals', 'removeBgm', 'separateBoth'];
          this.mode = modes.indexOf(e.data.value);
          if (this.mode < 0) this.mode = 0;
        } else if (e.data.name === 'strength') {
          this.strength = e.data.value;
        } else if (e.data.name === 'lowBand') {
          this.lowBand = e.data.value;
        } else if (e.data.name === 'midBand') {
          this.midBand = e.data.value;
        } else if (e.data.name === 'highBand') {
          this.highBand = e.data.value;
        }
      }
    };
  }

  process(inputs, outputs) {
    const input = inputs[0];
    const output = outputs[0];
    if (!input || input.length === 0 || !output || output.length === 0) return true;

    const isMono = input.length === 1;
    const isOutMono = output.length === 1;
    
    const inputL = input[0];
    const inputR = isMono ? input[0] : input[1];
    const outputL = output[0];
    const outputR = isOutMono ? output[0] : output[1];

    if (isMono) {
      for (let i = 0; i < inputL.length; i++) {
        outputL[i] = inputL[i];
        if (!isOutMono) outputR[i] = inputR[i];
      }
      return true;
    }

    const mode = this.mode;
    const strength = this.strength;
    const lowBand = this.lowBand;

    for (let i = 0; i < inputL.length; i++) {
      const l = inputL[i];
      const r = inputR[i];

      const mid = (l + r) * 0.5;
      const side = (l - r) * 0.5;

      let outL, outR;

      if (mode === 0) { // removeVocals
        const midAtten = 1.0 - strength;
        outL = side * 2.0 + mid * midAtten * lowBand;
        outR = -side * 2.0 + mid * midAtten * lowBand;
      } else if (mode === 1) { // removeBgm
        const sideAtten = 1.0 - strength;
        outL = mid + side * sideAtten * this.midBand;
        outR = mid - side * sideAtten * this.midBand;
      } else { // separateBoth
        const mix = 1.0 - strength * 0.5;
        outL = mid * strength + side * mix;
        outR = mid * strength - side * mix;
      }

      outputL[i] = outL;
      outputR[i] = outR;
    }

    return true;
  }
}

registerProcessor('vocal-separation-processor', VocalSeparationProcessor);
`;function O(e){if(!e.enabled)return[];const t=[],o=e.strength/100;if(e.mode==="removeVocals"){const n=1-o,i=.5*(1+n),a=.5*(1-n);t.push("-af",`pan=stereo|c0=${i}*c0-${a}*c1|c1=-${a}*c0+${i}*c1`)}else if(e.mode==="removeBgm"){const n=1-o;t.push("-af",`pan=stereo|c0=0.5*c0+0.5*c1+${n}*0.5*c0-${n}*0.5*c1|c1=0.5*c0+0.5*c1-${n}*0.5*c0+${n}*0.5*c1`)}else t.push("-af",`pan=stereo|c0=${o}*c0+(1-${o})*c1|c1=${o}*c1+(1-${o})*c0`);return t}function $(e){if(!e.enabled||!e.frequencyBands)return[];const{low:t,mid:o,high:n}=e.frequencyBands,i=t/100,a=o/100,l=n/100;return["-af",`crossover=f=200:order=4[low][midhigh];[midhigh]crossover=f=3000:order=4[mid][high];[low]volume=${i}[low_mod];[mid]volume=${a}[mid_mod];[high]volume=${l}[high_mod];[low_mod][mid_mod][high_mod]amix=inputs=3`]}function q(e){return{enabled:e.enabled??!1,mode:e.mode??"removeVocals",strength:Math.max(0,Math.min(100,e.strength??80)),frequencyBands:{low:Math.max(0,Math.min(100,e.frequencyBands?.low??100)),mid:Math.max(0,Math.min(100,e.frequencyBands?.mid??100)),high:Math.max(0,Math.min(100,e.frequencyBands?.high??100))}}}function k(e){switch(e){case"removeVocals":return"Remove Vocals (Keep BGM)";case"removeBgm":return"Remove BGM (Keep Vocals)";case"separateBoth":return"Separate Both";default:return"Unknown"}}export{x as createSeparationNode,$ as getFFmpegBandSeparationArgs,O as getFFmpegSeparationArgs,k as getSeparationModeLabel,A as getSeparationSettings,q as sanitizeSeparationSettings,m as updateSeparationParam};
