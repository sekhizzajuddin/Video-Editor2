const Dy="modulepreload",Py=function(e){return"/"+e},hu={},fu=function(t,r,a){let n=Promise.resolve();if(r&&r.length>0){let d=function(c){return Promise.all(c.map(h=>Promise.resolve(h).then(u=>({status:"fulfilled",value:u}),u=>({status:"rejected",reason:u}))))};document.getElementsByTagName("link");const s=document.querySelector("meta[property=csp-nonce]"),o=s?.nonce||s?.getAttribute("nonce");n=d(r.map(c=>{if(c=Py(c),c in hu)return;hu[c]=!0;const h=c.endsWith(".css"),u=h?'[rel="stylesheet"]':"";if(document.querySelector(`link[href="${c}"]${u}`))return;const f=document.createElement("link");if(f.rel=h?"stylesheet":Dy,h||(f.as="script"),f.crossOrigin="",f.href=c,o&&f.setAttribute("nonce",o),document.head.appendChild(f),h)return new Promise((m,_)=>{f.addEventListener("load",m),f.addEventListener("error",()=>_(new Error(`Unable to preload CSS for ${c}`)))})}))}function i(s){const o=new Event("vite:preloadError",{cancelable:!0});if(o.payload=s,window.dispatchEvent(o),!o.defaultPrevented)throw s}return n.then(s=>{for(const o of s||[])o.status==="rejected"&&i(o.reason);return t().catch(i)})};var ds=Object.defineProperty,Uy=Object.getOwnPropertyDescriptor,jy=Object.getOwnPropertyNames,Ly=Object.prototype.hasOwnProperty,Vy=(e=>typeof require<"u"?require:typeof Proxy<"u"?new Proxy(e,{get:(t,r)=>(typeof require<"u"?require:t)[r]}):e)(function(e){if(typeof require<"u")return require.apply(this,arguments);throw Error('Dynamic require of "'+e+'" is not supported')}),j=(e,t)=>()=>(e&&(t=e(e=0)),t),da=(e,t)=>{for(var r in t)ds(e,r,{get:t[r],enumerable:!0})},Wy=(e,t,r,a)=>{if(t&&typeof t=="object"||typeof t=="function")for(let n of jy(t))!Ly.call(e,n)&&n!==r&&ds(e,n,{get:()=>t[n],enumerable:!(a=Uy(t,n))||a.enumerable});return e},Wa=e=>Wy(ds({},"__esModule",{value:!0}),e),Sr,At,Gt,mu,ap,np=j(()=>{Sr=new Map,At=[],Gt=(e,t,r)=>{if(t&&typeof t.init=="function"&&typeof t.createInferenceSessionHandler=="function"){let a=Sr.get(e);if(a===void 0)Sr.set(e,{backend:t,priority:r});else{if(a.priority>r)return;if(a.priority===r&&a.backend!==t)throw new Error(`cannot register backend "${e}" using priority ${r}`)}if(r>=0){let n=At.indexOf(e);n!==-1&&At.splice(n,1);for(let i=0;i<At.length;i++)if(Sr.get(At[i]).priority<=r){At.splice(i,0,e);return}At.push(e)}return}throw new TypeError("not a valid backend")},mu=async e=>{let t=Sr.get(e);if(!t)return"backend not found.";if(t.initialized)return t.backend;if(t.aborted)return t.error;{let r=!!t.initPromise;try{return r||(t.initPromise=t.backend.init(e)),await t.initPromise,t.initialized=!0,t.backend}catch(a){return r||(t.error=`${a}`,t.aborted=!0),t.error}finally{delete t.initPromise}}},ap=async e=>{let t=e.executionProviders||[],r=t.map(d=>typeof d=="string"?d:d.name),a=r.length===0?At:r,n,i=[],s=new Set;for(let d of a){let c=await mu(d);typeof c=="string"?i.push({name:d,err:c}):(n||(n=c),n===c&&s.add(d))}if(!n)throw new Error(`no available backend found. ERR: ${i.map(d=>`[${d.name}] ${d.err}`).join(", ")}`);for(let{name:d,err:c}of i)r.includes(d)&&console.warn(`removing requested execution provider "${d}" from session options because it is not available: ${c}`);let o=t.filter(d=>s.has(typeof d=="string"?d:d.name));return[n,new Proxy(e,{get:(d,c)=>c==="executionProviders"?o:Reflect.get(d,c)})]}}),qy=j(()=>{np()}),ip,Fy=j(()=>{ip="1.21.0-dev.20250206-d981b153d3"}),Dn,Ke,sp=j(()=>{Fy(),Dn="warning",Ke={wasm:{},webgl:{},webgpu:{},versions:{common:ip},set logLevel(e){if(e!==void 0){if(typeof e!="string"||["verbose","info","warning","error","fatal"].indexOf(e)===-1)throw new Error(`Unsupported logging level: ${e}`);Dn=e}},get logLevel(){return Dn}},Object.defineProperty(Ke,"logLevel",{enumerable:!0})}),Se,Hy=j(()=>{sp(),Se=Ke}),op,up,Gy=j(()=>{op=(e,t)=>{let r=typeof document<"u"?document.createElement("canvas"):new OffscreenCanvas(1,1);r.width=e.dims[3],r.height=e.dims[2];let a=r.getContext("2d");if(a!=null){let n,i;t?.tensorLayout!==void 0&&t.tensorLayout==="NHWC"?(n=e.dims[2],i=e.dims[3]):(n=e.dims[3],i=e.dims[2]);let s=t?.format!==void 0?t.format:"RGB",o=t?.norm,d,c;o===void 0||o.mean===void 0?d=[255,255,255,255]:typeof o.mean=="number"?d=[o.mean,o.mean,o.mean,o.mean]:(d=[o.mean[0],o.mean[1],o.mean[2],0],o.mean[3]!==void 0&&(d[3]=o.mean[3])),o===void 0||o.bias===void 0?c=[0,0,0,0]:typeof o.bias=="number"?c=[o.bias,o.bias,o.bias,o.bias]:(c=[o.bias[0],o.bias[1],o.bias[2],0],o.bias[3]!==void 0&&(c[3]=o.bias[3]));let h=i*n,u=0,f=h,m=h*2,_=-1;s==="RGBA"?(u=0,f=h,m=h*2,_=h*3):s==="RGB"?(u=0,f=h,m=h*2):s==="RBG"&&(u=0,m=h,f=h*2);for(let g=0;g<i;g++)for(let w=0;w<n;w++){let x=(e.data[u++]-c[0])*d[0],b=(e.data[f++]-c[1])*d[1],k=(e.data[m++]-c[2])*d[2],S=_===-1?255:(e.data[_++]-c[3])*d[3];a.fillStyle="rgba("+x+","+b+","+k+","+S+")",a.fillRect(w,g,1,1)}if("toDataURL"in r)return r.toDataURL();throw new Error("toDataURL is not supported")}else throw new Error("Can not access image data")},up=(e,t)=>{let r=typeof document<"u"?document.createElement("canvas").getContext("2d"):new OffscreenCanvas(1,1).getContext("2d"),a;if(r!=null){let n,i,s;t?.tensorLayout!==void 0&&t.tensorLayout==="NHWC"?(n=e.dims[2],i=e.dims[1],s=e.dims[3]):(n=e.dims[3],i=e.dims[2],s=e.dims[1]);let o=t!==void 0&&t.format!==void 0?t.format:"RGB",d=t?.norm,c,h;d===void 0||d.mean===void 0?c=[255,255,255,255]:typeof d.mean=="number"?c=[d.mean,d.mean,d.mean,d.mean]:(c=[d.mean[0],d.mean[1],d.mean[2],255],d.mean[3]!==void 0&&(c[3]=d.mean[3])),d===void 0||d.bias===void 0?h=[0,0,0,0]:typeof d.bias=="number"?h=[d.bias,d.bias,d.bias,d.bias]:(h=[d.bias[0],d.bias[1],d.bias[2],0],d.bias[3]!==void 0&&(h[3]=d.bias[3]));let u=i*n;if(t!==void 0&&(t.format!==void 0&&s===4&&t.format!=="RGBA"||s===3&&t.format!=="RGB"&&t.format!=="BGR"))throw new Error("Tensor format doesn't match input tensor dims");let f=4,m=0,_=1,g=2,w=3,x=0,b=u,k=u*2,S=-1;o==="RGBA"?(x=0,b=u,k=u*2,S=u*3):o==="RGB"?(x=0,b=u,k=u*2):o==="RBG"&&(x=0,k=u,b=u*2),a=r.createImageData(n,i);for(let T=0;T<i*n;m+=f,_+=f,g+=f,w+=f,T++)a.data[m]=(e.data[x++]-h[0])*c[0],a.data[_]=(e.data[b++]-h[1])*c[1],a.data[g]=(e.data[k++]-h[2])*c[2],a.data[w]=S===-1?255:(e.data[S++]-h[3])*c[3]}else throw new Error("Can not access image data");return a}}),Sa,lp,dp,cp,pp,hp,Zy=j(()=>{cs(),Sa=(e,t)=>{if(e===void 0)throw new Error("Image buffer must be defined");if(t.height===void 0||t.width===void 0)throw new Error("Image height and width must be defined");if(t.tensorLayout==="NHWC")throw new Error("NHWC Tensor layout is not supported yet");let{height:r,width:a}=t,n=t.norm??{mean:255,bias:0},i,s;typeof n.mean=="number"?i=[n.mean,n.mean,n.mean,n.mean]:i=[n.mean[0],n.mean[1],n.mean[2],n.mean[3]??255],typeof n.bias=="number"?s=[n.bias,n.bias,n.bias,n.bias]:s=[n.bias[0],n.bias[1],n.bias[2],n.bias[3]??0];let o=t.format!==void 0?t.format:"RGBA",d=t.tensorFormat!==void 0&&t.tensorFormat!==void 0?t.tensorFormat:"RGB",c=r*a,h=d==="RGBA"?new Float32Array(c*4):new Float32Array(c*3),u=4,f=0,m=1,_=2,g=3,w=0,x=c,b=c*2,k=-1;o==="RGB"&&(u=3,f=0,m=1,_=2,g=-1),d==="RGBA"?k=c*3:d==="RBG"?(w=0,b=c,x=c*2):d==="BGR"&&(b=0,x=c,w=c*2);for(let S=0;S<c;S++,f+=u,_+=u,m+=u,g+=u)h[w++]=(e[f]+s[0])/i[0],h[x++]=(e[m]+s[1])/i[1],h[b++]=(e[_]+s[2])/i[2],k!==-1&&g!==-1&&(h[k++]=(e[g]+s[3])/i[3]);return d==="RGBA"?new Fe("float32",h,[1,4,r,a]):new Fe("float32",h,[1,3,r,a])},lp=async(e,t)=>{let r=typeof HTMLImageElement<"u"&&e instanceof HTMLImageElement,a=typeof ImageData<"u"&&e instanceof ImageData,n=typeof ImageBitmap<"u"&&e instanceof ImageBitmap,i=typeof e=="string",s,o=t??{},d=()=>{if(typeof document<"u")return document.createElement("canvas");if(typeof OffscreenCanvas<"u")return new OffscreenCanvas(1,1);throw new Error("Canvas is not supported")},c=h=>typeof HTMLCanvasElement<"u"&&h instanceof HTMLCanvasElement||h instanceof OffscreenCanvas?h.getContext("2d"):null;if(r){let h=d();h.width=e.width,h.height=e.height;let u=c(h);if(u!=null){let f=e.height,m=e.width;if(t!==void 0&&t.resizedHeight!==void 0&&t.resizedWidth!==void 0&&(f=t.resizedHeight,m=t.resizedWidth),t!==void 0){if(o=t,t.tensorFormat!==void 0)throw new Error("Image input config format must be RGBA for HTMLImageElement");o.tensorFormat="RGBA",o.height=f,o.width=m}else o.tensorFormat="RGBA",o.height=f,o.width=m;u.drawImage(e,0,0),s=u.getImageData(0,0,m,f).data}else throw new Error("Can not access image data")}else if(a){let h,u;if(t!==void 0&&t.resizedWidth!==void 0&&t.resizedHeight!==void 0?(h=t.resizedHeight,u=t.resizedWidth):(h=e.height,u=e.width),t!==void 0&&(o=t),o.format="RGBA",o.height=h,o.width=u,t!==void 0){let f=d();f.width=u,f.height=h;let m=c(f);if(m!=null)m.putImageData(e,0,0),s=m.getImageData(0,0,u,h).data;else throw new Error("Can not access image data")}else s=e.data}else if(n){if(t===void 0)throw new Error("Please provide image config with format for Imagebitmap");let h=d();h.width=e.width,h.height=e.height;let u=c(h);if(u!=null){let f=e.height,m=e.width;return u.drawImage(e,0,0,m,f),s=u.getImageData(0,0,m,f).data,o.height=f,o.width=m,Sa(s,o)}else throw new Error("Can not access image data")}else{if(i)return new Promise((h,u)=>{let f=d(),m=c(f);if(!e||!m)return u();let _=new Image;_.crossOrigin="Anonymous",_.src=e,_.onload=()=>{f.width=_.width,f.height=_.height,m.drawImage(_,0,0,f.width,f.height);let g=m.getImageData(0,0,f.width,f.height);o.height=f.height,o.width=f.width,h(Sa(g.data,o))}});throw new Error("Input data provided is not supported - aborted tensor creation")}if(s!==void 0)return Sa(s,o);throw new Error("Input data provided is not supported - aborted tensor creation")},dp=(e,t)=>{let{width:r,height:a,download:n,dispose:i}=t,s=[1,a,r,4];return new Fe({location:"texture",type:"float32",texture:e,dims:s,download:n,dispose:i})},cp=(e,t)=>{let{dataType:r,dims:a,download:n,dispose:i}=t;return new Fe({location:"gpu-buffer",type:r??"float32",gpuBuffer:e,dims:a,download:n,dispose:i})},pp=(e,t)=>{let{dataType:r,dims:a,download:n,dispose:i}=t;return new Fe({location:"ml-tensor",type:r??"float32",mlTensor:e,dims:a,download:n,dispose:i})},hp=(e,t,r)=>new Fe({location:"cpu-pinned",type:e,data:t,dims:r??[t.length]})}),Ft,Br,Pn,fp,Ky=j(()=>{Ft=new Map([["float32",Float32Array],["uint8",Uint8Array],["int8",Int8Array],["uint16",Uint16Array],["int16",Int16Array],["int32",Int32Array],["bool",Uint8Array],["float64",Float64Array],["uint32",Uint32Array],["int4",Uint8Array],["uint4",Uint8Array]]),Br=new Map([[Float32Array,"float32"],[Uint8Array,"uint8"],[Int8Array,"int8"],[Uint16Array,"uint16"],[Int16Array,"int16"],[Int32Array,"int32"],[Float64Array,"float64"],[Uint32Array,"uint32"]]),Pn=!1,fp=()=>{if(!Pn){Pn=!0;let e=typeof BigInt64Array<"u"&&BigInt64Array.from,t=typeof BigUint64Array<"u"&&BigUint64Array.from,r=typeof Float16Array<"u"&&Float16Array.from;e&&(Ft.set("int64",BigInt64Array),Br.set(BigInt64Array,"int64")),t&&(Ft.set("uint64",BigUint64Array),Br.set(BigUint64Array,"uint64")),r?(Ft.set("float16",Float16Array),Br.set(Float16Array,"float16")):Ft.set("float16",Uint16Array)}}}),mp,gp,Qy=j(()=>{cs(),mp=e=>{let t=1;for(let r=0;r<e.length;r++){let a=e[r];if(typeof a!="number"||!Number.isSafeInteger(a))throw new TypeError(`dims[${r}] must be an integer, got: ${a}`);if(a<0)throw new RangeError(`dims[${r}] must be a non-negative integer, got: ${a}`);t*=a}return t},gp=(e,t)=>{switch(e.location){case"cpu":return new Fe(e.type,e.data,t);case"cpu-pinned":return new Fe({location:"cpu-pinned",data:e.data,type:e.type,dims:t});case"texture":return new Fe({location:"texture",texture:e.texture,type:e.type,dims:t});case"gpu-buffer":return new Fe({location:"gpu-buffer",gpuBuffer:e.gpuBuffer,type:e.type,dims:t});case"ml-tensor":return new Fe({location:"ml-tensor",mlTensor:e.mlTensor,type:e.type,dims:t});default:throw new Error(`tensorReshape: tensor location ${e.location} is not supported`)}}}),Fe,cs=j(()=>{Gy(),Zy(),Ky(),Qy(),Fe=class{constructor(e,t,r){fp();let a,n;if(typeof e=="object"&&"location"in e)switch(this.dataLocation=e.location,a=e.type,n=e.dims,e.location){case"cpu-pinned":{let s=Ft.get(a);if(!s)throw new TypeError(`unsupported type "${a}" to create tensor from pinned buffer`);if(!(e.data instanceof s))throw new TypeError(`buffer should be of type ${s.name}`);this.cpuData=e.data;break}case"texture":{if(a!=="float32")throw new TypeError(`unsupported type "${a}" to create tensor from texture`);this.gpuTextureData=e.texture,this.downloader=e.download,this.disposer=e.dispose;break}case"gpu-buffer":{if(a!=="float32"&&a!=="float16"&&a!=="int32"&&a!=="int64"&&a!=="uint32"&&a!=="uint8"&&a!=="bool"&&a!=="uint4"&&a!=="int4")throw new TypeError(`unsupported type "${a}" to create tensor from gpu buffer`);this.gpuBufferData=e.gpuBuffer,this.downloader=e.download,this.disposer=e.dispose;break}case"ml-tensor":{if(a!=="float32"&&a!=="float16"&&a!=="int32"&&a!=="int64"&&a!=="uint32"&&a!=="uint64"&&a!=="int8"&&a!=="uint8"&&a!=="bool"&&a!=="uint4"&&a!=="int4")throw new TypeError(`unsupported type "${a}" to create tensor from MLTensor`);this.mlTensorData=e.mlTensor,this.downloader=e.download,this.disposer=e.dispose;break}default:throw new Error(`Tensor constructor: unsupported location '${this.dataLocation}'`)}else{let s,o;if(typeof e=="string")if(a=e,o=r,e==="string"){if(!Array.isArray(t))throw new TypeError("A string tensor's data must be a string array.");s=t}else{let d=Ft.get(e);if(d===void 0)throw new TypeError(`Unsupported tensor type: ${e}.`);if(Array.isArray(t)){if(e==="float16"&&d===Uint16Array||e==="uint4"||e==="int4")throw new TypeError(`Creating a ${e} tensor from number array is not supported. Please use ${d.name} as data.`);e==="uint64"||e==="int64"?s=d.from(t,BigInt):s=d.from(t)}else if(t instanceof d)s=t;else if(t instanceof Uint8ClampedArray)if(e==="uint8")s=Uint8Array.from(t);else throw new TypeError("A Uint8ClampedArray tensor's data must be type of uint8");else throw new TypeError(`A ${a} tensor's data must be type of ${d}`)}else if(o=t,Array.isArray(e)){if(e.length===0)throw new TypeError("Tensor type cannot be inferred from an empty array.");let d=typeof e[0];if(d==="string")a="string",s=e;else if(d==="boolean")a="bool",s=Uint8Array.from(e);else throw new TypeError(`Invalid element type of data array: ${d}.`)}else if(e instanceof Uint8ClampedArray)a="uint8",s=Uint8Array.from(e);else{let d=Br.get(e.constructor);if(d===void 0)throw new TypeError(`Unsupported type for tensor data: ${e.constructor}.`);a=d,s=e}if(o===void 0)o=[s.length];else if(!Array.isArray(o))throw new TypeError("A tensor's dims must be a number array");n=o,this.cpuData=s,this.dataLocation="cpu"}let i=mp(n);if(this.cpuData&&i!==this.cpuData.length&&!((a==="uint4"||a==="int4")&&Math.ceil(i/2)===this.cpuData.length))throw new Error(`Tensor's size(${i}) does not match data length(${this.cpuData.length}).`);this.type=a,this.dims=n,this.size=i}static async fromImage(e,t){return lp(e,t)}static fromTexture(e,t){return dp(e,t)}static fromGpuBuffer(e,t){return cp(e,t)}static fromMLTensor(e,t){return pp(e,t)}static fromPinnedBuffer(e,t,r){return hp(e,t,r)}toDataURL(e){return op(this,e)}toImageData(e){return up(this,e)}get data(){if(this.ensureValid(),!this.cpuData)throw new Error("The data is not on CPU. Use `getData()` to download GPU data to CPU, or use `texture` or `gpuBuffer` property to access the GPU data directly.");return this.cpuData}get location(){return this.dataLocation}get texture(){if(this.ensureValid(),!this.gpuTextureData)throw new Error("The data is not stored as a WebGL texture.");return this.gpuTextureData}get gpuBuffer(){if(this.ensureValid(),!this.gpuBufferData)throw new Error("The data is not stored as a WebGPU buffer.");return this.gpuBufferData}get mlTensor(){if(this.ensureValid(),!this.mlTensorData)throw new Error("The data is not stored as a WebNN MLTensor.");return this.mlTensorData}async getData(e){switch(this.ensureValid(),this.dataLocation){case"cpu":case"cpu-pinned":return this.data;case"texture":case"gpu-buffer":case"ml-tensor":{if(!this.downloader)throw new Error("The current tensor is not created with a specified data downloader.");if(this.isDownloading)throw new Error("The current tensor is being downloaded.");try{this.isDownloading=!0;let t=await this.downloader();return this.downloader=void 0,this.dataLocation="cpu",this.cpuData=t,e&&this.disposer&&(this.disposer(),this.disposer=void 0),t}finally{this.isDownloading=!1}}default:throw new Error(`cannot get data from location: ${this.dataLocation}`)}}dispose(){if(this.isDownloading)throw new Error("The current tensor is being downloaded.");this.disposer&&(this.disposer(),this.disposer=void 0),this.cpuData=void 0,this.gpuTextureData=void 0,this.gpuBufferData=void 0,this.mlTensorData=void 0,this.downloader=void 0,this.isDownloading=void 0,this.dataLocation="none"}ensureValid(){if(this.dataLocation==="none")throw new Error("The tensor is disposed.")}reshape(e){if(this.ensureValid(),this.downloader||this.disposer)throw new Error("Cannot reshape a tensor that owns GPU resource.");return gp(this,e)}}}),nt,yp=j(()=>{cs(),nt=Fe}),Fr,Un,st,Qe,_p=j(()=>{sp(),Fr=(e,t)=>{(typeof Ke.trace>"u"?!Ke.wasm.trace:!Ke.trace)||console.timeStamp(`${e}::ORT::${t}`)},Un=(e,t)=>{let r=new Error().stack?.split(/\r\n|\r|\n/g)||[],a=!1;for(let n=0;n<r.length;n++){if(a&&!r[n].includes("TRACE_FUNC")){let i=`FUNC_${e}::${r[n].trim().split(" ")[1]}`;t&&(i+=`::${t}`),Fr("CPU",i);return}r[n].includes("TRACE_FUNC")&&(a=!0)}},st=e=>{(typeof Ke.trace>"u"?!Ke.wasm.trace:!Ke.trace)||Un("BEGIN",e)},Qe=e=>{(typeof Ke.trace>"u"?!Ke.wasm.trace:!Ke.trace)||Un("END",e)}}),vp,Yy=j(()=>{np(),yp(),_p(),vp=class bp{constructor(t){this.handler=t}async run(t,r,a){st();let n={},i={};if(typeof t!="object"||t===null||t instanceof nt||Array.isArray(t))throw new TypeError("'feeds' must be an object that use input names as keys and OnnxValue as corresponding values.");let s=!0;if(typeof r=="object"){if(r===null)throw new TypeError("Unexpected argument[1]: cannot be null.");if(r instanceof nt)throw new TypeError("'fetches' cannot be a Tensor");if(Array.isArray(r)){if(r.length===0)throw new TypeError("'fetches' cannot be an empty array.");s=!1;for(let c of r){if(typeof c!="string")throw new TypeError("'fetches' must be a string array or an object.");if(this.outputNames.indexOf(c)===-1)throw new RangeError(`'fetches' contains invalid output name: ${c}.`);n[c]=null}if(typeof a=="object"&&a!==null)i=a;else if(typeof a<"u")throw new TypeError("'options' must be an object.")}else{let c=!1,h=Object.getOwnPropertyNames(r);for(let u of this.outputNames)if(h.indexOf(u)!==-1){let f=r[u];(f===null||f instanceof nt)&&(c=!0,s=!1,n[u]=f)}if(c){if(typeof a=="object"&&a!==null)i=a;else if(typeof a<"u")throw new TypeError("'options' must be an object.")}else i=r}}else if(typeof r<"u")throw new TypeError("Unexpected argument[1]: must be 'fetches' or 'options'.");for(let c of this.inputNames)if(typeof t[c]>"u")throw new Error(`input '${c}' is missing in 'feeds'.`);if(s)for(let c of this.outputNames)n[c]=null;let o=await this.handler.run(t,n,i),d={};for(let c in o)if(Object.hasOwnProperty.call(o,c)){let h=o[c];h instanceof nt?d[c]=h:d[c]=new nt(h.type,h.data,h.dims)}return Qe(),d}async release(){return this.handler.dispose()}static async create(t,r,a,n){st();let i,s={};if(typeof t=="string"){if(i=t,typeof r=="object"&&r!==null)s=r;else if(typeof r<"u")throw new TypeError("'options' must be an object.")}else if(t instanceof Uint8Array){if(i=t,typeof r=="object"&&r!==null)s=r;else if(typeof r<"u")throw new TypeError("'options' must be an object.")}else if(t instanceof ArrayBuffer||typeof SharedArrayBuffer<"u"&&t instanceof SharedArrayBuffer){let h=t,u=0,f=t.byteLength;if(typeof r=="object"&&r!==null)s=r;else if(typeof r=="number"){if(u=r,!Number.isSafeInteger(u))throw new RangeError("'byteOffset' must be an integer.");if(u<0||u>=h.byteLength)throw new RangeError(`'byteOffset' is out of range [0, ${h.byteLength}).`);if(f=t.byteLength-u,typeof a=="number"){if(f=a,!Number.isSafeInteger(f))throw new RangeError("'byteLength' must be an integer.");if(f<=0||u+f>h.byteLength)throw new RangeError(`'byteLength' is out of range (0, ${h.byteLength-u}].`);if(typeof n=="object"&&n!==null)s=n;else if(typeof n<"u")throw new TypeError("'options' must be an object.")}else if(typeof a<"u")throw new TypeError("'byteLength' must be a number.")}else if(typeof r<"u")throw new TypeError("'options' must be an object.");i=new Uint8Array(h,u,f)}else throw new TypeError("Unexpected argument[0]: must be 'path' or 'buffer'.");let[o,d]=await ap(s),c=await o.createInferenceSessionHandler(i,d);return Qe(),new bp(c)}startProfiling(){this.handler.startProfiling()}endProfiling(){this.handler.endProfiling()}get inputNames(){return this.handler.inputNames}get outputNames(){return this.handler.outputNames}}}),ps,Jy=j(()=>{Yy(),ps=vp}),Xy=j(()=>{}),e_=j(()=>{}),t_=j(()=>{}),r_=j(()=>{}),wp={};da(wp,{InferenceSession:()=>ps,TRACE:()=>Fr,TRACE_FUNC_BEGIN:()=>st,TRACE_FUNC_END:()=>Qe,Tensor:()=>nt,env:()=>Se,registerBackend:()=>Gt});var ut=j(()=>{qy(),Hy(),Jy(),yp(),Xy(),e_(),_p(),t_(),r_()}),hs=j(()=>{}),$p={};da($p,{default:()=>xp});var jn,Ln,xp,a_=j(()=>{Cm(),tr(),fs(),jn="ort-wasm-proxy-worker",Ln=globalThis.self?.name===jn,Ln&&(self.onmessage=e=>{let{type:t,in:r}=e.data;try{switch(t){case"init-wasm":ms(r.wasm).then(()=>{Rs(r).then(()=>{postMessage({type:t})},a=>{postMessage({type:t,err:a})})},a=>{postMessage({type:t,err:a})});break;case"init-ep":{let{epName:a,env:n}=r;Ms(n,a).then(()=>{postMessage({type:t})},i=>{postMessage({type:t,err:i})});break}case"copy-from":{let{buffer:a}=r,n=Ka(a);postMessage({type:t,out:n});break}case"create":{let{model:a,options:n}=r;Ns(a,n).then(i=>{postMessage({type:t,out:i})},i=>{postMessage({type:t,err:i})});break}case"release":Bs(r),postMessage({type:t});break;case"run":{let{sessionId:a,inputIndices:n,inputs:i,outputIndices:s,options:o}=r;Ds(a,n,i,s,new Array(s.length).fill(null),o).then(d=>{d.some(c=>c[3]!=="cpu")?postMessage({type:t,err:"Proxy does not support non-cpu tensor location."}):postMessage({type:t,out:d},Us([...i,...d]))},d=>{postMessage({type:t,err:d})});break}case"end-profiling":Ps(r),postMessage({type:t});break;default:}}catch(a){postMessage({type:t,err:a})}}),xp=Ln?null:e=>new Worker(e??qe,{type:"module",name:jn})}),kp={};da(kp,{default:()=>Sp});var Vn,Wn,Sp,n_=j(()=>{Wn=(Vn=import.meta.url,async function(e={}){function t(){return J.buffer!=se.buffer&&ke(),se}function r(){return J.buffer!=se.buffer&&ke(),ce}function a(){return J.buffer!=se.buffer&&ke(),K}function n(){return J.buffer!=se.buffer&&ke(),Te}function i(){return J.buffer!=se.buffer&&ke(),U}function s(){return J.buffer!=se.buffer&&ke(),G}function o(){return J.buffer!=se.buffer&&ke(),ye}function d(){return J.buffer!=se.buffer&&ke(),gt}var c,h,u=Object.assign({},e),f=new Promise((l,p)=>{c=l,h=p}),m=typeof window=="object",_=typeof importScripts=="function",g=_&&self.name=="em-pthread";u.mountExternalData=(l,p)=>{l.startsWith("./")&&(l=l.substring(2)),(u.Fb||(u.Fb=new Map)).set(l,p)},u.unmountExternalData=()=>{delete u.Fb};var w=globalThis.SharedArrayBuffer??new WebAssembly.Memory({initial:0,maximum:0,shared:!0}).buffer.constructor;let x=()=>{let l=(y,v,$)=>(...C)=>{let R=ct,B=v?.();C=y(...C);let q=v?.();return B!==q&&(y=q,$(B),v=$=null),ct!=R?new Promise((Z,ae)=>{En={resolve:Z,reject:ae}}):C},p=y=>async(...v)=>{try{if(u.Gb)throw Error("Session already started");let $=u.Gb={hc:v[0],errors:[]},C=await y(...v);if(u.Gb!==$)throw Error("Session mismatch");u.Hb?.flush();let R=$.errors;if(0<R.length){let B=await Promise.all(R);if(B=B.filter(q=>q),0<B.length)throw Error(B.join(`
`))}return C}finally{u.Gb=null}};u._OrtCreateSession=l(u._OrtCreateSession,()=>u._OrtCreateSession,y=>u._OrtCreateSession=y),u._OrtRun=p(l(u._OrtRun,()=>u._OrtRun,y=>u._OrtRun=y)),u._OrtRunWithBinding=p(l(u._OrtRunWithBinding,()=>u._OrtRunWithBinding,y=>u._OrtRunWithBinding=y)),u._OrtBindInput=l(u._OrtBindInput,()=>u._OrtBindInput,y=>u._OrtBindInput=y),x=void 0};u.jsepInit=(l,p)=>{if(x?.(),l==="webgpu"){[u.Hb,u.Vb,u.Zb,u.Ob,u.Yb,u.kb,u.$b,u.cc,u.Wb,u.Xb,u.ac]=p;let y=u.Hb;u.jsepRegisterBuffer=(v,$,C,R)=>y.registerBuffer(v,$,C,R),u.jsepGetBuffer=v=>y.getBuffer(v),u.jsepCreateDownloader=(v,$,C)=>y.createDownloader(v,$,C),u.jsepOnCreateSession=v=>{y.onCreateSession(v)},u.jsepOnReleaseSession=v=>{y.onReleaseSession(v)},u.jsepOnRunStart=v=>y.onRunStart(v),u.dc=(v,$)=>{y.upload(v,$)}}else if(l==="webnn"){[u.Hb,u.bc,u.Pb,u.jsepEnsureTensor,u.ec,u.jsepDownloadTensor]=p,u.jsepReleaseTensorId=u.Pb;let y=u.Hb;u.jsepOnRunStart=v=>y.onRunStart(v),u.jsepRegisterMLContext=(v,$)=>{y.registerMLContext(v,$)},u.jsepOnReleaseSession=v=>{y.onReleaseSession(v)},u.jsepCreateMLTensorDownloader=(v,$)=>y.createMLTensorDownloader(v,$),u.jsepRegisterMLTensor=(v,$,C)=>y.registerMLTensor(v,$,C),u.jsepCreateMLContext=v=>y.createMLContext(v),u.jsepRegisterMLConstant=(v,$,C,R,B)=>y.registerMLConstant(v,$,C,R,B,u.Fb)}};var b,k,S=Object.assign({},u),T=(l,p)=>{throw p},E="";(m||_)&&(_?E=self.location.href:typeof document<"u"&&document.currentScript&&(E=document.currentScript.src),Vn&&(E=Vn),E=E.startsWith("blob:")?"":E.substr(0,E.replace(/[?#].*/,"").lastIndexOf("/")+1),_&&(k=l=>{var p=new XMLHttpRequest;return p.open("GET",l,!1),p.responseType="arraybuffer",p.send(null),new Uint8Array(p.response)}),b=(l,p,y)=>{var v=new XMLHttpRequest;v.open("GET",l,!0),v.responseType="arraybuffer",v.onload=()=>{v.status==200||v.status==0&&v.response?p(v.response):y()},v.onerror=y,v.send(null)});var I,N=console.log.bind(console),D=console.error.bind(console),V=N,A=D;if(Object.assign(u,S),S=null,g){let l=function(p){try{var y=p.data,v=y.cmd;if(v==="load"){let $=[];self.onmessage=C=>$.push(C),self.startWorker=()=>{postMessage({cmd:"loaded"});for(let C of $)l(C);self.onmessage=l};for(let C of y.handlers)u[C]&&!u[C].proxy||(u[C]=(...R)=>{postMessage({Nb:"callHandler",pc:C,args:R})},C=="print"&&(V=u[C]),C=="printErr"&&(A=u[C]));J=y.wasmMemory,ke(),W(y.wasmModule)}else if(v==="run"){Rn(y.pthread_ptr,0,0,1,0,0),Cn(y.pthread_ptr),wg(),ao(),P||(tu(),P=!0);try{$g(y.start_routine,y.arg)}catch($){if($!="unwind")throw $}}else v==="cancel"?ir()&&xa(-1):y.target!=="setimmediate"&&(v==="checkMailbox"?P&&ha():v&&(A(`worker: received unknown command ${v}`),A(y)))}catch($){throw ru(),$}};var W,P=!1;A=function(...p){p=p.join(" "),console.error(p)},self.alert=function(...p){postMessage({Nb:"alert",text:p.join(" "),rc:ir()})},u.instantiateWasm=(p,y)=>new Promise(v=>{W=$=>{$=new WebAssembly.Instance($,Js()),y($),v()}}),self.onunhandledrejection=p=>{throw p.reason||p},self.onmessage=l}u.wasmBinary&&(I=u.wasmBinary);var J,ne,F,se,ce,K,Te,U,G,ye,ge,Re,gt,Ce=!1;function ke(){var l=J.buffer;u.HEAP8=se=new Int8Array(l),u.HEAP16=K=new Int16Array(l),u.HEAPU8=ce=new Uint8Array(l),u.HEAPU16=Te=new Uint16Array(l),u.HEAP32=U=new Int32Array(l),u.HEAPU32=G=new Uint32Array(l),u.HEAPF32=ye=new Float32Array(l),u.HEAPF64=gt=new Float64Array(l),u.HEAP64=ge=new BigInt64Array(l),u.HEAPU64=Re=new BigUint64Array(l)}if(!g){if(!((J=new WebAssembly.Memory({initial:256,maximum:65536,shared:!0})).buffer instanceof w))throw A("requested a shared WebAssembly.Memory but the returned buffer is not a SharedArrayBuffer, indicating that while the browser has SharedArrayBuffer it does not have WebAssembly threads support - you may need to set a flag"),Error("bad memory");ke()}var kt=[],wr=[],fn=[],$r=0,xr=null;function Gs(){if(--$r==0&&xr){var l=xr;xr=null,l()}}function St(l){throw A(l="Aborted("+l+")"),Ce=!0,F=1,l=new WebAssembly.RuntimeError(l+". Build with -sASSERTIONS for more info."),h(l),l}var mn,Zs=l=>l.startsWith("data:application/octet-stream;base64,"),Ks=l=>l.startsWith("file://");function Qs(l){if(l==mn&&I)return new Uint8Array(I);if(k)return k(l);throw"both async and sync fetching of the wasm failed"}function Ys(l,p,y){return(function(v){if(!I&&(m||_)){if(typeof fetch=="function"&&!Ks(v))return fetch(v,{credentials:"same-origin"}).then($=>{if(!$.ok)throw`failed to load wasm binary file at '${v}'`;return $.arrayBuffer()}).catch(()=>Qs(v));if(b)return new Promise(($,C)=>{b(v,R=>$(new Uint8Array(R)),C)})}return Promise.resolve().then(()=>Qs(v))})(l).then(v=>WebAssembly.instantiate(v,p)).then(y,v=>{A(`failed to asynchronously prepare wasm: ${v}`),St(v)})}function Js(){return{a:{O:bg,Aa:vg,b:kg,aa:oo,B:co,qa:po,Y:fo,_:mo,ra:go,oa:yo,ha:_o,na:vo,L:bo,Z:wo,W:$o,pa:xo,X:ko,va:Sg,F:Tg,Q:Cg,P:Eg,E:zg,u:Og,q:Rg,G:Mg,A:Lg,R:Vg,ua:Wg,ka:qg,U:Fg,ba:Hg,H:Gg,ja:Cn,ta:Zg,t:Kg,Ba:Qg,x:Xg,o:ey,m:ry,c:Sn,n:ay,k:sy,w:oy,p:uy,f:ly,s:dy,l:cy,e:py,j:hy,i:fy,g:my,d:gy,ea:yy,fa:_y,ga:vy,ca:Po,da:Uo,T:by,h:wy,D:$y,I:xy,M:ky,y:Sy,sa:Ty,V:Cy,v:Lo,z:Iy,N:Ey,S:Ay,za:zy,ya:Oy,la:qo,ma:Fo,$:bn,C:Ho,K:Go,ia:Zo,J:Ko,a:J,xa:vn,wa:Jo,r:Ny}}}var gn={916868:(l,p,y,v,$)=>{if(u===void 0||!u.Fb)return 1;if((l=Oe(Number(l>>>0))).startsWith("./")&&(l=l.substring(2)),!(l=u.Fb.get(l)))return 2;if(p=Number(p>>>0),y=Number(y>>>0),v=Number(v>>>0),p+y>l.byteLength)return 3;try{let C=l.subarray(p,p+y);switch($){case 0:r().set(C,v>>>0);break;case 1:u.dc(v,C);break;default:return 4}return 0}catch{return 4}},917583:(l,p,y)=>{u.ec(l,r().subarray(p>>>0,p+y>>>0))},917646:()=>u.bc(),917687:l=>{u.Pb(l)},917723:()=>{u.Wb()},917754:()=>{u.Xb()},917783:()=>{u.ac()},917808:l=>u.Vb(l),917841:l=>u.Zb(l),917873:(l,p,y)=>{u.Ob(Number(l),Number(p),Number(y),!0)},917936:(l,p,y)=>{u.Ob(Number(l),Number(p),Number(y))},917993:()=>typeof wasmOffsetConverter<"u",918050:l=>{u.kb("Abs",l,void 0)},918101:l=>{u.kb("Neg",l,void 0)},918152:l=>{u.kb("Floor",l,void 0)},918205:l=>{u.kb("Ceil",l,void 0)},918257:l=>{u.kb("Reciprocal",l,void 0)},918315:l=>{u.kb("Sqrt",l,void 0)},918367:l=>{u.kb("Exp",l,void 0)},918418:l=>{u.kb("Erf",l,void 0)},918469:l=>{u.kb("Sigmoid",l,void 0)},918524:(l,p,y)=>{u.kb("HardSigmoid",l,{alpha:p,beta:y})},918603:l=>{u.kb("Log",l,void 0)},918654:l=>{u.kb("Sin",l,void 0)},918705:l=>{u.kb("Cos",l,void 0)},918756:l=>{u.kb("Tan",l,void 0)},918807:l=>{u.kb("Asin",l,void 0)},918859:l=>{u.kb("Acos",l,void 0)},918911:l=>{u.kb("Atan",l,void 0)},918963:l=>{u.kb("Sinh",l,void 0)},919015:l=>{u.kb("Cosh",l,void 0)},919067:l=>{u.kb("Asinh",l,void 0)},919120:l=>{u.kb("Acosh",l,void 0)},919173:l=>{u.kb("Atanh",l,void 0)},919226:l=>{u.kb("Tanh",l,void 0)},919278:l=>{u.kb("Not",l,void 0)},919329:(l,p,y)=>{u.kb("Clip",l,{min:p,max:y})},919398:l=>{u.kb("Clip",l,void 0)},919450:(l,p)=>{u.kb("Elu",l,{alpha:p})},919508:l=>{u.kb("Gelu",l,void 0)},919560:l=>{u.kb("Relu",l,void 0)},919612:(l,p)=>{u.kb("LeakyRelu",l,{alpha:p})},919676:(l,p)=>{u.kb("ThresholdedRelu",l,{alpha:p})},919746:(l,p)=>{u.kb("Cast",l,{to:p})},919804:l=>{u.kb("Add",l,void 0)},919855:l=>{u.kb("Sub",l,void 0)},919906:l=>{u.kb("Mul",l,void 0)},919957:l=>{u.kb("Div",l,void 0)},920008:l=>{u.kb("Pow",l,void 0)},920059:l=>{u.kb("Equal",l,void 0)},920112:l=>{u.kb("Greater",l,void 0)},920167:l=>{u.kb("GreaterOrEqual",l,void 0)},920229:l=>{u.kb("Less",l,void 0)},920281:l=>{u.kb("LessOrEqual",l,void 0)},920340:(l,p,y,v,$)=>{u.kb("ReduceMean",l,{keepDims:!!p,noopWithEmptyAxes:!!y,axes:v?Array.from(i().subarray(Number(v)>>>0,Number($)>>>0)):[]})},920515:(l,p,y,v,$)=>{u.kb("ReduceMax",l,{keepDims:!!p,noopWithEmptyAxes:!!y,axes:v?Array.from(i().subarray(Number(v)>>>0,Number($)>>>0)):[]})},920689:(l,p,y,v,$)=>{u.kb("ReduceMin",l,{keepDims:!!p,noopWithEmptyAxes:!!y,axes:v?Array.from(i().subarray(Number(v)>>>0,Number($)>>>0)):[]})},920863:(l,p,y,v,$)=>{u.kb("ReduceProd",l,{keepDims:!!p,noopWithEmptyAxes:!!y,axes:v?Array.from(i().subarray(Number(v)>>>0,Number($)>>>0)):[]})},921038:(l,p,y,v,$)=>{u.kb("ReduceSum",l,{keepDims:!!p,noopWithEmptyAxes:!!y,axes:v?Array.from(i().subarray(Number(v)>>>0,Number($)>>>0)):[]})},921212:(l,p,y,v,$)=>{u.kb("ReduceL1",l,{keepDims:!!p,noopWithEmptyAxes:!!y,axes:v?Array.from(i().subarray(Number(v)>>>0,Number($)>>>0)):[]})},921385:(l,p,y,v,$)=>{u.kb("ReduceL2",l,{keepDims:!!p,noopWithEmptyAxes:!!y,axes:v?Array.from(i().subarray(Number(v)>>>0,Number($)>>>0)):[]})},921558:(l,p,y,v,$)=>{u.kb("ReduceLogSum",l,{keepDims:!!p,noopWithEmptyAxes:!!y,axes:v?Array.from(i().subarray(Number(v)>>>0,Number($)>>>0)):[]})},921735:(l,p,y,v,$)=>{u.kb("ReduceSumSquare",l,{keepDims:!!p,noopWithEmptyAxes:!!y,axes:v?Array.from(i().subarray(Number(v)>>>0,Number($)>>>0)):[]})},921915:(l,p,y,v,$)=>{u.kb("ReduceLogSumExp",l,{keepDims:!!p,noopWithEmptyAxes:!!y,axes:v?Array.from(i().subarray(Number(v)>>>0,Number($)>>>0)):[]})},922095:l=>{u.kb("Where",l,void 0)},922148:(l,p,y)=>{u.kb("Transpose",l,{perm:p?Array.from(i().subarray(Number(p)>>>0,Number(y)>>>0)):[]})},922272:(l,p,y,v)=>{u.kb("DepthToSpace",l,{blocksize:p,mode:Oe(y),format:v?"NHWC":"NCHW"})},922405:(l,p,y,v)=>{u.kb("DepthToSpace",l,{blocksize:p,mode:Oe(y),format:v?"NHWC":"NCHW"})},922538:(l,p,y,v,$,C,R,B,q,Z,ae,me,we,O,fe)=>{u.kb("ConvTranspose",l,{format:q?"NHWC":"NCHW",autoPad:p,dilations:[y],group:v,kernelShape:[$],pads:[C,R],strides:[B],wIsConst:()=>!!t()[Z>>>0],outputPadding:ae?Array.from(i().subarray(Number(ae)>>>0,Number(me)>>>0)):[],outputShape:we?Array.from(i().subarray(Number(we)>>>0,Number(O)>>>0)):[],activation:Oe(fe)})},922971:(l,p,y,v,$,C,R,B,q,Z,ae,me,we,O)=>{u.kb("ConvTranspose",l,{format:B?"NHWC":"NCHW",autoPad:p,dilations:Array.from(i().subarray(Number(y)>>>0,2+(Number(y)>>>0)>>>0)),group:v,kernelShape:Array.from(i().subarray(Number($)>>>0,2+(Number($)>>>0)>>>0)),pads:Array.from(i().subarray(Number(C)>>>0,4+(Number(C)>>>0)>>>0)),strides:Array.from(i().subarray(Number(R)>>>0,2+(Number(R)>>>0)>>>0)),wIsConst:()=>!!t()[q>>>0],outputPadding:Z?Array.from(i().subarray(Number(Z)>>>0,Number(ae)>>>0)):[],outputShape:me?Array.from(i().subarray(Number(me)>>>0,Number(we)>>>0)):[],activation:Oe(O)})},923632:(l,p,y,v,$,C,R,B,q,Z,ae,me,we,O,fe)=>{u.kb("ConvTranspose",l,{format:q?"NHWC":"NCHW",autoPad:p,dilations:[y],group:v,kernelShape:[$],pads:[C,R],strides:[B],wIsConst:()=>!!t()[Z>>>0],outputPadding:ae?Array.from(i().subarray(Number(ae)>>>0,Number(me)>>>0)):[],outputShape:we?Array.from(i().subarray(Number(we)>>>0,Number(O)>>>0)):[],activation:Oe(fe)})},924065:(l,p,y,v,$,C,R,B,q,Z,ae,me,we,O)=>{u.kb("ConvTranspose",l,{format:B?"NHWC":"NCHW",autoPad:p,dilations:Array.from(i().subarray(Number(y)>>>0,2+(Number(y)>>>0)>>>0)),group:v,kernelShape:Array.from(i().subarray(Number($)>>>0,2+(Number($)>>>0)>>>0)),pads:Array.from(i().subarray(Number(C)>>>0,4+(Number(C)>>>0)>>>0)),strides:Array.from(i().subarray(Number(R)>>>0,2+(Number(R)>>>0)>>>0)),wIsConst:()=>!!t()[q>>>0],outputPadding:Z?Array.from(i().subarray(Number(Z)>>>0,Number(ae)>>>0)):[],outputShape:me?Array.from(i().subarray(Number(me)>>>0,Number(we)>>>0)):[],activation:Oe(O)})},924726:(l,p)=>{u.kb("GlobalAveragePool",l,{format:p?"NHWC":"NCHW"})},924817:(l,p,y,v,$,C,R,B,q,Z,ae,me,we,O)=>{u.kb("AveragePool",l,{format:O?"NHWC":"NCHW",auto_pad:p,ceil_mode:y,count_include_pad:v,storage_order:$,dilations:C?Array.from(i().subarray(Number(C)>>>0,Number(R)>>>0)):[],kernel_shape:B?Array.from(i().subarray(Number(B)>>>0,Number(q)>>>0)):[],pads:Z?Array.from(i().subarray(Number(Z)>>>0,Number(ae)>>>0)):[],strides:me?Array.from(i().subarray(Number(me)>>>0,Number(we)>>>0)):[]})},925296:(l,p)=>{u.kb("GlobalAveragePool",l,{format:p?"NHWC":"NCHW"})},925387:(l,p,y,v,$,C,R,B,q,Z,ae,me,we,O)=>{u.kb("AveragePool",l,{format:O?"NHWC":"NCHW",auto_pad:p,ceil_mode:y,count_include_pad:v,storage_order:$,dilations:C?Array.from(i().subarray(Number(C)>>>0,Number(R)>>>0)):[],kernel_shape:B?Array.from(i().subarray(Number(B)>>>0,Number(q)>>>0)):[],pads:Z?Array.from(i().subarray(Number(Z)>>>0,Number(ae)>>>0)):[],strides:me?Array.from(i().subarray(Number(me)>>>0,Number(we)>>>0)):[]})},925866:(l,p)=>{u.kb("GlobalMaxPool",l,{format:p?"NHWC":"NCHW"})},925953:(l,p,y,v,$,C,R,B,q,Z,ae,me,we,O)=>{u.kb("MaxPool",l,{format:O?"NHWC":"NCHW",auto_pad:p,ceil_mode:y,count_include_pad:v,storage_order:$,dilations:C?Array.from(i().subarray(Number(C)>>>0,Number(R)>>>0)):[],kernel_shape:B?Array.from(i().subarray(Number(B)>>>0,Number(q)>>>0)):[],pads:Z?Array.from(i().subarray(Number(Z)>>>0,Number(ae)>>>0)):[],strides:me?Array.from(i().subarray(Number(me)>>>0,Number(we)>>>0)):[]})},926428:(l,p)=>{u.kb("GlobalMaxPool",l,{format:p?"NHWC":"NCHW"})},926515:(l,p,y,v,$,C,R,B,q,Z,ae,me,we,O)=>{u.kb("MaxPool",l,{format:O?"NHWC":"NCHW",auto_pad:p,ceil_mode:y,count_include_pad:v,storage_order:$,dilations:C?Array.from(i().subarray(Number(C)>>>0,Number(R)>>>0)):[],kernel_shape:B?Array.from(i().subarray(Number(B)>>>0,Number(q)>>>0)):[],pads:Z?Array.from(i().subarray(Number(Z)>>>0,Number(ae)>>>0)):[],strides:me?Array.from(i().subarray(Number(me)>>>0,Number(we)>>>0)):[]})},926990:(l,p,y,v,$)=>{u.kb("Gemm",l,{alpha:p,beta:y,transA:v,transB:$})},927094:l=>{u.kb("MatMul",l,void 0)},927148:(l,p,y,v)=>{u.kb("ArgMax",l,{keepDims:!!p,selectLastIndex:!!y,axis:v})},927256:(l,p,y,v)=>{u.kb("ArgMin",l,{keepDims:!!p,selectLastIndex:!!y,axis:v})},927364:(l,p)=>{u.kb("Softmax",l,{axis:p})},927427:(l,p)=>{u.kb("Concat",l,{axis:p})},927487:(l,p,y,v,$)=>{u.kb("Split",l,{axis:p,numOutputs:y,splitSizes:v?Array.from(i().subarray(Number(v)>>>0,Number($)>>>0)):[]})},927643:l=>{u.kb("Expand",l,void 0)},927697:(l,p)=>{u.kb("Gather",l,{axis:Number(p)})},927768:(l,p)=>{u.kb("GatherElements",l,{axis:Number(p)})},927847:(l,p)=>{u.kb("GatherND",l,{batch_dims:Number(p)})},927926:(l,p,y,v,$,C,R,B,q,Z,ae)=>{u.kb("Resize",l,{antialias:p,axes:y?Array.from(i().subarray(Number(y)>>>0,Number(v)>>>0)):[],coordinateTransformMode:Oe($),cubicCoeffA:C,excludeOutside:R,extrapolationValue:B,keepAspectRatioPolicy:Oe(q),mode:Oe(Z),nearestMode:Oe(ae)})},928288:(l,p,y,v,$,C,R)=>{u.kb("Slice",l,{starts:p?Array.from(i().subarray(Number(p)>>>0,Number(y)>>>0)):[],ends:v?Array.from(i().subarray(Number(v)>>>0,Number($)>>>0)):[],axes:C?Array.from(i().subarray(Number(C)>>>0,Number(R)>>>0)):[]})},928552:l=>{u.kb("Tile",l,void 0)},928604:(l,p,y)=>{u.kb("InstanceNormalization",l,{epsilon:p,format:y?"NHWC":"NCHW"})},928718:(l,p,y)=>{u.kb("InstanceNormalization",l,{epsilon:p,format:y?"NHWC":"NCHW"})},928832:l=>{u.kb("Range",l,void 0)},928885:(l,p)=>{u.kb("Einsum",l,{equation:Oe(p)})},928966:(l,p,y,v,$)=>{u.kb("Pad",l,{mode:p,value:y,pads:v?Array.from(i().subarray(Number(v)>>>0,Number($)>>>0)):[]})},929109:(l,p,y,v,$,C)=>{u.kb("BatchNormalization",l,{epsilon:p,momentum:y,spatial:!!$,trainingMode:!!v,format:C?"NHWC":"NCHW"})},929278:(l,p,y,v,$,C)=>{u.kb("BatchNormalization",l,{epsilon:p,momentum:y,spatial:!!$,trainingMode:!!v,format:C?"NHWC":"NCHW"})},929447:(l,p,y)=>{u.kb("CumSum",l,{exclusive:Number(p),reverse:Number(y)})},929544:(l,p,y)=>{u.kb("DequantizeLinear",l,{axis:p,blockSize:y})},929634:(l,p,y,v,$)=>{u.kb("GridSample",l,{align_corners:p,mode:Oe(y),padding_mode:Oe(v),format:$?"NHWC":"NCHW"})},929804:(l,p,y,v,$)=>{u.kb("GridSample",l,{align_corners:p,mode:Oe(y),padding_mode:Oe(v),format:$?"NHWC":"NCHW"})},929974:(l,p,y,v,$,C,R,B,q)=>{u.kb("Attention",l,{numHeads:p,isUnidirectional:y,maskFilterValue:v,scale:$,doRotary:C,qkvHiddenSizes:R?Array.from(i().subarray(Number(B)>>>0,Number(B)+R>>>0)):[],pastPresentShareBuffer:!!q})},930246:l=>{u.kb("BiasAdd",l,void 0)},930301:l=>{u.kb("BiasSplitGelu",l,void 0)},930362:l=>{u.kb("FastGelu",l,void 0)},930418:(l,p,y,v,$,C,R,B,q,Z,ae,me,we,O,fe,Ae)=>{u.kb("Conv",l,{format:me?"NHWC":"NCHW",auto_pad:p,dilations:y?Array.from(i().subarray(Number(y)>>>0,Number(v)>>>0)):[],group:$,kernel_shape:C?Array.from(i().subarray(Number(C)>>>0,Number(R)>>>0)):[],pads:B?Array.from(i().subarray(Number(B)>>>0,Number(q)>>>0)):[],strides:Z?Array.from(i().subarray(Number(Z)>>>0,Number(ae)>>>0)):[],w_is_const:()=>!!t()[Number(we)>>>0],activation:Oe(O),activation_params:fe?Array.from(o().subarray(Number(fe)>>>0,Number(Ae)>>>0)):[]})},931002:l=>{u.kb("Gelu",l,void 0)},931054:(l,p,y,v,$,C,R,B,q)=>{u.kb("GroupQueryAttention",l,{numHeads:p,kvNumHeads:y,scale:v,softcap:$,doRotary:C,rotaryInterleaved:R,smoothSoftmax:B,localWindowSize:q})},931271:(l,p,y,v)=>{u.kb("LayerNormalization",l,{axis:p,epsilon:y,simplified:!!v})},931382:(l,p,y,v)=>{u.kb("LayerNormalization",l,{axis:p,epsilon:y,simplified:!!v})},931493:(l,p,y,v,$,C)=>{u.kb("MatMulNBits",l,{k:p,n:y,accuracyLevel:v,bits:$,blockSize:C})},931620:(l,p,y,v,$,C)=>{u.kb("MultiHeadAttention",l,{numHeads:p,isUnidirectional:y,maskFilterValue:v,scale:$,doRotary:C})},931779:(l,p)=>{u.kb("QuickGelu",l,{alpha:p})},931843:(l,p,y,v,$)=>{u.kb("RotaryEmbedding",l,{interleaved:!!p,numHeads:y,rotaryEmbeddingDim:v,scale:$})},931982:(l,p,y)=>{u.kb("SkipLayerNormalization",l,{epsilon:p,simplified:!!y})},932084:(l,p,y)=>{u.kb("SkipLayerNormalization",l,{epsilon:p,simplified:!!y})},932186:(l,p,y,v)=>{u.kb("GatherBlockQuantized",l,{gatherAxis:p,quantizeAxis:y,blockSize:v})},932307:l=>{u.$b(l)},932341:(l,p)=>u.cc(Number(l),Number(p),u.Gb.hc,u.Gb.errors)};function vg(l,p,y){return Ro(async()=>{await u.Yb(Number(l),Number(p),Number(y))})}function bg(){return typeof wasmOffsetConverter<"u"}function yn(l){this.name="ExitStatus",this.message=`Program terminated with exit(${l})`,this.status=l}var _n=l=>{l.terminate(),l.onmessage=()=>{}},Xs=l=>{Tt.length==0&&(io(),no(Tt[0]));var p=Tt.pop();if(!p)return 6;Ut.push(p),lt[l.Bb]=p,p.Bb=l.Bb;var y={cmd:"run",start_routine:l.ic,arg:l.Rb,pthread_ptr:l.Bb};return p.postMessage(y,l.nc),0},Pt=0,Ie=(l,p,...y)=>{for(var v=2*y.length,$=Bn(),C=Nn(8*v),R=C>>>3,B=0;B<y.length;B++){var q=y[B];typeof q=="bigint"?(ge[R+2*B]=1n,ge[R+2*B+1]=q):(ge[R+2*B]=0n,d()[R+2*B+1>>>0]=q)}return l=au(l,0,v,C,p),ka($),l};function vn(l){if(g)return Ie(0,1,l);if(F=l,!(0<Pt)){for(var p of Ut)_n(p);for(p of Tt)_n(p);Tt=[],Ut=[],lt=[],Ce=!0}T(0,new yn(l))}function eo(l){if(g)return Ie(1,0,l);bn(l)}var bn=l=>{if(F=l,g)throw eo(l),"unwind";vn(l)},Tt=[],Ut=[],to=[],lt={},ro=l=>{var p=l.Bb;delete lt[p],Tt.push(l),Ut.splice(Ut.indexOf(l),1),l.Bb=0,Mn(p)};function ao(){to.forEach(l=>l())}var no=l=>new Promise(p=>{l.onmessage=$=>{var C=($=$.data).cmd;if($.targetThread&&$.targetThread!=ir()){var R=lt[$.targetThread];R?R.postMessage($,$.transferList):A(`Internal error! Worker sent a message "${C}" to target pthread ${$.targetThread}, but that thread no longer exists!`)}else C==="checkMailbox"?ha():C==="spawnThread"?Xs($):C==="cleanupThread"?ro(lt[$.thread]):C==="killThread"?($=$.thread,C=lt[$],delete lt[$],_n(C),Mn($),Ut.splice(Ut.indexOf(C),1),C.Bb=0):C==="cancelThread"?lt[$.thread].postMessage({cmd:"cancel"}):C==="loaded"?(l.loaded=!0,p(l)):C==="alert"?alert(`Thread ${$.threadId}: ${$.text}`):$.target==="setimmediate"?l.postMessage($):C==="callHandler"?u[$.handler](...$.args):C&&A(`worker sent an unknown command ${C}`)},l.onerror=$=>{throw A(`worker sent an error! ${$.filename}:${$.lineno}: ${$.message}`),$};var y,v=[];for(y of[])u.hasOwnProperty(y)&&v.push(y);l.postMessage({cmd:"load",handlers:v,wasmMemory:J,wasmModule:ne})});function io(){var l=new Worker(import.meta.url.startsWith("file:")?new URL("/assets/ort.bundle.min-D2-GKZ-g.mjs",import.meta.url):new URL(import.meta.url),{type:"module",workerData:"em-pthread",name:"em-pthread"});Tt.push(l)}var pa=l=>{for(;0<l.length;)l.shift()(u)},wg=()=>{var l=ir(),p=s()[l+52>>>2>>>0];l=s()[l+56>>>2>>>0],iu(p,p-l),ka(p)},$g=(l,p)=>{Pt=0,l=su(l,p),0<Pt?F=l:xa(l)};class xg{constructor(p){this.Kb=p-24}}function kg(l,p,y){var v=new xg(l>>>=0);throw p>>>=0,y>>>=0,s()[v.Kb+16>>>2>>>0]=0,s()[v.Kb+4>>>2>>>0]=p,s()[v.Kb+8>>>2>>>0]=y,l}function so(l,p,y,v){return g?Ie(2,1,l,p,y,v):oo(l,p,y,v)}function oo(l,p,y,v){if(l>>>=0,p>>>=0,y>>>=0,v>>>=0,w===void 0)return A("Current environment does not support SharedArrayBuffer, pthreads are not available!"),6;var $=[];return g&&$.length===0?so(l,p,y,v):(l={ic:y,Bb:l,Rb:v,nc:$},g?(l.Nb="spawnThread",postMessage(l,$),0):Xs(l))}var uo=typeof TextDecoder<"u"?new TextDecoder("utf8"):void 0,lo=(l,p,y)=>{var v=(p>>>=0)+y;for(y=p;l[y]&&!(y>=v);)++y;if(16<y-p&&l.buffer&&uo)return uo.decode(l.buffer instanceof w?l.slice(p,y):l.subarray(p,y));for(v="";p<y;){var $=l[p++];if(128&$){var C=63&l[p++];if((224&$)==192)v+=String.fromCharCode((31&$)<<6|C);else{var R=63&l[p++];65536>($=(240&$)==224?(15&$)<<12|C<<6|R:(7&$)<<18|C<<12|R<<6|63&l[p++])?v+=String.fromCharCode($):($-=65536,v+=String.fromCharCode(55296|$>>10,56320|1023&$))}}else v+=String.fromCharCode($)}return v},Oe=(l,p)=>(l>>>=0)?lo(r(),l,p):"";function co(l,p,y){return g?Ie(3,1,l,p,y):0}function po(l,p){if(g)return Ie(4,1,l,p)}var wn=l=>{for(var p=0,y=0;y<l.length;++y){var v=l.charCodeAt(y);127>=v?p++:2047>=v?p+=2:55296<=v&&57343>=v?(p+=4,++y):p+=3}return p},ho=(l,p,y,v)=>{if(!(0<v))return 0;var $=y>>>=0;v=y+v-1;for(var C=0;C<l.length;++C){var R=l.charCodeAt(C);if(55296<=R&&57343>=R&&(R=65536+((1023&R)<<10)|1023&l.charCodeAt(++C)),127>=R){if(y>=v)break;p[y++>>>0]=R}else{if(2047>=R){if(y+1>=v)break;p[y++>>>0]=192|R>>6}else{if(65535>=R){if(y+2>=v)break;p[y++>>>0]=224|R>>12}else{if(y+3>=v)break;p[y++>>>0]=240|R>>18,p[y++>>>0]=128|R>>12&63}p[y++>>>0]=128|R>>6&63}p[y++>>>0]=128|63&R}}return p[y>>>0]=0,y-$},ar=(l,p,y)=>ho(l,r(),p,y);function fo(l,p){if(g)return Ie(5,1,l,p)}function mo(l,p,y){if(g)return Ie(6,1,l,p,y)}function go(l,p,y){return g?Ie(7,1,l,p,y):0}function yo(l,p){if(g)return Ie(8,1,l,p)}function _o(l,p,y){if(g)return Ie(9,1,l,p,y)}function vo(l,p,y,v){if(g)return Ie(10,1,l,p,y,v)}function bo(l,p,y,v){if(g)return Ie(11,1,l,p,y,v)}function wo(l,p,y,v){if(g)return Ie(12,1,l,p,y,v)}function $o(l){if(g)return Ie(13,1,l)}function xo(l,p){if(g)return Ie(14,1,l,p)}function ko(l,p,y){if(g)return Ie(15,1,l,p,y)}var So,Ct,Sg=()=>{St("")},dt=l=>{for(var p="";r()[l>>>0];)p+=So[r()[l++>>>0]];return p},$n={},xn={};function yt(l,p,y={}){if(!("argPackAdvance"in p))throw new TypeError("registerType registeredInstance requires argPackAdvance");return(function(v,$,C={}){var R=$.name;if(!v)throw new Ct(`type "${R}" must have a positive integer typeid pointer`);if(xn.hasOwnProperty(v)){if(C.Tb)return;throw new Ct(`Cannot register type '${R}' twice`)}xn[v]=$,$n.hasOwnProperty(v)&&($=$n[v],delete $n[v],$.forEach(B=>B()))})(l,p,y)}var To=(l,p,y)=>{switch(p){case 1:return y?v=>t()[v>>>0]:v=>r()[v>>>0];case 2:return y?v=>a()[v>>>1>>>0]:v=>n()[v>>>1>>>0];case 4:return y?v=>i()[v>>>2>>>0]:v=>s()[v>>>2>>>0];case 8:return y?v=>ge[v>>>3]:v=>Re[v>>>3];default:throw new TypeError(`invalid integer width (${p}): ${l}`)}};function Tg(l,p,y){y>>>=0,yt(l>>>=0,{name:p=dt(p>>>0),fromWireType:v=>v,toWireType:function(v,$){if(typeof $!="bigint"&&typeof $!="number")throw $=$===null?"null":(v=typeof $)=="object"||v==="array"||v==="function"?$.toString():""+$,new TypeError(`Cannot convert "${$}" to ${this.name}`);return typeof $=="number"&&($=BigInt($)),$},argPackAdvance:It,readValueFromPointer:To(p,y,p.indexOf("u")==-1),Eb:null})}var It=8;function Cg(l,p,y,v){yt(l>>>=0,{name:p=dt(p>>>0),fromWireType:function($){return!!$},toWireType:function($,C){return C?y:v},argPackAdvance:It,readValueFromPointer:function($){return this.fromWireType(r()[$>>>0])},Eb:null})}var kn=[],_t=[];function Sn(l){9<(l>>>=0)&&--_t[l+1]==0&&(_t[l]=void 0,kn.push(l))}var We=l=>{if(!l)throw new Ct("Cannot use deleted val. handle = "+l);return _t[l]},Ge=l=>{switch(l){case void 0:return 2;case null:return 4;case!0:return 6;case!1:return 8;default:let p=kn.pop()||_t.length;return _t[p]=l,_t[p+1]=1,p}};function Tn(l){return this.fromWireType(s()[l>>>2>>>0])}var Ig={name:"emscripten::val",fromWireType:l=>{var p=We(l);return Sn(l),p},toWireType:(l,p)=>Ge(p),argPackAdvance:It,readValueFromPointer:Tn,Eb:null};function Eg(l){return yt(l>>>0,Ig)}var Ag=(l,p)=>{switch(p){case 4:return function(y){return this.fromWireType(o()[y>>>2>>>0])};case 8:return function(y){return this.fromWireType(d()[y>>>3>>>0])};default:throw new TypeError(`invalid float width (${p}): ${l}`)}};function zg(l,p,y){y>>>=0,yt(l>>>=0,{name:p=dt(p>>>0),fromWireType:v=>v,toWireType:(v,$)=>$,argPackAdvance:It,readValueFromPointer:Ag(p,y),Eb:null})}function Og(l,p,y,v,$){if(l>>>=0,y>>>=0,p=dt(p>>>0),$===-1&&($=4294967295),$=B=>B,v===0){var C=32-8*y;$=B=>B<<C>>>C}var R=p.includes("unsigned")?function(B,q){return q>>>0}:function(B,q){return q};yt(l,{name:p,fromWireType:$,toWireType:R,argPackAdvance:It,readValueFromPointer:To(p,y,v!==0),Eb:null})}function Rg(l,p,y){function v(C){var R=s()[C>>>2>>>0];return C=s()[C+4>>>2>>>0],new $(t().buffer,C,R)}var $=[Int8Array,Uint8Array,Int16Array,Uint16Array,Int32Array,Uint32Array,Float32Array,Float64Array,BigInt64Array,BigUint64Array][p];yt(l>>>=0,{name:y=dt(y>>>0),fromWireType:v,argPackAdvance:It,readValueFromPointer:v},{Tb:!0})}function Mg(l,p){l>>>=0;var y=(p=dt(p>>>0))==="std::string";yt(l,{name:p,fromWireType:function(v){var $=s()[v>>>2>>>0],C=v+4;if(y)for(var R=C,B=0;B<=$;++B){var q=C+B;if(B==$||r()[q>>>0]==0){if(R=Oe(R,q-R),Z===void 0)var Z=R;else Z+="\0",Z+=R;R=q+1}}else{for(Z=Array($),B=0;B<$;++B)Z[B]=String.fromCharCode(r()[C+B>>>0]);Z=Z.join("")}return pt(v),Z},toWireType:function(v,$){$ instanceof ArrayBuffer&&($=new Uint8Array($));var C=typeof $=="string";if(!(C||$ instanceof Uint8Array||$ instanceof Uint8ClampedArray||$ instanceof Int8Array))throw new Ct("Cannot pass non-string to std::string");var R=y&&C?wn($):$.length,B=$a(4+R+1),q=B+4;if(s()[B>>>2>>>0]=R,y&&C)ar($,q,R+1);else if(C)for(C=0;C<R;++C){var Z=$.charCodeAt(C);if(255<Z)throw pt(q),new Ct("String has UTF-16 code units that do not fit in 8 bits");r()[q+C>>>0]=Z}else for(C=0;C<R;++C)r()[q+C>>>0]=$[C];return v!==null&&v.push(pt,B),B},argPackAdvance:It,readValueFromPointer:Tn,Eb(v){pt(v)}})}var Co=typeof TextDecoder<"u"?new TextDecoder("utf-16le"):void 0,Ng=(l,p)=>{for(var y=l>>1,v=y+p/2;!(y>=v)&&n()[y>>>0];)++y;if(32<(y<<=1)-l&&Co)return Co.decode(r().slice(l,y));for(y="",v=0;!(v>=p/2);++v){var $=a()[l+2*v>>>1>>>0];if($==0)break;y+=String.fromCharCode($)}return y},Bg=(l,p,y)=>{if(y??=2147483647,2>y)return 0;var v=p;y=(y-=2)<2*l.length?y/2:l.length;for(var $=0;$<y;++$){var C=l.charCodeAt($);a()[p>>>1>>>0]=C,p+=2}return a()[p>>>1>>>0]=0,p-v},Dg=l=>2*l.length,Pg=(l,p)=>{for(var y=0,v="";!(y>=p/4);){var $=i()[l+4*y>>>2>>>0];if($==0)break;++y,65536<=$?($-=65536,v+=String.fromCharCode(55296|$>>10,56320|1023&$)):v+=String.fromCharCode($)}return v},Ug=(l,p,y)=>{if(p>>>=0,y??=2147483647,4>y)return 0;var v=p;y=v+y-4;for(var $=0;$<l.length;++$){var C=l.charCodeAt($);if(55296<=C&&57343>=C&&(C=65536+((1023&C)<<10)|1023&l.charCodeAt(++$)),i()[p>>>2>>>0]=C,(p+=4)+4>y)break}return i()[p>>>2>>>0]=0,p-v},jg=l=>{for(var p=0,y=0;y<l.length;++y){var v=l.charCodeAt(y);55296<=v&&57343>=v&&++y,p+=4}return p};function Lg(l,p,y){if(l>>>=0,p>>>=0,y=dt(y>>>=0),p===2)var v=Ng,$=Bg,C=Dg,R=B=>n()[B>>>1>>>0];else p===4&&(v=Pg,$=Ug,C=jg,R=B=>s()[B>>>2>>>0]);yt(l,{name:y,fromWireType:B=>{for(var q,Z=s()[B>>>2>>>0],ae=B+4,me=0;me<=Z;++me){var we=B+4+me*p;me!=Z&&R(we)!=0||(ae=v(ae,we-ae),q===void 0?q=ae:(q+="\0",q+=ae),ae=we+p)}return pt(B),q},toWireType:(B,q)=>{if(typeof q!="string")throw new Ct(`Cannot pass non-string to C++ string type ${y}`);var Z=C(q),ae=$a(4+Z+p);return s()[ae>>>2>>>0]=Z/p,$(q,ae+4,Z+p),B!==null&&B.push(pt,ae),ae},argPackAdvance:It,readValueFromPointer:Tn,Eb(B){pt(B)}})}function Vg(l,p){yt(l>>>=0,{Ub:!0,name:p=dt(p>>>0),argPackAdvance:0,fromWireType:()=>{},toWireType:()=>{}})}var Wg=()=>1;function qg(l){Rn(l>>>0,!_,1,!m,131072,!1),ao()}var Io=l=>{if(!Ce)try{if(l(),!(0<Pt))try{g?xa(F):bn(F)}catch(p){p instanceof yn||p=="unwind"||T(0,p)}}catch(p){p instanceof yn||p=="unwind"||T(0,p)}};function Cn(l){l>>>=0,typeof Atomics.oc=="function"&&(Atomics.oc(i(),l>>>2,l).value.then(ha),l+=128,Atomics.store(i(),l>>>2,1))}var ha=()=>{var l=ir();l&&(Cn(l),Io(nu))};function Fg(l,p){(l>>>=0)==p>>>0?setTimeout(ha):g?postMessage({targetThread:l,cmd:"checkMailbox"}):(l=lt[l])&&l.postMessage({cmd:"checkMailbox"})}var In=[];function Hg(l,p,y,v,$){for(p>>>=0,v/=2,In.length=v,y=$>>>0>>>3,$=0;$<v;$++)In[$]=ge[y+2*$]?ge[y+2*$+1]:d()[y+2*$+1>>>0];return(p?gn[p]:By[l])(...In)}function Gg(l){l>>>=0,g?postMessage({cmd:"cleanupThread",thread:l}):ro(lt[l])}function Zg(l){}var fa=(l,p)=>{var y=xn[l];if(y===void 0)throw l=eu(l),y=dt(l),pt(l),new Ct(`${p} has unknown type ${y}`);return y},Eo=(l,p,y)=>{var v=[];return l=l.toWireType(v,y),v.length&&(s()[p>>>2>>>0]=Ge(v)),l};function Kg(l,p,y){return p>>>=0,y>>>=0,l=We(l>>>0),p=fa(p,"emval::as"),Eo(p,y,l)}function Qg(l,p){return p>>>=0,l=We(l>>>0),(p=fa(p,"emval::as")).toWireType(null,l)}var ma=l=>{try{l()}catch(p){St(p)}},Et=0,ct=null,Ao=0,ga=[],zo={},Oo={},Yg=0,En=null,Jg=[];function Ro(l){return(function(p){if(!Ce){if(Et===0){var y=!1,v=!1;p(($=0)=>{if(!Ce&&(Ao=$,y=!0,v)){Et=2,ma(()=>lu(ct)),typeof Browser<"u"&&Browser.Lb.Sb&&Browser.Lb.resume(),$=!1;try{var C=(function(){var q=i()[ct+8>>>2>>>0];return q=re[Oo[q]],--Pt,q()})()}catch(q){C=q,$=!0}var R=!1;if(!ct){var B=En;B&&(En=null,($?B.reject:B.resolve)(C),R=!0)}if($&&!R)throw C}}),v=!0,y||(Et=1,ct=(function(){var $=$a(65548),C=$+12;s()[$>>>2>>>0]=C,s()[$+4>>>2>>>0]=C+65536,C=ga[0];var R=zo[C];return R===void 0&&(R=Yg++,zo[C]=R,Oo[R]=C),C=R,i()[$+8>>>2>>>0]=C,$})(),typeof Browser<"u"&&Browser.Lb.Sb&&Browser.Lb.pause(),ma(()=>ou(ct)))}else Et===2?(Et=0,ma(du),pt(ct),ct=null,Jg.forEach(Io)):St(`invalid state: ${Et}`);return Ao}})(p=>{l().then(p)})}function Xg(l){return l>>>=0,Ro(()=>(l=We(l)).then(Ge))}var ya=[];function ey(l,p,y,v){return y>>>=0,v>>>=0,(l=ya[l>>>0])(null,p=We(p>>>0),y,v)}var ty={},_a=l=>{var p=ty[l];return p===void 0?dt(l):p};function ry(l,p,y,v,$){return y>>>=0,v>>>=0,$>>>=0,(l=ya[l>>>0])(p=We(p>>>0),p[y=_a(y)],v,$)}var Mo=()=>typeof globalThis=="object"?globalThis:Function("return this")();function ay(l){return(l>>>=0)==0?Ge(Mo()):(l=_a(l),Ge(Mo()[l]))}var ny=l=>{var p=ya.length;return ya.push(l),p},iy=(l,p)=>{for(var y=Array(l),v=0;v<l;++v)y[v]=fa(s()[p+4*v>>>2>>>0],"parameter "+v);return y},No=(l,p)=>Object.defineProperty(p,"name",{value:l});function sy(l,p,y){var v=(p=iy(l,p>>>0)).shift();l--;var $=`return function (obj, func, destructorsRef, args) {
`,C=0,R=[];y===0&&R.push("obj");for(var B=["retType"],q=[v],Z=0;Z<l;++Z)R.push("arg"+Z),B.push("argType"+Z),q.push(p[Z]),$+=`  var arg${Z} = argType${Z}.readValueFromPointer(args${C?"+"+C:""});
`,C+=p[Z].argPackAdvance;return $+=`  var rv = ${y===1?"new func":"func.call"}(${R.join(", ")});
`,v.Ub||(B.push("emval_returnValue"),q.push(Eo),$+=`  return emval_returnValue(retType, destructorsRef, rv);
`),B.push($+`};
`),l=(function(ae){var me=Function;if(!(me instanceof Function))throw new TypeError(`new_ called with constructor type ${typeof me} which is not a function`);var we=No(me.name||"unknownFunctionName",function(){});return we.prototype=me.prototype,we=new we,(ae=me.apply(we,ae))instanceof Object?ae:we})(B)(...q),y=`methodCaller<(${p.map(ae=>ae.name).join(", ")}) => ${v.name}>`,ny(No(y,l))}function oy(l){return l=_a(l>>>0),Ge(u[l])}function uy(l,p){return p>>>=0,l=We(l>>>0),p=We(p),Ge(l[p])}function ly(l){9<(l>>>=0)&&(_t[l+1]+=1)}function dy(){return Ge([])}function cy(l){l=We(l>>>0);for(var p=Array(l.length),y=0;y<l.length;y++)p[y]=l[y];return Ge(p)}function py(l){return Ge(_a(l>>>0))}function hy(){return Ge({})}function fy(l){for(var p=We(l>>>=0);p.length;){var y=p.pop();p.pop()(y)}Sn(l)}function my(l,p,y){p>>>=0,y>>>=0,l=We(l>>>0),p=We(p),y=We(y),l[p]=y}function gy(l,p){return p>>>=0,l=(l=fa(l>>>0,"_emval_take_value")).readValueFromPointer(p),Ge(l)}function yy(l,p){l=-9007199254740992>l||9007199254740992<l?NaN:Number(l),p>>>=0,l=new Date(1e3*l),i()[p>>>2>>>0]=l.getUTCSeconds(),i()[p+4>>>2>>>0]=l.getUTCMinutes(),i()[p+8>>>2>>>0]=l.getUTCHours(),i()[p+12>>>2>>>0]=l.getUTCDate(),i()[p+16>>>2>>>0]=l.getUTCMonth(),i()[p+20>>>2>>>0]=l.getUTCFullYear()-1900,i()[p+24>>>2>>>0]=l.getUTCDay(),l=(l.getTime()-Date.UTC(l.getUTCFullYear(),0,1,0,0,0,0))/864e5|0,i()[p+28>>>2>>>0]=l}var nr=l=>l%4==0&&(l%100!=0||l%400==0),Bo=[0,31,60,91,121,152,182,213,244,274,305,335],Do=[0,31,59,90,120,151,181,212,243,273,304,334];function _y(l,p){l=-9007199254740992>l||9007199254740992<l?NaN:Number(l),p>>>=0,l=new Date(1e3*l),i()[p>>>2>>>0]=l.getSeconds(),i()[p+4>>>2>>>0]=l.getMinutes(),i()[p+8>>>2>>>0]=l.getHours(),i()[p+12>>>2>>>0]=l.getDate(),i()[p+16>>>2>>>0]=l.getMonth(),i()[p+20>>>2>>>0]=l.getFullYear()-1900,i()[p+24>>>2>>>0]=l.getDay();var y=(nr(l.getFullYear())?Bo:Do)[l.getMonth()]+l.getDate()-1|0;i()[p+28>>>2>>>0]=y,i()[p+36>>>2>>>0]=-60*l.getTimezoneOffset(),y=new Date(l.getFullYear(),6,1).getTimezoneOffset();var v=new Date(l.getFullYear(),0,1).getTimezoneOffset();l=0|(y!=v&&l.getTimezoneOffset()==Math.min(v,y)),i()[p+32>>>2>>>0]=l}function vy(l){l>>>=0;var p=new Date(i()[l+20>>>2>>>0]+1900,i()[l+16>>>2>>>0],i()[l+12>>>2>>>0],i()[l+8>>>2>>>0],i()[l+4>>>2>>>0],i()[l>>>2>>>0],0),y=i()[l+32>>>2>>>0],v=p.getTimezoneOffset(),$=new Date(p.getFullYear(),6,1).getTimezoneOffset(),C=new Date(p.getFullYear(),0,1).getTimezoneOffset(),R=Math.min(C,$);return 0>y?i()[l+32>>>2>>>0]=+($!=C&&R==v):0<y!=(R==v)&&($=Math.max(C,$),p.setTime(p.getTime()+6e4*((0<y?R:$)-v))),i()[l+24>>>2>>>0]=p.getDay(),y=(nr(p.getFullYear())?Bo:Do)[p.getMonth()]+p.getDate()-1|0,i()[l+28>>>2>>>0]=y,i()[l>>>2>>>0]=p.getSeconds(),i()[l+4>>>2>>>0]=p.getMinutes(),i()[l+8>>>2>>>0]=p.getHours(),i()[l+12>>>2>>>0]=p.getDate(),i()[l+16>>>2>>>0]=p.getMonth(),i()[l+20>>>2>>>0]=p.getYear(),l=p.getTime(),BigInt(isNaN(l)?-1:l/1e3)}function Po(l,p,y,v,$,C,R){return g?Ie(16,1,l,p,y,v,$,C,R):-52}function Uo(l,p,y,v,$,C){if(g)return Ie(17,1,l,p,y,v,$,C)}function by(l,p,y,v){l>>>=0,p>>>=0,y>>>=0,v>>>=0;var $=new Date().getFullYear(),C=new Date($,0,1),R=new Date($,6,1);$=C.getTimezoneOffset();var B=R.getTimezoneOffset(),q=Math.max($,B);s()[l>>>2>>>0]=60*q,i()[p>>>2>>>0]=+($!=B),C=(l=Z=>Z.toLocaleTimeString(void 0,{hour12:!1,timeZoneName:"short"}).split(" ")[1])(C),R=l(R),B<$?(ar(C,y,17),ar(R,v,17)):(ar(C,v,17),ar(R,y,17))}var An=[],jo=(l,p)=>{An.length=0;for(var y;y=r()[l++>>>0];){var v=y!=105;p+=(v&=y!=112)&&p%8?4:0,An.push(y==112?s()[p>>>2>>>0]:y==106?ge[p>>>3]:y==105?i()[p>>>2>>>0]:d()[p>>>3>>>0]),p+=v?8:4}return An};function wy(l,p,y){return l>>>=0,p=jo(p>>>0,y>>>0),gn[l](...p)}function $y(l,p,y){return l>>>=0,p=jo(p>>>0,y>>>0),gn[l](...p)}var xy=()=>{},ky=()=>Date.now();function Sy(l,p){return A(Oe(l>>>0,p>>>0))}var Lo,Ty=()=>{throw Pt+=1,"unwind"};function Cy(){return 4294901760}Lo=()=>performance.timeOrigin+performance.now();var Iy=()=>navigator.hardwareConcurrency;function Ey(){return St("Cannot use emscripten_pc_get_function without -sUSE_OFFSET_CONVERTER"),0}function Ay(l){l>>>=0;var p=r().length;if(l<=p||4294901760<l)return!1;for(var y=1;4>=y;y*=2){var v=p*(1+.2/y);v=Math.min(v,l+100663296);var $=Math;v=Math.max(l,v);e:{$=($.min.call($,4294901760,v+(65536-v%65536)%65536)-J.buffer.byteLength+65535)/65536;try{J.grow($),ke();var C=1;break e}catch{}C=void 0}if(C)return!0}return!1}var va=()=>(St("Cannot use convertFrameToPC (needed by __builtin_return_address) without -sUSE_OFFSET_CONVERTER"),0),kr={},Vo=l=>{l.forEach(p=>{va()})};function zy(){var l=Error().stack.toString().split(`
`);return l[0]=="Error"&&l.shift(),Vo(l),kr.Qb=va(),kr.fc=l,kr.Qb}function Oy(l,p,y){if(l>>>=0,p>>>=0,kr.Qb==l)var v=kr.fc;else(v=Error().stack.toString().split(`
`))[0]=="Error"&&v.shift(),Vo(v);for(var $=3;v[$]&&va()!=l;)++$;for(l=0;l<y&&v[l+$];++l)i()[p+4*l>>>2>>>0]=va();return l}var zn,On={},Wo=()=>{if(!zn){var l,p={USER:"web_user",LOGNAME:"web_user",PATH:"/",PWD:"/",HOME:"/home/web_user",LANG:(typeof navigator=="object"&&navigator.languages&&navigator.languages[0]||"C").replace("-","_")+".UTF-8",_:"./this.program"};for(l in On)On[l]===void 0?delete p[l]:p[l]=On[l];var y=[];for(l in p)y.push(`${l}=${p[l]}`);zn=y}return zn};function qo(l,p){if(g)return Ie(18,1,l,p);l>>>=0,p>>>=0;var y=0;return Wo().forEach((v,$)=>{var C=p+y;for($=s()[l+4*$>>>2>>>0]=C,C=0;C<v.length;++C)t()[$++>>>0]=v.charCodeAt(C);t()[$>>>0]=0,y+=v.length+1}),0}function Fo(l,p){if(g)return Ie(19,1,l,p);l>>>=0,p>>>=0;var y=Wo();s()[l>>>2>>>0]=y.length;var v=0;return y.forEach($=>v+=$.length+1),s()[p>>>2>>>0]=v,0}function Ho(l){return g?Ie(20,1,l):52}function Go(l,p,y,v){return g?Ie(21,1,l,p,y,v):52}function Zo(l,p,y,v){return g?Ie(22,1,l,p,y,v):70}var Ry=[null,[],[]];function Ko(l,p,y,v){if(g)return Ie(23,1,l,p,y,v);p>>>=0,y>>>=0,v>>>=0;for(var $=0,C=0;C<y;C++){var R=s()[p>>>2>>>0],B=s()[p+4>>>2>>>0];p+=8;for(var q=0;q<B;q++){var Z=r()[R+q>>>0],ae=Ry[l];Z===0||Z===10?((l===1?V:A)(lo(ae,0)),ae.length=0):ae.push(Z)}$+=B}return s()[v>>>2>>>0]=$,0}var Qo=[31,29,31,30,31,30,31,31,30,31,30,31],Yo=[31,28,31,30,31,30,31,31,30,31,30,31],My=(l,p)=>{t().set(l,p>>>0)};function Jo(l,p,y,v){function $(O,fe,Ae){for(O=typeof O=="number"?O.toString():O||"";O.length<fe;)O=Ae[0]+O;return O}function C(O,fe){return $(O,fe,"0")}function R(O,fe){function Ae(pu){return 0>pu?-1:0<pu?1:0}var jt;return(jt=Ae(O.getFullYear()-fe.getFullYear()))===0&&(jt=Ae(O.getMonth()-fe.getMonth()))===0&&(jt=Ae(O.getDate()-fe.getDate())),jt}function B(O){switch(O.getDay()){case 0:return new Date(O.getFullYear()-1,11,29);case 1:return O;case 2:return new Date(O.getFullYear(),0,3);case 3:return new Date(O.getFullYear(),0,2);case 4:return new Date(O.getFullYear(),0,1);case 5:return new Date(O.getFullYear()-1,11,31);case 6:return new Date(O.getFullYear()-1,11,30)}}function q(O){var fe=O.Cb;for(O=new Date(new Date(O.Db+1900,0,1).getTime());0<fe;){var Ae=O.getMonth(),jt=(nr(O.getFullYear())?Qo:Yo)[Ae];if(!(fe>jt-O.getDate())){O.setDate(O.getDate()+fe);break}fe-=jt-O.getDate()+1,O.setDate(1),11>Ae?O.setMonth(Ae+1):(O.setMonth(0),O.setFullYear(O.getFullYear()+1))}return Ae=new Date(O.getFullYear()+1,0,4),fe=B(new Date(O.getFullYear(),0,4)),Ae=B(Ae),0>=R(fe,O)?0>=R(Ae,O)?O.getFullYear()+1:O.getFullYear():O.getFullYear()-1}l>>>=0,p>>>=0,y>>>=0,v>>>=0;var Z=s()[v+40>>>2>>>0];for(var ae in v={lc:i()[v>>>2>>>0],kc:i()[v+4>>>2>>>0],Ib:i()[v+8>>>2>>>0],Mb:i()[v+12>>>2>>>0],Jb:i()[v+16>>>2>>>0],Db:i()[v+20>>>2>>>0],vb:i()[v+24>>>2>>>0],Cb:i()[v+28>>>2>>>0],sc:i()[v+32>>>2>>>0],jc:i()[v+36>>>2>>>0],mc:Z?Oe(Z):""},y=Oe(y),Z={"%c":"%a %b %d %H:%M:%S %Y","%D":"%m/%d/%y","%F":"%Y-%m-%d","%h":"%b","%r":"%I:%M:%S %p","%R":"%H:%M","%T":"%H:%M:%S","%x":"%m/%d/%y","%X":"%H:%M:%S","%Ec":"%c","%EC":"%C","%Ex":"%m/%d/%y","%EX":"%H:%M:%S","%Ey":"%y","%EY":"%Y","%Od":"%d","%Oe":"%e","%OH":"%H","%OI":"%I","%Om":"%m","%OM":"%M","%OS":"%S","%Ou":"%u","%OU":"%U","%OV":"%V","%Ow":"%w","%OW":"%W","%Oy":"%y"})y=y.replace(new RegExp(ae,"g"),Z[ae]);var me="Sunday Monday Tuesday Wednesday Thursday Friday Saturday".split(" "),we="January February March April May June July August September October November December".split(" ");for(ae in Z={"%a":O=>me[O.vb].substring(0,3),"%A":O=>me[O.vb],"%b":O=>we[O.Jb].substring(0,3),"%B":O=>we[O.Jb],"%C":O=>C((O.Db+1900)/100|0,2),"%d":O=>C(O.Mb,2),"%e":O=>$(O.Mb,2," "),"%g":O=>q(O).toString().substring(2),"%G":q,"%H":O=>C(O.Ib,2),"%I":O=>((O=O.Ib)==0?O=12:12<O&&(O-=12),C(O,2)),"%j":O=>{for(var fe=0,Ae=0;Ae<=O.Jb-1;fe+=(nr(O.Db+1900)?Qo:Yo)[Ae++]);return C(O.Mb+fe,3)},"%m":O=>C(O.Jb+1,2),"%M":O=>C(O.kc,2),"%n":()=>`
`,"%p":O=>0<=O.Ib&&12>O.Ib?"AM":"PM","%S":O=>C(O.lc,2),"%t":()=>"	","%u":O=>O.vb||7,"%U":O=>C(Math.floor((O.Cb+7-O.vb)/7),2),"%V":O=>{var fe=Math.floor((O.Cb+7-(O.vb+6)%7)/7);if(2>=(O.vb+371-O.Cb-2)%7&&fe++,fe)fe==53&&((Ae=(O.vb+371-O.Cb)%7)==4||Ae==3&&nr(O.Db)||(fe=1));else{fe=52;var Ae=(O.vb+7-O.Cb-1)%7;(Ae==4||Ae==5&&nr(O.Db%400-1))&&fe++}return C(fe,2)},"%w":O=>O.vb,"%W":O=>C(Math.floor((O.Cb+7-(O.vb+6)%7)/7),2),"%y":O=>(O.Db+1900).toString().substring(2),"%Y":O=>O.Db+1900,"%z":O=>{var fe=0<=(O=O.jc);return O=Math.abs(O)/60,(fe?"+":"-")+("0000"+(O/60*100+O%60)).slice(-4)},"%Z":O=>O.mc,"%%":()=>"%"},y=y.replace(/%%/g,"\0\0"),Z)y.includes(ae)&&(y=y.replace(new RegExp(ae,"g"),Z[ae](v)));return ae=(function(O){var fe=Array(wn(O)+1);return ho(O,fe,0,fe.length),fe})(y=y.replace(/\0\0/g,"%")),ae.length>p?0:(My(ae,l),ae.length-1)}function Ny(l,p,y,v){return Jo(l>>>0,p>>>0,y>>>0,v>>>0)}g||(function(){for(var l=u.numThreads-1;l--;)io();kt.unshift(()=>{$r++,(function(p){g?p():Promise.all(Tt.map(no)).then(p)})(()=>Gs())})})();for(var Xo=Array(256),ba=0;256>ba;++ba)Xo[ba]=String.fromCharCode(ba);So=Xo,Ct=u.BindingError=class extends Error{constructor(l){super(l),this.name="BindingError"}},u.InternalError=class extends Error{constructor(l){super(l),this.name="InternalError"}},_t.push(0,1,void 0,1,null,1,!0,1,!1,1),u.count_emval_handles=()=>_t.length/2-5-kn.length;var By=[vn,eo,so,co,po,fo,mo,go,yo,_o,vo,bo,wo,$o,xo,ko,Po,Uo,qo,Fo,Ho,Go,Zo,Ko],re=(function(){function l(y,v){return re=y.exports,re=(function(){var $=re,C={};for(let[R,B]of Object.entries($))C[R]=typeof B=="function"?(...q)=>{ga.push(R);try{return B(...q)}finally{Ce||(ga.pop(),ct&&Et===1&&ga.length===0&&(Et=0,Pt+=1,ma(uu),typeof Fibers<"u"&&Fibers.tc()))}}:B;return C})(),re=(function(){var $=re,C=B=>q=>B(q)>>>0,R=B=>()=>B()>>>0;return($=Object.assign({},$)).Da=C($.Da),$.gb=R($.gb),$.ib=C($.ib),$.emscripten_main_runtime_thread_id=R($.emscripten_main_runtime_thread_id),$.tb=C($.tb),$.ub=R($.ub),$})(),to.push(re.jb),wr.unshift(re.Ca),ne=v,Gs(),re}var p=Js();if($r++,u.instantiateWasm)try{return u.instantiateWasm(p,l)}catch(y){A(`Module.instantiateWasm callback failed with error: ${y}`),h(y)}return mn||=u.locateFile?Zs("ort-wasm-simd-threaded.jsep.wasm")?"ort-wasm-simd-threaded.jsep.wasm":u.locateFile?u.locateFile("ort-wasm-simd-threaded.jsep.wasm",E):E+"ort-wasm-simd-threaded.jsep.wasm":new URL("/assets/ort-wasm-simd-threaded.jsep-Y7jqkEt_.wasm",import.meta.url).href,(function(y,v){var $=mn;return I||typeof WebAssembly.instantiateStreaming!="function"||Zs($)||Ks($)||typeof fetch!="function"?Ys($,y,v):fetch($,{credentials:"same-origin"}).then(C=>WebAssembly.instantiateStreaming(C,y).then(v,function(R){return A(`wasm streaming compile failed: ${R}`),A("falling back to ArrayBuffer instantiation"),Ys($,y,v)}))})(p,function(y){l(y.instance,y.module)}).catch(h),{}})(),eu=l=>(eu=re.Da)(l),tu=()=>(tu=re.Ea)();u._OrtInit=(l,p)=>(u._OrtInit=re.Fa)(l,p),u._OrtGetLastError=(l,p)=>(u._OrtGetLastError=re.Ga)(l,p),u._OrtCreateSessionOptions=(l,p,y,v,$,C,R,B,q,Z)=>(u._OrtCreateSessionOptions=re.Ha)(l,p,y,v,$,C,R,B,q,Z),u._OrtAppendExecutionProvider=(l,p)=>(u._OrtAppendExecutionProvider=re.Ia)(l,p),u._OrtAddFreeDimensionOverride=(l,p,y)=>(u._OrtAddFreeDimensionOverride=re.Ja)(l,p,y),u._OrtAddSessionConfigEntry=(l,p,y)=>(u._OrtAddSessionConfigEntry=re.Ka)(l,p,y),u._OrtReleaseSessionOptions=l=>(u._OrtReleaseSessionOptions=re.La)(l),u._OrtCreateSession=(l,p,y)=>(u._OrtCreateSession=re.Ma)(l,p,y),u._OrtReleaseSession=l=>(u._OrtReleaseSession=re.Na)(l),u._OrtGetInputOutputCount=(l,p,y)=>(u._OrtGetInputOutputCount=re.Oa)(l,p,y),u._OrtGetInputName=(l,p)=>(u._OrtGetInputName=re.Pa)(l,p),u._OrtGetOutputName=(l,p)=>(u._OrtGetOutputName=re.Qa)(l,p),u._OrtFree=l=>(u._OrtFree=re.Ra)(l),u._OrtCreateTensor=(l,p,y,v,$,C)=>(u._OrtCreateTensor=re.Sa)(l,p,y,v,$,C),u._OrtGetTensorData=(l,p,y,v,$)=>(u._OrtGetTensorData=re.Ta)(l,p,y,v,$),u._OrtReleaseTensor=l=>(u._OrtReleaseTensor=re.Ua)(l),u._OrtCreateRunOptions=(l,p,y,v)=>(u._OrtCreateRunOptions=re.Va)(l,p,y,v),u._OrtAddRunConfigEntry=(l,p,y)=>(u._OrtAddRunConfigEntry=re.Wa)(l,p,y),u._OrtReleaseRunOptions=l=>(u._OrtReleaseRunOptions=re.Xa)(l),u._OrtCreateBinding=l=>(u._OrtCreateBinding=re.Ya)(l),u._OrtBindInput=(l,p,y)=>(u._OrtBindInput=re.Za)(l,p,y),u._OrtBindOutput=(l,p,y,v)=>(u._OrtBindOutput=re._a)(l,p,y,v),u._OrtClearBoundOutputs=l=>(u._OrtClearBoundOutputs=re.$a)(l),u._OrtReleaseBinding=l=>(u._OrtReleaseBinding=re.ab)(l),u._OrtRunWithBinding=(l,p,y,v,$)=>(u._OrtRunWithBinding=re.bb)(l,p,y,v,$),u._OrtRun=(l,p,y,v,$,C,R,B)=>(u._OrtRun=re.cb)(l,p,y,v,$,C,R,B),u._OrtEndProfiling=l=>(u._OrtEndProfiling=re.db)(l),u._JsepOutput=(l,p,y)=>(u._JsepOutput=re.eb)(l,p,y),u._JsepGetNodeName=l=>(u._JsepGetNodeName=re.fb)(l);var wa,ir=()=>(ir=re.gb)(),pt=u._free=l=>(pt=u._free=re.hb)(l),$a=u._malloc=l=>($a=u._malloc=re.ib)(l),Rn=(l,p,y,v,$,C)=>(Rn=re.lb)(l,p,y,v,$,C),ru=()=>(ru=re.mb)(),au=(l,p,y,v,$)=>(au=re.nb)(l,p,y,v,$),Mn=l=>(Mn=re.ob)(l),xa=l=>(xa=re.pb)(l),nu=()=>(nu=re.qb)(),iu=(l,p)=>(iu=re.rb)(l,p),ka=l=>(ka=re.sb)(l),Nn=l=>(Nn=re.tb)(l),Bn=()=>(Bn=re.ub)(),su=u.dynCall_ii=(l,p)=>(su=u.dynCall_ii=re.wb)(l,p),ou=l=>(ou=re.xb)(l),uu=()=>(uu=re.yb)(),lu=l=>(lu=re.zb)(l),du=()=>(du=re.Ab)();function cu(){0<$r||(g?(c(u),g||pa(wr),startWorker(u)):(pa(kt),0<$r||wa||(wa=!0,u.calledRun=!0,Ce||(g||pa(wr),c(u),g||pa(fn)))))}return u.___start_em_js=932469,u.___stop_em_js=932715,u.stackSave=()=>Bn(),u.stackRestore=l=>ka(l),u.stackAlloc=l=>Nn(l),u.setValue=function(l,p,y="i8"){switch(y.endsWith("*")&&(y="*"),y){case"i1":case"i8":t()[l>>>0]=p;break;case"i16":a()[l>>>1>>>0]=p;break;case"i32":i()[l>>>2>>>0]=p;break;case"i64":ge[l>>>3]=BigInt(p);break;case"float":o()[l>>>2>>>0]=p;break;case"double":d()[l>>>3>>>0]=p;break;case"*":s()[l>>>2>>>0]=p;break;default:St(`invalid type for setValue: ${y}`)}},u.getValue=function(l,p="i8"){switch(p.endsWith("*")&&(p="*"),p){case"i1":case"i8":return t()[l>>>0];case"i16":return a()[l>>>1>>>0];case"i32":return i()[l>>>2>>>0];case"i64":return ge[l>>>3];case"float":return o()[l>>>2>>>0];case"double":return d()[l>>>3>>>0];case"*":return s()[l>>>2>>>0];default:St(`invalid type for getValue: ${p}`)}},u.UTF8ToString=Oe,u.stringToUTF8=ar,u.lengthBytesUTF8=wn,xr=function l(){wa||cu(),wa||(xr=l)},cu(),u.PTR_SIZE=4,f}),Sp=Wn,globalThis.self?.name==="em-pthread"&&Wn()}),qn,gu,qe,Tp,Ta,yu,_u,Fn,vu,Hn,Cp,Gn,Ip,fs=j(()=>{hs(),qn=typeof location>"u"?void 0:location.origin,gu=()=>import.meta.url?.startsWith("file:")?new URL(new URL("/assets/ort.bundle.min-D2-GKZ-g.mjs",import.meta.url).href,qn).href:import.meta.url,qe=gu(),Tp=()=>{if(qe&&!qe.startsWith("blob:"))return qe.substring(0,qe.lastIndexOf("/")+1)},Ta=(e,t)=>{try{let r=t??qe;return(r?new URL(e,r):new URL(e)).origin===qn}catch{return!1}},yu=(e,t)=>{let r=t??qe;try{return(r?new URL(e,r):new URL(e)).href}catch{return}},_u=(e,t)=>`${t??"./"}${e}`,Fn=async e=>{let t=await(await fetch(e,{credentials:"same-origin"})).blob();return URL.createObjectURL(t)},vu=async e=>(await import(e)).default,Hn=(a_(),Wa($p)).default,Cp=async()=>{if(!qe)throw new Error("Failed to load proxy worker: cannot determine the script source URL.");if(Ta(qe))return[void 0,Hn()];let e=await Fn(qe);return[e,Hn(e)]},Gn=(n_(),Wa(kp)).default,Ip=async(e,t,r)=>{if(!e&&!t&&Gn&&qe&&Ta(qe))return[void 0,Gn];{let a="ort-wasm-simd-threaded.jsep.mjs",n=e??yu(a,t),i=r&&n&&!Ta(n,t),s=i?await Fn(n):n??_u(a,t);return[i?s:void 0,await vu(s)]}}}),Zn,Ca,Tr,Kn,bu,wu,ms,Me,tr=j(()=>{fs(),Ca=!1,Tr=!1,Kn=!1,bu=()=>{if(typeof SharedArrayBuffer>"u")return!1;try{return typeof MessageChannel<"u"&&new MessageChannel().port1.postMessage(new SharedArrayBuffer(1)),WebAssembly.validate(new Uint8Array([0,97,115,109,1,0,0,0,1,4,1,96,0,0,3,2,1,0,5,4,1,3,1,1,10,11,1,9,0,65,0,254,16,2,0,26,11]))}catch{return!1}},wu=()=>{try{return WebAssembly.validate(new Uint8Array([0,97,115,109,1,0,0,0,1,4,1,96,0,0,3,2,1,0,10,30,1,28,0,65,0,253,15,253,12,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,253,186,1,26,11]))}catch{return!1}},ms=async e=>{if(Ca)return Promise.resolve();if(Tr)throw new Error("multiple calls to 'initializeWebAssembly()' detected.");if(Kn)throw new Error("previous call to 'initializeWebAssembly()' failed.");Tr=!0;let t=e.initTimeout,r=e.numThreads;if(!wu())throw new Error("WebAssembly SIMD is not supported in the current environment.");let a=bu();r>1&&!a&&(typeof self<"u"&&!self.crossOriginIsolated&&console.warn("env.wasm.numThreads is set to "+r+", but this will not work unless you enable crossOriginIsolated mode. See https://web.dev/cross-origin-isolation-guide/ for more info."),console.warn("WebAssembly multi-threading is not supported in the current environment. Falling back to single-threading."),e.numThreads=r=1);let n=e.wasmPaths,i=typeof n=="string"?n:void 0,s=n?.mjs,o=s?.href??s,d=n?.wasm,c=d?.href??d,h=e.wasmBinary,[u,f]=await Ip(o,i,r>1),m=!1,_=[];if(t>0&&_.push(new Promise(g=>{setTimeout(()=>{m=!0,g()},t)})),_.push(new Promise((g,w)=>{let x={numThreads:r};if(h)x.wasmBinary=h;else if(c||i)x.locateFile=b=>c??i+b;else if(o&&o.indexOf("blob:")!==0)x.locateFile=b=>new URL(b,o).href;else if(u){let b=Tp();b&&(x.locateFile=k=>b+k)}f(x).then(b=>{Tr=!1,Ca=!0,Zn=b,g(),u&&URL.revokeObjectURL(u)},b=>{Tr=!1,Kn=!0,w(b)})})),await Promise.race(_),m)throw new Error(`WebAssembly backend initializing failed due to timeout: ${t}ms`)},Me=()=>{if(Ca&&Zn)return Zn;throw new Error("WebAssembly is not initialized yet.")}}),Pe,qa,be,gs=j(()=>{tr(),Pe=(e,t)=>{let r=Me(),a=r.lengthBytesUTF8(e)+1,n=r._malloc(a);return r.stringToUTF8(e,n,a),t.push(n),n},qa=(e,t,r,a)=>{if(typeof e=="object"&&e!==null){if(r.has(e))throw new Error("Circular reference in options");r.add(e)}Object.entries(e).forEach(([n,i])=>{let s=t?t+n:n;if(typeof i=="object")qa(i,s+".",r,a);else if(typeof i=="string"||typeof i=="number")a(s,i.toString());else if(typeof i=="boolean")a(s,i?"1":"0");else throw new Error(`Can't handle extra config type: ${typeof i}`)})},be=e=>{let t=Me(),r=t.stackSave();try{let a=t.PTR_SIZE,n=t.stackAlloc(2*a);t._OrtGetLastError(n,n+a);let i=Number(t.getValue(n,a===4?"i32":"i64")),s=t.getValue(n+a,"*"),o=s?t.UTF8ToString(s):"";throw new Error(`${e} ERROR_CODE: ${i}, ERROR_MESSAGE: ${o}`)}finally{t.stackRestore(r)}}}),Ep,i_=j(()=>{tr(),gs(),Ep=e=>{let t=Me(),r=0,a=[],n=e||{};try{if(e?.logSeverityLevel===void 0)n.logSeverityLevel=2;else if(typeof e.logSeverityLevel!="number"||!Number.isInteger(e.logSeverityLevel)||e.logSeverityLevel<0||e.logSeverityLevel>4)throw new Error(`log serverity level is not valid: ${e.logSeverityLevel}`);if(e?.logVerbosityLevel===void 0)n.logVerbosityLevel=0;else if(typeof e.logVerbosityLevel!="number"||!Number.isInteger(e.logVerbosityLevel))throw new Error(`log verbosity level is not valid: ${e.logVerbosityLevel}`);e?.terminate===void 0&&(n.terminate=!1);let i=0;return e?.tag!==void 0&&(i=Pe(e.tag,a)),r=t._OrtCreateRunOptions(n.logSeverityLevel,n.logVerbosityLevel,!!n.terminate,i),r===0&&be("Can't create run options."),e?.extra!==void 0&&qa(e.extra,"",new WeakSet,(s,o)=>{let d=Pe(s,a),c=Pe(o,a);t._OrtAddRunConfigEntry(r,d,c)!==0&&be(`Can't set a run config entry: ${s} - ${o}.`)}),[r,a]}catch(i){throw r!==0&&t._OrtReleaseRunOptions(r),a.forEach(s=>t._free(s)),i}}}),$u,xu,ku,Su,Ap,s_=j(()=>{tr(),gs(),$u=e=>{switch(e){case"disabled":return 0;case"basic":return 1;case"extended":return 2;case"all":return 99;default:throw new Error(`unsupported graph optimization level: ${e}`)}},xu=e=>{switch(e){case"sequential":return 0;case"parallel":return 1;default:throw new Error(`unsupported execution mode: ${e}`)}},ku=e=>{e.extra||(e.extra={}),e.extra.session||(e.extra.session={});let t=e.extra.session;t.use_ort_model_bytes_directly||(t.use_ort_model_bytes_directly="1"),e.executionProviders&&e.executionProviders.some(r=>(typeof r=="string"?r:r.name)==="webgpu")&&(e.enableMemPattern=!1)},Su=(e,t,r)=>{for(let a of t){let n=typeof a=="string"?a:a.name;switch(n){case"webnn":if(n="WEBNN",typeof a!="string"){let s=a?.deviceType;if(s){let o=Pe("deviceType",r),d=Pe(s,r);Me()._OrtAddSessionConfigEntry(e,o,d)!==0&&be(`Can't set a session config entry: 'deviceType' - ${s}.`)}}break;case"webgpu":if(n="JS",typeof a!="string"){let s=a;if(s?.preferredLayout){if(s.preferredLayout!=="NCHW"&&s.preferredLayout!=="NHWC")throw new Error(`preferredLayout must be either 'NCHW' or 'NHWC': ${s.preferredLayout}`);let o=Pe("preferredLayout",r),d=Pe(s.preferredLayout,r);Me()._OrtAddSessionConfigEntry(e,o,d)!==0&&be(`Can't set a session config entry: 'preferredLayout' - ${s.preferredLayout}.`)}}break;case"wasm":case"cpu":continue;default:throw new Error(`not supported execution provider: ${n}`)}let i=Pe(n,r);Me()._OrtAppendExecutionProvider(e,i)!==0&&be(`Can't append execution provider: ${n}.`)}},Ap=e=>{let t=Me(),r=0,a=[],n=e||{};ku(n);try{let i=$u(n.graphOptimizationLevel??"all"),s=xu(n.executionMode??"sequential"),o=typeof n.logId=="string"?Pe(n.logId,a):0,d=n.logSeverityLevel??2;if(!Number.isInteger(d)||d<0||d>4)throw new Error(`log serverity level is not valid: ${d}`);let c=n.logVerbosityLevel??0;if(!Number.isInteger(c)||c<0||c>4)throw new Error(`log verbosity level is not valid: ${c}`);let h=typeof n.optimizedModelFilePath=="string"?Pe(n.optimizedModelFilePath,a):0;if(r=t._OrtCreateSessionOptions(i,!!n.enableCpuMemArena,!!n.enableMemPattern,s,!!n.enableProfiling,0,o,d,c,h),r===0&&be("Can't create session options."),n.executionProviders&&Su(r,n.executionProviders,a),n.enableGraphCapture!==void 0){if(typeof n.enableGraphCapture!="boolean")throw new Error(`enableGraphCapture must be a boolean value: ${n.enableGraphCapture}`);let u=Pe("enableGraphCapture",a),f=Pe(n.enableGraphCapture.toString(),a);t._OrtAddSessionConfigEntry(r,u,f)!==0&&be(`Can't set a session config entry: 'enableGraphCapture' - ${n.enableGraphCapture}.`)}if(n.freeDimensionOverrides)for(let[u,f]of Object.entries(n.freeDimensionOverrides)){if(typeof u!="string")throw new Error(`free dimension override name must be a string: ${u}`);if(typeof f!="number"||!Number.isInteger(f)||f<0)throw new Error(`free dimension override value must be a non-negative integer: ${f}`);let m=Pe(u,a);t._OrtAddFreeDimensionOverride(r,m,f)!==0&&be(`Can't set a free dimension override: ${u} - ${f}.`)}return n.extra!==void 0&&qa(n.extra,"",new WeakSet,(u,f)=>{let m=Pe(u,a),_=Pe(f,a);t._OrtAddSessionConfigEntry(r,m,_)!==0&&be(`Can't set a session config entry: ${u} - ${f}.`)}),[r,a]}catch(i){throw r!==0&&t._OrtReleaseSessionOptions(r)!==0&&be("Can't release session options."),a.forEach(s=>t._free(s)),i}}}),Dr,Ht,lr,ys,Fa,_s,vs,Ui,ie=j(()=>{Dr=e=>{switch(e){case"int8":return 3;case"uint8":return 2;case"bool":return 9;case"int16":return 5;case"uint16":return 4;case"int32":return 6;case"uint32":return 12;case"float16":return 10;case"float32":return 1;case"float64":return 11;case"string":return 8;case"int64":return 7;case"uint64":return 13;case"int4":return 22;case"uint4":return 21;default:throw new Error(`unsupported data type: ${e}`)}},Ht=e=>{switch(e){case 3:return"int8";case 2:return"uint8";case 9:return"bool";case 5:return"int16";case 4:return"uint16";case 6:return"int32";case 12:return"uint32";case 10:return"float16";case 1:return"float32";case 11:return"float64";case 8:return"string";case 7:return"int64";case 13:return"uint64";case 22:return"int4";case 21:return"uint4";default:throw new Error(`unsupported data type: ${e}`)}},lr=(e,t)=>{let r=[-1,4,1,1,2,2,4,8,-1,1,2,8,4,8,-1,-1,-1,-1,-1,-1,-1,.5,.5][e],a=typeof t=="number"?t:t.reduce((n,i)=>n*i,1);return r>0?Math.ceil(a*r):void 0},ys=e=>{switch(e){case"float16":return typeof Float16Array<"u"&&Float16Array.from?Float16Array:Uint16Array;case"float32":return Float32Array;case"uint8":return Uint8Array;case"int8":return Int8Array;case"uint16":return Uint16Array;case"int16":return Int16Array;case"int32":return Int32Array;case"bool":return Uint8Array;case"float64":return Float64Array;case"uint32":return Uint32Array;case"int64":return BigInt64Array;case"uint64":return BigUint64Array;default:throw new Error(`unsupported type: ${e}`)}},Fa=e=>{switch(e){case"verbose":return 0;case"info":return 1;case"warning":return 2;case"error":return 3;case"fatal":return 4;default:throw new Error(`unsupported logging level: ${e}`)}},_s=e=>e==="float32"||e==="float16"||e==="int32"||e==="int64"||e==="uint32"||e==="uint8"||e==="bool"||e==="uint4"||e==="int4",vs=e=>e==="float32"||e==="float16"||e==="int32"||e==="int64"||e==="uint32"||e==="uint64"||e==="int8"||e==="uint8"||e==="bool"||e==="uint4"||e==="int4",Ui=e=>{switch(e){case"none":return 0;case"cpu":return 1;case"cpu-pinned":return 2;case"texture":return 3;case"gpu-buffer":return 4;case"ml-tensor":return 5;default:throw new Error(`unsupported data location: ${e}`)}}}),bs,zp=j(()=>{hs(),bs=async e=>{if(typeof e=="string"){let t=await fetch(e);if(!t.ok)throw new Error(`failed to load external data file: ${e}`);let r=t.headers.get("Content-Length"),a=r?parseInt(r,10):0;if(a<1073741824)return new Uint8Array(await t.arrayBuffer());{if(!t.body)throw new Error(`failed to load external data file: ${e}, no response body.`);let n=t.body.getReader(),i;try{i=new ArrayBuffer(a)}catch(o){if(o instanceof RangeError){let d=Math.ceil(a/65536);i=new WebAssembly.Memory({initial:d,maximum:d}).buffer}else throw o}let s=0;for(;;){let{done:o,value:d}=await n.read();if(o)break;let c=d.byteLength;new Uint8Array(i,s,c).set(d),s+=c}return new Uint8Array(i,0,a)}}else return e instanceof Blob?new Uint8Array(await e.arrayBuffer()):e instanceof Uint8Array?e:new Uint8Array(e)}}),Tu,Cu,Iu,Eu,ws,Au,$e,xt=j(()=>{ie(),Tu=["V","I","W","E","F"],Cu=(e,t)=>{console.log(`[${Tu[e]},${new Date().toISOString()}]${t}`)},ws=(e,t)=>{Iu=e,Eu=t},Au=(e,t)=>{let r=Fa(e),a=Fa(Iu);r>=a&&Cu(r,typeof t=="function"?t():t)},$e=(...e)=>{Eu&&Au(...e)}}),$s,Op=j(()=>{ie(),$s=(e,t)=>new(ys(t))(e)}),xs=j(()=>{}),Qn,Ia,Ea,zu,Ou,Yn,ji,Ru,Rp,o_=j(()=>{xt(),xs(),Qn=new Map([[64,250],[128,200],[256,200],[512,200],[2048,230],[4096,200],[8192,50],[16384,50],[32768,50],[65536,50],[131072,50],[262144,50],[524288,50],[1048576,50],[2097152,30],[4194304,20],[8388608,10],[12582912,10],[16777216,10],[26214400,15],[33554432,22],[44236800,2],[58982400,6],[67108864,6],[134217728,6],[167772160,6]]),Ia=[],Ea=e=>Math.ceil(Number(e)/16)*16,zu=e=>{for(let t=0;t<Ia.length;t++){let r=Ia[t];if(e<=r)return r}return Math.ceil(e/16)*16},Ou=1,Yn=()=>Ou++,ji=async(e,t,r,a)=>{let n=Ea(r),i=e.device.createBuffer({size:n,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ});try{let s=e.getCommandEncoder();e.endComputePass(),s.copyBufferToBuffer(t,0,i,0,n),e.flush(),await i.mapAsync(GPUMapMode.READ);let o=i.getMappedRange();if(a){let d=a();return d.set(new Uint8Array(o,0,r)),d}else return new Uint8Array(o.slice(0,r))}finally{i.destroy()}},Ru=class{constructor(e){this.backend=e,this.storageCache=new Map,this.freeBuffers=new Map,this.freeUniformBuffers=new Map,this.buffersPending=[],this.capturedPendingBuffers=new Map;for(let[t]of Qn)Ia.push(t),this.freeBuffers.set(t,[]),this.freeUniformBuffers.set(t,[]);this.sessionCount=0}upload(e,t){let r=t.buffer,a=t.byteOffset,n=t.byteLength,i=Ea(n),s=this.storageCache.get(e);if(!s)throw new Error("gpu data for uploading does not exist");if(Number(s.originalSize)!==n)throw new Error(`inconsistent data size. gpu data size=${s.originalSize}, data size=${n}`);let o=this.backend.device.createBuffer({mappedAtCreation:!0,size:i,usage:GPUBufferUsage.MAP_WRITE|GPUBufferUsage.COPY_SRC}),d=o.getMappedRange();new Uint8Array(d).set(new Uint8Array(r,a,n)),o.unmap();let c=this.backend.device.createCommandEncoder();c.copyBufferToBuffer(o,0,s.gpuData.buffer,0,i),this.backend.device.queue.submit([c.finish()]),o.destroy(),$e("verbose",()=>`[WebGPU] GpuDataManager.upload(id=${e})`)}memcpy(e,t){let r=this.storageCache.get(e);if(!r)throw new Error("source gpu data for memcpy does not exist");let a=this.storageCache.get(t);if(!a)throw new Error("destination gpu data for memcpy does not exist");if(r.originalSize!==a.originalSize)throw new Error("inconsistent source and destination gpu data size");let n=Ea(r.originalSize),i=this.backend.getCommandEncoder();this.backend.endComputePass(),i.copyBufferToBuffer(r.gpuData.buffer,0,a.gpuData.buffer,0,n)}registerExternalBuffer(e,t,r){let a;if(r){if(a=r[0],e===r[1])return $e("verbose",()=>`[WebGPU] GpuDataManager.registerExternalBuffer(size=${t}) => id=${a}, buffer is the same, skip.`),a;if(this.backend.capturedCommandList.has(this.backend.currentSessionId))throw new Error(`Registering a different external buffer under graph capture mode is not supported yet.
             Please use the previous external buffer!`)}else a=Yn();return this.storageCache.set(a,{gpuData:{id:a,type:0,buffer:e},originalSize:t}),$e("verbose",()=>`[WebGPU] GpuDataManager.registerExternalBuffer(size=${t}) => id=${a}, registered.`),a}unregisterExternalBuffer(e){e!==void 0&&(this.storageCache.delete(e),$e("verbose",()=>`[WebGPU] GpuDataManager.unregisterExternalBuffer() => id=${e}`))}create(e,t=GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC|GPUBufferUsage.COPY_DST){let r=zu(e),a,n=(t&GPUBufferUsage.STORAGE)===GPUBufferUsage.STORAGE,i=(t&GPUBufferUsage.UNIFORM)===GPUBufferUsage.UNIFORM;if(n||i){let o=(n?this.freeBuffers:this.freeUniformBuffers).get(r);o?o.length>0?a=o.pop():a=this.backend.device.createBuffer({size:r,usage:t}):a=this.backend.device.createBuffer({size:r,usage:t})}else a=this.backend.device.createBuffer({size:r,usage:t});let s={id:Yn(),type:0,buffer:a};return this.storageCache.set(s.id,{gpuData:s,originalSize:Number(e)}),$e("verbose",()=>`[WebGPU] GpuDataManager.create(size=${e}) => id=${s.id}`),s}get(e){return this.storageCache.get(e)?.gpuData}release(e){let t=typeof e=="bigint"?Number(e):e,r=this.storageCache.get(t);if(!r){if(this.storageCache.size===0)return 0;throw new Error("releasing data does not exist")}return $e("verbose",()=>`[WebGPU] GpuDataManager.release(id=${t}), gpuDataId=${r.gpuData.id}`),this.storageCache.delete(t),this.buffersPending.push(r.gpuData.buffer),r.originalSize}async download(e,t){let r=this.storageCache.get(Number(e));if(!r)throw new Error("data does not exist");await ji(this.backend,r.gpuData.buffer,r.originalSize,t)}refreshPendingBuffers(){if(this.buffersPending.length!==0)if(this.backend.sessionStatus==="default"){for(let e of this.buffersPending){let t=Qn.get(e.size);if((e.usage&GPUBufferUsage.STORAGE)===GPUBufferUsage.STORAGE){let r=this.freeBuffers.get(e.size)||[];t===void 0||r.length>=t?e.destroy():r.push(e)}else if((e.usage&GPUBufferUsage.UNIFORM)===GPUBufferUsage.UNIFORM){let r=this.freeUniformBuffers.get(e.size)||[];t===void 0||r.length>=t?e.destroy():r.push(e)}else e.destroy()}this.buffersPending=[]}else{let e=this.capturedPendingBuffers.get(this.backend.currentSessionId);e||(e=[],this.capturedPendingBuffers.set(this.backend.currentSessionId,e));for(let t of this.buffersPending)e.push(t);this.buffersPending=[]}}dispose(){this.freeBuffers.forEach(e=>{e.forEach(t=>{t.destroy()})}),this.freeUniformBuffers.forEach(e=>{e.forEach(t=>{t.destroy()})}),this.storageCache.forEach(e=>{e.gpuData.buffer.destroy()}),this.capturedPendingBuffers.forEach(e=>{e.forEach(t=>{t.destroy()})}),this.storageCache=new Map,this.freeBuffers=new Map,this.freeUniformBuffers=new Map,this.capturedPendingBuffers=new Map}onCreateSession(){this.sessionCount+=1}onReleaseSession(e){let t=this.capturedPendingBuffers.get(e);t&&(t.forEach(r=>{r.destroy()}),this.capturedPendingBuffers.delete(e)),this.sessionCount-=1,this.sessionCount===0&&($e("warning",()=>"[WebGPU] Clearing webgpu buffer cache"),this.storageCache.forEach(r=>{r.gpuData.buffer.destroy()}),this.storageCache=new Map)}},Rp=(...e)=>new Ru(...e)}),Mu,xe,ze=j(()=>{Mu=class{constructor(e){Object.assign(this,e)}get cacheKey(){return this.key||(this.key=Object.getOwnPropertyNames(this).sort().map(e=>`${this[e]}`).join(";")),this.key}},xe=e=>new Mu(e)}),Nu,pr,z,Ha,Mp,Np,Bp,le=j(()=>{Nu=class{static calcMatMulShape(e,t){return e[1]!==t[0]?void 0:[e[0],t[1]]}},pr=class{static calcShape(e,t,r=!1){let a=e.length,n=t.length;if(a===0)return t;if(n===0)return e;let i=Math.max(e.length,t.length),s=new Array(i);if(r){if(a<2||n<2)return;let o=Nu.calcMatMulShape([e[a-2],e[a-1]],[t[n-2],t[n-1]]);if(o===void 0)return;[s[i-2],s[i-1]]=o}for(let o=r?3:1;o<=i;o++){let d=a-o<0?1:e[a-o],c=n-o<0?1:t[n-o];if(d!==c&&d>1&&c>1)return;let h=Math.max(d,c);if(d&&c)s[i-o]=Math.max(d,c);else{if(h>1)return;s[i-o]=0}}return s}static isValidBroadcast(e,t){let r=e.length,a=t.length;if(r>a)return!1;for(let n=1;n<=r;n++)if(e[r-n]!==1&&e[r-n]!==t[a-n])return!1;return!0}},z=class Ua{static size(t){return Ua.getSizeFromDimensionRange(t,0,t.length)}static convertShape(t,r=4){let a=t.length;if(a===0)return[];let n=new Array(a),i=a-1;for(;i>=0;){if(t[i]%r===0){n[i]=t[i]/r;break}if(r%t[i]!==0)throw new Error("cannot convert shape");n[i]=1,r/=t[i],i--}for(i--;i>=0;i--)n[i]=t[i];return n}static sizeFromDimension(t,r){if(r<0||r>t.length)throw new Error(`invalid dimension of ${r} for sizeFromDimension as Tensor has ${t.length} dimensions.`);return Ua.getSizeFromDimensionRange(t,r,t.length)}static sizeToDimension(t,r){if(r<0||r>t.length)throw new Error(`invalid dimension of ${r} for sizeToDimension as Tensor has ${t.length} dimensions.`);return Ua.getSizeFromDimensionRange(t,0,r)}static getSizeFromDimensionRange(t,r,a){let n=1;for(let i=r;i<a;i++){if(t[i]<0)throw new Error("cannot get valid size from specified dimension range. Most likely the range contains negative values in them.");n*=Number(t[i])}return n}static computeStrides(t){let r=t.length;if(r===0)return[];if(r===1)return[1];let a=new Array(r);a[r-1]=1,a[r-2]=t[r-1];for(let n=r-3;n>=0;--n)a[n]=a[n+1]*t[n+1];return a}static normalizeAxis(t,r){if(t<-r&&t>=r)throw new Error("unsupported axis for this operation.");return t<0?t+r:t}static normalizeAxes(t,r){return t.map(a=>this.normalizeAxis(a,r??t.length))}static sortBasedOnPerm(t,r){return r?r.map(a=>t[a]):t.slice().reverse()}static padShape(t,r){let a=t.length;return t.map((n,i)=>n+r[i]+r[i+a])}static areEqual(t,r){return t.length!==r.length?!1:t.every((a,n)=>a===r[n])}},Ha=class Pr{static adjustPoolAttributes(t,r,a,n,i,s){if(!t&&a.length!==r.length-2)throw new Error("length of specified kernel shapes should be 2 less than length of input dimensions");if(t)for(let o=0;o<r.length-2;o++)o>=a.length?a.push(r[o+2]):a[o]=r[o+2];for(let o=0;o<a.length;o++)if(o<n.length){if(n[o]<0)throw new Error("strides should be greater than or equal to 1")}else n.push(1);for(let o=0;o<a.length;o++)if(o<i.length){if(i[o]<0)throw new Error("dilations should be greater than or equal to 1")}else i.push(1);for(let o=0;o<a.length*2;o++)if(o<s.length){if(s[o]<0)throw new Error("pad should be greater than or equal to 1")}else s.push(0);for(let o=0;o<a.length;o++){if(a[o]<=0)throw new Error("kernel shapes need to be greater than 0");if(s[o]>=a[o]||s[o+a.length]>=a[o])throw new Error("pads should be smaller than kernel")}}static adjustPadsBasedOnAutoPad(t,r,a,n,i,s,o){if(o){if(i.length!==2*(t.length-2))throw new Error("length of pads should be twice the length of data dimensions");if(r.length!==t.length-2)throw new Error("length of strides should be the length of data dimensions");if(n.length!==t.length-2)throw new Error("length of kernel shapes should be the length of data dimensions");for(let d=0;d<t.length-2;d++)Pr.adjustPadAndReturnShape(t[d+(s?1:2)],r[d],a[d],n[d],i,d,d+t.length-2,o)}}static computePoolOutputShape(t,r,a,n,i,s,o){if(r.length<=0)throw new Error("input shape must be of size greater than 0");let d=[r[0],r[1]];return Pr.computeShapeHelper(t,r,d,a,n,i,s,o),d}static computeConvOutputShape(t,r,a,n,i,s,o){if(t.length<=0||r.length<=0)throw new Error("invalid input tensor dims or invalid filter tensor dims");let d=[t[0],r[0]];return Pr.computeShapeHelper(!1,t,d,a,n,i,s,o),d}static computeShapeHelper(t,r,a,n,i,s,o,d){if(t)for(let c=0;c<r.length-2;c++)a.push(1);else for(let c=0;c<r.length-2;c++)a.push(Pr.adjustPadAndReturnShape(r[c+2],n[c],i[c],s[c],o,c,c+r.length-2,d))}static adjustPadAndReturnShape(t,r,a,n,i,s,o,d){let c=a*(n-1)+1;if(d&&d!=="NOTSET")switch(d){case"VALID":return i[s]=0,i[o]=0,Math.floor((t-c)/r+1);case"SAME_LOWER":case"SAME_UPPER":if(a!==1)throw new Error("Dilation not supported for SAME_UPPER or SAME_LOWER");{let h=((t+r-1)/r-1)*r+n-t;return i[s]=Math.floor(d==="SAME_LOWER"?(h+1)/2:h/2),i[o]=h-i[s],Math.floor((t+h-n)/r+1)}default:throw new Error("Unsupported AutoPad type")}else return Math.floor((t+i[s]+i[o]-c)/r+1)}},Mp=class{static getShapeOfGemmResult(e,t,r,a,n){if(e.length!==2||r.length!==2)throw new Error("shape need to be of size 2");let i,s,o;t?(i=e[1],s=e[0]):(i=e[0],s=e[1]);let d=-1;if(a?(o=r[0],d=1):(o=r[1],d=0),r[d]!==s)throw new Error("dimension mismatch");if(i<=0||o<=0||s<=0)throw new Error("invalid shape specified");if(n&&!pr.isValidBroadcast(n,[i,o]))throw new Error("gemm: invalid bias shape for broadcast");return[i,o,s]}},Np=-34028234663852886e22,Bp=34028234663852886e22}),hr,Aa,Ne,Ue,ee,Ee,Li,dr,Mt,X,Cr,M,Y,Dp,ks,Bu,Pp,de=j(()=>{ie(),le(),hr=64,Aa=(e,t)=>{if(t===3)throw new Error("vec3 has same alignment as vec4, use vec4 instead");switch(Number(e)){case 10:return t>1?`vec${t}<f16>`:"f16";case 1:return t>1?`vec${t}<f32>`:"f32";case 6:return t>1?`vec${t}<i32>`:"i32";case 12:return t>1?`vec${t}<u32>`:"u32";case 7:if(t>1)throw new Error("currently not supported vecX of uint64 yet");return["vec2<u32>","i32"];case 13:if(t>1)throw new Error("currently not supported vecX of uint64 yet");return["vec2<u32>","u32"];case 9:if(t!==4)throw new Error("bool must be vec4");return["u32","vec4<bool>"];case 22:return"i32";case 21:return"u32";default:throw new Error(`Unknown data type: ${e}`)}},Ne=(e,t=1)=>{let r=Aa(e,t);return typeof r=="string"?r:r[0]},Ue=(e,t=1)=>{let r=Aa(e,t);return typeof r=="string"?r:r[1]},ee=(...e)=>{let t=[];return e.forEach(r=>{r.length!==0&&t.push({type:12,data:r},{type:12,data:z.computeStrides(r)})}),t},Ee=e=>e%4===0?4:e%2===0?2:1,Li=(e="f32",t,r="0")=>!t||t===1?`${e}(${r})`:`vec${t}<${e}>(${r})`,dr=(e,t,r)=>e==="f32"?r:t===1?`f32(${r})`:`vec${t}<f32>(${r})`,Mt=(e,t)=>t===4?`(${e}.x + ${e}.y + ${e}.z + ${e}.w)`:t===2?`(${e}.x + ${e}.y)`:t===3?`(${e}.x + ${e}.y + ${e}.z)`:e,X=(e,t,r,a)=>e.startsWith("uniforms.")&&r>4?typeof t=="string"?a==="f16"?`${e}[(${t}) / 8][(${t}) % 8 / 4][(${t}) % 8 % 4]`:`${e}[(${t}) / 4][(${t}) % 4]`:a==="f16"?`${e}[${Math.floor(t/8)}][${Math.floor(t%8/4)}][${t%8%4}]`:`${e}[${Math.floor(t/4)}][${t%4}]`:r>1?`${e}[${t}]`:e,Cr=(e,t,r,a,n)=>{let i=typeof r=="number",s=i?r:r.length,o=[...new Array(s).keys()],d=s<2?"u32":s<=4?`vec${s}<u32>`:`array<u32, ${s}>`,c=Aa(t,n),h=typeof c=="string"?c:c[1],u=typeof c=="string"?c:c[0],f={indices:d,value:h,storage:u,tensor:t},m=U=>typeof U=="string"?U:`${U}u`,_={offsetToIndices:!1,indicesToOffset:!1,broadcastedIndicesToOffset:!1,set:!1,setByIndices:!1,get:!1,getByIndices:!1},g=i?"uniforms.":"",w=`${g}${e}_shape`,x=`${g}${e}_strides`,b="";for(let U=0;U<s-1;U++)b+=`
    let dim${U} = current / ${X(x,U,s)};
    let rest${U} = current % ${X(x,U,s)};
    indices[${U}] = dim${U};
    current = rest${U};
    `;b+=`indices[${s-1}] = current;`;let k=s<2?"":`
  fn o2i_${e}(offset: u32) -> ${f.indices} {
    var indices: ${f.indices};
    var current = offset;
    ${b}
    return indices;
  }`,S=U=>(_.offsetToIndices=!0,s<2?U:`o2i_${e}(${U})`),T=[];if(s>=2)for(let U=s-1;U>=0;U--)T.push(`${X(x,U,s)} * (indices[${U}])`);let E=s<2?"":`
  fn i2o_${e}(indices: ${f.indices}) -> u32 {
    return ${T.join("+")};
  }`,I=U=>(_.indicesToOffset=!0,s<2?U:`i2o_${e}(${U})`),N=(...U)=>s===0?"0u":`${f.indices}(${U.map(m).join(",")})`,D=(U,G)=>s<2?`${U}`:`${X(U,G,s)}`,V=(U,G,ye)=>s<2?`${U}=${ye};`:`${X(U,G,s)}=${ye};`,A={},W=(U,G)=>{_.broadcastedIndicesToOffset=!0;let ye=`${G.name}broadcastedIndicesTo${e}Offset`;if(ye in A)return`${ye}(${U})`;let ge=[];for(let Re=s-1;Re>=0;Re--){let gt=G.indicesGet("outputIndices",Re+G.rank-s);ge.push(`${D(x,Re)} * (${gt} % ${D(w,Re)})`)}return A[ye]=`fn ${ye}(outputIndices: ${G.type.indices}) -> u32 {
             return ${ge.length>0?ge.join("+"):"0u"};
           }`,`${ye}(${U})`},P=(U,G)=>(()=>{if(f.storage===f.value)return`${e}[${U}]=${G};`;if(f.storage==="vec2<u32>"&&f.value==="i32")return`${e}[${U}]=vec2<u32>(u32(${G}), select(0u, 0xFFFFFFFFu, ${G} < 0));`;if(f.storage==="vec2<u32>"&&f.value==="u32")return`${e}[${U}]=vec2<u32>(u32(${G}), 0u);`;if(f.storage==="u32"&&f.value==="vec4<bool>")return`${e}[${U}]=dot(vec4<u32>(0x1, 0x100, 0x10000, 0x1000000), vec4<u32>(${G}));`;throw new Error(`not supported combination of storage type ${f.storage} and value type ${f.value} yet`)})(),J=U=>(()=>{if(f.storage===f.value)return`${e}[${U}]`;if(f.storage==="vec2<u32>"&&f.value==="i32")return`i32(${e}[${U}].x)`;if(f.storage==="vec2<u32>"&&f.value==="u32")return`u32(${e}[${U}].x)`;if(f.storage==="u32"&&f.value==="vec4<bool>")return`vec4<bool>(bool(${e}[${U}] & 0xFFu), bool(${e}[${U}] & 0xFF00u), bool(${e}[${U}] & 0xFF0000u), bool(${e}[${U}] & 0xFF000000u))`;throw new Error(`not supported combination of storage type ${f.storage} and value type ${f.value} yet`)})(),ne=s<2?"":`
  fn get_${e}ByIndices(indices: ${f.indices}) -> ${h} {
    return ${J(`i2o_${e}(indices)`)};
  }`,F=s<2?"":(()=>{let U=o.map(ye=>`d${ye}: u32`).join(", "),G=o.map(ye=>`d${ye}`).join(", ");return`
  fn get_${e}(${U}) -> ${h} {
    return get_${e}ByIndices(${N(G)});
  }`})(),se=(...U)=>{if(U.length!==s)throw new Error(`indices length must be ${s}`);let G=U.map(m).join(",");return s===0?J("0u"):s===1?J(G[0]):(_.get=!0,_.getByIndices=!0,_.indicesToOffset=!0,`get_${e}(${G})`)},ce=U=>s<2?J(U):(_.getByIndices=!0,_.indicesToOffset=!0,`get_${e}ByIndices(${U})`),K=s<2?"":`
  fn set_${e}ByIndices(indices: ${f.indices}, value: ${h}) {
    ${P(`i2o_${e}(indices)`,"value")}
  }`,Te=s<2?"":(()=>{let U=o.map(ye=>`d${ye}: u32`).join(", "),G=o.map(ye=>`d${ye}`).join(", ");return`
  fn set_${e}(${U}, value: ${h}) {
    set_${e}ByIndices(${N(G)}, value);
  }`})();return{impl:()=>{let U=[],G=!1;return _.offsetToIndices&&(U.push(k),G=!0),_.indicesToOffset&&(U.push(E),G=!0),_.broadcastedIndicesToOffset&&(Object.values(A).forEach(ye=>U.push(ye)),G=!0),_.set&&(U.push(Te),G=!0),_.setByIndices&&(U.push(K),G=!0),_.get&&(U.push(F),G=!0),_.getByIndices&&(U.push(ne),G=!0),!i&&G&&U.unshift(`const ${w} = ${f.indices}(${r.join(",")});`,`const ${x} = ${f.indices}(${z.computeStrides(r).join(",")});`),U.join(`
`)},type:f,offsetToIndices:S,indicesToOffset:I,broadcastedIndicesToOffset:W,indices:N,indicesGet:D,indicesSet:V,set:(...U)=>{if(U.length!==s+1)throw new Error(`indices length must be ${s}`);let G=U[s];if(typeof G!="string")throw new Error("value must be string");let ye=U.slice(0,s).map(m).join(",");return s===0?P("0u",G):s===1?P(ye[0],G):(_.set=!0,_.setByIndices=!0,_.indicesToOffset=!0,`set_${e}(${ye}, ${G})`)},setByOffset:P,setByIndices:(U,G)=>s<2?P(U,G):(_.setByIndices=!0,_.indicesToOffset=!0,`set_${e}ByIndices(${U}, ${G});`),get:se,getByOffset:J,getByIndices:ce,usage:a,name:e,strides:x,shape:w,rank:s}},M=(e,t,r,a=1)=>Cr(e,t,r,"input",a),Y=(e,t,r,a=1)=>Cr(e,t,r,"output",a),Dp=(e,t,r)=>Cr(e,t,r,"atomicOutput",1),ks=(e,t,r,a=1)=>Cr(e,t,r,"internal",a),Bu=class{constructor(e,t){this.normalizedDispatchGroup=e,this.limits=t,this.internalVariables=[],this.variables=[],this.uniforms=[],this.variableIndex=0}guardAgainstOutOfBoundsWorkgroupSizes(e){return`if (global_idx >= ${typeof e=="number"?`${e}u`:e}) { return; }`}mainStart(e=hr){let t=typeof e=="number"?e:e[0],r=typeof e=="number"?1:e[1],a=typeof e=="number"?1:e[2];if(t>this.limits.maxComputeWorkgroupSizeX||r>this.limits.maxComputeWorkgroupSizeY||a>this.limits.maxComputeWorkgroupSizeZ)throw new Error(`workgroup size [${t}, ${r}, ${a}] exceeds the maximum workgroup size [${this.limits.maxComputeWorkgroupSizeX}, ${this.limits.maxComputeWorkgroupSizeY}, ${this.limits.maxComputeWorkgroupSizeZ}].`);if(t*r*a>this.limits.maxComputeInvocationsPerWorkgroup)throw new Error(`workgroup size [${t}, ${r}, ${a}] exceeds the maximum workgroup invocations ${this.limits.maxComputeInvocationsPerWorkgroup}.`);let n=this.normalizedDispatchGroup[1]===1&&this.normalizedDispatchGroup[2]===1,i=n?`@builtin(global_invocation_id) global_id : vec3<u32>,
    @builtin(workgroup_id) workgroup_id : vec3<u32>,
    @builtin(local_invocation_index) local_idx : u32,
    @builtin(local_invocation_id) local_id : vec3<u32>`:`@builtin(global_invocation_id) global_id : vec3<u32>,
                                             @builtin(local_invocation_id) local_id : vec3<u32>,
    @builtin(local_invocation_index) local_idx : u32,
    @builtin(workgroup_id) workgroup_id : vec3<u32>,
    @builtin(num_workgroups) num_workgroups : vec3<u32>`,s=n?`let global_idx = global_id.x;
         let workgroup_index = workgroup_id.x;`:`let workgroup_index = workgroup_id.z * num_workgroups[0] * num_workgroups[1] +
             workgroup_id.y * num_workgroups[0] + workgroup_id.x;
         let global_idx = workgroup_index * ${t*r*a}u + local_idx;`;return`@compute @workgroup_size(${t}, ${r}, ${a})
  fn main(${i}) {
    ${s}
  `}appendVariableUniforms(e){e.rank!==0&&(e.shape.startsWith("uniforms.")&&this.uniforms.push({name:e.shape.replace("uniforms.",""),type:"u32",length:e.rank}),e.strides.startsWith("uniforms.")&&this.uniforms.push({name:e.strides.replace("uniforms.",""),type:"u32",length:e.rank}))}declareVariable(e,t){if(e.usage==="internal")throw new Error("cannot use internal variable with declareVariable(). use registerInternalVariables() instead.");this.variables.push(e),this.appendVariableUniforms(e);let r=e.usage==="input"?"read":"read_write",a=e.usage==="atomicOutput"?"atomic<i32>":e.type.storage;return`@group(0) @binding(${t}) var<storage, ${r}> ${e.name}: array<${a}>;`}declareVariables(...e){return e.map(t=>this.declareVariable(t,this.variableIndex++)).join(`
`)}registerInternalVariable(e){if(e.usage!=="internal")throw new Error("cannot use input or output variable with registerInternalVariable(). use declareVariables() instead.");this.internalVariables.push(e),this.appendVariableUniforms(e)}registerInternalVariables(...e){return e.forEach(t=>this.registerInternalVariable(t)),this}registerUniform(e,t,r=1){return this.uniforms.push({name:e,type:t,length:r}),this}registerUniforms(e){return this.uniforms=this.uniforms.concat(e),this}uniformDeclaration(){if(this.uniforms.length===0)return"";let e=[];for(let{name:t,type:r,length:a}of this.uniforms)if(a&&a>4)r==="f16"?e.push(`@align(16) ${t}:array<mat2x4<${r}>, ${Math.ceil(a/8)}>`):e.push(`${t}:array<vec4<${r}>, ${Math.ceil(a/4)}>`);else{let n=a==null||a===1?r:`vec${a}<${r}>`;e.push(`${t}:${n}`)}return`
      struct Uniforms { ${e.join(", ")} };
      @group(0) @binding(${this.variableIndex}) var<uniform> uniforms: Uniforms;`}get additionalImplementations(){return this.uniformDeclaration()+this.variables.map(e=>e.impl()).join(`
`)+this.internalVariables.map(e=>e.impl()).join(`
`)}get variablesInfo(){if(this.uniforms.length===0)return;let e=t=>[12,10,1,6][["u32","f16","f32","i32"].indexOf(t)];return this.uniforms.map(t=>[e(t.type),t.length??1])}},Pp=(e,t)=>new Bu(e,t)}),Du,Jn,Pu,Uu,ju,Lu,He,Up,jp,Dt=j(()=>{ie(),le(),ze(),de(),Du=(e,t)=>{if(!e||e.length!==1)throw new Error("Transpose requires 1 input.");if(t.length!==0&&t.length!==e[0].dims.length)throw new Error(`perm size ${t.length} does not match input rank ${e[0].dims.length}`)},Jn=(e,t)=>t.length!==0?t:[...new Array(e).keys()].reverse(),Pu=(e,t)=>z.sortBasedOnPerm(e,Jn(e.length,t)),Uu=(e,t,r,a)=>{let n=`fn perm(i: ${a.type.indices}) -> ${r.type.indices} {
    var a: ${r.type.indices};`;for(let i=0;i<t;++i)n+=`a[${e[i]}]=i[${i}];`;return n+="return a;}"},ju=(e,t)=>{let r=[],a=[];for(let n=0;n<e.length;++n)e[n]!==1&&r.push(e[n]),e[t[n]]!==1&&a.push(t[n]);return{newShape:r,newPerm:a}},Lu=(e,t)=>{let r=0;for(let a=0;a<e.length;++a)if(t[e[a]]!==1){if(e[a]<r)return!1;r=e[a]}return!0},He=(e,t)=>{let r=e.dataType,a=e.dims.length,n=Jn(a,t),i=Pu(e.dims,n),s=e.dims,o=i,d=a<2||Lu(n,e.dims),c;if(d)return c=_=>{let g=M("input",r,s,4),w=Y("output",r,o,4);return`
  ${_.registerUniform("output_size","u32").declareVariables(g,w)}
  ${_.mainStart()}
    ${_.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.output_size")}
    output[global_idx] = input[global_idx];
  }`},{name:"TransposeCopy",shaderCache:{inputDependencies:["type"]},getRunData:()=>{let _=z.size(i);return{outputs:[{dims:i,dataType:e.dataType}],dispatchGroup:{x:Math.ceil(_/64/4)},programUniforms:[{type:12,data:Math.ceil(_/4)}]}},getShaderSource:c};let{newShape:h,newPerm:u}=ju(e.dims,n),f=z.areEqual(u,[2,3,1]),m=z.areEqual(u,[3,1,2]);if(h.length===2||f||m){s=f?[h[0],h[1]*h[2]]:m?[h[0]*h[1],h[2]]:h,o=[s[1],s[0]];let _=16;return c=g=>{let w=M("a",r,s.length),x=Y("output",r,o.length);return`
  ${g.registerUniform("output_size","u32").declareVariables(w,x)}
  var<workgroup> tile : array<array<${x.type.value}, ${_+1}>, ${_}>;
  ${g.mainStart([_,_,1])}
    let stride = (uniforms.output_shape[1] - 1) / ${_} + 1;
    let workgroup_id_x = workgroup_index % stride;
    let workgroup_id_y = workgroup_index / stride;
    let input_col = workgroup_id_y * ${_}u + local_id.x;
    let input_row = workgroup_id_x * ${_}u + local_id.y;
    if (input_row < uniforms.a_shape[0] && input_col < uniforms.a_shape[1]) {
      tile[local_id.y][local_id.x] = ${w.getByIndices(`${w.type.indices}(input_row, input_col)`)};
    }
    workgroupBarrier();

    let output_col = workgroup_id_x * ${_}u + local_id.x;
    let output_row = workgroup_id_y * ${_}u + local_id.y;
    if (output_row < uniforms.output_shape[0] && output_col < uniforms.output_shape[1]) {
      ${x.setByIndices(`${x.type.indices}(output_row, output_col)`,"tile[local_id.x][local_id.y]")}
    }
  }`},{name:"TransposeShared",shaderCache:{inputDependencies:["type"]},getRunData:()=>{let g=z.size(i);return{outputs:[{dims:i,dataType:e.dataType}],dispatchGroup:{x:Math.ceil(o[1]/_),y:Math.ceil(o[0]/_)},programUniforms:[{type:12,data:g},...ee(s,o)]}},getShaderSource:c}}return c=_=>{let g=M("a",r,s.length),w=Y("output",r,o.length);return`
  ${_.registerUniform("output_size","u32").declareVariables(g,w)}

  ${Uu(n,a,g,w)}

  ${_.mainStart()}
    ${_.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.output_size")}

    let indices = ${w.offsetToIndices("global_idx")};
    let aIndices = perm(indices);

    ${w.setByOffset("global_idx",g.getByIndices("aIndices"))}
  }`},{name:"Transpose",shaderCache:{hint:`${t}`,inputDependencies:["rank"]},getRunData:()=>{let _=z.size(i);return{outputs:[{dims:i,dataType:e.dataType}],dispatchGroup:{x:Math.ceil(_/64)},programUniforms:[{type:12,data:_},...ee(s,o)]}},getShaderSource:c}},Up=(e,t)=>{Du(e.inputs,t.perm),e.compute(He(e.inputs[0],t.perm))},jp=e=>xe({perm:e.perm})}),Vu,Wu,qu,Fu,Hu,Gu,Zu,Ku,Qu,Yu,Je,Lp,Vp,Wp,qp,Fp,Hp,Gp,Zp,Kp,Qp,u_=j(()=>{ie(),le(),de(),Ss(),Dt(),Vu={max:"select(bestValue, candidate, candidate > bestValue)",min:"select(bestValue, candidate, candidate < bestValue)",mean:"bestValue + candidate",sum:"bestValue + candidate",prod:"bestValue * candidate",sumSquare:"bestValue + candidate * candidate",logSumExp:"bestValue + exp(candidate)",l1:"bestValue + abs(candidate)",l2:"bestValue + candidate * candidate",logSum:"bestValue + candidate"},Wu={max:"select(bestValue, candidate, candidate > bestValue)",min:"select(bestValue, candidate, candidate < bestValue)",mean:"bestValue + candidate",sum:"bestValue + candidate",prod:"bestValue * candidate",sumSquare:"bestValue + candidate",logSumExp:"bestValue + candidate",l1:"bestValue + candidate",l2:"bestValue + candidate",logSum:"bestValue + candidate"},qu={max:"_A[offset]",min:"_A[offset]",mean:"0",sum:"0",prod:"1",sumSquare:"0",logSumExp:"0",l1:"0",l2:"0",logSum:"0"},Fu={max:"bestValue",min:"bestValue",sum:"bestValue",prod:"bestValue",sumSquare:"bestValue",logSumExp:"log(bestValue)",l1:"bestValue",l2:"sqrt(bestValue)",logSum:"log(bestValue)"},Hu=(e,t)=>{let r=[];for(let a=t-e;a<t;++a)r.push(a);return r},Gu=(e,t)=>{let r=[],a=e.length;for(let i=0;i<a;i++)t.indexOf(i)===-1&&r.push(e[i]);let n=t.map(i=>e[i]);return[r,n]},Zu=(e,t)=>{let r=e.length+t.length,a=[],n=0;for(let i=0;i<r;i++)t.indexOf(i)===-1?a.push(e[n++]):a.push(1);return a},Ku=(e,t)=>{for(let r=0;r<e.length;++r)if(e[e.length-r-1]!==t-1-r)return!1;return!0},Qu=(e,t)=>{let r=[];if(!Ku(e,t)){for(let a=0;a<t;++a)e.indexOf(a)===-1&&r.push(a);e.forEach(a=>r.push(a))}return r},Yu=(e,t,r,a,n,i,s)=>{let o=r[0].dims,d=z.size(i),c=z.size(s),h=M("_A",r[0].dataType,o),u=Y("output",n,i),f=64;d===1&&(f=256);let m=`
          var<workgroup> aBestValues : array<f32, ${f}>;
       `,_=g=>`
        ${g.registerUniform("reduceSize","u32").declareVariables(h,u)}
        ${m}
        fn DIV_CEIL(a : u32, b : u32) -> u32 {
          return ((a - 1u) / b + 1u);
         }
         ${g.mainStart(f)}

          let outputIndex = global_idx / ${f};
          let offset = outputIndex * uniforms.reduceSize;

          var bestValue = f32(${qu[a]});
          let Length = uniforms.reduceSize;
          for (var k = local_idx; k < Length; k = k + ${f}) {
           let candidate = f32(${h.getByOffset("offset + k")});
           bestValue = ${Vu[a]};
          }
          aBestValues[local_idx] = bestValue;
          workgroupBarrier();

         var reduceSize = min(Length, ${f}u);
         for (var currentSize = reduceSize / 2u; reduceSize > 1u;
             currentSize = reduceSize / 2u) {
           let interval = DIV_CEIL(reduceSize, 2u);
           if (local_idx < currentSize) {
            let candidate = aBestValues[local_idx + interval];
            bestValue = ${Wu[a]};
            aBestValues[local_idx] = bestValue;
           }
           reduceSize = interval;
           workgroupBarrier();
         }

         if (local_idx == 0u) {
          ${u.setByOffset("outputIndex",`${a==="mean"?`${u.type.storage}(bestValue / f32(uniforms.reduceSize))`:`${u.type.storage}(${Fu[a]})`}`)};
         }
        }`;return{name:e,shaderCache:{hint:`${t};${f}`,inputDependencies:["type"]},getShaderSource:_,getRunData:()=>({outputs:[{dims:i,dataType:n}],dispatchGroup:{x:d},programUniforms:[{type:12,data:c}]})}},Je=(e,t,r,a)=>{let n=e.inputs.length===1?r:Vi(e.inputs,r),i=n.axes;i.length===0&&!n.noopWithEmptyAxes&&(i=e.inputs[0].dims.map((m,_)=>_));let s=z.normalizeAxes(i,e.inputs[0].dims.length),o=s,d=e.inputs[0],c=Qu(o,e.inputs[0].dims.length);c.length>0&&(d=e.compute(He(e.inputs[0],c),{inputs:[0],outputs:[-1]})[0],o=Hu(o.length,d.dims.length));let[h,u]=Gu(d.dims,o),f=h;n.keepDims&&(f=Zu(h,s)),e.compute(Yu(t,n.cacheKey,[d],a,e.inputs[0].dataType,f,u),{inputs:[d]})},Lp=(e,t)=>{Je(e,"ReduceMeanShared",t,"mean")},Vp=(e,t)=>{Je(e,"ReduceL1Shared",t,"l1")},Wp=(e,t)=>{Je(e,"ReduceL2Shared",t,"l2")},qp=(e,t)=>{Je(e,"ReduceLogSumExpShared",t,"logSumExp")},Fp=(e,t)=>{Je(e,"ReduceMaxShared",t,"max")},Hp=(e,t)=>{Je(e,"ReduceMinShared",t,"min")},Gp=(e,t)=>{Je(e,"ReduceProdShared",t,"prod")},Zp=(e,t)=>{Je(e,"ReduceSumShared",t,"sum")},Kp=(e,t)=>{Je(e,"ReduceSumSquareShared",t,"sumSquare")},Qp=(e,t)=>{Je(e,"ReduceLogSumShared",t,"logSum")}}),Xe,Ju,Ga,Vi,et,Xu,el,tl,rl,al,nl,il,sl,ol,ul,tt,Yp,Jp,Xp,eh,th,rh,ah,nh,ih,sh,Ss=j(()=>{ie(),le(),ze(),de(),u_(),Xe=e=>{if(!e||e.length===0||e.length>2)throw new Error("Reduce op requires 1 or 2 inputs.");if(e.length===2&&e[1].dims.length!==1)throw new Error("Invalid axes input dims.")},Ju=e=>["","",`var value = ${e.getByIndices("input_indices")};`,""],Ga=(e,t,r,a,n,i,s=!1,o=!1)=>{let d=[],c=r[0].dims,h=c.length,u=z.normalizeAxes(n,h),f=!o&&u.length===0;c.forEach((g,w)=>{f||u.indexOf(w)>=0?s&&d.push(1):d.push(g)});let m=d.length,_=z.size(d);return{name:e,shaderCache:t,getShaderSource:g=>{let w=[],x=M("_A",r[0].dataType,h),b=Y("output",i,m),k=a(x,b,u),S=k[2];for(let T=0,E=0;T<h;T++)f||u.indexOf(T)>=0?(s&&E++,S=`for(var j${T}: u32 = 0; j${T} < ${c[T]}; j${T}++) {
                  ${k[2].includes("last_index")?`let last_index = j${T};`:""}
                  ${x.indicesSet("input_indices",T,`j${T}`)}
                  ${S}
                }`):(w.push(`${x.indicesSet("input_indices",T,b.indicesGet("output_indices",E))};`),E++);return`

        ${g.registerUniform("output_size","u32").declareVariables(x,b)}

        ${g.mainStart()}
          ${g.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.output_size")}
          var input_indices: ${x.type.indices};
          let output_indices = ${b.offsetToIndices("global_idx")};

          ${w.join(`
`)}
          ${k[0]}       // init ops for reduce max/min
          ${k[1]}
          ${S}
          ${k[3]}
          ${k.length===4?b.setByOffset("global_idx","value"):k.slice(4).join(`
`)}
        }`},getRunData:()=>({outputs:[{dims:d,dataType:i}],dispatchGroup:{x:Math.ceil(_/64)},programUniforms:[{type:12,data:_},...ee(c,d)]})}},Vi=(e,t)=>{let r=[];return e[1].dims[0]>0&&e[1].getBigInt64Array().forEach(a=>r.push(Number(a))),xe({axes:r,keepDims:t.keepDims,noopWithEmptyAxes:t.noopWithEmptyAxes})},et=(e,t,r,a)=>{let n=e.inputs,i=n.length===1?r:Vi(n,r);e.compute(Ga(t,{hint:i.cacheKey,inputDependencies:["rank"]},[n[0]],i.noopWithEmptyAxes&&i.axes.length===0?Ju:a,i.axes,n[0].dataType,i.keepDims,i.noopWithEmptyAxes),{inputs:[0]})},Xu=(e,t)=>{Xe(e.inputs),et(e,"ReduceLogSum",t,(r,a)=>[`var value = ${a.type.storage}(0);`,"",`value += ${r.getByIndices("input_indices")};`,"value = log(value);"])},el=(e,t)=>{Xe(e.inputs),et(e,"ReduceL1",t,(r,a)=>[`var value = ${a.type.storage}(0);`,"",`value += abs(${r.getByIndices("input_indices")});`,""])},tl=(e,t)=>{Xe(e.inputs),et(e,"ReduceL2",t,(r,a)=>[`var t = ${a.type.value}(0); var value = ${a.type.value}(0);`,"",`t = ${r.getByIndices("input_indices")}; value += (t * t);`,"value = sqrt(value);"])},rl=(e,t)=>{Xe(e.inputs),et(e,"ReduceLogSumExp",t,(r,a)=>[`var value = ${a.type.storage}(0);`,"",`value += exp(${r.getByIndices("input_indices")});`,"value = log(value);"])},al=(e,t)=>{Xe(e.inputs),et(e,"ReduceMax",t,(r,a,n)=>{let i=[];for(let s=0;s<r.rank;s++)(n.indexOf(s)>=0||n.length===0)&&i.push(r.indicesSet("input_indices",s,0));return[`${i.join(`
`)}`,`var value = ${r.getByIndices("input_indices")};`,`value = max(value, ${r.getByIndices("input_indices")});`,""]})},nl=(e,t)=>{Xe(e.inputs),et(e,"ReduceMean",t,(r,a,n)=>{let i=1;for(let s=0;s<r.rank;s++)(n.indexOf(s)>=0||n.length===0)&&(i*=e.inputs[0].dims[s]);return["var sum = f32(0);","",`sum += f32(${r.getByIndices("input_indices")});`,`let value = ${a.type.value}(sum / ${i});`]})},il=(e,t)=>{Xe(e.inputs),et(e,"ReduceMin",t,(r,a,n)=>{let i=[];for(let s=0;s<r.rank;s++)(n.indexOf(s)>=0||n.length===0)&&i.push(`input_indices[${s}] = 0;`);return[`${i.join(`
`)}`,`var value = ${r.getByIndices("input_indices")};`,`value = min(value, ${r.getByIndices("input_indices")});`,""]})},sl=(e,t)=>{Xe(e.inputs),et(e,"ReduceProd",t,(r,a)=>[`var value = ${a.type.storage}(1);`,"",`value *= ${r.getByIndices("input_indices")};`,""])},ol=(e,t)=>{Xe(e.inputs),et(e,"ReduceSum",t,(r,a)=>[`var value = ${a.type.storage}(0);`,"",`value += ${r.getByIndices("input_indices")};`,""])},ul=(e,t)=>{Xe(e.inputs),et(e,"ReduceSumSquare",t,(r,a)=>[`var t = ${a.type.value}(0); var value = ${a.type.value}(0);`,"",`t = ${r.getByIndices("input_indices")}; value += t * t;`,""])},tt=(e,t,r)=>{if(t.length===0)return r;let a=1,n=1;for(let i=0;i<t.length;i++)t.indexOf(i)===-1?a*=e[i]:n*=e[i];return n<32&&a>1024},Yp=(e,t)=>{tt(e.inputs[0].dims,t.axes,t.noopWithEmptyAxes)?nl(e,t):Lp(e,t)},Jp=(e,t)=>{tt(e.inputs[0].dims,t.axes,t.noopWithEmptyAxes)?el(e,t):Vp(e,t)},Xp=(e,t)=>{tt(e.inputs[0].dims,t.axes,t.noopWithEmptyAxes)?tl(e,t):Wp(e,t)},eh=(e,t)=>{tt(e.inputs[0].dims,t.axes,t.noopWithEmptyAxes)?rl(e,t):qp(e,t)},th=(e,t)=>{tt(e.inputs[0].dims,t.axes,t.noopWithEmptyAxes)?al(e,t):Fp(e,t)},rh=(e,t)=>{tt(e.inputs[0].dims,t.axes,t.noopWithEmptyAxes)?il(e,t):Hp(e,t)},ah=(e,t)=>{tt(e.inputs[0].dims,t.axes,t.noopWithEmptyAxes)?sl(e,t):Gp(e,t)},nh=(e,t)=>{tt(e.inputs[0].dims,t.axes,t.noopWithEmptyAxes)?ol(e,t):Zp(e,t)},ih=(e,t)=>{tt(e.inputs[0].dims,t.axes,t.noopWithEmptyAxes)?ul(e,t):Kp(e,t)},sh=(e,t)=>{tt(e.inputs[0].dims,t.axes,t.noopWithEmptyAxes)?Xu(e,t):Qp(e,t)}}),Xn,oh,uh,Wi,l_=j(()=>{ie(),ze(),Ss(),Xn=e=>{if(!e||e.length===0||e.length>2)throw new Error("ArgMinMaxOp op requires 1 or 2 inputs.");if(e[0].dataType!==1)throw new Error("Invalid input type.")},oh=(e,t)=>{Xn(e.inputs);let r=(a,n,i)=>{let s=[];for(let o=0;o<a.rank;o++)(i.indexOf(o)>=0||i.length===0)&&s.push(`input_indices[${o}] = 0;`);return[`${s.join(`
`)}`,`var value = ${a.getByIndices("input_indices")};
var best_index : i32 = 0;`,`if (${a.getByIndices("input_indices")} ${t.selectLastIndex>0?"<=":"<"} value) {
         value = ${a.getByIndices("input_indices")};
         best_index = i32(last_index);
       }`,"",n.setByOffset("global_idx","best_index")]};e.compute(Ga("ArgMin",{hint:t.cacheKey,inputDependencies:["rank"]},[e.inputs[0]],r,[t.axis],7,t.keepDims),{inputs:[0]})},uh=(e,t)=>{Xn(e.inputs);let r=(a,n,i)=>{let s=[];for(let o=0;o<a.rank;o++)(i.indexOf(o)>=0||i.length===0)&&s.push(`input_indices[${o}] = 0;`);return[`${s.join(`
`)}`,`var value = ${a.getByIndices("input_indices")};
var best_index : i32 = 0;`,`if (${a.getByIndices("input_indices")} ${t.selectLastIndex>0?">=":">"} value) {
         value = ${a.getByIndices("input_indices")};
         best_index = i32(last_index);
       }`,"",n.setByOffset("global_idx","best_index")]};e.compute(Ga("argMax",{hint:t.cacheKey,inputDependencies:["rank"]},[e.inputs[0]],r,[t.axis],7,t.keepDims),{inputs:[0]})},Wi=e=>xe(e)}),ll,za,dl,cl,pl,Hr,hl,lh,Ts=j(()=>{ie(),le(),xs(),de(),ll=(e,t)=>{let r=e[0],a=e[1],n=e[2],i=e[3],s=e[4],o=e[5];if(s&&o)throw new Error("Attention cannot have both past and attention_bias");if(r.dims.length!==3)throw new Error('Input "input" must have 3 dimensions');let d=r.dims[0],c=r.dims[1],h=r.dims[2];if(n.dims.length!==1)throw new Error('Input "bias" is expected to have 1 dimensions');if(a.dims.length!==2)throw new Error('Input "weights" is expected to have 2 dimensions');if(a.dims[0]!==h)throw new Error("Input 1 dimension 0 should have same length as dimension 2 of input 0");if(n.dims[0]!==a.dims[1])throw new Error('Input "bias" dimension 0 should have same length as dimension 1 of input "weights"');let u=n.dims[0]/3,f=u,m=f;if(t.qkvHiddenSizes.length>0){if(t.qkvHiddenSizes.length!==3)throw new Error("qkv_hidden_sizes attribute should have 3 elements");for(let k of t.qkvHiddenSizes)if(k%t.numHeads!==0)throw new Error("qkv_hidden_sizes should be divisible by num_heads");u=t.qkvHiddenSizes[0],f=t.qkvHiddenSizes[1],m=t.qkvHiddenSizes[2]}let _=c;if(u!==f)throw new Error("qkv_hidden_sizes first element should be same as the second");if(n.dims[0]!==u+f+m)throw new Error('Input "bias" dimension 0 should have same length as sum of Q/K/V hidden sizes');let g=0;if(s){if(f!==m)throw new Error('Input "past" expect k_hidden_size == v_hidden_size');if(s.dims.length!==5)throw new Error('Input "past" must have 5 dimensions');if(s.dims[0]!==2)throw new Error('Input "past" first dimension must be 2');if(s.dims[1]!==d)throw new Error('Input "past" second dimension must be batch_size');if(s.dims[2]!==t.numHeads)throw new Error('Input "past" third dimension must be num_heads');if(s.dims[4]!==f/t.numHeads)throw new Error('Input "past" fifth dimension must be k_hidden_size / num_heads');t.pastPresentShareBuffer||(g=s.dims[3])}let w=_+g,x=-1,b=0;if(i)throw new Error("Mask not supported");if(s)throw new Error("past is not supported");if(o){if(o.dims.length!==4)throw new Error('Input "attention_bias" must have 4 dimensions');if(o.dims[0]!==d||o.dims[1]!==t.numHeads||o.dims[2]!==c||o.dims[3]!==w)throw new Error('Expect "attention_bias" shape (batch_size, num_heads, sequence_length, total_sequence_length)')}return{batchSize:d,sequenceLength:c,pastSequenceLength:g,kvSequenceLength:_,totalSequenceLength:w,maxSequenceLength:x,inputHiddenSize:h,hiddenSize:u,vHiddenSize:m,headSize:Math.floor(u/t.numHeads),vHeadSize:Math.floor(m/t.numHeads),numHeads:t.numHeads,isUnidirectional:!1,pastPresentShareBuffer:!1,maskFilterValue:t.maskFilterValue,maskType:b,scale:t.scale,broadcastResPosBias:!1,passPastInKv:!1,qkvFormat:1}},za=(e,t,r)=>t&&e?`
      let total_sequence_length_input = u32(${t.getByOffset("0")});
      let present_sequence_length = max(total_sequence_length_input, uniforms.past_sequence_length);
      let is_subsequent_prompt: bool = sequence_length > 1 && sequence_length != total_sequence_length_input;
      let is_first_prompt: bool = is_subsequent_prompt == false && sequence_length == total_sequence_length_input;
      total_sequence_length = u32(${e?.getByOffset("batchIdx")}) + 1;
      var past_sequence_length: u32 = 0;
      if (is_first_prompt == false) {
        past_sequence_length = total_sequence_length - sequence_length;
      }
       `:`
    ${r?"let past_sequence_length = uniforms.past_sequence_length":""};
    let present_sequence_length = total_sequence_length;
    `,dl=(e,t,r,a,n,i,s,o)=>{let d=Ee(s?1:i),c=64,h=i/d;h<c&&(c=32);let u=Math.ceil(i/d/c),f=[{type:12,data:t},{type:12,data:r},{type:12,data:a},{type:12,data:n},{type:12,data:h},{type:12,data:u}],m=Ne(e.dataType,d),_=Ue(1,d),g=["type"];s&&g.push("type"),o&&g.push("type");let w=x=>{let b=Y("x",e.dataType,e.dims,d),k=[b],S=s?M("seq_lens",s.dataType,s.dims):void 0;S&&k.push(S);let T=o?M("total_sequence_length_input",o.dataType,o.dims):void 0;T&&k.push(T);let E=Ue(e.dataType),I=[{name:"batch_size",type:"u32"},{name:"num_heads",type:"u32"},{name:"past_sequence_length",type:"u32"},{name:"sequence_length",type:"u32"},{name:"total_sequence_length",type:"u32"},{name:"elements_per_thread",type:"u32"}];return`
  var<workgroup> thread_max: array<f32, ${c}>;
  var<workgroup> thread_sum: array<f32, ${c}>;
  ${x.registerUniforms(I).declareVariables(...k)}
  ${x.mainStart([c,1,1])}
    let batchIdx = workgroup_id.z / uniforms.num_heads;
    let headIdx = workgroup_id.z % uniforms.num_heads;
    let sequence_length = uniforms.sequence_length;
    var total_sequence_length = uniforms.total_sequence_length;
    ${za(S,T,!1)}
    let local_offset = local_idx * uniforms.elements_per_thread;
    let offset = (global_idx / ${c}) * uniforms.total_sequence_length + local_offset;
    let seq_causal_length = ${s?"u32(past_sequence_length + workgroup_id.y + 1)":"total_sequence_length"};
    var thread_max_vector = ${_}(-3.402823e+38f);
    for (var i: u32 = 0; i < uniforms.elements_per_thread && i + local_offset < seq_causal_length; i++) {
      thread_max_vector = max(${_}(x[offset + i]), thread_max_vector);
    }
    thread_max[local_idx] = ${(()=>{switch(d){case 1:return"thread_max_vector";case 2:return"max(thread_max_vector.x, thread_max_vector.y)";case 4:return"max(max(thread_max_vector.x, thread_max_vector.y), max(thread_max_vector.z, thread_max_vector.w))";default:throw new Error(`Unsupported components: ${d}`)}})()};
    workgroupBarrier();

    var max_value =  f32(-3.402823e+38f);
    for (var i = 0u; i < ${c}; i++) {
      max_value = max(thread_max[i], max_value);
    }

    var sum_vector = ${_}(0);
    for (var i: u32 = 0; i < uniforms.elements_per_thread && i + local_offset < seq_causal_length; i++) {
      sum_vector += exp(${_}(x[offset + i]) - max_value);
    }
    thread_sum[local_idx] = ${(()=>{switch(d){case 1:return"sum_vector";case 2:return"sum_vector.x + sum_vector.y";case 4:return"sum_vector.x + sum_vector.y + sum_vector.z + sum_vector.w";default:throw new Error(`Unsupported components: ${d}`)}})()};
    workgroupBarrier();

    var sum: f32 = 0;
    for (var i = 0u; i < ${c}; i++) {
      sum += thread_sum[i];
    }

    if (sum == 0) {
      for (var i: u32 = 0; i < uniforms.elements_per_thread && i + local_offset < seq_causal_length; i++) {
        x[offset + i] = ${b.type.value}(${E}(1.0) / ${E}(seq_causal_length));
      }
    } else {
      for (var i: u32 = 0; i < uniforms.elements_per_thread && i + local_offset < seq_causal_length; i++) {
        var f32input = ${_}(x[offset + i]);
        x[offset + i] = ${b.type.value}(exp(f32input - max_value) / sum);
      }
    }
      ${s?`
        for (var total_seq_id: u32 = seq_causal_length; total_seq_id + local_offset < uniforms.total_sequence_length; total_seq_id++) {
          x[offset + total_seq_id] = ${b.type.value}(${E}(0));
        }`:""};
  }`};return{name:"AttentionProbsSoftmax",shaderCache:{hint:`${c};${m};${d}`,inputDependencies:g},getShaderSource:w,getRunData:()=>({outputs:[],dispatchGroup:{x:Math.ceil(i/c),y:n,z:t*r},programUniforms:f})}},cl=(e,t,r,a,n,i,s,o,d)=>{let c=s+i.kvSequenceLength,h=[i.batchSize,i.numHeads,i.sequenceLength,c],u=e>1&&a,f=i.kvNumHeads?i.kvNumHeads:i.numHeads,m=u?[i.batchSize,f,c,i.headSize]:void 0,_=i.nReps?i.nReps:1,g=i.scale===0?1/Math.sqrt(i.headSize):i.scale,w=Ee(i.headSize),x=i.headSize/w,b=12,k={x:Math.ceil(c/b),y:Math.ceil(i.sequenceLength/b),z:i.batchSize*i.numHeads},S=[{type:12,data:i.sequenceLength},{type:12,data:x},{type:12,data:c},{type:12,data:i.numHeads},{type:12,data:i.headSize},{type:1,data:g},{type:12,data:s},{type:12,data:i.kvSequenceLength},{type:12,data:_}],T=u&&a&&z.size(a.dims)>0,E=["type","type"];T&&E.push("type"),n&&E.push("type"),o&&E.push("type"),d&&E.push("type");let I=[{dims:h,dataType:t.dataType,gpuDataType:0}];u&&I.push({dims:m,dataType:t.dataType,gpuDataType:0});let N=D=>{let V=M("q",t.dataType,t.dims,w),A=M("key",r.dataType,r.dims,w),W=[V,A];if(T){let K=M("past_key",a.dataType,a.dims,w);W.push(K)}n&&W.push(M("attention_bias",n.dataType,n.dims));let P=o?M("seq_lens",o.dataType,o.dims):void 0;P&&W.push(P);let J=d?M("total_sequence_length_input",d.dataType,d.dims):void 0;J&&W.push(J);let ne=Y("output",t.dataType,h),F=[ne];u&&F.push(Y("present_key",t.dataType,m,w));let se=Ue(1,w),ce=[{name:"M",type:"u32"},{name:"K",type:"u32"},{name:"N",type:"u32"},{name:"num_heads",type:"u32"},{name:"head_size",type:"u32"},{name:"alpha",type:"f32"},{name:"past_sequence_length",type:"u32"},{name:"kv_sequence_length",type:"u32"},{name:"n_reps",type:"u32"}];return`
  const TILE_SIZE = ${b}u;

  var<workgroup> tileQ: array<${V.type.storage}, ${b*b}>;
  var<workgroup> tileK: array<${V.type.storage}, ${b*b}>;
  ${D.registerUniforms(ce).declareVariables(...W,...F)}
  ${D.mainStart([b,b,1])}
    // x holds the N and y holds the M
    let headIdx = workgroup_id.z % uniforms.num_heads;
    let kvHeadIdx = ${_===1?"headIdx":"headIdx / uniforms.n_reps"};
    let kv_num_heads = ${_===1?"uniforms.num_heads":"uniforms.num_heads / uniforms.n_reps"};
    let batchIdx = workgroup_id.z / uniforms.num_heads;
    let m = workgroup_id.y * TILE_SIZE;
    let n = workgroup_id.x * TILE_SIZE;
    let sequence_length = uniforms.M;
    var total_sequence_length = uniforms.N;
    ${za(P,J,!0)}
    let absKvHeadIdx = batchIdx * kv_num_heads + kvHeadIdx;
    let qOffset = workgroup_id.z * uniforms.M * uniforms.K + m * uniforms.K;
    ${T&&u?"let pastKeyOffset = absKvHeadIdx * uniforms.past_sequence_length * uniforms.K;":""};
    let kOffset = absKvHeadIdx * uniforms.kv_sequence_length * uniforms.K;
    ${u?"let presentKeyOffset = absKvHeadIdx * uniforms.N * uniforms.K;":""}
    var value = ${se}(0);
    for (var w: u32 = 0u; w < uniforms.K; w += TILE_SIZE) {
      if (global_id.y < uniforms.M && w + local_id.x < uniforms.K) {
        tileQ[TILE_SIZE * local_id.y + local_id.x] = q[qOffset + local_id.y * uniforms.K + w + local_id.x];
      }
      if (n + local_id.y < uniforms.N && w + local_id.x < uniforms.K) {
        var idx = TILE_SIZE * local_id.y + local_id.x;
      ${T&&u?`
              if (n + local_id.y < past_sequence_length) {
                tileK[idx] = past_key[pastKeyOffset + (n + local_id.y) * uniforms.K + w + local_id.x];
              } else if (n + local_id.y - past_sequence_length < uniforms.kv_sequence_length) {
                tileK[idx] = key[kOffset + (n + local_id.y - past_sequence_length) * uniforms.K + w + local_id.x];
              }`:`
          if (n + local_id.y < uniforms.kv_sequence_length) {
            tileK[idx] = key[kOffset + (n + local_id.y) * uniforms.K + w + local_id.x];
          }`}
      ${u?`if (n + local_id.y < present_sequence_length) {
        present_key[presentKeyOffset + (n + local_id.y) * uniforms.K + w + local_id.x] = tileK[idx];
      }`:""}
      }
      workgroupBarrier();

      for (var k: u32 = 0u; k < TILE_SIZE && w+k < uniforms.K; k++) {
          value += ${se}(tileQ[TILE_SIZE * local_id.y + k] * tileK[TILE_SIZE * local_id.x + k]);
      }

      workgroupBarrier();
    }

    if (global_id.y < uniforms.M && global_id.x < total_sequence_length) {
      let headOffset = workgroup_id.z * uniforms.M * uniforms.N;
      let outputIdx = headOffset + global_id.y * uniforms.N + global_id.x;
      var sum: f32 = ${(()=>{switch(w){case 1:return"value";case 2:return"value.x + value.y";case 4:return"value.x + value.y + value.z + value.w";default:throw new Error(`Unsupported components: ${w}`)}})()};
        output[outputIdx] = ${ne.type.value} (sum * uniforms.alpha) + ${n?"attention_bias[outputIdx]":"0.0"};
    }
  }`};return{name:"AttentionProbs",shaderCache:{hint:`${w};${n!==void 0};${a!==void 0};${e}`,inputDependencies:E},getRunData:()=>({outputs:I,dispatchGroup:k,programUniforms:S}),getShaderSource:N}},pl=(e,t,r,a,n,i,s=void 0,o=void 0)=>{let d=i+n.kvSequenceLength,c=n.nReps?n.nReps:1,h=n.vHiddenSize*c,u=e>1&&a,f=n.kvNumHeads?n.kvNumHeads:n.numHeads,m=u?[n.batchSize,f,d,n.headSize]:void 0,_=[n.batchSize,n.sequenceLength,h],g=12,w={x:Math.ceil(n.vHeadSize/g),y:Math.ceil(n.sequenceLength/g),z:n.batchSize*n.numHeads},x=[{type:12,data:n.sequenceLength},{type:12,data:d},{type:12,data:n.vHeadSize},{type:12,data:n.numHeads},{type:12,data:n.headSize},{type:12,data:h},{type:12,data:i},{type:12,data:n.kvSequenceLength},{type:12,data:c}],b=u&&a&&z.size(a.dims)>0,k=["type","type"];b&&k.push("type"),s&&k.push("type"),o&&k.push("type");let S=[{dims:_,dataType:t.dataType,gpuDataType:0}];u&&S.push({dims:m,dataType:t.dataType,gpuDataType:0});let T=E=>{let I=M("probs",t.dataType,t.dims),N=M("v",r.dataType,r.dims),D=[I,N];b&&D.push(M("past_value",a.dataType,a.dims));let V=s?M("seq_lens",s.dataType,s.dims):void 0;s&&D.push(V);let A=o?M("total_sequence_length_input",o.dataType,o.dims):void 0;o&&D.push(A);let W=[Y("output",t.dataType,_)];u&&W.push(Y("present_value",t.dataType,m));let P=[{name:"M",type:"u32"},{name:"K",type:"u32"},{name:"N",type:"u32"},{name:"num_heads",type:"u32"},{name:"head_size",type:"u32"},{name:"v_hidden_size",type:"u32"},{name:"past_sequence_length",type:"u32"},{name:"kv_sequence_length",type:"u32"},{name:"n_reps",type:"u32"}];return`
  const TILE_SIZE = ${g}u;
  var<workgroup> tileQ: array<${I.type.value}, ${g*g}>;
  var<workgroup> tileV: array<${I.type.value}, ${g*g}>;
  ${E.registerUniforms(P).declareVariables(...D,...W)}
  ${E.mainStart([g,g,1])}
   let headIdx = workgroup_id.z % uniforms.num_heads;
   let batchIdx = workgroup_id.z / uniforms.num_heads;
   let kvHeadIdx = ${c===1?"headIdx":"headIdx / uniforms.n_reps"};
   let kv_num_heads = ${c===1?"uniforms.num_heads":"uniforms.num_heads / uniforms.n_reps"};
   let m = global_id.y;
   let n = global_id.x;
   let sequence_length = uniforms.M;
   var total_sequence_length = uniforms.K;
   ${za(V,A,!0)}
   let offsetA = workgroup_id.z * uniforms.M * uniforms.K + m * uniforms.K;
   let absKvHeadIdx = batchIdx * kv_num_heads + kvHeadIdx; // kvHeadIdx is relative to the batch
   ${b&&u?"let pastValueOffset = absKvHeadIdx * uniforms.N * uniforms.past_sequence_length + n;":""};
   let vOffset = absKvHeadIdx * uniforms.N * uniforms.kv_sequence_length + n;
   ${u?"let presentValueOffset = absKvHeadIdx * uniforms.N * uniforms.K + n;":""}
   var value = ${I.type.storage}(0);
   for (var w: u32 = 0u; w < uniforms.K; w += TILE_SIZE) {
      if (m < uniforms.M && w + local_id.x < uniforms.K) {
        tileQ[TILE_SIZE * local_id.y + local_id.x] = probs[offsetA + w + local_id.x];
      }
      if (n < uniforms.N && w + local_id.y < uniforms.K) {
        var idx = TILE_SIZE * local_id.y + local_id.x;
        ${b&&u?`
        if (w + local_id.y < past_sequence_length) {
          tileV[idx] = past_value[pastValueOffset + (w + local_id.y) * uniforms.N];
        } else if (w + local_id.y - past_sequence_length < uniforms.kv_sequence_length) {
          tileV[idx] = v[vOffset + (w + local_id.y - past_sequence_length) * uniforms.N];
        }
      `:`
            if (w + local_id.y < uniforms.kv_sequence_length) {
              tileV[idx] = v[vOffset + (w + local_id.y) * uniforms.N];
            }`}
        ${u?`
            if (w + local_id.y < present_sequence_length) {
          present_value[presentValueOffset + (w + local_id.y) * uniforms.N] = tileV[idx];
        }`:""}
      }
     workgroupBarrier();
     for (var k: u32 = 0u; k < TILE_SIZE && w+k < total_sequence_length; k++) {
       value += tileQ[TILE_SIZE * local_id.y + k] * tileV[TILE_SIZE * k + local_id.x];
     }
     workgroupBarrier();
   }

   // we need to transpose output from BNSH_v to BSND_v
   if (m < uniforms.M && n < uniforms.N) {
     let outputIdx = batchIdx * uniforms.M * uniforms.v_hidden_size + m * uniforms.v_hidden_size
       + headIdx * uniforms.N + n;
     output[outputIdx] = value;
   }
  }`};return{name:"AttentionScore",shaderCache:{hint:`${a!==void 0};${e}`,inputDependencies:k},getRunData:()=>({outputs:S,dispatchGroup:w,programUniforms:x}),getShaderSource:T}},Hr=(e,t,r,a,n,i,s,o,d,c,h=void 0,u=void 0)=>{let f=Math.min(e.outputCount,1+(s?1:0)+(o?1:0)),m=f>1?c.pastSequenceLength:0,_=m+c.kvSequenceLength,g=d&&z.size(d.dims)>0?d:void 0,w=[t,r];f>1&&s&&z.size(s.dims)>0&&w.push(s),g&&w.push(g),h&&w.push(h),u&&w.push(u);let x=e.compute(cl(f,t,r,s,g,c,m,h,u),{inputs:w,outputs:f>1?[-1,1]:[-1]})[0];e.compute(dl(x,c.batchSize,c.numHeads,m,c.sequenceLength,_,h,u),{inputs:h&&u?[x,h,u]:[x],outputs:[]});let b=[x,a];f>1&&o&&z.size(o.dims)>0&&b.push(o),h&&b.push(h),u&&b.push(u),e.compute(pl(f,x,a,o,c,m,h,u),{inputs:b,outputs:f>1?[0,2]:[0]})},hl=(e,t)=>{let r=[t.batchSize,t.numHeads,t.sequenceLength,t.headSize],a=t.sequenceLength,n=t.inputHiddenSize,i=t.headSize,s=12,o={x:Math.ceil(t.headSize/s),y:Math.ceil(t.sequenceLength/s),z:t.batchSize*t.numHeads},d=[e.inputs[0],e.inputs[1],e.inputs[2]],c=[{type:12,data:a},{type:12,data:n},{type:12,data:i},{type:12,data:t.numHeads},{type:12,data:t.headSize},{type:12,data:t.hiddenSize},{type:12,data:t.hiddenSize+t.hiddenSize+t.vHiddenSize}],h=u=>{let f=Y("output_q",d[0].dataType,r),m=Y("output_k",d[0].dataType,r),_=Y("output_v",d[0].dataType,r),g=M("input",d[0].dataType,d[0].dims),w=M("weight",d[1].dataType,d[1].dims),x=M("bias",d[2].dataType,d[2].dims),b=g.type.storage,k=[{name:"M",type:"u32"},{name:"K",type:"u32"},{name:"N",type:"u32"},{name:"num_heads",type:"u32"},{name:"head_size",type:"u32"},{name:"hidden_size",type:"u32"},{name:"ldb",type:"u32"}];return`
  const TILE_SIZE = ${s}u;
  var<workgroup> tileInput: array<${b}, ${s*s}>;
  var<workgroup> tileWeightQ: array<${b}, ${s*s}>;
  var<workgroup> tileWeightK: array<${b}, ${s*s}>;
  var<workgroup> tileWeightV: array<${b}, ${s*s}>;
  ${u.registerUniforms(k).declareVariables(g,w,x,f,m,_)}
  ${u.mainStart([s,s,1])}
    let batchIndex = workgroup_id.z / uniforms.num_heads;
    let headNumber = workgroup_id.z % uniforms.num_heads;
    let m = global_id.y;
    let n = global_id.x;

    let inputOffset = batchIndex * (uniforms.M * uniforms.K) + m * uniforms.K;
    let biasOffsetQ = headNumber * uniforms.head_size;
    let biasOffsetK = uniforms.hidden_size + biasOffsetQ;
    let biasOffsetV = uniforms.hidden_size + biasOffsetK;

    var valueQ = ${b}(0);
    var valueK = ${b}(0);
    var valueV = ${b}(0);
    for (var w: u32 = 0u; w < uniforms.K; w += TILE_SIZE) {
      if (m < uniforms.M && w + local_id.x < uniforms.K) {
        tileInput[TILE_SIZE * local_id.y + local_id.x] = input[inputOffset + w + local_id.x];
      }
      if (n < uniforms.N && w + local_id.y < uniforms.K) {
        let offset = n + (w + local_id.y) * uniforms.ldb;
        tileWeightQ[TILE_SIZE * local_id.y + local_id.x] = weight[biasOffsetQ + offset];
        tileWeightK[TILE_SIZE * local_id.y + local_id.x] = weight[biasOffsetK + offset];
        tileWeightV[TILE_SIZE * local_id.y + local_id.x] = weight[biasOffsetV + offset];
      }
      workgroupBarrier();
      for (var k: u32 = 0u; k<TILE_SIZE && w+k < uniforms.K; k++) {
        let inputTileOffset = TILE_SIZE * local_id.y + k;
        let weightTileOffset = TILE_SIZE * k + local_id.x;
        valueQ += tileInput[inputTileOffset] * tileWeightQ[weightTileOffset];
        valueK += tileInput[inputTileOffset] * tileWeightK[weightTileOffset];
        valueV += tileInput[inputTileOffset] * tileWeightV[weightTileOffset];
      }

      workgroupBarrier();
    }

    let headOffset = (m * uniforms.N + n) % uniforms.head_size;
    valueQ += bias[headOffset + biasOffsetQ];
    valueK += bias[headOffset + biasOffsetK];
    valueV += bias[headOffset + biasOffsetV];

    let offset = workgroup_id.z * uniforms.M * uniforms.N;
    if (m < uniforms.M && n < uniforms.N) {
      let outputIdx = offset + m * uniforms.N + n;
      output_q[outputIdx] = valueQ;
      output_k[outputIdx] = valueK;
      output_v[outputIdx] = valueV;
    }
  }`};return e.compute({name:"AttentionPrepare",shaderCache:{inputDependencies:["type","type","type"]},getRunData:()=>({outputs:[{dims:r,dataType:e.inputs[0].dataType,gpuDataType:0},{dims:r,dataType:e.inputs[0].dataType,gpuDataType:0},{dims:r,dataType:e.inputs[0].dataType,gpuDataType:0}],dispatchGroup:o,programUniforms:c}),getShaderSource:h},{inputs:d,outputs:[-1,-1,-1]})},lh=(e,t)=>{let r=ll(e.inputs,t),[a,n,i]=hl(e,r);return Hr(e,a,n,i,e.inputs[4],void 0,void 0,void 0,e.inputs[5],r)}}),fl,ml,gl,dh,d_=j(()=>{ut(),ie(),le(),ze(),de(),fl=(e,t)=>{if(!e||e.length!==5)throw new Error("BatchNormalization requires 5 inputs");let r=(a,n,i)=>{let s=n.length;if(s!==a.length)throw new Error(`${i}: num dimensions != ${s}`);n.forEach((o,d)=>{if(o!==a[d])throw new Error(`${i}: dim[${d}] do not match`)})};if(e[0].dims.length>1){let a=t.format==="NHWC"?t.spatial?e[0].dims.slice(-1):e[0].dims.slice(-1).concat(e[0].dims.slice(1,e[0].dims.length-1)):e[0].dims.slice(1,t.spatial?2:void 0);r(e[1].dims,a,"Invalid input scale"),r(e[2].dims,a,"Invalid input B"),r(e[3].dims,a,"Invalid input mean"),r(e[4].dims,a,"Invalid input var")}else r(e[1].dims,[1],"Invalid input scale"),r(e[2].dims,[1],"Invalid input B"),r(e[3].dims,[1],"Invalid input mean"),r(e[4].dims,[1],"Invalid input var")},ml=(e,t)=>{let{epsilon:r,spatial:a,format:n}=t,i=e[0].dims,s=a?Ee(i[i.length-1]):1,o=n==="NHWC"&&i.length>1?s:1,d=z.size(i)/s,c=a,h=c?i.length:i,u=M("x",e[0].dataType,e[0].dims,s),f=M("scale",e[1].dataType,e[1].dims,o),m=M("bias",e[2].dataType,e[2].dims,o),_=M("inputMean",e[3].dataType,e[3].dims,o),g=M("inputVar",e[4].dataType,e[4].dims,o),w=Y("y",e[0].dataType,h,s),x=()=>{let k="";if(a)k=`let cOffset = ${i.length===1?"0u":n==="NHWC"?`outputIndices[${i.length-1}] / ${s}`:"outputIndices[1]"};`;else if(n==="NCHW")k=`
            ${w.indicesSet("outputIndices","0","0")}
            let cOffset = ${w.indicesToOffset("outputIndices")};`;else{k=`var cIndices = ${f.type.indices}(0);
                       cIndices[0] = outputIndices[${i.length-1}];`;for(let S=1;S<f.rank;S++)k+=`cIndices[${S}] = outputIndices[${S}];`;k+=`let cOffset = ${f.indicesToOffset("cIndices")};`}return k},b=k=>`
  const epsilon = ${r};
  ${k.registerUniform("outputSize","u32").declareVariables(u,f,m,_,g,w)}
  ${k.mainStart()}
  ${k.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.outputSize")}
    var outputIndices = ${w.offsetToIndices(`global_idx * ${s}`)};
    ${x()}
    let scale = ${f.getByOffset("cOffset")};
    let bias = ${m.getByOffset("cOffset")};
    let inputMean = ${_.getByOffset("cOffset")};
    let inputVar = ${g.getByOffset("cOffset")};
    let x = ${u.getByOffset("global_idx")};
    let value = (x - inputMean) * inverseSqrt(inputVar + epsilon) * scale + bias;
    ${w.setByOffset("global_idx","value")}
  }`;return{name:"BatchNormalization",shaderCache:{hint:`${t.epsilon}_${t.format}_${a}_${s}`,inputDependencies:c?["rank","type","type","type","type"]:void 0},getShaderSource:b,getRunData:()=>({outputs:[{dims:e[0].dims,dataType:e[0].dataType}],dispatchGroup:{x:Math.ceil(d/64)},programUniforms:c?[{type:12,data:d},...ee(i)]:[{type:12,data:d}]})}},gl=e=>xe(e),dh=(e,t)=>{let{inputs:r,outputCount:a}=e,n=gl({...t,outputCount:a});if(Se.webgpu.validateInputContent&&fl(r,n),t.trainingMode)throw new Error("BatchNormalization trainingMode is not supported yet.");e.compute(ml(r,n))}}),yl,_l,ch,c_=j(()=>{le(),de(),yl=e=>{if(e[0].dims.length!==3)throw new Error("input should have 3 dimensions");if(![320,640,1280].includes(e[0].dims[2]))throw new Error("number of channels should be 320, 640 or 1280");if(e[1].dims.length!==1)throw new Error("bias is expected to have 1 dimensions");if(e[0].dims[2]!==e[1].dims[0])throw new Error("last dimension of input and bias are not the same")},_l=e=>{let t=e[0].dims,r=e[0].dims[2],a=z.size(t)/4,n=e[0].dataType,i=M("input",n,t,4),s=M("bias",n,[r],4),o=M("residual",n,t,4),d=Y("output",n,t,4);return{name:"BiasAdd",getRunData:()=>({outputs:[{dims:t,dataType:e[0].dataType}],dispatchGroup:{x:Math.ceil(a/64)}}),getShaderSource:c=>`
  const channels = ${r}u / 4;
  ${c.declareVariables(i,s,o,d)}

  ${c.mainStart()}
    ${c.guardAgainstOutOfBoundsWorkgroupSizes(a)}
    let value = ${i.getByOffset("global_idx")}
      + ${s.getByOffset("global_idx % channels")} + ${o.getByOffset("global_idx")};
    ${d.setByOffset("global_idx","value")}
  }`}},ch=e=>{yl(e.inputs),e.compute(_l(e.inputs))}}),vl,_e,ph,hh,fh,mh,gh,yh,_h,vh,bh,bl,wh,$h,xh,kh,Ur,Sh,ja,Th,Ch,Ih,Eh,Ah,zh,Oh,Rh,Mh,Nh,Bh,Dh,Ph,Uh,jh,Lh,ei,Vh,qi,Fi,Wh,qh,Fh,wl,$l,Hh,Cs=j(()=>{ie(),le(),ze(),de(),vl=(e,t,r,a,n,i,s)=>{let o=Math.ceil(t/4),d="";typeof n=="string"?d=`${n}(a)`:d=n("a");let c=M("inputData",r,[o],4),h=Y("outputData",a,[o],4),u=[{name:"vec_size",type:"u32"}];return s&&u.push(...s),`
      ${e.registerUniforms(u).declareVariables(c,h)}

  ${i??""}

  ${e.mainStart()}
    ${e.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.vec_size")}

    let a = ${c.getByOffset("global_idx")};
    ${h.setByOffset("global_idx",d)}
  }`},_e=(e,t,r,a,n,i=e.dataType,s,o)=>{let d=[{type:12,data:Math.ceil(z.size(e.dims)/4)}];return s&&d.push(...s),{name:t,shaderCache:{hint:n,inputDependencies:["type"]},getShaderSource:c=>vl(c,z.size(e.dims),e.dataType,i,r,a,o),getRunData:c=>({outputs:[{dims:e.dims,dataType:i}],dispatchGroup:{x:Math.ceil(z.size(c[0].dims)/64/4)},programUniforms:d})}},ph=e=>{e.compute(_e(e.inputs[0],"Abs","abs"))},hh=e=>{e.compute(_e(e.inputs[0],"Acos","acos"))},fh=e=>{e.compute(_e(e.inputs[0],"Acosh","acosh"))},mh=e=>{e.compute(_e(e.inputs[0],"Asin","asin"))},gh=e=>{e.compute(_e(e.inputs[0],"Asinh","asinh"))},yh=e=>{e.compute(_e(e.inputs[0],"Atan","atan"))},_h=e=>{e.compute(_e(e.inputs[0],"Atanh","atanh"))},vh=e=>xe(e),bh=(e,t)=>{let r;switch(t.to){case 10:r="vec4<f16>";break;case 1:r="vec4<f32>";break;case 12:r="vec4<u32>";break;case 6:r="vec4<i32>";break;case 9:r="vec4<bool>";break;default:throw new RangeError(`not supported type (specified in attribute 'to' from 'Cast' operator): ${t.to}`)}e.compute(_e(e.inputs[0],"Cast",r,void 0,t.cacheKey,t.to))},bl=e=>{let t,r,a=e.length>=2&&e[1].data!==0,n=e.length>=3&&e[2].data!==0;switch(e[0].dataType){case 1:t=a?e[1].getFloat32Array()[0]:-34028234663852886e22,r=n?e[2].getFloat32Array()[0]:34028234663852886e22;break;case 10:t=a?e[1].getUint16Array()[0]:64511,r=n?e[2].getUint16Array()[0]:31743;break;default:throw new Error("Unsupport data type")}return xe({min:t,max:r})},wh=(e,t)=>{let r=t||bl(e.inputs),a=Ue(e.inputs[0].dataType);e.compute(_e(e.inputs[0],"Clip",n=>`clamp(${n}, vec4<${a}>(uniforms.min), vec4<${a}>(uniforms.max))`,void 0,r.cacheKey,void 0,[{type:e.inputs[0].dataType,data:r.min},{type:e.inputs[0].dataType,data:r.max}],[{name:"min",type:a},{name:"max",type:a}]),{inputs:[0]})},$h=e=>{e.compute(_e(e.inputs[0],"Ceil","ceil"))},xh=e=>{e.compute(_e(e.inputs[0],"Cos","cos"))},kh=e=>{e.compute(_e(e.inputs[0],"Cosh","cosh"))},Ur=e=>xe(e),Sh=(e,t)=>{let r=Ue(e.inputs[0].dataType);e.compute(_e(e.inputs[0],"Elu",a=>`elu_vf32(${a})`,`
  const elu_alpha_ = ${r}(${t.alpha});

  fn elu_f32(a: ${r}) -> ${r} {
  return select((exp(a) - 1.0) * elu_alpha_, a, a >= 0.0);
  }

  fn elu_vf32(v: vec4<${r}>) -> vec4<${r}> {
  return vec4(elu_f32(v.x), elu_f32(v.y), elu_f32(v.z), elu_f32(v.w));
  }`,t.cacheKey))},ja=(e="f32")=>`
const r0: ${e} = 0.3275911;
const r1: ${e} = 0.254829592;
const r2: ${e} = -0.284496736;
const r3: ${e} = 1.421413741;
const r4: ${e} = -1.453152027;
const r5: ${e} = 1.061405429;

fn erf_vf32(v: vec4<${e}>) -> vec4<${e}> {
  let absv = abs(v);
  let x = 1.0 / (1.0 + r0 * absv);
  return sign(v) * (1.0 - ((((r5 * x + r4) * x + r3) * x + r2) * x + r1) * x * exp(-absv * absv));
}`,Th=e=>{let t=Ue(e.inputs[0].dataType);e.compute(_e(e.inputs[0],"Erf",r=>`erf_vf32(${r})`,ja(t)))},Ch=e=>{e.compute(_e(e.inputs[0],"Exp","exp"))},Ih=e=>{e.compute(_e(e.inputs[0],"Floor","floor"))},Eh=e=>{let t=Ue(e.inputs[0].dataType);e.compute(_e(e.inputs[0],"Gelu",r=>`0.5 * ${r} * (1.0 + erf_vf32(${r} * 0.7071067811865475))`,ja(t)))},Ah=(e,t)=>{let r=Ue(e.inputs[0].dataType);e.compute(_e(e.inputs[0],"LeakyRelu",a=>`select(leaky_relu_alpha_ * ${a}, ${a}, ${a} >= vec4<${r}>(0.0))`,`const leaky_relu_alpha_ = ${r}(${t.alpha});`,t.cacheKey))},zh=e=>{e.compute(_e(e.inputs[0],"Not",t=>`!${t}`))},Oh=e=>{e.compute(_e(e.inputs[0],"Neg",t=>`-${t}`))},Rh=e=>{e.compute(_e(e.inputs[0],"Reciprocal",t=>`1.0/${t}`))},Mh=e=>{let t=Ue(e.inputs[0].dataType);e.compute(_e(e.inputs[0],"Relu",r=>`select(vec4<${t}>(0.0), ${r}, ${r} > vec4<${t}>(0.0))`))},Nh=e=>{e.compute(_e(e.inputs[0],"Sigmoid",t=>`(1.0 / (1.0 + exp(-${t})))`))},Bh=e=>xe(e),Dh=(e,t)=>{let r=Ue(e.inputs[0].dataType);e.compute(_e(e.inputs[0],"HardSigmoid",a=>`max(vec4<${r}>(0.0), min(vec4<${r}>(1.0), ${t.alpha} * ${a} + vec4<${r}>(${t.beta})))`,void 0,t.cacheKey))},Ph=e=>{e.compute(_e(e.inputs[0],"Sin","sin"))},Uh=e=>{e.compute(_e(e.inputs[0],"Sinh","sinh"))},jh=e=>{e.compute(_e(e.inputs[0],"Sqrt","sqrt"))},Lh=e=>{e.compute(_e(e.inputs[0],"Tan","tan"))},ei=e=>`sign(${e}) * (1 - exp(-2 * abs(${e}))) / (1 + exp(-2 * abs(${e})))`,Vh=e=>{e.compute(_e(e.inputs[0],"Tanh",ei))},qi=(e="f32")=>`
const fast_gelu_a: ${e} = 0.5;
const fast_gelu_b: ${e} = 0.7978845608028654;
const fast_gelu_c: ${e} = 0.035677408136300125;

fn tanh_v(v: vec4<${e}>) -> vec4<${e}> {
  return ${ei("v")};
}
`,Fi=e=>`(fast_gelu_a + fast_gelu_a * tanh_v(${e} * (fast_gelu_c * ${e} * ${e} + fast_gelu_b))) * ${e}`,Wh=e=>{let t=Ue(e.inputs[0].dataType);e.compute(_e(e.inputs[0],"FastGelu",Fi,qi(t),void 0,e.inputs[0].dataType))},qh=(e,t)=>{let r=Ue(e.inputs[0].dataType);return e.compute(_e(e.inputs[0],"ThresholdedRelu",a=>`select(vec4<${r}>(0.0), ${a}, ${a} > thresholded_relu_alpha_)`,`const thresholded_relu_alpha_ = vec4<${r}>(${t.alpha});`,t.cacheKey)),0},Fh=e=>{e.compute(_e(e.inputs[0],"Log","log"))},wl=(e,t)=>`
const alpha = vec4<${e}>(${t});
const one = ${e}(1.0);
const zero = ${e}(0.0);

fn quick_gelu_impl(x: vec4<${e}>) -> vec4<${e}> {
  let v = x *alpha;
  var x1 : vec4<${e}>;
  for (var i = 0; i < 4; i = i + 1) {
    if (v[i] >= zero) {
      x1[i] = one / (one + exp(-v[i]));
    } else {
      x1[i] = one - one / (one + exp(v[i]));
    }
  }
  return x * x1;
}
`,$l=e=>`quick_gelu_impl(${e})`,Hh=(e,t)=>{let r=Ue(e.inputs[0].dataType);e.compute(_e(e.inputs[0],"QuickGelu",$l,wl(r,t.alpha),t.cacheKey,e.inputs[0].dataType))}}),xl,kl,Gh,p_=j(()=>{le(),de(),Cs(),xl=e=>{if(e[0].dims.length!==3)throw new Error("input should have 3 dimensions");if(![2560,5120,10240].includes(e[0].dims[2]))throw new Error("hidden state should be 2560, 5120 or 10240");if(e[1].dims.length!==1)throw new Error("bias is expected to have 1 dimensions");if(e[0].dims[2]!==e[1].dims[0])throw new Error("last dimension of input and bias are not the same")},kl=e=>{let t=e[0].dims.slice();t[2]=t[2]/2;let r=M("input",e[0].dataType,e[0].dims,4),a=M("bias",e[0].dataType,[e[0].dims[2]],4),n=Y("output",e[0].dataType,t,4),i=z.size(t)/4,s=Ne(e[0].dataType);return{name:"BiasSplitGelu",getRunData:()=>({outputs:[{dims:t,dataType:e[0].dataType}],dispatchGroup:{x:Math.ceil(i/64)}}),getShaderSource:o=>`
  const M_SQRT2 = sqrt(2.0);
  const halfChannels = ${e[0].dims[2]/4/2}u;

  ${o.declareVariables(r,a,n)}

  ${ja(s)}

  ${o.mainStart()}
    ${o.guardAgainstOutOfBoundsWorkgroupSizes(i)}
    let biasIdx = global_idx % halfChannels;
    let batchIndex = global_idx / halfChannels;
    let inputOffset = biasIdx + batchIndex * halfChannels * 2;
    let valueLeft = input[inputOffset] + bias[biasIdx];
    let valueRight = input[inputOffset + halfChannels] + bias[biasIdx + halfChannels];
    let geluRight = valueRight * 0.5 * (erf_vf32(valueRight / M_SQRT2) + 1);

    ${n.setByOffset("global_idx","valueLeft * geluRight")}
  }`}},Gh=e=>{xl(e.inputs),e.compute(kl(e.inputs))}}),Sl,Tl,rt,Zh,Kh,Qh,Yh,Jh,Xh,ef,tf,rf,af,h_=j(()=>{ie(),le(),de(),Sl=(e,t,r,a,n,i,s,o,d,c,h,u)=>{let f,m;typeof o=="string"?f=m=(b,k)=>`${o}((${b}),(${k}))`:typeof o=="function"?f=m=o:(f=o.scalar,m=o.vector);let _=Y("outputData",h,a.length,4),g=M("aData",d,t.length,4),w=M("bData",c,r.length,4),x;if(n)if(i){let b=z.size(t)===1,k=z.size(r)===1,S=t.length>0&&t[t.length-1]%4===0,T=r.length>0&&r[r.length-1]%4===0;b||k?x=_.setByOffset("global_idx",m(b?`${g.type.value}(${g.getByOffset("0")}.x)`:g.getByOffset("global_idx"),k?`${w.type.value}(${w.getByOffset("0")}.x)`:w.getByOffset("global_idx"))):x=`
            let outputIndices = ${_.offsetToIndices("global_idx * 4u")};
            let offsetA = ${g.broadcastedIndicesToOffset("outputIndices",_)};
            let offsetB = ${w.broadcastedIndicesToOffset("outputIndices",_)};
            ${_.setByOffset("global_idx",m(s||S?g.getByOffset("offsetA / 4u"):`${g.type.value}(${g.getByOffset("offsetA / 4u")}[offsetA % 4u])`,s||T?w.getByOffset("offsetB / 4u"):`${w.type.value}(${w.getByOffset("offsetB / 4u")}[offsetB % 4u])`))}
          `}else x=_.setByOffset("global_idx",m(g.getByOffset("global_idx"),w.getByOffset("global_idx")));else{if(!i)throw new Error("no necessary to use scalar implementation for element-wise binary op implementation.");let b=(k,S,T="")=>{let E=`aData[indexA${S}][componentA${S}]`,I=`bData[indexB${S}][componentB${S}]`;return`
            let outputIndices${S} = ${_.offsetToIndices(`global_idx * 4u + ${S}u`)};
            let offsetA${S} = ${g.broadcastedIndicesToOffset(`outputIndices${S}`,_)};
            let offsetB${S} = ${w.broadcastedIndicesToOffset(`outputIndices${S}`,_)};
            let indexA${S} = offsetA${S} / 4u;
            let indexB${S} = offsetB${S} / 4u;
            let componentA${S} = offsetA${S} % 4u;
            let componentB${S} = offsetB${S} % 4u;
            ${k}[${S}] = ${T}(${f(E,I)});
          `};h===9?x=`
            var data = vec4<u32>(0);
            ${b("data",0,"u32")}
            ${b("data",1,"u32")}
            ${b("data",2,"u32")}
            ${b("data",3,"u32")}
            outputData[global_idx] = dot(vec4<u32>(0x1, 0x100, 0x10000, 0x1000000), vec4<u32>(data));`:x=`
            ${b("outputData[global_idx]",0)}
            ${b("outputData[global_idx]",1)}
            ${b("outputData[global_idx]",2)}
            ${b("outputData[global_idx]",3)}
          `}return`
        ${e.registerUniform("vec_size","u32").declareVariables(g,w,_)}

        ${u??""}

        ${e.mainStart()}
        ${e.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.vec_size")}
        ${x}
      }`},Tl=(e,t,r,a,n,i,s=r.dataType)=>{let o=r.dims.map(g=>Number(g)??1),d=a.dims.map(g=>Number(g)??1),c=!z.areEqual(o,d),h=o,u=z.size(o),f=!1,m=!1,_=[c];if(c){let g=pr.calcShape(o,d,!1);if(!g)throw new Error("Can't perform binary op on the given tensors");h=g.slice(),u=z.size(h);let w=z.size(o)===1,x=z.size(d)===1,b=o.length>0&&o[o.length-1]%4===0,k=d.length>0&&d[d.length-1]%4===0;_.push(w),_.push(x),_.push(b),_.push(k);let S=1;for(let T=1;T<h.length;T++){let E=o[o.length-T],I=d[d.length-T];if(E===I)S*=E;else break}S%4===0?(m=!0,f=!0):(w||x||b||k)&&(f=!0)}else f=!0;return _.push(f),{name:e,shaderCache:{hint:t+_.map(g=>g.toString()).join("_"),inputDependencies:["rank","rank"]},getShaderSource:g=>Sl(g,o,d,h,f,c,m,n,r.dataType,a.dataType,s,i),getRunData:()=>({outputs:[{dims:h,dataType:s}],dispatchGroup:{x:Math.ceil(u/64/4)},programUniforms:[{type:12,data:Math.ceil(z.size(h)/4)},...ee(o,d,h)]})}},rt=(e,t,r,a,n,i)=>{e.compute(Tl(t,n??"",e.inputs[0],e.inputs[1],r,a,i))},Zh=e=>{rt(e,"Add",(t,r)=>`${t}+${r}`)},Kh=e=>{rt(e,"Div",(t,r)=>`${t}/${r}`)},Qh=e=>{rt(e,"Equal",{scalar:(t,r)=>`u32(${t}==${r})`,vector:(t,r)=>`vec4<u32>(${t}==${r})`},void 0,void 0,9)},Yh=e=>{rt(e,"Mul",(t,r)=>`${t}*${r}`)},Jh=e=>{let t=M("input",e.inputs[0].dataType,e.inputs[0].dims).type.value;rt(e,"Pow",{scalar:(r,a)=>`pow_custom(${r},${a})`,vector:(r,a)=>`pow_vector_custom(${r},${a})`},`
    fn pow_custom(a : ${t}, b : ${t}) -> ${t} {
      if (b == ${t}(0.0)) {
        return ${t}(1.0);
      } else if (a < ${t}(0.0) && f32(b) != floor(f32(b))) {
        return ${t}(pow(f32(a), f32(b))); // NaN
      }
      return select(sign(a), ${t}(1.0), round(f32(abs(b) % ${t}(2.0))) != 1.0) * ${t}(${t==="i32"?"round":""}(pow(f32(abs(a)), f32(b))));
    }
    fn pow_vector_custom(a : vec4<${t}>, b : vec4<${t}>) -> vec4<${t}> {
      // TODO: implement vectorized pow
      return vec4<${t}>(pow_custom(a.x, b.x), pow_custom(a.y, b.y), pow_custom(a.z, b.z), pow_custom(a.w, b.w));
    }
      `)},Xh=e=>{rt(e,"Sub",(t,r)=>`${t}-${r}`)},ef=e=>{rt(e,"Greater",{scalar:(t,r)=>`u32(${t}>${r})`,vector:(t,r)=>`vec4<u32>(${t}>${r})`},void 0,void 0,9)},tf=e=>{rt(e,"Less",{scalar:(t,r)=>`u32(${t}<${r})`,vector:(t,r)=>`vec4<u32>(${t}<${r})`},void 0,void 0,9)},rf=e=>{rt(e,"GreaterOrEqual",{scalar:(t,r)=>`u32(${t}>=${r})`,vector:(t,r)=>`vec4<u32>(${t}>=${r})`},void 0,void 0,9)},af=e=>{rt(e,"LessOrEqual",{scalar:(t,r)=>`u32(${t}<=${r})`,vector:(t,r)=>`vec4<u32>(${t}<=${r})`},void 0,void 0,9)}}),Cl,Il,El,Al,nf,sf,f_=j(()=>{ie(),le(),ze(),de(),Cl=(e,t)=>{if(!e||e.length<1)throw new Error("too few inputs");let r=0,a=e[r],n=a.dataType,i=a.dims.length;e.forEach((s,o)=>{if(o!==r){if(s.dataType!==n)throw new Error("input tensors should be one type");if(s.dims.length!==i)throw new Error("input tensors should have the same shape");s.dims.forEach((d,c)=>{if(c!==t&&d!==a.dims[c])throw new Error("non concat dimensions must match")})}})},Il=(e,t)=>`
  fn calculateInputIndex(index: u32) -> u32 {
    let sizeInConcatAxis = array<u32, ${e}u>(${t});
    for (var i: u32 = 0u; i < ${e}; i += 1u ) {
      if (index < sizeInConcatAxis[i]) {
        return i;
      }
    }
    return ${e}u;
  }`,El=(e,t)=>{let r=e.length,a=[];for(let n=0;n<r;++n){let i=t.setByOffset("global_idx",e[n].getByIndices("indices"));r===1?a.push(i):n===0?a.push(`if (inputIndex == ${n}u) { ${i} }`):n===r-1?a.push(`else { ${i} }`):a.push(`else if (inputIndex == ${n}) { ${i} }`)}return a.join(`
`)},Al=(e,t,r,a)=>{let n=z.size(r),i=new Array(e.length),s=new Array(e.length),o=0,d=[],c=[],h=[{type:12,data:n}];for(let g=0;g<e.length;++g)o+=e[g].dims[t],i[g]=o,c.push(e[g].dims.length),s[g]=M(`input${g}`,a,c[g]),d.push("rank"),h.push({type:12,data:i[g]});for(let g=0;g<e.length;++g)h.push(...ee(e[g].dims));h.push(...ee(r));let u=Y("output",a,r.length),f=u.indicesGet("indices",t),m=Array.from(Array(i.length).keys()).map(g=>`uniforms.sizeInConcatAxis${g}`).join(","),_=g=>`

  ${(()=>{g.registerUniform("outputSize","u32");for(let w=0;w<e.length;w++)g.registerUniform(`sizeInConcatAxis${w}`,"u32");return g.declareVariables(...s,u)})()}

  ${Il(i.length,m)}

  ${g.mainStart()}
    ${g.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.outputSize")}

    var indices = ${u.offsetToIndices("global_idx")};

    let inputIndex = calculateInputIndex(${f});
    if (inputIndex != 0u) {
      let sizeInConcatAxis = array<u32, ${i.length}u>(${m});
      ${f} -= sizeInConcatAxis[inputIndex - 1u];
    }

    ${El(s,u)}
  }`;return{name:"Concat",shaderCache:{hint:`${t}`,inputDependencies:d},getRunData:()=>({outputs:[{dims:r,dataType:a}],dispatchGroup:{x:Math.ceil(n/64)},programUniforms:h}),getShaderSource:_}},nf=(e,t)=>{let r=e.inputs,a=r[0].dims,n=z.normalizeAxis(t.axis,a.length);Cl(r,n);let i=a.slice();i[n]=r.reduce((o,d)=>o+(d.dims.length>n?d.dims[n]:0),0);let s=r.filter(o=>z.size(o.dims)>0);e.compute(Al(s,n,i,r[0].dataType),{inputs:s})},sf=e=>xe({axis:e.axis})}),Qt,Yt,Jt,Is,rr=j(()=>{ie(),le(),Qt=(e,t,r="f32")=>{switch(e.activation){case"Relu":return`value = max(value, ${t}(0.0));`;case"Sigmoid":return`value = (${t}(1.0) / (${t}(1.0) + exp(-value)));`;case"Clip":return`value = clamp(value, ${t}(${r}(uniforms.clip_min)), ${t}(${r}(uniforms.clip_max)));`;case"HardSigmoid":return`value = max(${t}(0.0), min(${t}(1.0), ${r}(uniforms.alpha) * value + ${r}(uniforms.beta)));`;case"LeakyRelu":return`value = select(${r}(uniforms.alpha) * value, value, value >= ${t}(0.0));`;case"Tanh":return`let e2x = exp(-2.0 * abs(value));
              value = sign(value) * (1.0 - e2x) / (1.0 + e2x);
        `;case"":return"";default:throw new Error(`Unsupported activation ${e.activation}`)}},Yt=(e,t)=>{e.activation==="Clip"?t.push({type:1,data:e.clipMax},{type:1,data:e.clipMin}):e.activation==="HardSigmoid"?t.push({type:1,data:e.alpha},{type:1,data:e.beta}):e.activation==="LeakyRelu"&&t.push({type:1,data:e.alpha})},Jt=(e,t)=>{e.activation==="Clip"?t.push({name:"clip_max",type:"f32"},{name:"clip_min",type:"f32"}):e.activation==="HardSigmoid"?t.push({name:"alpha",type:"f32"},{name:"beta",type:"f32"}):e.activation==="LeakyRelu"&&t.push({name:"alpha",type:"f32"})},Is=e=>{let t=e?.activation||"";if(t==="HardSigmoid"){let[r,a]=e?.activation_params||[.2,.5];return{activation:t,alpha:r,beta:a}}else if(t==="Clip"){let[r,a]=e?.activation_params||[Np,Bp];return{activation:t,clipMax:a,clipMin:r}}else if(t==="LeakyRelu"){let[r]=e?.activation_params||[.01];return{activation:t,alpha:r}}return{activation:t}}}),Be,of,Es=j(()=>{Be=(e,t)=>{switch(e){case 1:return t;case 2:return`vec2<${t}>`;case 3:return`vec3<${t}>`;case 4:return`vec4<${t}>`;default:throw new Error(`${e}-component is not supported.`)}},of=e=>`
      ${e?"value = value + getBiasByOutputCoords(coords);":""}
      `}),uf,m_=j(()=>{uf=e=>`
fn getIndexFromCoords4D(coords : vec4<i32>, shape : vec4<i32>) -> i32 {
  return dot(coords, vec4<i32>(
      shape.y * shape.z * shape.w, shape.z * shape.w, shape.w, 1));
}
fn getOutputIndexFromCoords(coords : vec4<i32>) -> i32 {
  return dot(coords, vec4<i32>(
    i32(${e}.x), i32(${e}.y), i32(${e}.z), 1));
}
`}),qr,As,zs=j(()=>{ie(),le(),de(),rr(),qr=(e,t,r,a,n)=>{let i=a-r;return`
      ${Array.from({length:r}).map((s,o)=>`
      if (${X(t.shape,o,t.rank)} != 1) {
        ${t.indicesSet(e,o,X(n,o+i,a))}
      } else {
        ${t.indicesSet(e,o,0)}
      }`).join("")}
`},As=(e,t,r,a,n=!1,i)=>{let s=e[0].dims,o=e[1].dims,d=s[s.length-2],c=o[o.length-1],h=s[s.length-1],u=Ee(c),f=Ee(h),m=Ee(d),_=z.size(r)/u/m,g=e.length>2,w=a?a.slice(0,-2):r.slice(0,-2),x=[z.size(w),d,c],b=[{type:12,data:_},{type:12,data:d},{type:12,data:c},{type:12,data:h}];Yt(t,b),b.push(...ee(w,s,o)),g&&b.push(...ee(e[2].dims)),b.push(...ee(x));let k=S=>{let T=ks("batch_dims",e[0].dataType,w.length),E=M("a",e[0].dataType,s.length,f),I=M("b",e[1].dataType,o.length,u),N=Y("output",e[0].dataType,x.length,u),D=Ne(N.type.tensor),V=Qt(t,N.type.value,D),A=[E,I],W="";if(g){let ne=n?u:1;A.push(M("bias",e[2].dataType,e[2].dims.length,ne)),W=`${n?`value += bias[col / ${ne}];`:`value += ${N.type.value}(bias[row + i]);`}`}let P=[{name:"output_size",type:"u32"},{name:"M",type:"u32"},{name:"N",type:"u32"},{name:"K",type:"u32"}];Jt(t,P);let J=()=>{let ne=`var a_data: ${E.type.value};`;for(let F=0;F<f;F++)ne+=`
              let b_data${F} = b[(b_offset + (k + ${F}) * uniforms.N + col) / ${u}];`;for(let F=0;F<m;F++){ne+=`a_data = a[(a_offset + (row + ${F}) * uniforms.K + k) / ${f}];`;for(let se=0;se<f;se++)ne+=`
            values[${F}] = fma(${I.type.value}(a_data${f===1?"":`[${se}]`}), b_data${se}, values[${F}]);
`}return ne};return`
  ${S.registerUniforms(P).registerInternalVariables(T).declareVariables(...A,N)}
  ${S.mainStart()}
    ${S.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.output_size")}
    let col = (global_idx % (uniforms.N / ${u})) * ${u};
    var index1 = global_idx / (uniforms.N / ${u});
    let stride1 = uniforms.M / ${m};
    let row = (index1 % stride1) * ${m};
    let batch = index1 / stride1;

    ${r.length===2?"":`let batch_indices = ${T.offsetToIndices("batch")};`}

    var a_indices: ${E.type.indices};
    ${qr("a_indices",E,E.rank-2,T.rank,"batch_indices")}
    ${E.indicesSet("a_indices",E.rank-2,0)}
    ${E.indicesSet("a_indices",E.rank-1,0)}
    let a_offset = ${E.indicesToOffset("a_indices")};

    var b_indices: ${I.type.indices};
    ${qr("b_indices",I,I.rank-2,T.rank,"batch_indices")}
    ${I.indicesSet("b_indices",I.rank-2,0)}
    ${I.indicesSet("b_indices",I.rank-1,0)}
    let b_offset = ${I.indicesToOffset("b_indices")};
    var values: array<${N.type.value}, ${m}>;
    for (var k: u32 = 0u; k < uniforms.K; k = k + ${f}) {
      ${J()}
    }
    for (var i = 0u; i < ${m}u; i++) {
      var value = values[i];
      ${W}
      ${V}
      let cur_indices = ${N.type.indices}(batch, row + i, col);
      let offset = ${N.indicesToOffset("cur_indices")};
      ${N.setByOffset(`offset / ${u}`,"value")};
    }
  }
  `};return{name:"MatMulNaive",shaderCache:{hint:`${t.activation};${u};${f};${m};${n}`,inputDependencies:g?["rank","rank","rank"]:["rank","rank"]},getRunData:()=>({outputs:[{dims:i?i(r):r,dataType:e[0].dataType}],dispatchGroup:{x:Math.ceil(_/64)},programUniforms:b}),getShaderSource:k}}}),zl,Ol,Hi,ti,Rl,Gi,Ml,Za,Os=j(()=>{ie(),le(),de(),rr(),zs(),Es(),zl=(e,t)=>e?`
        mm_Asub[inputRow][inputCol] = mm_readA(batch,
          kStart + inputRow,
          globalRowStart / innerElementSize + inputCol${t?", batchIndices":""});
        `:`
        mm_Asub[inputRow][inputCol] = mm_readA(batch,
          globalRow + innerRow,
          kStart / innerElementSize + inputCol${t?", batchIndices":""});
        `,Ol=(e,t)=>e?`
        let ACached0 = mm_Asub[k * innerElementSize][localRow];
        let ACached1 = mm_Asub[k * innerElementSize + 1][localRow];
        let ACached2 = mm_Asub[k * innerElementSize + 2][localRow];
        ${t===3?"":"let ACached3 = mm_Asub[k * innerElementSize + 3][localRow];"}
        for (var i = 0; i < rowPerThread; i = i + 1) {
          acc[i] = BCached0 * ACached0[i] + acc[i];
          acc[i] = BCached1 * ACached1[i] + acc[i];
          acc[i] = BCached2 * ACached2[i] + acc[i];
          ${t===3?"":"acc[i] = BCached3 * ACached3[i] + acc[i];"}
        }`:`
        for (var i = 0; i < rowPerThread; i = i + 1) {
          let ACached = mm_Asub[tileRow + i][k];
          acc[i] = BCached0 * ACached.x + acc[i];
          acc[i] = BCached1 * ACached.y + acc[i];
          acc[i] = BCached2 * ACached.z + acc[i];
          ${t===3?"":"acc[i] = BCached3 * ACached.w + acc[i];"}
        }`,Hi=(e,t,r="f32",a,n=!1,i=32,s=!1,o=32)=>{let d=t[1]*e[1],c=t[0]*e[0],h=n?d:i,u=n?i:d,f=h/t[0],m=i/t[1];if(!((n&&f===4&&e[1]===4||!n&&(f===3||f===4))&&h%t[0]===0&&i%t[1]===0&&e[0]===4))throw new Error(`If transposeA ${n} is true, innerElementSize ${f} and workPerThread[1] ${e[1]} must be 4.
      Otherwise, innerElementSize ${f} must be 3 or 4.
  tileAWidth ${h} must be divisible by workgroupSize[0]${t[0]}. tileInner ${i} must be divisible by workgroupSize[1] ${t[1]}. colPerThread ${e[0]} must be 4.`);return`
var<workgroup> mm_Asub: array<array<vec${f}<${r}>, ${h/f}>, ${u}>;
var<workgroup> mm_Bsub: array<array<vec4<${r}>, ${c/e[0]}>, ${i}>;

const rowPerThread = ${e[1]};
const colPerThread = ${e[0]};
const innerElementSize = ${f};
const tileInner = ${i};

@compute @workgroup_size(${t[0]}, ${t[1]}, ${t[2]})
fn main(@builtin(local_invocation_id) localId : vec3<u32>,
        @builtin(global_invocation_id) globalId : vec3<u32>,
        @builtin(workgroup_id) workgroupId : vec3<u32>) {
  let localRow = i32(localId.y);
  let tileRow = localRow * rowPerThread;
  let tileCol = i32(localId.x);

  let globalRow =i32(globalId.y) * rowPerThread;
  let globalCol = i32(globalId.x);
  let batch = ${s?"0":"i32(globalId.z)"};
  ${a?`let batchIndices = ${a.offsetToIndices("u32(batch)")};`:""}
  let globalRowStart = i32(workgroupId.y) * ${d};

  let num_tiles = ${s?`${Math.ceil(o/i)}`:"(uniforms.dim_inner - 1) / tileInner + 1"};
  var kStart = ${s?`i32(globalId.z) * ${o}`:"0"};

  var acc: array<vec4<${r}>, rowPerThread>;

  // Loop over shared dimension.
  let tileRowB = localRow * ${m};
  for (var t = 0; t < num_tiles; t = t + 1) {
      // Load one tile of A into local memory.
      for (var innerRow = 0; innerRow < rowPerThread; innerRow = innerRow + 1) {
          let inputRow = tileRow + innerRow;
          let inputCol = tileCol;
          ${zl(n,a)}
      }

      // Load one tile of B into local memory.
      for (var innerRow = 0; innerRow < ${m}; innerRow = innerRow + 1) {
          let inputRow = tileRowB + innerRow;
          let inputCol = tileCol;
          mm_Bsub[inputRow][inputCol] = mm_readB(batch, kStart + inputRow, globalCol${a?", batchIndices":""});
      }
      kStart = kStart + tileInner;
      workgroupBarrier();

      // Compute acc values for a single thread.
      for (var k = 0; k < tileInner / innerElementSize; k = k + 1) {
          let BCached0 = mm_Bsub[k * innerElementSize][tileCol];
          let BCached1 = mm_Bsub[k * innerElementSize + 1][tileCol];
          let BCached2 = mm_Bsub[k * innerElementSize + 2][tileCol];
          ${f===3?"":"let BCached3 = mm_Bsub[k * innerElementSize + 3][tileCol];"}

          ${Ol(n,f)}
      }

      workgroupBarrier();
  }

  for (var innerRow = 0; innerRow < rowPerThread; innerRow = innerRow + 1) {
      mm_write(batch, globalRow + innerRow, globalCol, acc[innerRow]);
  }
}`},ti=(e,t)=>e?`
            mm_Asub[inputRow][inputCol] = mm_readA(batch,
              kStart + inputRow,
              globalRowStart + inputCol${t?", batchIndices":""});
            `:`
            mm_Asub[inputRow][inputCol] = mm_readA(batch,
              globalRowStart + inputRow,
              kStart + inputCol${t?", batchIndices":""});
            `,Rl=e=>e?"let ACached = mm_Asub[k][tileRow + innerRow];":"let ACached = mm_Asub[tileRow + innerRow][k];",Gi=(e,t,r="f32",a,n=!1,i=32,s=!1,o=32,d=!1)=>{let c=e[1]*t[1],h=e[0]*t[0],u=n?c:i,f=n?i:c;if(!(f%t[1]===0&&u%t[0]===0&&i%t[1]===0))throw new Error(`tileAHight ${f} must be divisible by workgroupSize[1]${t[1]}, tileAWidth ${u} must be divisible by workgroupSize[0]${t[0]}, tileInner ${i} must be divisible by workgroupSize[1]${t[1]}`);let m=f/t[1],_=u/t[0],g=i/t[1],w=d?`
    let localRow = i32(localId.y);
    let localCol = i32(localId.x);
    let globalRowStart = i32(workgroupId.y) * ${c};
    let globalColStart = i32(workgroupId.x) * ${h};

    // Loop over shared dimension.
    for (var t = 0; t < num_tiles; t = t + 1) {
      // Load one tile of A into local memory.
      for (var inputRow = localRow; inputRow < ${f}; inputRow = inputRow + ${t[1]}) {
        for (var inputCol = localCol; inputCol < ${u}; inputCol = inputCol + ${t[0]}) {
          ${ti(n,a)}
        }
      }
      // Load one tile of B into local memory.
      for (var inputRow = localRow; inputRow < ${i}; inputRow = inputRow + ${t[1]}) {
            for (var inputCol = localCol; inputCol < ${h}; inputCol = inputCol + ${t[0]}) {
          mm_Bsub[inputRow][inputCol] = mm_readB(batch,
            kStart + inputRow,
            globalColStart + inputCol${a?", batchIndices":""});
        }
      }
      kStart = kStart + tileInner;
      workgroupBarrier();

      // Compute acc values for a single thread.
      var BCached : array<${r}, colPerThread>;
      for (var k = 0; k < tileInner; k = k + 1) {
        for (var inner = 0; inner < colPerThread; inner = inner + 1) {
          BCached[inner] = mm_Bsub[k][localCol + inner * ${t[0]}];
        }
        for (var innerRow = 0; innerRow < rowPerThread; innerRow = innerRow + 1) {
          let ACached = ${n?`mm_Asub[k][localRow + innerRow * ${t[1]}];`:`mm_Asub[localRow + innerRow * ${t[1]}][k];`}
          for (var innerCol = 0; innerCol < colPerThread; innerCol = innerCol + 1) {
            acc[innerRow][innerCol] = acc[innerRow][innerCol] +
                ACached * BCached[innerCol];
          }
        }
      }
      workgroupBarrier();
    }
    for (var innerRow = 0; innerRow < rowPerThread; innerRow = innerRow + 1) {
      let gRow = globalRowStart + localRow + innerRow * ${t[1]};
      for (var innerCol = 0; innerCol < colPerThread; innerCol = innerCol + 1) {
        let gCol = globalColStart + localCol + innerCol * ${t[0]};
        mm_write(batch, gRow, gCol, acc[innerRow][innerCol]);
      }
    }
    `:`
let tileRow = i32(localId.y) * rowPerThread;
let tileCol = i32(localId.x) * colPerThread;

let globalRow = i32(globalId.y) * rowPerThread;
let globalCol = i32(globalId.x) * colPerThread;
let globalRowStart = i32(workgroupId.y) * ${c};

let tileRowA = i32(localId.y) * ${m};
let tileColA = i32(localId.x) * ${_};
let tileRowB = i32(localId.y) * ${g};
// Loop over shared dimension.
for (var t = 0; t < num_tiles; t = t + 1) {
  // Load one tile of A into local memory.
  for (var innerRow = 0; innerRow < ${m}; innerRow = innerRow + 1) {
    for (var innerCol = 0; innerCol < ${_}; innerCol = innerCol + 1) {
      let inputRow = tileRowA + innerRow;
      let inputCol = tileColA + innerCol;
      ${ti(n,a)}
    }
  }

  // Load one tile of B into local memory.
  for (var innerRow = 0; innerRow < ${g}; innerRow = innerRow + 1) {
    for (var innerCol = 0; innerCol < colPerThread; innerCol = innerCol + 1) {
      let inputRow = tileRowB + innerRow;
      let inputCol = tileCol + innerCol;
      mm_Bsub[inputRow][inputCol] = mm_readB(batch,
        kStart + inputRow,
        globalCol + innerCol${a?", batchIndices":""});
    }
  }
  kStart = kStart + tileInner;
  workgroupBarrier();

  // Compute acc values for a single thread.
  var BCached : array<${r}, colPerThread>;
  for (var k = 0; k < tileInner; k = k + 1) {
    for (var inner = 0; inner < colPerThread; inner = inner + 1) {
      BCached[inner] = mm_Bsub[k][tileCol + inner];
    }

    for (var innerRow = 0; innerRow < rowPerThread; innerRow = innerRow + 1) {
      ${Rl(n)}
      for (var innerCol = 0; innerCol < colPerThread; innerCol = innerCol + 1) {
        acc[innerRow][innerCol] = acc[innerRow][innerCol] + ACached * BCached[innerCol];
      }
    }
  }

  workgroupBarrier();
}

for (var innerRow = 0; innerRow < rowPerThread; innerRow = innerRow + 1) {
  for (var innerCol = 0; innerCol < colPerThread; innerCol = innerCol + 1) {
    mm_write(batch, globalRow + innerRow, globalCol + innerCol,
        acc[innerRow][innerCol]);
  }
}
`;return`
  var<workgroup> mm_Asub : array<array<${r}, ${u}>, ${f}>;
  var<workgroup> mm_Bsub : array<array<${r}, ${h}>, ${i}>;
  const rowPerThread = ${e[1]};
  const colPerThread = ${e[0]};
  const tileInner = ${i};

@compute @workgroup_size(${t[0]}, ${t[1]}, ${t[2]})
fn main(@builtin(local_invocation_id) localId : vec3<u32>,
        @builtin(global_invocation_id) globalId : vec3<u32>,
        @builtin(workgroup_id) workgroupId : vec3<u32>) {
    let batch = ${s?"0":"i32(globalId.z)"};
    ${a?`let batchIndices = ${a.offsetToIndices("u32(batch)")};`:""}
    let num_tiles = ${s?`${Math.ceil(o/i)}`:"(uniforms.dim_inner - 1) / tileInner + 1"};
    var kStart = ${s?`i32(globalId.z) * ${o}`:"0"};

    var acc : array<array<${r}, colPerThread>, rowPerThread>;
    ${w}
  }
`},Ml=(e,t,r,a,n=!1)=>{let[i,s,o,d]=a,c=Ne(a[0].type.tensor);return`
    fn mm_readA(batch: i32, row: i32, colIn: i32, batchIndices: ${i.type.indices}) -> ${Be(e,c)} {
      var value = ${Be(e,c)}(0.0);
      let col = colIn * ${e};
      if(row < uniforms.dim_a_outer && col < uniforms.dim_inner)
      {
        var aIndices: ${s.type.indices};
        ${qr("aIndices",s,s.rank-2,i.rank,"batchIndices")}
        ${s.indicesSet("aIndices",s.rank-2,"u32(row)")}
        ${s.indicesSet("aIndices",s.rank-1,"u32(colIn)")}
        value = ${s.getByIndices("aIndices")};
      }
      return value;
    }

    fn mm_readB(batch: i32, row: i32, colIn: i32, batchIndices: ${i.type.indices}) -> ${Be(e,c)} {
      var value = ${Be(e,c)}(0.0);
      let col = colIn * ${e};
      if(row < uniforms.dim_inner && col < uniforms.dim_b_outer)
      {
        var bIndices: ${o.type.indices};
        ${qr("bIndices",o,o.rank-2,i.rank,"batchIndices")}
        ${o.indicesSet("bIndices",o.rank-2,"u32(row)")}
        ${o.indicesSet("bIndices",o.rank-1,"u32(colIn)")}
        value = ${o.getByIndices("bIndices")};
      }
      return value;
    }

    fn mm_write(batch: i32, row: i32, colIn: i32, valueIn: ${Be(e,c)}) {
      let col = colIn * ${e};
      if (row < uniforms.dim_a_outer && col < uniforms.dim_b_outer) {
        var value = valueIn;
        let coords = vec3<i32>(batch, row, colIn);
        ${t?`value = value + ${n?"bias[colIn]":`${Be(e,c)}(bias[row])`};`:""}
        ${r}
        ${d.setByIndices("vec3<u32>(coords)","value")}
      }
    }
    `},Za=(e,t,r,a,n=!1,i)=>{let s=e[0].dims,o=e[1].dims,d=s.slice(0,-2),c=o.slice(0,-2),h=a?a.slice(0,-2):r.slice(0,-2),u=z.size(h),f=s[s.length-2],m=s[s.length-1],_=o[o.length-1],g=m%4===0&&_%4===0,w=f<=8?[4,1,1]:[4,4,1],x=[8,8,1],b=[Math.ceil(_/x[0]/w[0]),Math.ceil(f/x[1]/w[1]),Math.ceil(u/x[2]/w[2])],k=g?4:1,S=[...d,f,m/k],T=S.length,E=[...c,m,_/k],I=E.length,N=[u,f,_/k],D=[{type:6,data:f},{type:6,data:_},{type:6,data:m}];Yt(t,D),D.push(...ee(h,S,E));let V=["rank","rank"],A=e.length>2;A&&(D.push(...ee(e[2].dims)),V.push("rank")),D.push(...ee(N));let W=P=>{let J=h.length,ne=ks("batchDims",e[0].dataType,J,1),F=Ne(e[0].dataType),se=M("a",e[0].dataType,T,k),ce=M("b",e[1].dataType,I,k),K=Y("result",e[0].dataType,N.length,k),Te=[se,ce];if(A){let Re=n?k:1;Te.push(M("bias",e[2].dataType,e[2].dims.length,Re))}let U=[{name:"dim_a_outer",type:"i32"},{name:"dim_b_outer",type:"i32"},{name:"dim_inner",type:"i32"}];Jt(t,U);let G=Ne(K.type.tensor),ye=Qt(t,K.type.value,G),ge=Ml(k,A,ye,[ne,se,ce,K],n);return`
  ${P.registerUniforms(U).registerInternalVariables(ne).declareVariables(...Te,K)}
  ${ge}
  ${g?Hi(w,x,F,ne):Gi(w,x,F,ne)}
                   `};return{name:"MatMul",shaderCache:{hint:`${w};${t.activation};${g};${n}`,inputDependencies:V},getRunData:()=>({outputs:[{dims:i?i(r):r,dataType:e[0].dataType}],dispatchGroup:{x:b[0],y:b[1],z:b[2]},programUniforms:D}),getShaderSource:W}}}),Nl,lf,g_=j(()=>{ie(),xt(),de(),rr(),Es(),m_(),Os(),Nl=(e,t,r,a,n=!1,i,s=4,o=4,d=4,c="f32")=>{let h=D=>{switch(D){case 1:return"resData = x[xIndex];";case 3:return`resData = vec3<${c}>(x[xIndex], x[xIndex + 1], x[xIndex + 2]);`;case 4:return"resData = x[xIndex / 4];";default:throw new Error(`innerElementSize ${D} is not supported.`)}},u=D=>{switch(D){case 1:return"return w[row * i32(uniforms.w_shape[3]) + colIn];";case 4:return"return w[row * i32(uniforms.w_shape[3]) / 4 + colIn];";default:throw new Error(`innerElementSize ${D} is not supported.`)}},f=e?`
    let coord = vec4<i32>(batch, xRow, xCol, xCh);
    `:`
    let coord = vec4<i32>(batch, xCh, xRow, xCol);
    `,m=e?`
    let coords = vec4<i32>(
      batch,
      row / outWidth,
      row % outWidth,
      col);
    `:`
    let coords = vec4<i32>(
      batch,
      row,
      col / outWidth,
      col % outWidth);
    `,_=e?"i32(uniforms.x_shape[1])":"i32(uniforms.x_shape[2])",g=e?"i32(uniforms.x_shape[2])":"i32(uniforms.x_shape[3])",w=e?"row":"col",x=e?"col":"row",b=`
    let inChannels = i32(uniforms.w_shape[2]);
    let outWidth = ${e?"i32(uniforms.result_shape[2])":"i32(uniforms.result_shape[3])"};
    let outRow = ${w} / outWidth;
    let outCol = ${w} % outWidth;

    let WRow = ${x} / (i32(uniforms.w_shape[1]) * inChannels);
    let WCol = ${x} / inChannels % i32(uniforms.w_shape[1]);
    let xRow = outRow * uniforms.stride[0] + uniforms.dilation[0] * WRow - uniforms.pad[0];
    let xCol = outCol * uniforms.stride[1] + uniforms.dilation[1] * WCol - uniforms.pad[1];
    let xCh = ${x} % inChannels;
    var resData = ${Be(s,c)}(0.0);
    // The bounds checking is always needed since we use it to pad zero for
    // the 'same' padding type.
    if (xRow >= 0 && xRow < ${_} && xCol >= 0 && xCol < ${g}) {
      ${f}
      let xIndex = getIndexFromCoords4D(coord, vec4<i32>(uniforms.x_shape));
      ${h(s)}
    }
    return resData;`,k=e?t&&a?`
    let col = colIn * ${s};
    ${b}`:`
    let col = colIn * ${s};
    if (row < uniforms.dim_a_outer && col < uniforms.dim_inner) {
      ${b}
    }
    return ${Be(s,c)}(0.0);`:a&&r?`
    let col = colIn * ${s};
    ${b}`:`
    let col = colIn * ${s};
    if (row < uniforms.dim_inner && col < uniforms.dim_b_outer) {
      ${b}
    }
    return ${Be(s,c)}(0.0);`,S=e?a&&r?u(o):`
    let col = colIn * ${o};
    if (row < uniforms.dim_inner && col < uniforms.dim_b_outer) {
      ${u(o)}
    }
    return ${Be(o,c)}(0.0);`:`
    let col = colIn * ${o};
    if (row < uniforms.dim_inner && col < uniforms.dim_a_outer) {
      ${u(o)}
    }
    return ${Be(o,c)}(0.0);`,T=Be(d,c),E=Be(e?s:o,c),I=Be(e?o:s,c),N=Qt(i,T,c);return`
    fn mm_readA(batch: i32, row : i32, colIn : i32) -> ${E} {
      ${e?k:S}
    }

    fn mm_readB(batch: i32, row : i32, colIn : i32) -> ${I} {
      ${e?S:k}
    }

    fn mm_write(batch: i32, row : i32, colIn : i32, valueIn : ${T}) {
      let col = colIn * ${d};
      if (row < uniforms.dim_a_outer && col < uniforms.dim_b_outer)
      {
      var value = valueIn;
      let outWidth = ${e?"i32(uniforms.result_shape[2])":"i32(uniforms.result_shape[3])"};
      ${m}
      ${of(n)}
      ${N}
      setOutputAtCoords(coords[0], coords[1], coords[2], coords[3], value);
      }
    }`},lf=(e,t,r,a,n,i,s,o,d)=>{let c=t.format==="NHWC",h=c?e[0].dims[3]:e[0].dims[1],u=r[0],f=c?r[2]:r[3],m=c?r[1]:r[2],_=c?r[3]:r[1],g=c&&(h%4===0||h%3===0)&&_%4===0,w=c?_:f*m,x=c?f*m:_,b=[8,8,1],k=a<=8?[4,1,1]:[4,4,1],S=[Math.ceil(w/b[0]/k[0]),Math.ceil(x/b[1]/k[1]),Math.ceil(u/b[2]/k[2])];$e("verbose",()=>`[conv2d_mm_webgpu] dispatch = ${S}`);let T=g?c&&h%4!==0?3:4:1,E=b[1]*k[1],I=b[0]*k[0],N=Math.max(b[0]*T,b[1]),D=a%E===0,V=n%I===0,A=i%N===0,W=g?[T,4,4]:[1,1,1],P=[{type:6,data:a},{type:6,data:n},{type:6,data:i},{type:6,data:[t.pads[0],t.pads[1]]},{type:6,data:t.strides},{type:6,data:t.dilations}];Yt(t,P),P.push(...ee(e[0].dims,e[1].dims));let J=["rank","rank"];s&&(P.push(...ee(e[2].dims)),J.push("rank")),P.push(...ee(r));let ne=F=>{let se=[{name:"dim_a_outer",type:"i32"},{name:"dim_b_outer",type:"i32"},{name:"dim_inner",type:"i32"},{name:"pad",type:"i32",length:2},{name:"stride",type:"i32",length:2},{name:"dilation",type:"i32",length:2}];Jt(t,se);let ce=g?4:1,K=Ne(e[0].dataType),Te=`
      fn setOutputAtIndex(flatIndex : i32, value : ${g?`vec4<${K}>`:K}) {
        result[flatIndex] = ${g?`vec4<${K}>`:K}(value);
      }
      fn setOutputAtCoords(d0 : i32, d1 : i32, d2 : i32, d3 : i32, value : ${g?`vec4<${K}>`:K}) {
        let flatIndex = getOutputIndexFromCoords(vec4<i32>(d0, d1, d2, d3));
        setOutputAtIndex(flatIndex ${g?"/ 4":""}, value);
      }`,U=M("x",e[0].dataType,e[0].dims.length,T===3?1:T),G=M("w",e[1].dataType,e[1].dims.length,ce),ye=[U,G],ge=Y("result",e[0].dataType,r.length,ce);if(s){let Re=M("bias",e[2].dataType,e[2].dims.length,ce);ye.push(Re),Te+=`
        fn getBiasByOutputCoords(coords : vec4<i32>) -> ${g?`vec4<${K}>`:K} {
          return bias[coords.${c?"w":"y"}${g?"/ 4":""}];
        }`}return`
        ${uf("uniforms.result_strides")}
        //struct Uniforms { xShape : vec4<i32>, wShape : vec4<i32>, outShape : vec4<i32>,
        //  outShapeStrides: vec3<i32>, filterDims : vec2<i32>, pad : vec2<i32>, stride : vec2<i32>,
        //  dilation : vec2<i32>, dimAOuter : i32, dimBOuter : i32, dimInner : i32 };
        ${F.registerUniforms(se).declareVariables(...ye,ge)}
        ${Te}
        ${Nl(c,D,V,A,s,t,W[0],W[1],W[2],K)}
        ${g?Hi(k,b,K,void 0,!c,N):Gi(k,b,K,void 0,!c,N,!1,void 0,o)}`};return{name:"Conv2DMatMul",shaderCache:{hint:`${t.cacheKey};${T};${g};${D};${V};${A};${E};${I};${N}`,inputDependencies:J},getRunData:()=>({outputs:[{dims:d?d(r):r,dataType:e[0].dataType}],dispatchGroup:{x:S[0],y:S[1],z:S[2]},programUniforms:P}),getShaderSource:ne}}}),Bl,ri,Ir,Dl,ai,Pl,df,cf,y_=j(()=>{ie(),xt(),le(),de(),rr(),Es(),Bl=e=>{let t=1;for(let r=0;r<e.length;r++)t*=e[r];return t},ri=e=>typeof e=="number"?[e,e,e]:e,Ir=(e,t)=>t<=1?e:e+(e-1)*(t-1),Dl=(e,t,r,a=1)=>{let n=Ir(t,a);return Math.floor((e[0]*(r-1)-r+n)/2)},ai=(e,t,r,a,n)=>{n==null&&(n=Dl(e,t[0],a[0]));let i=[0,0,0,r];for(let s=0;s<3;s++)e[s]+2*n>=t[s]&&(i[s]=Math.trunc((e[s]-t[s]+2*n)/a[s]+1));return i},Pl=(e,t,r,a,n,i,s,o,d,c)=>{let h,u,f,m;if(e==="VALID"&&(e=0),typeof e=="number"){h={top:e,bottom:e,left:e,right:e,front:e,back:e};let _=ai([t,r,a,1],[o,d,c],1,[n,i,s],e);u=_[0],f=_[1],m=_[2]}else if(Array.isArray(e)){if(!e.every((g,w,x)=>g===x[0]))throw Error(`Unsupported padding parameter: ${e}`);h={top:e[0],bottom:e[1],left:e[2],right:e[3],front:e[4],back:e[5]};let _=ai([t,r,a,1],[o,d,c],1,[n,i,s],e[0]);u=_[0],f=_[1],m=_[2]}else if(e==="SAME_UPPER"){u=Math.ceil(t/n),f=Math.ceil(r/i),m=Math.ceil(a/s);let _=(u-1)*n+o-t,g=(f-1)*i+d-r,w=(m-1)*s+c-a,x=Math.floor(_/2),b=_-x,k=Math.floor(g/2),S=g-k,T=Math.floor(w/2),E=w-T;h={top:k,bottom:S,left:T,right:E,front:x,back:b}}else throw Error(`Unknown padding parameter: ${e}`);return{padInfo:h,outDepth:u,outHeight:f,outWidth:m}},df=(e,t,r,a,n,i=!1,s="channelsLast")=>{let o,d,c,h,u;if(s==="channelsLast")[o,d,c,h,u]=e;else if(s==="channelsFirst")[o,u,d,c,h]=e;else throw new Error(`Unknown dataFormat ${s}`);let[f,,m,_,g]=t,[w,x,b]=ri(r),[k,S,T]=ri(a),E=Ir(m,k),I=Ir(_,S),N=Ir(g,T),{padInfo:D,outDepth:V,outHeight:A,outWidth:W}=Pl(n,d,c,h,w,x,b,E,I,N),P=i?f*u:f,J=[0,0,0,0,0];return s==="channelsFirst"?J=[o,P,V,A,W]:s==="channelsLast"&&(J=[o,V,A,W,P]),{batchSize:o,dataFormat:s,inDepth:d,inHeight:c,inWidth:h,inChannels:u,outDepth:V,outHeight:A,outWidth:W,outChannels:P,padInfo:D,strideDepth:w,strideHeight:x,strideWidth:b,filterDepth:m,filterHeight:_,filterWidth:g,effectiveFilterDepth:E,effectiveFilterHeight:I,effectiveFilterWidth:N,dilationDepth:k,dilationHeight:S,dilationWidth:T,inShape:e,outShape:J,filterShape:t}},cf=(e,t,r,a,n,i)=>{let s=i==="channelsLast";s?e[0].dims[3]:e[0].dims[1];let o=[64,1,1],d={x:r.map((w,x)=>x)},c=[Math.ceil(Bl(d.x.map(w=>r[w]))/o[0]),1,1];$e("verbose",()=>`[conv3d_naive_webgpu] dispatch = ${c}`);let h=1,u=z.size(r),f=[{type:12,data:u},{type:12,data:a},{type:12,data:n},{type:12,data:t.strides},{type:12,data:t.dilations}];Yt(t,f),f.push(...ee(e[0].dims,e[1].dims));let m=["rank","rank"],_=e.length===3;_&&(f.push(...ee(e[2].dims)),m.push("rank")),f.push(...ee(r));let g=w=>{let x=[{name:"output_size",type:"u32"},{name:"filter_dims",type:"u32",length:a.length},{name:"pads",type:"u32",length:n.length},{name:"strides",type:"u32",length:t.strides.length},{name:"dilations",type:"u32",length:t.dilations.length}];Jt(t,x);let b=1,k=Ne(e[0].dataType),S=M("x",e[0].dataType,e[0].dims.length,h),T=M("W",e[1].dataType,e[1].dims.length,b),E=[S,T],I=Y("result",e[0].dataType,r.length,b),N="";if(_){let A=M("bias",e[2].dataType,e[2].dims.length,b);E.push(A),N+=`
        fn getBiasByOutputCoords(coords : array<u32, 5>) -> ${k} {
          return bias[${s?X("coords",4,5):X("coords",1,5)}];
        }`}let D=Be(h,k),V=Qt(t,D,k);return`
            ${N}
            fn getX(d0 : u32, d1 : u32, d2 : u32, d3 : u32, d4 : u32) -> f32 {
              let aIndices = array<u32, 5>(d0, d1, d2, d3, d4);
              return ${S.getByIndices("aIndices")};
            }
            fn getW(d0 : u32, d1 : u32, d2 : u32, d3 : u32, d4 : u32) -> f32 {
              let aIndices = array<u32, 5>(d0, d1, d2, d3, d4);
              return ${T.getByIndices("aIndices")};
            }
          ${w.registerUniforms(x).declareVariables(...E,I)}
          ${w.mainStart()}
          ${w.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.output_size")}
              let coords = ${I.offsetToIndices("global_idx")};
              let batch = ${X("coords",0,S.rank)};
              let d2 = ${s?X("coords",S.rank-1,S.rank):X("coords",1,S.rank)};
              let xFRCCorner = vec3<u32>(${s?X("coords",1,S.rank):X("coords",2,S.rank)},
              ${s?X("coords",2,S.rank):X("coords",3,S.rank)},
              ${s?X("coords",3,S.rank):X("coords",4,S.rank)}) * uniforms.strides - uniforms.pads;
              let xFCorner = xFRCCorner.x;
              let xRCorner = xFRCCorner.y;
              let xCCorner = xFRCCorner.z;
              let xShapeY = ${s?X("uniforms.x_shape",1,S.rank):X("uniforms.x_shape",2,S.rank)};
              let xShapeZ = ${s?X("uniforms.x_shape",2,S.rank):X("uniforms.x_shape",3,S.rank)};
              let xShapeW = ${s?X("uniforms.x_shape",3,S.rank):X("uniforms.x_shape",4,S.rank)};
              let xShapeU = ${s?X("uniforms.x_shape",4,S.rank):X("uniforms.x_shape",1,S.rank)};
              let inputDepthNearestVec4 = (xShapeU / 4) * 4;
              let inputDepthVec4Remainder = xShapeU % 4;

              var value = 0.0;
              for (var wF = 0u; wF < uniforms.filter_dims[0]; wF++) {
                let xF = xFCorner + wF * uniforms.dilations[0];
                if (xF < 0 || xF >= xShapeY) {
                  continue;
                }

                for (var wR = 0u; wR < uniforms.filter_dims[1]; wR++) {
                  let xR = xRCorner + wR * uniforms.dilations[1];
                  if (xR < 0 || xR >= xShapeZ) {
                    continue;
                  }

                  for (var wC = 0u; wC < uniforms.filter_dims[2]; wC++) {
                    let xC = xCCorner + wC * uniforms.dilations[2];
                    if (xC < 0 || xC >= xShapeW) {
                      continue;
                    }

                    for (var d1 = 0u; d1 < inputDepthNearestVec4; d1 += 4) {
                      ${s?`let xValues = vec4<f32>(
                               getX(batch, xF, xR, xC, d1),
                               getX(batch, xF, xR, xC, d1 + 1),
                               getX(batch, xF, xR, xC, d1 + 2),
                               getX(batch, xF, xR, xC, d1 + 3));
                            `:`let xValues = vec4<f32>(
                               getX(batch, d1, xF, xR, xC),
                               getX(batch, d1 + 1, xF, xR, xC),
                               getX(batch, d1 + 2, xF, xR, xC),
                               getX(batch, d1 + 3, xF, xR, xC));
                            `}
                            let wValues = vec4<f32>(
                              getW(d2, d1, wF, wR, wC),
                              getW(d2, d1 + 1, wF, wR, wC),
                              getW(d2, d1 + 2, wF, wR, wC),
                              getW(d2, d1 + 3, wF, wR, wC));
                      value += dot(xValues, wValues);
                    }
                    if (inputDepthVec4Remainder == 1) {
                        ${s?`value += getX(batch, xF, xR, xC, inputDepthNearestVec4)
                          * getW(d2, inputDepthNearestVec4, wF, wR, wC);`:`value += getX(batch, inputDepthNearestVec4, xF, xR, xC)
                          * getW(d2, inputDepthNearestVec4, wF, wR, wC);`}
                    } else if (inputDepthVec4Remainder == 2) {
                      ${s?`let xValues = vec2<f32>(
                        getX(batch, xF, xR, xC, inputDepthNearestVec4),
                        getX(batch, xF, xR, xC, inputDepthNearestVec4 + 1));
                      `:`let xValues = vec2<f32>(
                        getX(batch, inputDepthNearestVec4, xF, xR, xC),
                        getX(batch, inputDepthNearestVec4 + 1, xF, xR, xC));
                    `}
                    let wValues = vec2<f32>(
                      getW(d2, inputDepthNearestVec4, wF, wR, wC),
                      getW(d2, inputDepthNearestVec4 + 1, wF, wR, wC));
                      value += dot(xValues, wValues);
                    } else if (inputDepthVec4Remainder == 3) {
                      ${s?`let xValues = vec3<f32>(
                        getX(batch, xF, xR, xC, inputDepthNearestVec4),
                        getX(batch, xF, xR, xC, inputDepthNearestVec4 + 1),
                        getX(batch, xF, xR, xC, inputDepthNearestVec4 + 2));
                      `:`let xValues = vec3<f32>(
                        getX(batch, inputDepthNearestVec4, xF, xR, xC),
                        getX(batch, inputDepthNearestVec4 + 1, xF, xR, xC),
                        getX(batch, inputDepthNearestVec4 + 2, xF, xR, xC));
                    `}
                    let wValues = vec3<f32>(
                      getW(d2, inputDepthNearestVec4, wF, wR, wC),
                      getW(d2, inputDepthNearestVec4 + 1, wF, wR, wC),
                      getW(d2, inputDepthNearestVec4 + 2, wF, wR, wC));
                      value += dot(xValues, wValues);
                    }
                  }
                }
              }
              ${_?"value = value + getBiasByOutputCoords(coords)":""};
              ${V}
              result[global_idx] = f32(value);
          }`};return{name:"Conv3DNaive",shaderCache:{hint:`${t.cacheKey};${s};${h};${_}`,inputDependencies:m},getRunData:()=>({outputs:[{dims:r,dataType:e[0].dataType}],dispatchGroup:{x:c[0],y:c[1],z:c[2]},programUniforms:f}),getShaderSource:g}}}),pf,hf,__=j(()=>{ie(),le(),de(),rr(),pf=(e,t,r,a)=>{let n=e.length>2,i=n?"value += b[output_channel];":"",s=e[0].dims,o=e[1].dims,d=t.format==="NHWC",c=d?r[3]:r[1],h=c/t.group,u=d&&h>=4?Ee(c):1,f=z.size(r)/u,m=[{type:12,data:f},{type:12,data:t.dilations},{type:12,data:[t.strides[0],t.strides[1]]},{type:12,data:[t.pads[0],t.pads[1]]},{type:12,data:h}];Yt(t,m),m.push(...ee(s,[o[0],o[1],o[2],o[3]/u]));let _=n?["rank","rank","rank"]:["rank","rank"];m.push(...ee([r[0],r[1],r[2],r[3]/u]));let g=w=>{let x=Y("output",e[0].dataType,r.length,u),b=Ne(x.type.tensor),k=Qt(t,x.type.value,b),S=M("x",e[0].dataType,s.length),T=M("w",e[1].dataType,o.length,u),E=[S,T];n&&E.push(M("b",e[2].dataType,e[2].dims,u));let I=[{name:"output_size",type:"u32"},{name:"dilations",type:"u32",length:t.dilations.length},{name:"strides",type:"u32",length:2},{name:"pads",type:"u32",length:2},{name:"output_channels_per_group",type:"u32"}];Jt(t,I);let N=d?`
      for (var wHeight: u32 = 0u; wHeight < uniforms.w_shape[0]; wHeight++) {
        let xHeight = xRCCorner.x + wHeight * uniforms.dilations[0];

        if (xHeight < 0u || xHeight >= uniforms.x_shape[1]) {
          continue;
        }

        for (var wWidth: u32 = 0u; wWidth < uniforms.w_shape[1]; wWidth++) {
          let xWidth = xRCCorner.y + wWidth * uniforms.dilations[1];
          if (xWidth < 0u || xWidth >= uniforms.x_shape[2]) {
            continue;
          }

          for (var wInChannel: u32 = 0u; wInChannel < uniforms.w_shape[2]; wInChannel++) {
            let input_channel = in_channel_offset + wInChannel;
            let xVal = ${S.get("batch","xHeight","xWidth","input_channel")};
            let wVal = ${T.get("wHeight","wWidth","wInChannel","output_channel")};
            value += xVal * wVal;
          }
        }
      }
      `:`
      for (var wInChannel: u32 = 0u; wInChannel < uniforms.w_shape[1]; wInChannel++) {
        let input_channel = in_channel_offset + wInChannel;
        for (var wHeight: u32 = 0u; wHeight < uniforms.w_shape[2]; wHeight++) {
          let xHeight = xRCCorner.x + wHeight * uniforms.dilations[0];

          if (xHeight < 0u || xHeight >= uniforms.x_shape[2]) {
            continue;
          }

          for (var wWidth: u32 = 0u; wWidth < uniforms.w_shape[3]; wWidth++) {
            let xWidth = xRCCorner.y + wWidth * uniforms.dilations[1];
            if (xWidth < 0u || xWidth >= uniforms.x_shape[3]) {
              continue;
            }

            let xVal = ${S.get("batch","input_channel","xHeight","xWidth")};
            let wVal = ${T.get("output_channel","wInChannel","wHeight","wWidth")};
            value += xVal * wVal;
          }
        }
      }
      `;return`
  ${w.registerUniforms(I).declareVariables(...E,x)}

  ${w.mainStart()}
    ${w.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.output_size")}

    let outputIndices = ${x.offsetToIndices("global_idx")};
    let batch: u32 = outputIndices[0];
    let output_channel: u32 = outputIndices[${d?3:1}];
    let xRCCorner: vec2<u32> = vec2<u32>(outputIndices[${d?1:2}], outputIndices[${d?2:3}]) * uniforms.strides - uniforms.pads;
    let group_id: u32 = output_channel * ${u} / uniforms.output_channels_per_group;
    var in_channel_offset = group_id * uniforms.w_shape[${d?2:1}];

    var value: ${x.type.value} = ${x.type.value}(0);
    ${N}
    ${i}
    ${k}
    ${x.setByOffset("global_idx","value")}
  }`};return{name:"GroupedConv",shaderCache:{hint:`${t.cacheKey}_${u}`,inputDependencies:_},getRunData:()=>({outputs:[{dims:a?a(r):r,dataType:e[0].dataType}],dispatchGroup:{x:Math.ceil(f/64)},programUniforms:m}),getShaderSource:g}},hf=(e,t,r,a)=>{let n=e.length>2,i=Ee(r[3]),s=Ee(r[2]),o=z.size(r)/i/s,d=[e[0].dims[0],e[0].dims[1],e[0].dims[2],e[0].dims[3]/i],c=[e[1].dims[0],e[1].dims[1],e[1].dims[2],e[1].dims[3]/i],h=[r[0],r[1],r[2],r[3]/i],u=[{type:12,data:o},{type:6,data:[t.strides[0],t.strides[1]]},{type:6,data:[t.pads[0],t.pads[1]]}];Yt(t,u),u.push(...ee(d,c,h));let f=(s-1)*t.strides[1]+c[1],m=_=>{let g=Y("output",e[0].dataType,h.length,i),w=Ne(g.type.tensor),x=Qt(t,g.type.value,w),b=M("x",e[0].dataType,d.length,i),k=M("w",e[1].dataType,c.length,i),S=[b,k];n&&S.push(M("b",e[2].dataType,e[2].dims,i));let T=n?"value += b[output_channel];":"",E=[{name:"output_size",type:"u32"},{name:"strides",type:"i32",length:2},{name:"pads",type:"i32",length:2}];return Jt(t,E),`
  ${_.registerUniforms(E).declareVariables(...S,g)}
  ${_.mainStart()}
    ${_.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.output_size")}
    let width0 = uniforms.output_shape[3];
    let output_channel = global_idx % width0;
    var index1 = global_idx / width0;
    let width1 = uniforms.output_shape[2] / ${s}u;
    let col = (index1 % width1) * ${s}u;
    index1 = index1 / width1;
    let row = index1 % uniforms.output_shape[1];
    let batch = index1 / uniforms.output_shape[1];

    let x_corner = vec2<i32>(i32(row), i32(col)) * uniforms.strides - uniforms.pads;

    var x_vals: array<${b.type.value}, ${f}>;
    var values: array<${g.type.value}, ${s}>;
    let input_channel = output_channel;
    // Use constant instead of uniform can give better performance for w's height/width.
    for (var w_height: u32 = 0u; w_height < ${c[0]}; w_height++) {
      let x_height = x_corner.x + i32(w_height);
      if (x_height >= 0 && u32(x_height) < uniforms.x_shape[1]) {
        for (var i = 0; i < ${f}; i++) {
          let x_width = x_corner.y + i;
          if (x_width >= 0 && u32(x_width) < uniforms.x_shape[2]) {
            x_vals[i] = ${b.get("batch","u32(x_height)","u32(x_width)","input_channel")};
          } else {
            x_vals[i] = ${b.type.value}(0);
          }
        }
        for (var w_width: u32 = 0u; w_width < ${c[1]}; w_width++) {
          let w_val = ${k.get("w_height","w_width","0","output_channel")};
          for (var i = 0u; i < ${s}u; i++) {
            values[i] = fma(x_vals[i * u32(uniforms.strides[1]) + w_width], w_val, values[i]);
          }
        }
      }
    }

    for (var i = 0u; i < ${s}u; i++) {
      var value = values[i];
      ${T}
      ${x}
      ${g.set("batch","row","col + i","output_channel","value")};
    }
  }`};return{name:"GroupedConv-Vectorize",shaderCache:{hint:`${t.cacheKey};${i};${s};${f};${c[0]};${c[1]}`,inputDependencies:n?["rank","rank","type"]:["rank","rank"]},getRunData:()=>({outputs:[{dims:a?a(r):r,dataType:e[0].dataType}],dispatchGroup:{x:Math.ceil(o/64)},programUniforms:u}),getShaderSource:m}}}),Ul,Oa,jl,Ra,Zi,ni,Ll,Vl,Ki,v_=j(()=>{le(),g_(),y_(),Os(),__(),rr(),zs(),Dt(),Ul=(e,t,r,a,n,i)=>{let s=e[0],o=e.slice(i?1:2,i?3:4),d=o.length,c=t[0],h=t.slice(2).map((f,m)=>f+(f-1)*(r[m]-1)),u=o.map((f,m)=>f+a[m]+a[m+d]).map((f,m)=>Math.floor((f-h[m]+n[m])/n[m]));return u.splice(0,0,s),u.splice(i?3:1,0,c),u},Oa=[2,3,1,0],jl=(e,t)=>{if(!e||e.length!==2&&e.length!==3)throw new Error("Conv requires 2 or 3 inputs");if(e[0].dims.length>5)throw new Error("greater than 5D is not supported");if(e[0].dims.length!==e[1].dims.length)throw new Error("filter does not have same dimension as input");let r=e[0].dims[t.format==="NHWC"?e[0].dims.length-1:1],a=e[1].dims[1]*t.group;if(r!==a)throw new Error("FILTER_IN_CHANNEL should be equal to DATA_CHANNEL");if(e.length===3&&(e[2].dims.length!==1||e[1].dims[0]!==e[2].dims[0]))throw new Error("invalid bias");let n=e[0].dims.length-2;if(t.dilations.length!==n)throw new Error(`dilations should be ${n}D`);if(t.strides.length!==n)throw new Error(`strides should be ${n}D`);if(t.pads.length!==n*2)throw new Error(`pads should be ${n*2}D`);if(t.kernelShape.length!==0&&t.kernelShape.length!==e[1].dims.length-2)throw new Error("invalid kernel shape")},Ra=(e,t)=>{let r=e.kernelShape.slice();r.length<t[1].dims.length-2&&r.push(...Array(t[1].dims.length-2-r.length).fill(0));for(let i=2;i<t[1].dims.length;++i)r[i-2]===0&&(r[i-2]=t[1].dims[i]);let a=e.pads.slice();Ha.adjustPadsBasedOnAutoPad(t[0].dims,e.strides,e.dilations,r,a,e.format==="NHWC",e.autoPad);let n=Object.assign({},e);return Object.assign(n,{kernelShape:r,pads:a}),n},Zi=e=>{let t=Is(e),r=e.format,a=["NOTSET","VALID","SAME_UPPER","SAME_LOWER"][e.auto_pad],n=e.dilations,i=e.group,s=e.kernel_shape,o=e.pads,d=e.strides,c=e.w_is_const();return{autoPad:a,format:r,dilations:n,group:i,kernelShape:s,pads:o,strides:d,wIsConst:c,...t,cacheKey:`${e.format};${t.activation};`}},ni=(e,t,r,a)=>{let n=r.format==="NHWC",i=Ul(t[0].dims,t[1].dims,r.dilations,r.pads,r.strides,n);if(r.group!==1){let E=[t[0]];if(n){let I=e.kernelCustomData.wT??e.compute(He(t[1],Oa),{inputs:[1],outputs:[r.wIsConst?-2:-1]})[0];r.wIsConst&&!e.kernelCustomData.wT&&(e.kernelCustomData.wT=I),E.push(I)}else E.push(t[1]);t.length===3&&E.push(t[2]),!e.adapterInfo.isArchitecture("ampere")&&n&&t[1].dims[0]===r.group&&t[1].dims[1]===1&&r.dilations[0]===1&&r.dilations[1]===1?e.compute(hf(E,r,i,a),{inputs:E}):e.compute(pf(E,r,i,a),{inputs:E});return}let s=t.length===3,o=t[0].dims[n?1:2],d=t[0].dims[n?2:3],c=t[0].dims[n?3:1],h=t[1].dims[2],u=t[1].dims[3],f=i[n?1:2],m=i[n?2:3],_=i[n?3:1],g=n&&h===o&&u===d&&r.pads[0]===0&&r.pads[1]===0;if(g||h===1&&u===1&&r.dilations[0]===1&&r.dilations[1]===1&&r.strides[0]===1&&r.strides[1]===1&&r.pads[0]===0&&r.pads[1]===0){let E=i[0],I,N,D,V=[];if(n){let P=e.kernelCustomData.wT??e.compute(He(t[1],Oa),{inputs:[1],outputs:[r.wIsConst?-2:-1]})[0];if(r.wIsConst&&!e.kernelCustomData.wT&&(e.kernelCustomData.wT=P),g){let J=o*d*c;I=t[0].reshape([1,E,J]),N=P.reshape([1,J,_]),D=[1,E,_]}else I=t[0].reshape([E,o*d,c]),N=P.reshape([1,c,_]),D=[E,f*m,_];V.push(I),V.push(N)}else I=t[0].reshape([E,c,o*d]),N=t[1].reshape([1,_,c]),D=[E,_,f*m],V.push(N),V.push(I);s&&V.push(t[2]);let A=D[2],W=V[0].dims[V[0].dims.length-1];A<8&&W<8?e.compute(As(V,r,i,D,n,a),{inputs:V}):e.compute(Za(V,r,i,D,n,a),{inputs:V});return}let w=!0,x=e.kernelCustomData.wT??e.compute(He(t[1],Oa),{inputs:[1],outputs:[r.wIsConst?-2:-1]})[0];r.wIsConst&&!e.kernelCustomData.wT&&(e.kernelCustomData.wT=x);let b=[t[0],x];s&&b.push(t[2]);let k=n?f*m:_,S=n?_:f*m,T=h*u*c;e.compute(lf(b,r,i,k,S,T,s,w,a),{inputs:b})},Ll=(e,t)=>{let r=t.format==="NHWC",a=[e.inputs[0].reshape(r?[e.inputs[0].dims[0],1,e.inputs[0].dims[1],e.inputs[0].dims[2]]:[e.inputs[0].dims[0],e.inputs[0].dims[1],1,e.inputs[0].dims[2]]),e.inputs[1].reshape([e.inputs[1].dims[0],e.inputs[1].dims[1],1,e.inputs[1].dims[2]])];e.inputs.length===3&&a.push(e.inputs[2]);let n=[0,t.pads[0],0,t.pads[1]],i=[1].concat(t.strides),s=[1].concat(t.dilations),o=[1].concat(t.kernelShape),d=Ra({...t,pads:n,strides:i,dilations:s,kernelShape:o},a);ni(e,a,d,c=>r?[c[0],c[2],c[3]]:[c[0],c[1],c[3]])},Vl=(e,t,r)=>{let a=r.format==="NHWC"?"channelsLast":"channelsFirst",n=Ra(r,t),i=r.autoPad==="NOTSET"?r.pads:r.autoPad,s=df(t[0].dims,t[1].dims,r.strides,r.dilations,i,!1,a);e.compute(cf(t,n,s.outShape,[s.filterDepth,s.filterHeight,s.filterWidth],[s.padInfo.front,s.padInfo.top,s.padInfo.left],a))},Ki=(e,t)=>{if(jl(e.inputs,t),e.inputs[0].dims.length===3)Ll(e,t);else if(e.inputs[0].dims.length===5)Vl(e,e.inputs,t);else{let r=Ra(t,e.inputs);ni(e,e.inputs,r)}}}),ff,b_=j(()=>{ie(),xt(),le(),de(),ff=(e,t,r)=>{let a=e.length>2,n=t.outputShape,i=t.format==="NHWC",s=t.group,o=e[1].dims,d=o[2]/s,c=o[3],h=i?Ee(d):1,u=i?Ee(c):1,f=i?c===1?h:u:1,m=z.size(n)/u,_=[Math.ceil(m/64),1,1];$e("verbose",()=>`[conv2d_backprop_webgpu] dispatch = ${_}`);let g=["rank","rank"],w=[t.strides[0],t.strides[1]],x=[t.kernelShape[i?1:2],t.kernelShape[i?2:3]],b=[t.dilations[0],t.dilations[1]],k=[x[0]+(t.dilations[0]<=1?0:(t.kernelShape[i?1:2]-1)*(t.dilations[0]-1)),x[1]+(t.dilations[1]<=1?0:(t.kernelShape[i?2:3]-1)*(t.dilations[1]-1))],S=[k[0]-1-Math.floor((t.pads[0]+t.pads[2])/2),k[1]-1-Math.floor((t.pads[1]+t.pads[3])/2)],T=[{type:12,data:m},{type:12,data:w},{type:12,data:x},{type:12,data:b},{type:12,data:k},{type:6,data:S},{type:12,data:d},{type:12,data:c},...ee(e[0].dims,e[1].dims)];a&&(T.push(...ee(e[2].dims)),g.push("rank")),T.push(...ee(n));let E=I=>{let N=[{name:"output_size",type:"u32"},{name:"strides",type:"u32",length:w.length},{name:"filter_dims",type:"u32",length:x.length},{name:"dilations",type:"u32",length:x.length},{name:"effective_filter_dims",type:"u32",length:k.length},{name:"pads",type:"i32",length:S.length},{name:"input_channels_per_group",type:"u32"},{name:"output_channels_per_group",type:"u32"}],D=Ne(e[0].dataType),V=i?1:2,A=i?2:3,W=i?3:1,P=M("W",e[1].dataType,e[1].dims.length,f),J=M("Dy",e[0].dataType,e[0].dims.length,h),ne=[J,P];a&&ne.push(M("bias",e[2].dataType,[n[W]].length,u));let F=Y("result",e[0].dataType,n.length,u),se=()=>{let K="";if(h===1)K+=`
        let w_offset = ${P.indicesToOffset(`${P.type.indices}(u32(wRPerm), u32(wCPerm), inputChannel, wOutChannel)`)};
        let wValue = ${P.getByOffset(`w_offset / ${f}`)};
        dotProd = dotProd + xValue * wValue;`;else if(c===1)K+=`
          let wValue = ${P.getByOffset(`${P.indicesToOffset(`${P.type.indices}(u32(wRPerm), u32(wCPerm), inputChannel, wOutChannel)`)} / ${f}`)};
          dotProd = dotProd + dot(xValue, wValue);`;else for(let Te=0;Te<h;Te++)K+=`
            let wValue${Te} = ${P.getByOffset(`${P.indicesToOffset(`${P.type.indices}(u32(wRPerm), u32(wCPerm), inputChannel + ${Te}, wOutChannel)`)} / ${f}`)};
            dotProd = dotProd + xValue[${Te}] * wValue${Te};`;return K},ce=`
            let outputIndices = ${F.offsetToIndices(`global_idx * ${u}`)};
            let batch = ${F.indicesGet("outputIndices",0)};
            let d1 = ${F.indicesGet("outputIndices",W)};
            let r = ${F.indicesGet("outputIndices",V)};
            let c = ${F.indicesGet("outputIndices",A)};
            let dyCorner = vec2<i32>(i32(r), i32(c)) - uniforms.pads;
            let dyRCorner = dyCorner.x;
            let dyCCorner = dyCorner.y;
            let groupId = d1 / uniforms.output_channels_per_group;
            let wOutChannel = d1 - groupId * uniforms.output_channels_per_group;
            // Convolve dy(?, ?, d2) with w(:, :, d1, d2) to compute dx(xR, xC, d1).
            // ? = to be determined. : = across all values in that axis.
            var dotProd = ${F.type.value}(0.0);
            var wR: u32 = 0;
            if (uniforms.dilations.x == 1) {
              // Minimum wR >= 0 that satisfies (dyRCorner + wR) % (uniforms.strides.x) == 0
              wR = u32(((dyRCorner + i32(uniforms.strides.x) - 1) / i32(uniforms.strides.x)) * i32(uniforms.strides.x) - dyRCorner);
            }
            for (; wR < uniforms.effective_filter_dims.x; wR = wR + 1) {
              if (wR % uniforms.dilations.x != 0) {
                continue;
              }
              let dyR = (${D}(dyRCorner) + ${D}(wR)) / ${D}(uniforms.strides[0]);
              let wRPerm = uniforms.filter_dims.x - 1 - wR / uniforms.dilations.x;
              if (dyR < 0.0 || dyR >= ${D}(uniforms.Dy_shape[${V}]) || fract(dyR) > 0.0 ||
                  wRPerm < 0) {
                continue;
              }
              let idyR: u32 = u32(dyR);
              var wC: u32 = 0;
              if (uniforms.dilations.y == 1) {
                // Minimum wC >= 0 that satisfies (dyCCorner + wC) % (uniforms.strides.y) == 0
                wC = u32(((dyCCorner + i32(uniforms.strides.y) - 1) / i32(uniforms.strides.y)) * i32(uniforms.strides.y) - dyCCorner);
              }

              for (; wC < uniforms.effective_filter_dims.y; wC = wC + 1) {
                if (wC % uniforms.dilations.y != 0) {
                  continue;
                }
                let dyC = (${D}(dyCCorner) + ${D}(wC)) / ${D}(uniforms.strides.y);
                let wCPerm = uniforms.filter_dims.y - 1 - wC / uniforms.dilations.y;
                if (dyC < 0.0 || dyC >= ${D}(uniforms.Dy_shape[${A}]) ||
                    fract(dyC) > 0.0 || wCPerm < 0) {
                  continue;
                }
                let idyC: u32 = u32(dyC);
                var inputChannel = groupId * uniforms.input_channels_per_group;
                for (var d2: u32 = 0; d2 < uniforms.input_channels_per_group; d2 = d2 + ${h}) {
                  let xValue = ${i?J.getByOffset(`${J.indicesToOffset(`${J.type.indices}(batch, idyR, idyC, inputChannel)`)} / ${h}`):J.get("batch","inputChannel","idyR","idyC")};
                  ${se()}
                  inputChannel = inputChannel + ${h};
                }
                wC = wC + uniforms.strides.y - 1;
              }
              wR = wR + uniforms.strides[0] - 1;
            }
            let value = dotProd${a?` + bias[d1 / ${u}]`:""};
            ${F.setByOffset("global_idx","value")};
          `;return`
    ${I.registerUniforms(N).declareVariables(...ne,F)}
      ${I.mainStart()}
      ${I.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.output_size")};
    ${ce}}`};return{name:"ConvTranspose2D",shaderCache:{hint:`${t.cacheKey};${h}${f}${u}${c===1}`,inputDependencies:g},getRunData:()=>({dispatchGroup:{x:_[0],y:_[1],z:_[2]},outputs:[{dims:r?r(n):n,dataType:e[0].dataType}],programUniforms:T}),getShaderSource:E}}}),Wl,ql,Fl,ii,mf,Hl,si,Gl,gf,w_=j(()=>{b_(),rr(),Dt(),Wl=(e,t,r,a,n,i)=>(e-1)*t+r+(a-1)*n+1-i,ql=(e,t,r,a,n)=>{let i=Math.floor(e/2);t==="SAME_UPPER"?(r[a]=i,r[n]=e-i):t==="SAME_LOWER"&&(r[a]=e-i,r[n]=i)},Fl=(e,t,r,a,n,i,s,o,d,c)=>{let h=e.length-2,u=c.length===0;d.length<h&&d.push(...Array(h-d.length).fill(0));let f=e[0],m=t[o?3:1]*n;for(let _=0,g=e.length-h-(o?1:0);_<h;++_,++g){let w=e[g],x=u?w*s[_]:c[_],b=Wl(w,s[_],i[_],t[g],r[_],x);ql(b,a,i,_,_+h),u&&c.push(s[_]*(w-1)+d[_]+(t[g]-1)*r[_]+1-i[_]-i[_+h])}c.splice(0,0,f),c.splice(o?3:1,0,m)},ii=(e,t)=>{let r=e.kernelShape.slice();if(e.kernelShape.length===0||e.kernelShape.reduce((u,f)=>u*f,1)===0){r.length=0;for(let u=2;u<t[1].dims.length;++u)r.push(t[1].dims[u])}let a=e.format==="NHWC";r.splice(0,0,t[1].dims[0]),r.splice(a?3:1,0,t[1].dims[1]);let n=e.pads.slice(),i=e.outputShape.slice(),s=e.outputPadding.slice(),o=t[0].dims,d=e.dilations.slice();if(d.reduce((u,f)=>u+f,0)===0){let u=t[0].dims.length-2;d=new Array(u).fill(1)}let c=e.strides.slice();if(c.reduce((u,f)=>u+f,0)===0){let u=t[0].dims.length-2;c=new Array(u).fill(1)}Fl(o,r,d,e.autoPad,e.group,n,c,a,s,i);let h=Object.assign({},e);return Object.assign(h,{kernelShape:r,pads:n,outputPadding:s,outputShape:i,dilations:d,strides:c}),h},mf=e=>{let t=Is(e),r=e.format,a=["NOTSET","VALID","SAME_UPPER","SAME_LOWER"][typeof e.autoPad>"u"?0:e.autoPad],n=e.dilations,i=e.group,s=e.kernelShape,o=e.pads,d=e.strides,c=e.wIsConst(),h=e.outputPadding,u=e.outputShape;return{autoPad:a,format:r,dilations:n,group:i,kernelShape:s,outputPadding:h,outputShape:u,pads:o,strides:d,wIsConst:c,...t,cacheKey:`${e.format};${t.activation};`}},Hl=(e,t)=>{if(!e||e.length!==2&&e.length!==3)throw new Error("Conv requires 2 or 3 inputs");if(e[0].dims.length!==4&&e[0].dims.length!==3)throw new Error("currently only support 2-dimensional conv");if(e[0].dims.length!==e[1].dims.length)throw new Error("filter does not have same dimension as input");let r=e[0].dims[t.format==="NHWC"?e[0].dims.length-1:1],a=e[1].dims[0];if(r!==a)throw new Error("FILTER_IN_CHANNEL should be equal to DATA_CHANNEL");let n=e[1].dims[1]*t.group;if(e.length===3&&(e[2].dims.length!==1||e[2].dims[0]!==n))throw new Error("invalid bias");let i=e[0].dims.length-2;if(t.dilations.reduce((s,o)=>s+o,0)>0&&t.dilations.length!==i)throw new Error(`dilations should be ${i}D`);if(t.strides.reduce((s,o)=>s+o,0)>0&&t.strides.length!==i)throw new Error(`strides should be ${i}D`);if(t.pads.reduce((s,o)=>s+o,0)>0&&t.pads.length!==i*2)throw new Error(`pads should be ${i*2}D`);if(t.outputPadding.length!==i&&t.outputPadding.length!==0)throw new Error(`output_padding should be ${i}D`);if(t.kernelShape.reduce((s,o)=>s+o,0)>0&&t.kernelShape.length!==0&&t.kernelShape.length!==e[1].dims.length-2)throw new Error("invalid kernel shape");if(t.outputShape.length!==0&&t.outputShape.length!==e[0].dims.length-2)throw new Error("invalid output shape")},si=(e,t,r,a)=>{let n=e.kernelCustomData.wT??e.compute(He(t[1],[2,3,0,1]),{inputs:[1],outputs:[r.wIsConst?-2:-1]})[0];r.wIsConst&&!e.kernelCustomData.wT&&(e.kernelCustomData.wT=n);let i=[t[0],n];t.length===3&&i.push(t[2]),e.compute(ff(i,r,a),{inputs:i})},Gl=(e,t)=>{let r=t.format==="NHWC",a=[e.inputs[0].reshape(r?[e.inputs[0].dims[0],1,e.inputs[0].dims[1],e.inputs[0].dims[2]]:[e.inputs[0].dims[0],e.inputs[0].dims[1],1,e.inputs[0].dims[2]]),e.inputs[1].reshape([e.inputs[1].dims[0],e.inputs[1].dims[1],1,e.inputs[1].dims[2]])];e.inputs.length===3&&a.push(e.inputs[2]);let n=t.kernelShape;(n.length===0||n[0]===0)&&(n=[e.inputs[1].dims[2]]);let i=t.dilations;(i.length===0||i[0]===0)&&(i=[1]);let s=t.strides;(s.length===0||s[0]===0)&&(s=[1]);let o=t.pads;o.length===0&&(o=[0,0]),o=[0,o[0],0,o[1]],s=[1].concat(s),i=[1].concat(i),n=[1].concat(n);let d=t.outputPadding;d=[0].concat(d);let c=ii({...t,pads:o,strides:s,dilations:i,kernelShape:n,outputPadding:d},a);si(e,a,c,h=>r?[h[0],h[2],h[3]]:[h[0],h[1],h[3]])},gf=(e,t)=>{if(Hl(e.inputs,t),e.inputs[0].dims.length===3)Gl(e,t);else{let r=ii(t,e.inputs);si(e,e.inputs,r)}}}),Zl,yf,_f,$_=j(()=>{ie(),le(),ze(),de(),Zl=(e,t,r,a)=>{let n=z.size(t),i=t.length,s=M("input",e,i),o=Y("output",e,i),d=r.dataType===6?r.getInt32Array()[0]:Number(r.getBigInt64Array()[0]),c=z.normalizeAxis(d,i),h=u=>{let f=` i32(${s.indicesGet("inputIndices","uniforms.axis")}) `,m=X("uniforms.input_shape","uniforms.axis",i),_=a.reverse?f+(a.exclusive?" + 1":""):"0",g=a.reverse?m:f+(a.exclusive?"":" + 1");return`
                ${u.registerUniform("outputSize","u32").registerUniform("axis","u32").declareVariables(s,o)}
                ${u.mainStart()}
                  ${u.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.outputSize")}
                  var inputIndices = ${o.offsetToIndices("global_idx")};
                  var sum = ${o.type.value}(0);
                  let first : i32 = ${_};
                  let last : i32 = ${g};
                  for (var i : i32 = first; i < last; i++) {
                    ${s.indicesSet("inputIndices","uniforms.axis","u32(i)")};
                    sum = sum + ${s.getByIndices("inputIndices")};
                  }
                  ${o.setByOffset("global_idx","sum")};
                }`};return{name:"CumSum",shaderCache:{hint:a.cacheKey,inputDependencies:["rank"]},getRunData:()=>({outputs:[{dims:t,dataType:e}],dispatchGroup:{x:Math.ceil(n/64)},programUniforms:[{type:12,data:n},{type:12,data:c},...ee(t,t)]}),getShaderSource:h}},yf=(e,t)=>{let r=e.inputs[0].dims,a=e.inputs[0].dataType,n=e.inputs[1];e.compute(Zl(a,r,n,t),{inputs:[0]})},_f=e=>{let t=e.exclusive===1,r=e.reverse===1;return xe({exclusive:t,reverse:r})}}),Kl,Ql,Yl,vf,bf,x_=j(()=>{ie(),le(),ze(),de(),Kl=e=>{if(!e||e.length!==1)throw new Error("DepthToSpace requires 1 input.");if(e[0].dims.length!==4)throw new Error("DepthToSpace requires 4D input.")},Ql=(e,t,r,a)=>{let n=[];n.push(`fn perm(i: ${a.type.indices}) -> ${r.type.indices} {
    var a: ${r.type.indices};`);for(let i=0;i<t;++i)n.push(r.indicesSet("a",e[i],`i[${i}]`));return n.push("return a;}"),n.join(`
`)},Yl=(e,t)=>{let r,a,n,i,s,o,d=t.format==="NHWC",c=t.blocksize,h=t.mode==="DCR";d?([r,a,n,i]=e.dims,s=h?[r,a,n,c,c,i/c**2]:[r,a,n,i/c**2,c,c],o=h?[0,1,3,2,4,5]:[0,1,4,2,5,3]):([r,a,n,i]=[e.dims[0],e.dims[2],e.dims[3],e.dims[1]],s=h?[r,c,c,i/c**2,a,n]:[r,i/c**2,c,c,a,n],o=h?[0,3,4,1,5,2]:[0,1,4,2,5,3]);let u=e.reshape(s),f=u.dims.length,m=e.dataType,_=M("a",m,f),g=Y("output",m,f),w=x=>`
  ${x.registerUniform("output_size","u32").declareVariables(_,g)}

  ${Ql(o,f,_,g)}

  ${x.mainStart()}
    ${x.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.output_size")}

    let indices = ${g.offsetToIndices("global_idx")};
    let aIndices = perm(indices);

    ${g.setByOffset("global_idx",_.getByIndices("aIndices"))}
  }`;return{name:"DepthToSpace",shaderCache:{hint:`${e.dims};${t.blocksize};${t.mode}`,inputDependencies:["rank"]},getRunData:x=>{let b=d?[r,a*c,n*c,i/c**2]:[r,i/c**2,a*c,n*c],k=z.size(b),S=u.dims,T=z.sortBasedOnPerm(S,o);return{outputs:[{dims:b,dataType:x[0].dataType}],dispatchGroup:{x:Math.ceil(k/64)},programUniforms:[{type:12,data:k},...ee(S,T)]}},getShaderSource:w}},vf=(e,t)=>{Kl(e.inputs),e.compute(Yl(e.inputs[0],t))},bf=e=>xe({blocksize:e.blocksize,mode:e.mode,format:e.format})}),Ma,Er,oi,Jl,Xl,ed,td,ui,rd,wf,$f,k_=j(()=>{ie(),le(),ze(),de(),Ma="[a-zA-Z]|\\.\\.\\.",Er="("+Ma+")+",oi="^"+Er+"$",Jl="("+Er+",)*"+Er,Xl="^"+Jl+"$",ed=class{constructor(e=-1){this.symbolToIndices=new Map,this.inputIndex=e}addSymbol(e,t){let r=this.symbolToIndices.get(e);r===void 0?r=[t]:r.push(t),this.symbolToIndices.set(e,r)}},td=class{constructor(e,t){this.equation=t,this.hasEllipsis=!1,this.symbolToInfo=new Map,this.lhs=new Array,this.outputDims=[];let[r,a]=t.includes("->")?t.split("->",2):[t,""];if(!r.match(RegExp(Xl)))throw new Error("Invalid LHS term");if(r.split(",").forEach((n,i)=>{let s=e[i].dims.slice();if(!n.match(RegExp(oi)))throw new Error("Invalid LHS term");let o=this.processTerm(n,!0,s,i);this.lhs.push(o)}),a==="")a+=[...this.symbolToInfo.entries()].filter(([n,i])=>i.count===1||n==="...").map(([n])=>n).join("");else if(!a.match(RegExp(Er)))throw new Error("Invalid RHS");a.match(RegExp(Ma,"g"))?.forEach(n=>{if(n==="...")this.outputDims=this.outputDims.concat(this.ellipsisDims);else{let i=this.symbolToInfo.get(n);if(i===void 0)throw new Error("Invalid RHS symbol");this.outputDims.push(i.dimValue)}}),this.rhs=this.processTerm(a,!1,this.outputDims)}addSymbol(e,t,r){let a=this.symbolToInfo.get(e);if(a!==void 0){if(a.dimValue!==t&&a.count!==1)throw new Error("Dimension mismatch");a.count++,a.inputIndices.push(r)}else a={count:1,dimValue:t,inputIndices:[r]};this.symbolToInfo.set(e,a)}processTerm(e,t,r,a=-1){let n=r.length,i=!1,s=[],o=0;if(!e.match(RegExp(oi))&&!t&&e!=="")throw new Error("Invalid LHS term");let d=e.match(RegExp(Ma,"g")),c=new ed(a);return d?.forEach((h,u)=>{if(h==="..."){if(i)throw new Error("Only one ellipsis is allowed per input term");i=!0;let f=n-d.length+1;if(f<0)throw new Error("Ellipsis out of bounds");if(s=r.slice(o,o+f),this.hasEllipsis){if(this.ellipsisDims.length!==s.length||this.ellipsisDims.toString()!==s.toString())throw new Error("Ellipsis dimensions mismatch")}else if(t)this.hasEllipsis=!0,this.ellipsisDims=s;else throw new Error("Ellipsis must be specified in the LHS");for(let m=0;m<s.length;m++){let _=String.fromCharCode(48+m);c.addSymbol(_,u+m),this.addSymbol(_,r[o++],a)}}else c.addSymbol(h,u+(this.hasEllipsis?this.ellipsisDims.length-1:0)),this.addSymbol(h,r[o++],a)}),c}},ui=e=>e+"_max",rd=(e,t,r,a)=>{let n=e.map(c=>c.length).map((c,h)=>M(`input${h}`,t,c)),i=z.size(a),s=Y("output",t,a.length),o=[...r.symbolToInfo.keys()].filter(c=>!r.rhs.symbolToIndices.has(c)),d=c=>{let h=[],u="var prod = 1.0;",f="var sum = 0.0;",m="sum += prod;",_=[],g=[],w=[],x=[],b=r.symbolToInfo.size===r.rhs.symbolToIndices.size;r.symbolToInfo.forEach((S,T)=>{if(r.rhs.symbolToIndices.has(T)){let E=r.rhs.symbolToIndices.get(T)?.[0];E!==void 0&&r.lhs.forEach((I,N)=>{if(S.inputIndices.includes(N)){let D=I.symbolToIndices.get(T);if(D===void 0)throw new Error("Invalid symbol error");D.forEach(V=>{h.push(`${n[N].indicesSet(`input${N}Indices`,V,s.indicesGet("outputIndices",E))}`)})}})}else r.lhs.forEach((E,I)=>{if(S.inputIndices.includes(I)){let N=E.symbolToIndices.get(T);if(N===void 0)throw new Error("Invalid symbol error");N.forEach(D=>{_.push(`${n[I].indicesSet(`input${I}Indices`,D,`${T}`)}`)}),x.push(`prod *= ${n[I].getByIndices(`input${I}Indices`)};`)}}),g.push(`for(var ${T}: u32 = 0; ${T} < uniforms.${ui(T)}; ${T}++) {`),w.push("}")});let k=b?[...h,`let sum = ${n.map((S,T)=>S.getByIndices(`input${T}Indices`)).join(" * ")};`]:[...h,f,...g,..._,u,...x,m,...w];return`
            ${c.registerUniforms(o.map(S=>({name:`${ui(S)}`,type:"u32"}))).registerUniform("outputSize","u32").declareVariables(...n,s)}

            ${c.mainStart()}
            ${c.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.outputSize")}
            var outputIndices = ${s.offsetToIndices("global_idx")};
            ${n.map((S,T)=>`var input${T}Indices: ${n[T].type.indices};`).join(`
`)}
            ${k.join(`
`)};
            ${s.setByOffset("global_idx","sum")};
          }`};return{name:"Einsum",shaderCache:{hint:r.equation,inputDependencies:e.map(()=>"rank")},getRunData:()=>{let c=o.filter(u=>r.symbolToInfo.has(u)).map(u=>({type:12,data:r.symbolToInfo.get(u)?.dimValue||0}));c.push({type:12,data:i});let h=e.map((u,f)=>[...ee(u)]).reduce((u,f)=>u.concat(f),c);return h.push(...ee(a)),{outputs:[{dims:a,dataType:t}],dispatchGroup:{x:Math.ceil(i/64)},programUniforms:h}},getShaderSource:d}},wf=(e,t)=>{let r=new td(e.inputs,t.equation),a=r.outputDims,n=e.inputs.map((i,s)=>i.dims);e.compute(rd(n,e.inputs[0].dataType,r,a))},$f=e=>{let t=e.equation.replace(/\s+/g,"");return xe({equation:t})}}),ad,li,nd,id,xf,S_=j(()=>{ie(),le(),de(),ad=e=>{if(!e||e.length!==2)throw new Error("Expand requires 2 input.");let t=e[0].dims,r=Array.from(e[1].getBigInt64Array(),Number),a=r.length<t.length?0:r.length-t.length,n=t.length<r.length?0:t.length-r.length;for(;a<r.length&&n<t.length;++a,++n)if(r[a]!==t[n]&&r[a]!==1&&t[n]!==1)throw new Error("Expand requires shape to be broadcastable to input")},li=(e,t)=>{let r=e.length-t.length,a=[];for(let n=0;n<r;++n)a.push(e[n]);for(let n=0;n<t.length;++n)a.push(t[n]===1?e[n+r]:t[n]);return a},nd=(e,t)=>e.length>t.length?li(e,t):li(t,e),id=e=>{let t=e[0].dims,r=Array.from(e[1].getBigInt64Array(),Number),a=nd(t,r),n=e[0].dataType,i=n===9||z.size(t)===1,s=n===9||t.length>0&&t[t.length-1]%4===0?4:1,o=i||a.length>0&&a[a.length-1]%4===0?4:1,d=Math.ceil(z.size(a)/o),c=u=>{let f=M("input",n,t.length,s),m=Y("output",n,a.length,o),_;if(n===9){let g=(w,x,b="")=>`
          let outputIndices${x} = ${m.offsetToIndices(`outputOffset + ${x}u`)};
          let offset${x} = ${f.broadcastedIndicesToOffset(`outputIndices${x}`,m)};
          let index${x} = offset${x} / 4u;
          let component${x} = offset${x} % 4u;
          ${w}[${x}] = ${b}(${f.getByOffset(`index${x}`)}[component${x}]);
        `;_=`
        let outputOffset = global_idx * ${o};
        var data = vec4<u32>(0);
        ${g("data",0,"u32")}
        ${g("data",1,"u32")}
        ${g("data",2,"u32")}
        ${g("data",3,"u32")}
        ${m.setByOffset("global_idx","data")}
      }`}else _=`
        let outputIndices = ${m.offsetToIndices(`global_idx * ${o}`)};
        let inputOffset = ${f.broadcastedIndicesToOffset("outputIndices",m)};
        let data = ${m.type.value}(${f.getByOffset(`inputOffset / ${s}`)});
        ${m.setByOffset("global_idx","data")}
      }`;return`
    ${u.registerUniform("vec_size","u32").declareVariables(f,m)}
    ${u.mainStart()}
    ${u.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.vec_size")}
    ${_}`},h=[{type:12,data:d},...ee(t,a)];return{name:"Expand",shaderCache:{hint:`${a.length};${s}${o}`,inputDependencies:["rank"]},getShaderSource:c,getRunData:()=>({outputs:[{dims:a,dataType:e[0].dataType}],dispatchGroup:{x:Math.ceil(d/64)},programUniforms:h})}},xf=e=>{ad(e.inputs),e.compute(id(e.inputs),{inputs:[0]})}}),sd,kf,T_=j(()=>{ie(),le(),de(),Cs(),sd=e=>{let t=e[0].dataType,r=z.size(e[0].dims),a=z.size(e[1].dims),n=a%4===0,i=s=>{let o=M("x",t,[1],4),d=M("bias",t,[1],4),c=Y("y",t,[1],4),h=[{name:"output_vec_size",type:"u32"},{name:"bias_size",type:"u32"}],u=m=>`
      let bias${m}_offset: u32 = (global_idx * 4 + ${m}) % uniforms.bias_size;
      let bias${m} = ${d.getByOffset(`bias${m}_offset / 4`)}[bias${m}_offset % 4];`,f=n?`
      let bias = ${d.getByOffset("global_idx % (uniforms.bias_size / 4)")};`:`${u(0)}${u(1)}${u(2)}${u(3)}
      let bias = ${o.type.value}(bias0, bias1, bias2, bias3);`;return`${s.registerUniforms(h).declareVariables(o,d,c)}

    ${qi(Ue(t))}

    ${s.mainStart(hr)}
      ${s.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.output_vec_size")}

      let x = ${o.getByOffset("global_idx")};
      ${f}
      let x_in = x + bias;
      ${c.setByOffset("global_idx",Fi("x_in"))}
    }`};return{name:"FastGeluWithBias",shaderCache:{hint:`${n}`,inputDependencies:["type","type"]},getShaderSource:i,getRunData:s=>({outputs:[{dims:s[0].dims,dataType:s[0].dataType}],programUniforms:[{type:12,data:Math.ceil(r/4)},{type:12,data:a}],dispatchGroup:{x:Math.ceil(r/hr/4)}})}},kf=e=>{e.inputs.length<2||z.size(e.inputs[1].dims)===0?Wh(e):e.compute(sd(e.inputs))}}),od,ud,Sf,Tf,C_=j(()=>{ie(),le(),ze(),de(),od=e=>{if(!e||e.length!==2)throw new Error("Gather requires 2 inputs.")},ud=(e,t)=>{let r=e[0].dims,a=e[1].dims,n=r.length,i=z.normalizeAxis(t.axis,n),s=r.slice(0);s.splice(i,1,...a);let o=r[i],d=e[0].dataType===9?4:1,c=Math.ceil(z.size(s)/d),h=[{type:12,data:c},{type:6,data:o},{type:12,data:i},...ee(e[0].dims,e[1].dims,s)],u=f=>{let m=M("data",e[0].dataType,e[0].dims.length,d),_=M("inputIndices",e[1].dataType,e[1].dims.length),g=Y("output",e[0].dataType,s.length,d),w=b=>{let k=a.length,S=`var indicesIndices${b}  = ${_.type.indices}(0);`;for(let T=0;T<k;T++)S+=`${k>1?`indicesIndices${b}[${T}]`:`indicesIndices${b}`} = ${s.length>1?`outputIndices${b}[uniforms.axis + ${T}]`:`outputIndices${b}`};`;S+=`
          var idx${b} = ${_.getByIndices(`indicesIndices${b}`)};
          if (idx${b} < 0) {
            idx${b} = idx${b} + uniforms.axisDimLimit;
          }
          var dataIndices${b} : ${m.type.indices};
        `;for(let T=0,E=0;T<n;T++)T===i?(S+=`${n>1?`dataIndices${b}[${T}]`:`dataIndices${b}`} = u32(idx${b});`,E+=k):(S+=`${n>1?`dataIndices${b}[${T}]`:`dataIndices${b}`} = ${s.length>1?`outputIndices${b}[${E}]`:`outputIndices${b}`};`,E++);return S},x;if(e[0].dataType===9){let b=(k,S,T="")=>`
          let outputIndices${S} = ${g.offsetToIndices(`outputOffset + ${S}u`)};
          ${w(S)};
          let offset${S} = ${m.indicesToOffset(`dataIndices${S}`)};
          let index${S} = offset${S} / 4u;
          let component${S} = offset${S} % 4u;
          ${k}[${S}] = ${T}(${m.getByOffset(`index${S}`)}[component${S}]);
        `;x=`
        let outputOffset = global_idx * ${d};
        var value = vec4<u32>(0);
        ${b("value",0,"u32")}
        ${b("value",1,"u32")}
        ${b("value",2,"u32")}
        ${b("value",3,"u32")}
        ${g.setByOffset("global_idx","value")}
      `}else x=`
      let outputIndices = ${g.offsetToIndices("global_idx")};
      ${w("")};
      let value = ${m.getByIndices("dataIndices")};
      ${g.setByOffset("global_idx","value")};
      `;return`
      ${f.registerUniform("outputSize","u32").registerUniform("axisDimLimit","i32").registerUniform("axis","u32").declareVariables(m,_,g)}
      ${f.mainStart()}
        ${f.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.outputSize")}
        ${x}
      }`};return{name:"Gather",shaderCache:{hint:t.cacheKey,inputDependencies:["rank","rank"]},getRunData:()=>({outputs:[{dims:s,dataType:e[0].dataType}],dispatchGroup:{x:Math.ceil(c/64)},programUniforms:h}),getShaderSource:u}},Sf=e=>xe({axis:e.axis}),Tf=(e,t)=>{let r=e.inputs;od(r),e.compute(ud(e.inputs,t))}}),ld,Cf,If,I_=j(()=>{ie(),le(),de(),ld=(e,t,r,a,n,i,s,o,d)=>{let c=[{type:12,data:i},{type:12,data:a},{type:12,data:n},{type:12,data:r},{type:12,data:s},{type:12,data:o},{type:12,data:d}],h=[i];c.push(...ee(t.dims,h));let u=f=>{let m=M("indices_data",t.dataType,t.dims.length),_=Y("input_slice_offsets_data",12,1,1),g=[m,_],w=[{name:"output_size",type:"u32"},{name:"batch_dims",type:"u32"},{name:"input_dims",type:"u32",length:n.length},{name:"sizes_from_slice_dims_data",type:"u32",length:r.length},{name:"num_slices_per_batch",type:"u32"},{name:"input_batch_stride",type:"u32"},{name:"num_slice_dims",type:"u32"}];return`
  ${f.registerUniforms(w).declareVariables(...g)}
  ${f.mainStart()}
    ${f.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.output_size")}
    let batch_idx = global_idx / uniforms.num_slices_per_batch;
    let base_offset = batch_idx * uniforms.input_batch_stride;

    let slice_indices_base_offset = global_idx * uniforms.num_slice_dims;
    var relative_slice_offset = 0;
    for (var dim_idx = 0u; dim_idx < uniforms.num_slice_dims; dim_idx ++) {
      var index = i32(indices_data[dim_idx + slice_indices_base_offset].x);
      let input_dim_idx = uniforms.batch_dims + dim_idx;
      if (index < 0) {
        ${n.length===1?"index += i32(uniforms.input_dims);":"index += i32(uniforms.input_dims[input_dim_idx]);"}
      }
      ${r.length===1?"relative_slice_offset += index * i32(uniforms.sizes_from_slice_dims_data);":"relative_slice_offset += index * i32(uniforms.sizes_from_slice_dims_data[dim_idx]);"}
    }

    input_slice_offsets_data[global_idx] =  base_offset + u32(relative_slice_offset);
  }`};return e.compute({name:"computeSliceOffsets",shaderCache:{hint:`${n.length}_${r.length}`,inputDependencies:["rank"]},getRunData:()=>({outputs:[{dims:h,dataType:e.inputs[1].dataType}],dispatchGroup:{x:Math.ceil(i/64)},programUniforms:c}),getShaderSource:u},{inputs:[t],outputs:[-1]})[0]},Cf=(e,t)=>{let r=e.inputs,a=r[0].dims,n=r[0].dataType,i=r[1].dims,s=i[i.length-1],o=z.sizeToDimension(i,i.length-1),d=z.sizeFromDimension(a,t.batchDims+s),c=z.sizeToDimension(a,t.batchDims),h=z.sizeFromDimension(a,t.batchDims),u=o/c,f=new Array(s),m=d;for(let S=0;S<s;++S)f[s-1-S]=m,m*=a[t.batchDims+s-1-S];let _=ld(e,r[1],f,t.batchDims,a,o,u,h,s),g=t.batchDims+s;if(g>a.length)throw new Error("last dimension of indices must not be larger than rank of input tensor");let w=i.slice(0,-1).concat(a.slice(g)),x=z.size(w),b=[{type:12,data:x},{type:12,data:d},...ee(r[0].dims,_.dims,w)],k=S=>{let T=M("data",r[0].dataType,r[0].dims.length),E=M("slice_offsets",12,_.dims.length),I=Y("output",r[0].dataType,w.length);return`
          ${S.registerUniform("output_size","u32").registerUniform("slice_size","u32").declareVariables(T,E,I)}
            ${S.mainStart()}
            ${S.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.output_size")}
          let slice_offset = slice_offsets[global_idx / uniforms.slice_size];
          output[global_idx] = data[u32(slice_offset) + global_idx % uniforms.slice_size];
        }`};e.compute({name:"GatherND",shaderCache:{hint:t.cacheKey,inputDependencies:["rank","rank"]},getRunData:()=>({outputs:[{dims:w,dataType:n}],dispatchGroup:{x:Math.ceil(x/64)},programUniforms:b}),getShaderSource:k},{inputs:[r[0],_]})},If=e=>({batchDims:e.batch_dims,cacheKey:""})}),dd,cd,Ef,Af,E_=j(()=>{ie(),le(),ze(),de(),dd=(e,t)=>{if(e.length<3||e.length>4)throw new Error("GatherBlockQuantized requires 3 or 4 inputs.");let r=z.normalizeAxis(t.quantizeAxis,e[0].dims.length),a=t.blockSize,n=e[0],i=e[2],s=e.length===4?e[3]:void 0;if(i.dims.length!==n.dims.length||!n.dims.map((o,d)=>d===r?Math.ceil(o/a)===i.dims[d]:o===i.dims[d]).reduce((o,d)=>o&&d,!0))throw new Error("Scales must have the same rank as the input tensor and the dims should match except on gatherAxis.");if(s){if(s.dataType!==n.dataType)throw new Error("Zero point must have the same data type as the input tensor.");if(s.dims.length!==i.dims.length||!s.dims.map((o,d)=>o===i.dims[d]).reduce((o,d)=>o&&d,!0))throw new Error("Zero point must have the same rank as the input tensor and the dims should match except on quantizeAxis.")}},cd=(e,t)=>{let r=e[0].dims,a=e[1].dims,n=r.length,i=z.normalizeAxis(t.gatherAxis,n),s=z.normalizeAxis(t.quantizeAxis,n),o=r.slice(0);o.splice(i,1,...a);let d=z.size(o),c=e[2].dataType,h=e[0].dataType===22,u=[{type:12,data:d},{type:12,data:s},{type:12,data:i},{type:12,data:t.blockSize},...ee(...e.map((m,_)=>m.dims),o)],f=m=>{let _=M("data",e[0].dataType,e[0].dims.length),g=M("inputIndices",e[1].dataType,e[1].dims.length),w=M("scales",e[2].dataType,e[2].dims.length),x=e.length>3?M("zeroPoint",e[3].dataType,e[3].dims.length):void 0,b=Y("output",c,o.length),k=[_,g,w];x&&k.push(x);let S=[{name:"output_size",type:"u32"},{name:"quantize_axis",type:"u32"},{name:"gather_axis",type:"u32"},{name:"block_size",type:"u32"}];return`
        ${m.registerUniforms(S).declareVariables(...k,b)}
        ${m.mainStart()}
        let output_indices = ${b.offsetToIndices("global_idx")};
        var indices_indices = ${g.type.indices}(0);
        ${a.length>1?`
          for (var i: u32 = 0; i < ${a.length}; i++) {
            let index = ${b.indicesGet("output_indices","uniforms.gather_axis + i")};
            ${g.indicesSet("indices_indices","i","index")};
          }`:`indices_indices = ${b.indicesGet("output_indices","uniforms.gather_axis")};`};
        var data_indices = ${_.type.indices}(0);
        for (var i: u32 = 0; i < uniforms.gather_axis; i++) {
          let index = ${b.indicesGet("output_indices","i")};
          ${_.indicesSet("data_indices","i","index")};
        }
        var index_from_indices = ${g.getByIndices("indices_indices")};
        if (index_from_indices < 0) {
          index_from_indices += ${r[i]};
        }
        ${_.indicesSet("data_indices","uniforms.gather_axis","u32(index_from_indices)")};
        for (var i = uniforms.gather_axis + 1; i < ${o.length}; i++) {
          let index = ${b.indicesGet("output_indices",`i + ${a.length} - 1`)};
          ${_.indicesSet("data_indices","i","index")};
        }
        let data_offset = ${_.indicesToOffset("data_indices")};
        let data_index = data_offset % 8;
        // Convert 4-bit packed data to 8-bit packed data.
        let packed_4bit_quantized_data = ${_.getByOffset("data_offset / 8")};
        let packed_8bit_quantized_data = (packed_4bit_quantized_data >> (4 * (data_index % 2))) & 0x0f0f0f0f;
        let quantized_data_vec = ${h?"unpack4xI8":"unpack4xU8"}(u32(packed_8bit_quantized_data));
        let quantized_data = quantized_data_vec[data_index / 2];
        var scale_indices = data_indices;
        let quantize_axis_index = ${w.indicesGet("data_indices","uniforms.quantize_axis")} / uniforms.block_size;
        ${w.indicesSet("scale_indices","uniforms.quantize_axis","quantize_axis_index")};
        var scale = ${w.getByIndices("scale_indices")};
        ${x?`
              let zero_point_indices = scale_indices;
              let zero_point_offset = ${x.indicesToOffset("zero_point_indices")};
              let zero_point_index = zero_point_offset % 8;
              let packed_4bit_zero_points = ${x.getByOffset("zero_point_offset / 8")};
              let packed_8bit_zero_points = (packed_4bit_zero_points >> (4 * (zero_point_index % 2))) & 0x0f0f0f0f;
              let zero_point_vec = ${h?"unpack4xI8":"unpack4xU8"}(u32(packed_8bit_zero_points));
              let zero_point = zero_point_vec[zero_point_index / 2];`:"var zero_point = 0"};
        let dequantized_data = ${Ue(c)}(quantized_data - zero_point) * scale;
        ${b.setByOffset("global_idx","dequantized_data")};
    }`};return{name:"GatherBlockQuantized",shaderCache:{hint:`${t.cacheKey};${e.filter((m,_)=>_!==1).map(m=>m.dims.join("_")).join(";")}`,inputDependencies:Array.from({length:e.length},(m,_)=>"rank")},getRunData:()=>({outputs:[{dims:o,dataType:c}],dispatchGroup:{x:Math.ceil(d/64)},programUniforms:u}),getShaderSource:f}},Ef=(e,t)=>{let r=e.inputs;dd(r,t),e.compute(cd(e.inputs,t))},Af=e=>xe({blockSize:e.blockSize,gatherAxis:e.gatherAxis,quantizeAxis:e.quantizeAxis})}),pd,hd,zf,Of,A_=j(()=>{ie(),le(),ze(),de(),pd=e=>{if(!e||e.length!==2)throw new Error("GatherElements requires 2 inputs.");if(e[0].dims.length<1)throw new Error("GatherElements requires that the data input be rank >= 1.");if(e[0].dims.length!==e[1].dims.length)throw new Error(`GatherElements requires that the data input and
                     indices input tensors be of same rank.`)},hd=(e,t)=>{let r=e[0].dims,a=e[0].dataType,n=r.length,i=e[1].dims,s=e[1].dataType,o=z.normalizeAxis(t.axis,n),d=r[o],c=i.slice(0),h=z.size(c),u=M("input",a,n),f=M("indicesInput",s,i.length),m=Y("output",a,c.length),_=[{type:12,data:h},{type:6,data:d},{type:12,data:o}];return _.push(...ee(r,i,c)),{name:"GatherElements",shaderCache:{inputDependencies:["rank","rank"]},getRunData:()=>({outputs:[{dims:c,dataType:e[0].dataType}],dispatchGroup:{x:Math.ceil(h/64)},programUniforms:_}),getShaderSource:g=>`
      ${g.registerUniform("outputSize","u32").registerUniform("axisDimLimit","i32").registerUniform("axis","u32").declareVariables(u,f,m)}
      ${g.mainStart()}
      ${g.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.outputSize")}

      let outputIndices = ${m.offsetToIndices("global_idx")};

      var idx = ${f.getByOffset("global_idx")};
      if (idx < 0) {
        idx = idx + uniforms.axisDimLimit;
      }
      var inputIndices = ${u.type.indices}(outputIndices);
      ${u.indicesSet("inputIndices","uniforms.axis","u32(idx)")};
      let value = ${u.getByIndices("inputIndices")};

      ${m.setByOffset("global_idx","value")};
  }`}},zf=e=>xe({axis:e.axis}),Of=(e,t)=>{let r=e.inputs;pd(r),e.compute(hd(e.inputs,t))}}),fd,md,Rf,Mf,z_=j(()=>{ie(),le(),de(),fd=e=>{if(!e)throw new Error("Input is missing");if(e.length<2||e.length>3)throw new Error("Invaid input number.");if(e.length===3&&e[2].dims.length>2)throw new Error("Invalid input shape of C");if(e[0].dataType!==e[1].dataType||e.length===3&&e[0].dataType!==e[2].dataType)throw new Error("Input types are mismatched")},md=(e,t)=>{let r=e[0].dims.slice(),a=e[1].dims.slice(),[n,i,s]=Mp.getShapeOfGemmResult(r,t.transA,a,t.transB,e.length===3?e[2].dims:void 0),o=[n,i];if(!o)throw new Error("Can't use gemm on the given tensors");let d=16,c=Math.ceil(i/d),h=Math.ceil(n/d),u=!0,f=z.size(o),m=[{type:12,data:u?c:f},{type:12,data:n},{type:12,data:i},{type:12,data:s},{type:1,data:t.alpha},{type:1,data:t.beta}],_=["type","type"];e.length===3&&(m.push(...ee(e[2].dims)),_.push("rank")),m.push(...ee(o));let g=x=>{let b="";t.transA&&t.transB?b="value += a[k * uniforms.M + m] * b[n * uniforms.K + k];":t.transA&&!t.transB?b="value += a[k * uniforms.M + m] * b[k * uniforms.N + n];":!t.transA&&t.transB?b="value += a[m * uniforms.K + k] * b[n * uniforms.K + k];":!t.transA&&!t.transB&&(b="value += a[m * uniforms.K + k] * b[k * uniforms.N + n];");let k=t.alpha===1?"":"value *= uniforms.alpha;",S=M("a",e[0].dataType,e[0].dims),T=M("b",e[1].dataType,e[1].dims),E=S.type.value,I=null,N=[S,T];e.length===3&&(I=M("c",e[2].dataType,e[2].dims.length),N.push(I));let D=Y("output",e[0].dataType,o.length);N.push(D);let V=[{name:"output_size",type:"u32"},{name:"M",type:"u32"},{name:"N",type:"u32"},{name:"K",type:"u32"},{name:"alpha",type:"f32"},{name:"beta",type:"f32"}];return`
  ${x.registerUniforms(V).declareVariables(...N)}

  ${x.mainStart()}
    ${x.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.output_size")}

    let m = global_idx / uniforms.N;
    let n = global_idx % uniforms.N;

    var value = ${E}(0);
    for (var k: u32 = 0u; k < uniforms.K; k++) {
      ${b}
    }

    ${k}
    ${I!=null?`let cOffset = ${I.broadcastedIndicesToOffset("vec2(m, n)",D)}; value += ${E}(uniforms.beta) * ${I.getByOffset("cOffset")};`:""}
    output[global_idx] = value;
  }`},w=x=>{let b=M("a",e[0].dataType,e[0].dims),k=M("b",e[1].dataType,e[1].dims),S=null,T=[b,k];e.length===3&&(S=M("c",e[2].dataType,e[2].dims.length),T.push(S));let E=Y("output",e[0].dataType,o.length);T.push(E);let I=[{name:"num_tile_n",type:"u32"},{name:"M",type:"u32"},{name:"N",type:"u32"},{name:"K",type:"u32"},{name:"alpha",type:"f32"},{name:"beta",type:"f32"}],N="",D="";t.transA&&t.transB?(D=`
      var col = tile_row_start + local_id.x;
      var row = k_start + local_id.y;
      if (col < uniforms.M && row < uniforms.K) {
        tile_a[local_id.y][local_id.x] = a[row * uniforms.M + col];
      } else {
        tile_a[local_id.y][local_id.x] = ${b.type.value}(0);
      }

      col = k_start + local_id.x;
      row = tile_col_start + local_id.y;
      if (col < uniforms.K && row < uniforms.N) {
        tile_b[local_id.y][local_id.x] = b[row * uniforms.K + col];
      } else {
        tile_b[local_id.y][local_id.x] = ${k.type.value}(0);
      }
      `,N="value += tile_a[k][local_id.y] * tile_b[local_id.x][k];"):t.transA&&!t.transB?(D=`
      var col = tile_row_start + local_id.x;
      var row = k_start + local_id.y;
      if (col < uniforms.M && row < uniforms.K) {
        tile_a[local_id.y][local_id.x] = a[row * uniforms.M + col];
      } else {
        tile_a[local_id.y][local_id.x] = ${b.type.value}(0);
      }

      col = tile_col_start + local_id.x;
      row = k_start + local_id.y;
      if (col < uniforms.N && row < uniforms.K) {
        tile_b[local_id.y][local_id.x] = b[row * uniforms.N + col];
      } else {
        tile_b[local_id.y][local_id.x] = ${k.type.value}(0);
      }
      `,N="value += tile_a[k][local_id.y] * tile_b[k][local_id.x];"):!t.transA&&t.transB?(D=`
      var col = k_start + local_id.x;
      var row = tile_row_start + local_id.y;
      if (col < uniforms.K && row < uniforms.M) {
        tile_a[local_id.y][local_id.x] = a[row * uniforms.K + col];
      } else {
        tile_a[local_id.y][local_id.x] = ${b.type.value}(0);
      }

      col = k_start + local_id.x;
      row = tile_col_start + local_id.y;
      if (col < uniforms.K && row < uniforms.N) {
        tile_b[local_id.y][local_id.x] = b[row * uniforms.K + col];
      } else {
        tile_b[local_id.y][local_id.x] = ${k.type.value}(0);
      }
      `,N="value += tile_a[local_id.y][k] * tile_b[local_id.x][k];"):!t.transA&&!t.transB&&(D=`
      var col = k_start + local_id.x;
      var row = tile_row_start + local_id.y;
      if (col < uniforms.K && row < uniforms.M) {
        tile_a[local_id.y][local_id.x] = a[row * uniforms.K + col];
      } else {
        tile_a[local_id.y][local_id.x] = ${b.type.value}(0);
      }

      col = tile_col_start + local_id.x;
      row = k_start + local_id.y;
      if (col < uniforms.N && row < uniforms.K) {
        tile_b[local_id.y][local_id.x] = b[row * uniforms.N + col];
      } else {
        tile_b[local_id.y][local_id.x] = ${k.type.value}(0);
      }
      `,N="value += tile_a[local_id.y][k] * tile_b[k][local_id.x];");let V=t.alpha===1?"":"value *= uniforms.alpha;";return`
  ${x.registerUniforms(I).declareVariables(...T)}
  var<workgroup> tile_a: array<array<${b.type.storage}, ${d}>, ${d}>;
  var<workgroup> tile_b: array<array<${k.type.storage}, ${d}>, ${d}>;
  ${x.mainStart([d,d,1])}
    let tile_col_start = (workgroup_index % uniforms.num_tile_n) * ${d};
    let tile_row_start = (workgroup_index / uniforms.num_tile_n) * ${d};
    let num_tiles = (uniforms.K - 1) / ${d} + 1;
    var k_start = 0u;
    var value = ${E.type.value}(0);
    for (var t: u32 = 0u; t < num_tiles; t++) {
      ${D}
      k_start = k_start + ${d};
      workgroupBarrier();

      for (var k: u32 = 0u; k < ${d}; k++) {
        ${N}
      }
      workgroupBarrier();
    }

    ${V}
    let m = tile_row_start + local_id.y;
    let n = tile_col_start + local_id.x;
    ${S!=null?`let cOffset = ${S.broadcastedIndicesToOffset("vec2(m, n)",E)}; value += ${E.type.value}(uniforms.beta) * ${S.getByOffset("cOffset")};`:""}
    if (m < uniforms.M && n < uniforms.N) {
      output[m * uniforms.N + n] = value;
    }
  }`};return u?{name:"GemmShared",shaderCache:{hint:`${t.cacheKey}`,inputDependencies:_},getRunData:()=>({outputs:[{dims:o,dataType:e[0].dataType}],dispatchGroup:{x:c*h},programUniforms:m}),getShaderSource:w}:{name:"Gemm",shaderCache:{hint:`${t.cacheKey}`,inputDependencies:_},getRunData:()=>({outputs:[{dims:o,dataType:e[0].dataType}],dispatchGroup:{x:Math.ceil(f/64)},programUniforms:m}),getShaderSource:g}},Rf=e=>{let t=e.transA,r=e.transB,a=e.alpha,n=e.beta;return{transA:t,transB:r,alpha:a,beta:n,cacheKey:`${e.transA};${e.transB};${e.alpha===1}`}},Mf=(e,t)=>{fd(e.inputs),e.compute(md(e.inputs,t))}}),ht,vt,Lt,Vt,gd,yd,_d,vd,bd,wd,$d,xd,Nf,Bf,O_=j(()=>{ie(),le(),ze(),de(),[ht,vt,Lt,Vt]=[0,1,2,3],gd=e=>{if(e[0].dims.length!==4)throw new Error("only 4-D tensor is supported.");if(e[0].dims.length!==e[1].dims.length)throw new Error("input dimensions must be equal to grid dimensions");if(e[0].dims.length-2!==e[1].dims[e[1].dims.length-1])throw new Error(`last dimension of grid must be equal to ${e[0].dims.length-2}`);if(e[0].dims[0]!==e[1].dims[0])throw new Error("grid batch size must match input batch size")},yd=`
  fn gs_get_cubic_coeffs(x: f32) -> vec4<f32> {
    let cubic_alpha = -0.75f;
    let x_abs = abs(x);
    var coeffs: vec4<f32>;
    coeffs[0] = (((cubic_alpha * (x_abs + 1) - 5 * cubic_alpha) * (x_abs + 1) + 8 * cubic_alpha) * (x_abs + 1) - 4 * cubic_alpha);
    coeffs[1] = (((cubic_alpha + 2) * x_abs - (cubic_alpha + 3)) * x_abs * x_abs + 1);
    coeffs[2] = (((cubic_alpha + 2) * (1 - x_abs) - (cubic_alpha + 3)) * (1 - x_abs) * (1 - x_abs) + 1);
    coeffs[3] = (((cubic_alpha * (2 - x_abs) - 5 * cubic_alpha) * (2 - x_abs) + 8 * cubic_alpha) * (2 - x_abs) - 4 * cubic_alpha);
    return coeffs;
  }
`,_d=e=>`
  fn gs_bicubic_interpolate(p: mat4x4<${e}>, x: f32, y: f32) -> ${e} {
    var v: vec4<f32>;
    var coeffs = gs_get_cubic_coeffs(x);
    for (var i = 0; i < 4; i++) {
      v[i] = coeffs[0] * p[i][0] + coeffs[1] * p[i][1] + coeffs[2] * p[i][2] + coeffs[3] * p[i][3];
    }
    coeffs = gs_get_cubic_coeffs(y);
    let pixel = ${e}(coeffs[0] * v[0] + coeffs[1] * v[1] + coeffs[2] * v[2] + coeffs[3] * v[3]);
    return pixel;
  }
`,vd=e=>`
  fn gs_denormalize(n: f32, length: i32) -> f32 {
    ${e.alignCorners===0?`
    // alignCorners: false => [-1, 1] to [-0.5, length - 0.5]
    return ((n + 1.0) * f32(length) - 1.0) / 2.0;
    `:`
    // alignCorners: true => [-1, 1] to [0, length - 1]
    return (n + 1.0) / 2.0 * (f32(length - 1));
    `}
  }
`,bd=e=>`
  ${e.paddingMode==="reflection"?`
      fn gs_reflect(x: i32, x_min: f32, x_max: f32) -> u32 {
        var dx = 0.0;
        var fx = f32(x);
        let range = x_max - x_min;
        if (fx < x_min) {
          dx = x_min - fx;
          let n = u32(dx / range);
          let r = dx - f32(n) * range;
          if (n % 2 == 0) {
            fx = x_min + r;
          } else {
            fx = x_max - r;
          }
        } else if (fx > x_max) {
          dx = fx - x_max;
          let n = u32(dx / range);
          let r = dx - f32(n) * range;
          if (n % 2 == 0) {
            fx = x_max - r;
          } else {
            fx = x_min + r;
          }
        }
        return u32(fx);
      }`:""}
`,wd=(e,t,r)=>`
  fn pixel_at_grid(r: i32, c: i32, H: i32, W: i32, batch: u32, channel: u32, border: vec4<f32>) -> ${t} {
     var pixel = ${t}(0);
     var indices = vec4<u32>(0);
     indices[${ht}] = batch;
     indices[${vt}] = channel;`+(()=>{switch(r.paddingMode){case"zeros":return`
          if (r >= 0 && r < H && c >=0 && c < W) {
            indices[${Lt}] = u32(r);
            indices[${Vt}] = u32(c);
          }
        `;case"border":return`
          indices[${Lt}] = u32(clamp(r, 0, H - 1));
          indices[${Vt}] = u32(clamp(c, 0, W - 1));
        `;case"reflection":return`
          indices[${Lt}] = gs_reflect(r, border[1], border[3]);
          indices[${Vt}] = gs_reflect(c, border[0], border[2]);
        `;default:throw new Error(`padding mode ${r.paddingMode} is not supported`)}})()+`
    return ${e.getByIndices("indices")};
  }
`,$d=(e,t,r)=>(()=>{switch(r.mode){case"nearest":return`
          let result = pixel_at_grid(i32(round(y)), i32(round(x)), H_in, W_in, indices[${ht}], indices[${vt}], border);
        `;case"bilinear":return`
          let x1 = i32(floor(x));
          let y1 = i32(floor(y));
          let x2 = x1 + 1;
          let y2 = y1 + 1;

          let p11 = pixel_at_grid(y1, x1, H_in, W_in, indices[${ht}], indices[${vt}], border);
          let p12 = pixel_at_grid(y1, x2, H_in, W_in, indices[${ht}], indices[${vt}], border);
          let p21 = pixel_at_grid(y2, x1, H_in, W_in, indices[${ht}], indices[${vt}], border);
          let p22 = pixel_at_grid(y2, x2, H_in, W_in, indices[${ht}], indices[${vt}], border);

          let dx2 = ${t}(f32(x2) - x);
          let dx1 = ${t}(x - f32(x1));
          let dy2 = ${t}(f32(y2) - y);
          let dy1 = ${t}(y - f32(y1));
          let result = dy2 * (dx2 * p11 + dx1 * p12) + dy1 * (dx2 * p21 + dx1 * p22);
        `;case"bicubic":return`
          let x0 = i32(floor(x)) - 1;
          let y0 = i32(floor(y)) - 1;
          var p: mat4x4<${t}>;
          for (var h = 0; h < 4; h++) {
            for (var w = 0; w < 4; w++) {
              p[h][w] = pixel_at_grid(h + y0, w + x0, H_in, W_in, indices[${ht}], indices[${vt}], border);
            }
          }

          let dx = x - f32(x0 + 1);
          let dy = y - f32(y0 + 1);
          let result = gs_bicubic_interpolate(p, dx, dy);
        `;default:throw new Error(`mode ${r.mode} is not supported`)}})()+`${e.setByOffset("global_idx","result")}`,xd=(e,t)=>{let r=M("x",e[0].dataType,e[0].dims.length),a=[e[1].dims[0],e[1].dims[1],e[1].dims[2]],n=M("grid",e[1].dataType,a.length,2),i=[e[0].dims[0],e[0].dims[1],e[1].dims[1],e[1].dims[2]];t.format==="NHWC"&&(i=[e[0].dims[0],e[1].dims[1],e[1].dims[2],e[0].dims[3]],[ht,vt,Lt,Vt]=[0,3,1,2]);let s=Y("output",e[0].dataType,i.length),o=r.type.value,d=z.size(i),c=[{type:12,data:d},...ee(e[0].dims,a,i)],h=u=>`
  ${u.registerUniform("output_size","u32").declareVariables(r,n,s)}
  ${yd}
  ${_d(o)}
  ${vd(t)}
  ${bd(t)}
  ${wd(r,o,t)}

  ${u.mainStart()}
    ${u.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.output_size")}
      let H_in = i32(uniforms.x_shape[${Lt}]);
      let W_in = i32(uniforms.x_shape[${Vt}]);

      ${t.alignCorners===0?`
      let x_min = -0.5;
      let x_max = f32(W_in) - 0.5;
      let y_min = -0.5;
      let y_max = f32(H_in) - 0.5;
      `:`
      let x_min = 0.0;
      let x_max = f32(W_in) - 1.0;
      let y_min = 0.0;
      let y_max = f32(H_in) - 1.0;
      `};
      let border = vec4<f32>(x_min, y_min, x_max, y_max);

      let indices = ${s.offsetToIndices("global_idx")};
      var grid_indices = vec3<u32>(indices[${ht}], indices[${Lt}], indices[${Vt}]);
      let nxy = ${n.getByIndices("grid_indices")};
      var x = gs_denormalize(f32(nxy[0]), W_in);
      var y = gs_denormalize(f32(nxy[1]), H_in);

      ${$d(s,o,t)}
  }`;return{name:"GridSample",shaderCache:{hint:`${t.cacheKey}`,inputDependencies:["type","type"]},getRunData:u=>{let f=z.size(i);return{outputs:[{dims:i,dataType:u[0].dataType}],dispatchGroup:{x:Math.ceil(f/64)},programUniforms:c}},getShaderSource:h}},Nf=(e,t)=>{gd(e.inputs),e.compute(xd(e.inputs,t))},Bf=e=>xe({alignCorners:e.align_corners,mode:e.mode,paddingMode:e.padding_mode,format:e.format})}),je,kd,Df,di,Sd,jr,Pf,Uf=j(()=>{ie(),le(),ze(),xs(),Ts(),de(),Dt(),je=(e,t)=>e.length>t&&e[t].dims.length>0?e[t]:void 0,kd=(e,t)=>{let r=e[0],a=je(e,1),n=je(e,2),i=je(e,3),s=je(e,4),o=je(e,5),d=je(e,6),c=je(e,7);if(r.dims.length!==3&&r.dims.length!==5)throw new Error("Input query is expected to have 3 or 5 dimensions");let h=r.dims[0],u=r.dims[1],f=r.dims.length===3?r.dims[2]:t.numHeads*r.dims[4],m=u,_=0,g=0,w=Math.floor(f/t.numHeads);if(d&&c&&z.size(d.dims)&&z.size(c.dims)){if(d.dims.length!==4)throw new Error('Input "past_key" is expected to have 4 dimensions');if(d.dims[0]!==h||d.dims[1]!==t.numHeads||d.dims[3]!==w)throw new Error('Input "past_key" shape (batch_size, num_heads, past_sequence_length, head_size)');if(c.dims[0]!==h||c.dims[1]!==t.numHeads||c.dims[3]!==w)throw new Error('Input "past_value" shape (batch_size, num_heads, past_sequence_length, head_size)');if(d.dims[2]!==c.dims[2])throw new Error('Input "past_key" and "past_value" shall have same dim 2 (past_sequence_length)');if(c.dims.length!==4)throw new Error('Input "past_value" is expected to have 4 dimensions');_=d.dims[2],g=d.dims[2]}else if(d&&z.size(d.dims)||c&&z.size(c.dims))throw new Error('Input "past_key" and "past_value" shall be both present or both absent');let x;if(a&&z.size(a.dims)>0){if(r.dims.length!==3)throw new Error('Input "query" is expected to have 3 dimensions when key is given');if(a.dims.length<3||a.dims.length>5)throw new Error('Input "key" is expected to have 3, 4, or 5 dimensions');if(r.dims[0]!==a.dims[0])throw new Error('Input "query" and "key" shall have same dim 0 (batch size)');if(a.dims.length===3){if(a.dims[2]!==r.dims[2])throw new Error('Input "query" and "key" shall have same dim 2 (hidden_size)');x=2,m=a.dims[1]}else if(a.dims.length===5){if(a.dims[2]!==t.numHeads||a.dims[3]!==2||a.dims[4]!==w)throw new Error('Expect "key" shape (batch_size, kv_sequence_length, num_heads, 2, head_size) for packed kv');if(n)throw new Error('Expect "value" be none when "key" has packed kv format.');x=5,m=a.dims[1]}else{if(a.dims[1]!==t.numHeads||a.dims[3]!==w)throw new Error('Expect "key" shape (batch_size, num_heads, kv_sequence_length, head_size) for past_key');x=0,m=a.dims[2]}}else{if(r.dims.length!==5)throw new Error('Input "query" is expected to have 5 dimensions when key is empty');if(r.dims[2]!==t.numHeads||r.dims[3]!==3)throw new Error('Expect "query" shape (batch_size, kv_sequence_length, num_heads, 3, head_size) for packed kv');x=3}if(i&&z.size(i.dims)>0){if(i.dims.length!==1)throw new Error('Input "bias" is expected to have 1 dimension');if(a&&a.dims.length===5&&a.dims[3]===2)throw new Error("bias is not allowed for packed kv.")}let b=_+m,k=0;if(s&&z.size(s.dims)>0){k=8;let I=s.dims;throw I.length===1?I[0]===h?k=1:I[0]===3*h+2&&(k=3):I.length===2&&I[0]===h&&I[1]===b&&(k=5),k===8?new Error('Input "key_padding_mask" shape shall be (batch_size) or (batch_size, total_sequence_length)'):new Error("Mask not supported")}let S=!1,T=f;if(n&&z.size(n.dims)>0){if(n.dims.length!==3&&n.dims.length!==4)throw new Error('Input "value" is expected to have 3 or 4 dimensions');if(r.dims[0]!==n.dims[0])throw new Error('Input "query" and "value" shall have same dim 0 (batch_size)');if(n.dims.length===3){if(m!==n.dims[1])throw new Error('Input "key" and "value" shall have the same dim 1 (kv_sequence_length)');T=n.dims[2]}else{if(m!==n.dims[2])throw new Error('Input "key" and "value" shall have the same dim 2 (kv_sequence_length)');T=n.dims[1]*n.dims[3],S=!0}}let E=!1;if(s&&z.size(s.dims)>0)throw new Error("Key padding mask is not supported");if(o&&z.size(o.dims)>0){if(o.dims.length!==4)throw new Error('Input "attention_bias" is expected to have 4 dimensions');if(o.dims[0]!==h||o.dims[1]!==t.numHeads||o.dims[2]!==u||o.dims[3]!==b)throw new Error('Expect "attention_bias" shape (batch_size, num_heads, sequence_length, total_sequence_length)')}return{batchSize:h,sequenceLength:u,pastSequenceLength:_,kvSequenceLength:m,totalSequenceLength:b,maxSequenceLength:g,inputHiddenSize:0,hiddenSize:f,vHiddenSize:T,headSize:w,vHeadSize:Math.floor(T/t.numHeads),numHeads:t.numHeads,isUnidirectional:!1,pastPresentShareBuffer:!1,maskFilterValue:t.maskFilterValue,maskType:k,scale:t.scale,broadcastResPosBias:E,passPastInKv:S,qkvFormat:x}},Df=e=>xe({...e}),di=xe({perm:[0,2,1,3]}),Sd=(e,t,r,a,n,i,s)=>{let o=[a,n,i],d=z.size(o),c=[{type:12,data:d},{type:12,data:s},{type:12,data:i}],h=u=>{let f=Y("qkv_with_bias",t.dataType,o),m=M("qkv",t.dataType,o),_=M("bias",r.dataType,o),g=[{name:"output_size",type:"u32"},{name:"bias_offset",type:"u32"},{name:"hidden_size",type:"u32"}];return`
  ${u.registerUniforms(g).declareVariables(m,_,f)}
  ${u.mainStart()}
    ${u.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.output_size")}
    let bias_offset_idx = (global_idx % uniforms.hidden_size) + uniforms.bias_offset;

    qkv_with_bias[global_idx] = qkv[global_idx] + bias[bias_offset_idx];
  }`};return e.compute({name:"MultiHeadAttentionAddBias",shaderCache:{inputDependencies:["type","type"]},getRunData:()=>({outputs:[{dims:o,dataType:t.dataType,gpuDataType:0}],dispatchGroup:{x:Math.ceil(d/64)},programUniforms:c}),getShaderSource:h},{inputs:[t,r],outputs:[-1]})[0]},jr=(e,t,r,a,n,i,s,o)=>{let d=i;if(s&&z.size(s.dims)>0){if(a===1)throw new Error("AddBiasReshape is not implemented. Please export your model with packed QKV or KV");return d=Sd(e,i,s,t,a,r*n,o),d=d.reshape([t,a,r,n]),r===1||a===1?d:e.compute(He(d,di.perm),{inputs:[d],outputs:[-1]})[0]}else return i.dims.length===3&&(d=i.reshape([t,a,r,n])),r===1||a===1?d:e.compute(He(d,di.perm),{inputs:[d],outputs:[-1]})[0]},Pf=(e,t)=>{let r=kd(e.inputs,t),a=e.inputs[0],n=je(e.inputs,1),i=je(e.inputs,2),s=je(e.inputs,3),o=je(e.inputs,4),d=je(e.inputs,5),c=je(e.inputs,6),h=je(e.inputs,7);if(a.dims.length===5)throw new Error("Packed QKV is not implemented");if(n?.dims.length===5)throw new Error("Packed KV is not implemented");let u=n&&i&&n.dims.length===4&&i.dims.length===4,f=jr(e,r.batchSize,r.numHeads,r.sequenceLength,r.headSize,a,s,0);if(u)return Hr(e,f,n,i,o,void 0,c,h,d,r);if(!n||!i)throw new Error("key and value must be provided");let m=jr(e,r.batchSize,r.numHeads,r.kvSequenceLength,r.headSize,n,s,r.hiddenSize),_=jr(e,r.batchSize,r.numHeads,r.kvSequenceLength,r.vHeadSize,i,s,2*r.hiddenSize);Hr(e,f,m,_,o,void 0,c,h,d,r)}}),Td,Cd,Id,Ed,Qi,jf,Lf,Vf=j(()=>{ie(),le(),ze(),de(),Td=e=>{if(!e||e.length<1)throw new Error("too few inputs")},Cd=(e,t)=>{let r=[],a=t.numOutputs;return e[1].dims[0]>0&&(e[1].getBigInt64Array().forEach(n=>r.push(Number(n))),a=r.length),xe({numOutputs:a,axis:t.axis,splitSizes:r})},Id=e=>`
fn calculateOutputIndex(index: u32) -> u32 {
    for (var i: u32 = 0u; i < ${e}u; i += 1u ) {
    if (index < ${X("uniforms.size_in_split_axis","i",e)}) {
        return i;
    }
    }
    return ${e}u;
}`,Ed=e=>{let t=e.length,r=[];for(let a=0;a<t;++a){let n=e[a].setByIndices("indices","input[global_idx]");t===1?r.push(n):a===0?r.push(`if (output_number == ${a}u) { ${n} }`):a===t-1?r.push(`else { ${n} }`):r.push(`else if (output_number == ${a}) { ${n} }`)}return`
      fn writeBufferData(output_number: u32, indices: ${e[0].type.indices}, global_idx: u32) {
        ${r.join(`
`)}
      }`},Qi=(e,t)=>{let r=e[0].dims,a=z.size(r),n=e[0].dataType,i=z.normalizeAxis(t.axis,r.length),s=new Array(t.numOutputs),o=M("input",n,r.length),d=new Array(t.numOutputs),c=[],h=[],u=0,f=[{type:12,data:a}];for(let _=0;_<t.numOutputs;_++){u+=t.splitSizes[_],d[_]=u;let g=r.slice();g[i]=t.splitSizes[_],h.push(g),s[_]=Y(`output${_}`,n,g.length),c.push({dims:h[_],dataType:e[0].dataType})}f.push({type:12,data:d},...ee(r,...h));let m=_=>`
  ${_.registerUniform("input_size","u32").registerUniform("size_in_split_axis","u32",d.length).declareVariables(o,...s)}
  ${Id(d.length)}
  ${Ed(s)}

  ${_.mainStart()}
    ${_.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.input_size")}

    var indices = ${o.offsetToIndices("global_idx")};
    var index = ${o.indicesGet("indices",i)};
    let output_number = calculateOutputIndex(index);
    if (output_number != 0) {
      index -= ${X("uniforms.size_in_split_axis","output_number - 1u",d.length)};
      ${o.indicesSet("indices",i,"index")};
    }
    writeBufferData(output_number, indices, global_idx);
  }`;return{name:"Split",shaderCache:{hint:t.cacheKey,inputDependencies:["rank"]},getShaderSource:m,getRunData:()=>({outputs:c,dispatchGroup:{x:Math.ceil(a/64)},programUniforms:f})}},jf=(e,t)=>{Td(e.inputs);let r=e.inputs.length===1?t:Cd(e.inputs,t);e.compute(Qi(e.inputs,r),{inputs:[0]})},Lf=e=>{let t=e.axis,r=e.splitSizes,a=e.numOutputs<0?r.length:e.numOutputs;if(a!==r.length)throw new Error("numOutputs and splitSizes lengh must be equal");return xe({axis:t,numOutputs:a,splitSizes:r})}}),Ad,zd,ci,Wf,R_=j(()=>{ze(),Ts(),Uf(),Vf(),Dt(),Ad=(e,t)=>{if(t.doRotary)throw new Error("GroupQuerryAttention do_rotary attribute is not supported");if(t.doRotary&&e.length<=7)throw new Error("cos_cache and sin_cache inputs are required if do_rotary is specified");let r=e[0],a=e[1],n=e[2],i=e[3],s=e[4];if(t.localWindowSize!==-1)throw new Error("Local attention is not supported");if(t.softcap!==0)throw new Error("Softcap is not supported");if(t.rotaryInterleaved!==0)throw new Error("Rotary interleaved is not supported");if(t.smoothSoftmax)throw new Error("Smooth softmax is not supported");if(r.dims.length!==3&&r.dims.length!==5)throw new Error("Input query is expected to have 3 or 5 dimensions");let o=!1,d=r.dims[0],c=r.dims[1],h=r.dims.length===3?o?r.dims[2]/3:r.dims[2]:t.numHeads*r.dims[4],u=c,f=0,m=!a||a.dims.length===0,_=Math.floor(m?h/(t.numHeads+2*t.kvNumHeads):h/t.numHeads);m&&(h=_*t.numHeads);let g=i&&i.dims.length!==0,w=s&&s.dims.length!==0;if(g&&i.dims.length===4&&i.dims[0]===d&&i.dims[1]!==t.kvNumHeads&&i.dims[2]===t.kvNumHeads&&i.dims[3]===_)throw new Error("BSNH pastKey/pastValue is not supported");if(g&&w){if(i.dims.length!==4)throw new Error('Input "past_key" is expected to have 4 dimensions');if(s.dims.length!==4)throw new Error('Input "past_value" is expected to have 4 dimensions');f=i.dims[2]}else if(g||w)throw new Error('Input "past_key" and "past_value" shall be both present or both absent');let x=1;if(a&&a.dims.length>0){if(r.dims.length!==3)throw new Error('Input "query" is expected to have 3 dimensions when key is given');if(a.dims.length<3||a.dims.length>5)throw new Error('Input "key" is expected to have 3, 4, or 5 dimensions');if(r.dims[0]!==a.dims[0])throw new Error('Input "query" and "key" shall have same dim 0 (batch size)');if(a.dims.length===3){if(r.dims[2]%a.dims[2]!==0)throw new Error('Dimension 2 of "query" should be a multiple of "key"');u=a.dims[1]}else if(a.dims.length===5){if(a.dims[2]!==t.numHeads||a.dims[3]!==2||a.dims[4]!==_)throw new Error('Expect "key" shape (batch_size, kv_sequence_length, num_heads, 2, head_size) for packed kv');if(n)throw new Error('Expect "value" be none when "key" has packed kv format.');u=a.dims[1]}else{if(a.dims[1]!==t.numHeads||a.dims[3]!==_)throw new Error('Expect "key" shape (batch_size, num_heads, kv_sequence_length, head_size) for past_key');u=a.dims[2]}}else{if(r.dims.length!==3&&r.dims.length!==5)throw new Error('Input "query" is expected to have 3 or 5 dimensions when key is empty');if(r.dims.length===5&&(r.dims[2]!==t.numHeads||r.dims[3]!==3))throw new Error('Expect "query" shape (batch_size, kv_sequence_length, num_heads, 3, head_size) for packed kv');x=3}let b=0,k=!1,S=t.kvNumHeads?_*t.kvNumHeads:h;if(n&&n.dims.length>0){if(n.dims.length!==3&&n.dims.length!==4)throw new Error('Input "value" is expected to have 3 or 4 dimensions');if(r.dims[0]!==n.dims[0])throw new Error('Input "query" and "value" shall have same dim 0 (batch_size)');if(n.dims.length===3){if(u!==n.dims[1])throw new Error('Input "key" and "value" shall have the same dim 1 (kv_sequence_length)');S=n.dims[2]}else{if(u!==n.dims[2])throw new Error('Input "past_key" and "past_value" shall have the same dim 2 (kv_sequence_length)');S=n.dims[1]*n.dims[3],k=!0}}let T=e.length>4?e[5]:void 0;if(T&&T.dims.length!==1&&T.dims[0]!==d)throw new Error('Input "seqlens" is expected to have 1 dimension and the same dim 0 as batch_size');return{batchSize:d,sequenceLength:c,pastSequenceLength:f,kvSequenceLength:u,totalSequenceLength:-1,maxSequenceLength:-1,inputHiddenSize:0,hiddenSize:h,vHiddenSize:S,headSize:_,vHeadSize:Math.floor(S/t.kvNumHeads),numHeads:t.numHeads,kvNumHeads:t.kvNumHeads,nReps:t.numHeads/t.kvNumHeads,pastPresentShareBuffer:!1,maskType:b,scale:t.scale,broadcastResPosBias:!1,passPastInKv:k,qkvFormat:x}},zd=xe({perm:[0,2,1,3]}),ci=(e,t,r)=>{let a=t,n=r.kvNumHeads;return t.dims.length===3&&r.kvSequenceLength!==0&&(a=t.reshape([r.batchSize,r.kvSequenceLength,n,r.headSize]),a=e.compute(He(a,zd.perm),{inputs:[a],outputs:[-1]})[0]),a},Wf=(e,t)=>{let r=Ad(e.inputs,t);if(e.inputs[0].dims.length===5)throw new Error("Packed QKV is not implemented");if(e.inputs[1]?.dims.length===5)throw new Error("Packed KV is not implemented");let a=e.inputs[0],n=e.inputs[1]&&e.inputs[1].dims.length>0?e.inputs[1]:void 0,i=e.inputs[2]&&e.inputs[2].dims.length>0?e.inputs[2]:void 0,s=e.inputs[3]&&e.inputs[3].dims.length!==0?e.inputs[3]:void 0,o=e.inputs[4]&&e.inputs[4].dims.length!==0?e.inputs[4]:void 0,d=e.inputs.length>4?e.inputs[5]:void 0,c=e.inputs.length>5?e.inputs[6]:void 0,h=r.kvNumHeads?r.kvNumHeads:r.numHeads,u=xe({axis:2,numOutputs:3,splitSizes:[r.numHeads*r.headSize,h*r.headSize,h*r.headSize]}),[f,m,_]=!n&&!i?e.compute(Qi([a],u),{inputs:[a],outputs:[-1,-1,-1]}):[a,n,i],g=jr(e,r.batchSize,r.numHeads,r.sequenceLength,r.headSize,f,void 0,0);Hr(e,g,ci(e,m,r),ci(e,_,r),void 0,void 0,s,o,void 0,r,d,c)}}),pi,Od,Rd,qf,M_=j(()=>{ie(),le(),Dt(),de(),pi=(e,t,r,a,n,i,s,o)=>{let d=Ee(i),c=d===1?"f32":`vec${d}f`,h=d===1?"vec2f":`mat2x${d}f`,u=n*s,f=64;u===1&&(f=256);let m=[n,s,i/d],_=[n,s,2],g=["rank","type","type"],w=[];w.push(...ee(m,_));let x=b=>{let k=M("x",t.dataType,3,d),S=M("scale",r.dataType,r.dims),T=M("bias",a.dataType,a.dims),E=Y("output",1,3,2),I=[k,S,T,E];return`
  var<workgroup> workgroup_shared : array<${h}, ${f}>;
  const workgroup_size = ${f}u;
  ${b.declareVariables(...I)}
  ${b.mainStart(f)}
    let batch = workgroup_index / uniforms.x_shape[1];
    let channel = workgroup_index % uniforms.x_shape[1];
    let hight = uniforms.x_shape[2];
    // initialize workgroup memory
    var sum = ${c}(0);
    var squared_sum = ${c}(0);
    for (var h = local_idx; h < hight; h += workgroup_size) {
      let value = ${c}(${k.get("batch","channel","h")});
      sum += value;
      squared_sum += value * value;
    }
    workgroup_shared[local_idx] = ${h}(sum, squared_sum);
    workgroupBarrier();

    for (var currSize = workgroup_size >> 1;  currSize > 0; currSize = currSize >> 1) {
      if (local_idx < currSize) {
        workgroup_shared[local_idx] = workgroup_shared[local_idx] + workgroup_shared[local_idx + currSize];
      }
      workgroupBarrier();
    }
    if (local_idx == 0) {
      let sum_final = ${Mt("workgroup_shared[0][0]",d)} / f32(hight * ${d});
      let squared_sum_final = ${Mt("workgroup_shared[0][1]",d)} / f32(hight * ${d});

      let inv_std_dev = inverseSqrt(squared_sum_final - sum_final * sum_final + f32(${o}));
      let channel_scale = inv_std_dev * f32(scale[channel]);
      let channel_shift = f32(bias[channel]) - sum_final * channel_scale;
      output[workgroup_index] = vec2f(channel_scale, channel_shift);
    }
  }`};return e.compute({name:"InstanceNormComputeChannelScaleShift",shaderCache:{hint:`${d};${o};${f}`,inputDependencies:g},getRunData:()=>({outputs:[{dims:_,dataType:1}],dispatchGroup:{x:u},programUniforms:w}),getShaderSource:x},{inputs:[t,r,a],outputs:[-1]})[0]},Od=(e,t,r)=>{let a=t[0].dims,n=a,i=2,s=a[0],o=a[1],d=z.sizeFromDimension(a,i),c=Ee(d),h=z.size(n)/c,u=pi(e,t[0],t[1],t[2],s,d,o,r.epsilon),f=[s,o,d/c],m=[s,o],_=["type","none"],g=w=>{let x=M("x",t[0].dataType,f.length,c),b=M("scale_shift",1,m.length,2),k=Y("output",t[0].dataType,f.length,c),S=[x,b,k];return`
  ${w.registerUniform("output_size","u32").declareVariables(...S)}
  ${w.mainStart()}
  ${w.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.output_size")}
      let outputIndices = ${k.offsetToIndices("global_idx")};
      let batch = outputIndices[0];
      let channel = outputIndices[1];
      let scale_shift = ${b.getByIndices("vec2<u32>(batch, channel)")};
      let value = ${x.getByOffset("global_idx")} * ${k.type.value}(scale_shift.x) + ${k.type.value}(scale_shift.y);
      ${k.setByOffset("global_idx","value")};
  }`};e.compute({name:"InstanceNormalization",shaderCache:{hint:`${c}`,inputDependencies:_},getRunData:()=>({outputs:[{dims:n,dataType:t[0].dataType}],dispatchGroup:{x:Math.ceil(h/64)},programUniforms:[{type:12,data:h},...ee(f,m,f)]}),getShaderSource:g},{inputs:[t[0],u]})},Rd=(e,t,r)=>{let a=t[0].dims,n=a,i=a[0],s=a[a.length-1],o=z.sizeFromDimension(a,1)/s,d=Ee(s),c=z.size(n)/d,h=[{type:12,data:o},{type:12,data:Math.floor(s/d)}],u=["type","type"],f=!1,m=[0,a.length-1];for(let x=0;x<a.length-2;x++)f=f||a[x+1]!==1,m.push(x+1);f=f&&a[a.length-1]!==1;let _=f?e.compute(He(e.inputs[0],m),{inputs:[e.inputs[0]],outputs:[-1]})[0]:e.inputs[0].reshape(Array.from({length:a.length},(x,b)=>a[m[b]])),g=pi(e,_,t[1],t[2],i,o,s,r.epsilon),w=x=>{let b=Ne(t[0].dataType),k=d===1?"vec2f":`mat${d}x2f`,S=I=>{let N=I===0?"x":"y",D=d===1?"f32":`vec${d}f`;switch(d){case 1:return`${b}(${D}(scale.${N}))`;case 2:return`vec2<${b}>(${D}(scale[0].${N}, scale[1].${N}))`;case 4:return`vec4<${b}>(${D}(scale[0].${N}, scale[1].${N}, scale[2].${N}, scale[3].${N}))`;default:throw new Error(`Not supported compoents ${d}`)}},T=M("input",t[0].dataType,t[0].dims,d),E=Y("output",t[0].dataType,n,d);return`
  @group(0) @binding(0) var<storage, read> input : array<${T.type.storage}>;
  @group(0) @binding(1) var<storage, read> scale_input : array<${k}>;
  @group(0) @binding(2) var<storage, read_write> output : array<${E.type.storage}>;
  struct Uniforms {H: u32, C : u32};
  @group(0) @binding(3) var<uniform> uniforms: Uniforms;

  ${x.mainStart()}
    let current_image_number = global_idx / (uniforms.C * uniforms.H);
    let current_channel_number = global_idx % uniforms.C;

    let scale_offset = current_image_number * uniforms.C + current_channel_number;
    let scale = scale_input[scale_offset];
    output[global_idx] = fma(input[global_idx], ${S(0)}, ${S(1)});
  }`};e.compute({name:"InstanceNormalizationNHWC",shaderCache:{hint:`${d}`,inputDependencies:u},getRunData:()=>({outputs:[{dims:n,dataType:t[0].dataType}],dispatchGroup:{x:Math.ceil(c/64)},programUniforms:h}),getShaderSource:w},{inputs:[t[0],g]})},qf=(e,t)=>{t.format==="NHWC"?Rd(e,e.inputs,t):Od(e,e.inputs,t)}}),Md,Nd,Ff,N_=j(()=>{ie(),le(),de(),Md=e=>{if(!e||e.length<2)throw new Error("layerNorm requires at least 2 inputs.")},Nd=(e,t,r)=>{let a=t.simplified,n=e[0].dims,i=e[1],s=!a&&e[2],o=n,d=z.normalizeAxis(t.axis,n.length),c=z.sizeToDimension(n,d),h=z.sizeFromDimension(n,d),u=z.size(i.dims),f=s?z.size(s.dims):0;if(u!==h||s&&f!==h)throw new Error(`Size of X.shape()[axis:] == ${h}.
       Size of scale and bias (if provided) must match this.
       Got scale size of ${u} and bias size of ${f}`);let m=[];for(let T=0;T<n.length;++T)T<d?m.push(n[T]):m.push(1);let _=Ee(h),g=["type","type"],w=[{type:12,data:c},{type:1,data:h},{type:12,data:Math.floor(h/_)},{type:1,data:t.epsilon}];s&&g.push("type");let x=r>1,b=r>2,k=T=>{let E=Ne(e[0].dataType),I=[M("x",e[0].dataType,e[0].dims,_),M("scale",i.dataType,i.dims,_)];s&&I.push(M("bias",s.dataType,s.dims,_)),I.push(Y("output",e[0].dataType,o,_)),x&&I.push(Y("mean_data_output",1,m)),b&&I.push(Y("inv_std_output",1,m));let N=[{name:"norm_count",type:"u32"},{name:"norm_size",type:"f32"},{name:"norm_size_vectorized",type:"u32"},{name:"epsilon",type:"f32"}];return`
  ${T.registerUniforms(N).declareVariables(...I)}
  ${T.mainStart()}
    ${T.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.norm_count")}
    let offset = global_idx * uniforms.norm_size_vectorized;
    var mean_vector = ${Li("f32",_)};
    var mean_square_vector = ${Li("f32",_)};

    for (var h: u32 = 0u; h < uniforms.norm_size_vectorized; h++) {
      let value = ${dr(E,_,"x[h + offset]")};
      mean_vector += value;
      mean_square_vector += value * value;
    }
    let mean = ${Mt("mean_vector",_)} / uniforms.norm_size;
    let inv_std_dev = inverseSqrt(${Mt("mean_square_vector",_)} / uniforms.norm_size ${a?"":"- mean * mean"} + uniforms.epsilon);

    for (var j: u32 = 0; j < uniforms.norm_size_vectorized; j++) {
      let f32input = ${dr(E,_,"x[j + offset]")};
      let f32scale = ${dr(E,_,"scale[j]")};
      output[j + offset] = ${I[0].type.value}((f32input ${a?"":"- mean"}) * inv_std_dev * f32scale
        ${s?`+ ${dr(E,_,"bias[j]")}`:""}
      );
    }

    ${x?"mean_data_output[global_idx] = mean":""};
    ${b?"inv_std_output[global_idx] = inv_std_dev":""};
  }`},S=[{dims:o,dataType:e[0].dataType}];return x&&S.push({dims:m,dataType:1}),b&&S.push({dims:m,dataType:1}),{name:"LayerNormalization",shaderCache:{hint:`${_};${r};${a}`,inputDependencies:g},getRunData:()=>({outputs:S,dispatchGroup:{x:Math.ceil(c/64)},programUniforms:w}),getShaderSource:k}},Ff=(e,t)=>{Md(e.inputs),e.compute(Nd(e.inputs,t,e.outputCount))}}),Bd,Hf,B_=j(()=>{le(),zs(),Os(),Bd=e=>{if(!e||e.length!==2)throw new Error("MatMul requires 2 inputs.");if(e[0].dims[e[0].dims.length-1]!==e[1].dims[e[1].dims.length-2])throw new Error("shared dimension does not match.")},Hf=e=>{Bd(e.inputs);let t=pr.calcShape(e.inputs[0].dims,e.inputs[1].dims,!0);if(!t)throw new Error("Can't use matmul on the given tensors");let r=t[t.length-1],a=e.inputs[0].dims[e.inputs[0].dims.length-1];if(r<8&&a<8)e.compute(As(e.inputs,{activation:""},t));else{let n=t[t.length-2],i=z.size(e.inputs[0].dims.slice(0,-2)),s=z.size(e.inputs[1].dims.slice(0,-2));if(i!==1&&n===1&&s===1){let o=e.inputs[0].reshape([1,i,a]),d=e.inputs[1].reshape([1,a,r]),c=[1,i,r],h=[o,d];e.compute(Za(h,{activation:""},t,c),{inputs:h})}else e.compute(Za(e.inputs,{activation:""},t))}}}),Dd,Pd,Ud,Gf,Zf,D_=j(()=>{ie(),le(),ze(),de(),Dd=(e,t)=>{if(e.length<3||e.length>4)throw new Error("MatMulNBits requires 3 or 4 inputs");let r=e[0],a=r.dims.length;if(r.dims[a-1]!==t.k)throw new Error("The last dim of input shape does not match the k value");let n=Math.floor((t.k+t.blockSize-1)/t.blockSize),i=t.blockSize/8*t.bits,s=e[1];if(!z.areEqual(s.dims,[t.n,n,i]))throw new Error("The second inputs must be 3D tensor with shape N X nBlocksPerCol X blobSize");let o=e[2].dims;if(z.size(o)!==t.n*n)throw new Error("scales input size error.");if(e.length===4){let d=e[3].dims,c=t.bits>4?t.n*n:t.n*Math.floor((n+1)/2);if(z.size(d)!==c)throw new Error("zeroPoints input size error.")}},Pd=(e,t)=>{let r=e[0].dims,a=r.length,n=r[a-2],i=t.k,s=t.n,o=r.slice(0,a-2),d=z.size(o),c=e[1].dims[2]/4,h=e[0].dataType,u=Ee(t.k),f=Ee(c),m=Ee(s),_=o.concat([n,s]),g=n>1&&s/m%2===0?2:1,w=z.size(_)/m/g,x=64,b=[],k=[d,n,i/u],S=z.convertShape(e[1].dims).slice();S.splice(-1,1,c/f),b.push(...ee(k)),b.push(...ee(S)),b.push(...ee(e[2].dims)),e.length===4&&b.push(...ee(z.convertShape(e[3].dims)));let T=[d,n,s/m];b.push(...ee(T));let E=I=>{let N=k.length,D=M("a",e[0].dataType,N,u),V=M("b",12,S.length,f),A=M("scales",e[2].dataType,e[2].dims.length),W=[D,V,A],P=e.length===4?M("zero_points",12,e[3].dims.length):void 0;P&&W.push(P);let J=T.length,ne=Y("output",e[0].dataType,J,m),F=Ne(e[0].dataType),se=(()=>{switch(u){case 1:return`array<${F}, 8>`;case 2:return`mat4x2<${F}>`;case 4:return`mat2x4<${F}>`;default:throw new Error(`${u}-component is not supported.`)}})(),ce=()=>{let U=`
          // reuse a data
            var input_offset = ${D.indicesToOffset(`${D.type.indices}(batch, row, word_offset)`)};
            var a_data: ${se};
            for (var j: u32 = 0; j < ${8/u}; j++) {
              a_data[j] = ${D.getByOffset("input_offset")};
              input_offset++;
            }
          `;for(let G=0;G<m*g;G++)U+=`
            b_value = ${f===1?`b${G}_data`:`b${G}_data[i]`};
            b_value_lower = unpack4xU8(b_value & b_mask);
            b_value_upper = unpack4xU8((b_value >> 4) & b_mask);
            b_quantized_values = ${se}(${Array.from({length:4},(ye,ge)=>`${F}(b_value_lower[${ge}]), ${F}(b_value_upper[${ge}])`).join(", ")});
            b_dequantized_values = ${u===1?`${se}(${Array.from({length:8},(ye,ge)=>`(b_quantized_values[${ge}] - ${P?`zero_point${G}`:"zero_point"}) * scale${G}`).join(", ")});`:`(b_quantized_values - ${se}(${Array(8).fill(`${P?`zero_point${G}`:"zero_point"}`).join(",")})) * scale${G};`};
            workgroup_shared[local_id.x * ${g} + ${Math.floor(G/m)}]${m>1?`[${G%m}]`:""} += ${Array.from({length:8/u},(ye,ge)=>`${u===1?`a_data[${ge}] * b_dequantized_values[${ge}]`:`dot(a_data[${ge}], b_dequantized_values[${ge}])`}`).join(" + ")};
          `;return U},K=()=>{let U=`
            var col_index = col * ${m};
            ${P?`
            let zero_point_bytes_per_col = (nBlocksPerCol + 1) / 2;
            var zero_point_byte_count: u32;
            var zero_point_word_index: u32;
            var zero_point_byte_offset: u32;
            let zero_point_nibble_offset: u32 = block & 0x1u;
            var zero_point_bits_offset: u32;
            var zero_point_word: u32;`:`
            // The default zero point is 8 for unsigned 4-bit quantization.
            let zero_point = ${F}(8);`}
            `;for(let G=0;G<m*g;G++)U+=`
            let scale${G} = ${A.getByOffset("col_index * nBlocksPerCol + block")};
            ${P?`
            zero_point_byte_count = col_index * zero_point_bytes_per_col + (block >> 0x1u);
            zero_point_word_index = zero_point_byte_count >> 0x2u;
            zero_point_byte_offset = zero_point_byte_count & 0x3u;
            zero_point_bits_offset = (zero_point_byte_offset << 3) + (zero_point_nibble_offset << 2);
            zero_point_word = ${P.getByOffset("zero_point_word_index")} >> zero_point_bits_offset;
            let zero_point${G} = ${F}((zero_point_word) & 0xFu);`:""}
            col_index += 1;`;return U},Te=()=>{let U=`col_index = col * ${m};`;for(let G=0;G<m*g;G++)U+=`
            let b${G}_data = ${V.getByIndices(`${V.type.indices}(col_index, block, word)`)};
            col_index += 1;`;return U+=`
            var b_value: u32;
            let b_mask: u32 = 0x0F0F0F0Fu;
            var b_value_lower: vec4<u32>;
            var b_value_upper: vec4<u32>;
            var b_quantized_values: ${se};
            var b_dequantized_values: ${se};`,U};return`
        var<workgroup> workgroup_shared: array<${ne.type.value}, ${g*x}>;
        ${I.declareVariables(...W,ne)}
        ${I.mainStart([x,1,1])}
          let output_indices = ${ne.offsetToIndices(`(global_idx / ${x}) * ${g}`)};
          let col = output_indices[2];
          let row = output_indices[1];
          let batch = output_indices[0];
          let nBlocksPerCol = uniforms.b_shape[1];

          for (var block = local_id.x; block < nBlocksPerCol; block += ${x}) {
            //process one block
            var word_offset: u32 = block * ${t.blockSize/u};
            ${K()}
            for (var word: u32 = 0; word < ${c}; word += ${f}) {
              ${Te()}
              for (var i: u32 = 0; i < ${f}; i++) {
                ${ce()}
                word_offset += ${8/u};
              }
            }
          }
          workgroupBarrier();

          if (local_id.x < ${g}) {
            var output_value: ${ne.type.value} = ${ne.type.value}(0);
            var workgroup_shared_offset: u32 = local_id.x;
            for (var b: u32 = 0u; b < ${x}u; b++) {
              output_value += workgroup_shared[workgroup_shared_offset];
              workgroup_shared_offset += ${g};
            }
            ${ne.setByIndices(`${ne.type.indices}(batch, row, col + local_id.x)`,"output_value")};
          }
        }`};return{name:"MatMulNBits",shaderCache:{hint:`${t.blockSize};${t.bits};${u};${f};${m};${g};${x}`,inputDependencies:Array(e.length).fill("rank")},getRunData:()=>({outputs:[{dims:_,dataType:h}],dispatchGroup:{x:w},programUniforms:b}),getShaderSource:E}},Ud=(e,t)=>{let r=e[0].dims,a=r.length,n=r[a-2],i=t.k,s=t.n,o=r.slice(0,a-2),d=z.size(o),c=e[1].dims[2]/4,h=e[0].dataType,u=Ee(t.k),f=Ee(c),m=o.concat([n,s]),_=128,g=s%8===0?8:s%4===0?4:1,w=_/g,x=w*f*8,b=x/u,k=x/t.blockSize,S=z.size(m)/g,T=[],E=[d,n,i/u],I=z.convertShape(e[1].dims).slice();I.splice(-1,1,c/f),T.push(...ee(E)),T.push(...ee(I)),T.push(...ee(e[2].dims)),e.length===4&&T.push(...ee(z.convertShape(e[3].dims)));let N=[d,n,s];T.push(...ee(N));let D=V=>{let A=E.length,W=M("a",e[0].dataType,A,u),P=M("b",12,I.length,f),J=M("scales",e[2].dataType,e[2].dims.length),ne=[W,P,J],F=e.length===4?M("zero_points",12,e[3].dims.length):void 0;F&&ne.push(F);let se=N.length,ce=Y("output",e[0].dataType,se),K=Ne(e[0].dataType),Te=()=>{switch(u){case 1:return`
          let a_data0 = vec4<${K}>(sub_a[word_offset], sub_a[word_offset + 1], sub_a[word_offset + 2], sub_a[word_offset + 3]);
          let a_data1 = vec4<${K}>(sub_a[word_offset + 4], sub_a[word_offset + 5], sub_a[word_offset + 6], sub_a[word_offset + 7]);`;case 2:return`
          let a_data0 = vec4<${K}>(sub_a[word_offset], sub_a[word_offset + 1]);
          let a_data1 = vec4<${K}>(sub_a[word_offset + 2], sub_a[word_offset + 3]);`;case 4:return`
          let a_data0 = sub_a[word_offset];
          let a_data1 = sub_a[word_offset + 1];`;default:throw new Error(`${u}-component is not supported.`)}};return`
        var<workgroup> sub_a: array<${W.type.value}, ${b}>;
        var<workgroup> inter_results: array<array<${ce.type.value}, ${w}>, ${g}>;
        ${V.declareVariables(...ne,ce)}
        ${V.mainStart([w,g,1])}
          let output_indices = ${ce.offsetToIndices(`workgroup_index * ${g}`)};
          let col = output_indices[2];
          let row = output_indices[1];
          let batch = output_indices[0];
          let n_blocks_per_col = uniforms.b_shape[1];
          let num_tiles =  (n_blocks_per_col - 1) / ${k} + 1;

          // Loop over shared dimension.
          for (var tile: u32 = 0; tile < num_tiles; tile += 1) {
            let a_col_start = tile * ${b};
            // load one tile A data into shared memory.
            for (var a_offset = local_idx; a_offset < ${b}; a_offset += ${_})
            {
              let a_col = a_col_start + a_offset;
              if (a_col < uniforms.a_shape[2])
              {
                sub_a[a_offset] = ${W.getByIndices(`${W.type.indices}(batch, row, a_col)`)};
              } else {
                sub_a[a_offset] = ${W.type.value}(0);
              }
            }
            workgroupBarrier();

            // each thread process one block
            let b_row = col + local_id.y;
            let block = tile * ${k} + local_id.x;
            ${F?`
            let zero_point_bytes_per_col = (n_blocks_per_col + 1) / 2;
            let zero_point_byte_count = b_row * zero_point_bytes_per_col + (block >> 0x1u);
            let zero_point_word_index = zero_point_byte_count >> 0x2u;
            let zero_point_byte_offset = zero_point_byte_count & 0x3u;
            let zero_point_nibble_offset: u32 = block & 0x1u;
            let zero_point_bits_offset = (zero_point_byte_offset << 3) + (zero_point_nibble_offset << 2);
            let zero_point_word = ${F.getByOffset("zero_point_word_index")} >> zero_point_bits_offset;
            let zero_point = ${K}((zero_point_word) & 0xFu);`:`
            // The default zero point is 8 for unsigned 4-bit quantization.
            let zero_point = ${K}(8);`}
            let scale = ${J.getByOffset("b_row * n_blocks_per_col + block")};
            let b_data = ${P.getByIndices(`${P.type.indices}(b_row, block, 0)`)};
            var word_offset = local_id.x * ${t.blockSize/u};
            for (var i: u32 = 0; i < ${f}; i++) {
              ${Te()}
              let b_value = ${f===1?"b_data":"b_data[i]"};
              let b_value_lower = unpack4xU8(b_value & 0x0F0F0F0Fu);
              let b_value_upper = unpack4xU8((b_value >> 4) & 0x0F0F0F0Fu);
              let b_quantized_values = mat2x4<${K}>(${Array.from({length:4},(U,G)=>`${K}(b_value_lower[${G}]), ${K}(b_value_upper[${G}])`).join(", ")});
              let b_dequantized_values = (b_quantized_values - mat2x4<${K}>(${Array(8).fill("zero_point").join(",")})) * scale;
              inter_results[local_id.y][local_id.x] += ${Array.from({length:2},(U,G)=>`${`dot(a_data${G}, b_dequantized_values[${G}])`}`).join(" + ")};
              word_offset += ${8/u};
            }
            workgroupBarrier();
          }

          if (local_idx < ${g}) {
            var output_value: ${ce.type.value} = ${ce.type.value}(0);
            for (var b = 0u; b < ${w}; b++) {
              output_value += inter_results[local_idx][b];
            }
            if (col + local_idx < uniforms.output_shape[2])
            {
              ${ce.setByIndices(`${ce.type.indices}(batch, row, col + local_idx)`,"output_value")}
            }
          }
        }`};return{name:"BlockwiseMatMulNBits32",shaderCache:{hint:`${t.blockSize};${u};${f};${w};${g}`,inputDependencies:Array(e.length).fill("rank")},getRunData:()=>({outputs:[{dims:m,dataType:h}],dispatchGroup:{x:S},programUniforms:T}),getShaderSource:D}},Gf=(e,t)=>{Dd(e.inputs,t),t.blockSize===32&&e.adapterInfo.isVendor("intel")&&e.adapterInfo.isArchitecture("gen-12lp")?e.compute(Ud(e.inputs,t)):e.compute(Pd(e.inputs,t))},Zf=e=>xe(e)}),jd,Ld,Vd,Wd,qd,Fd,Hd,Gd,Kf,P_=j(()=>{ie(),le(),de(),jd=e=>{if(!e||e.length<1)throw new Error("Too few inputs");if(e[0].dataType!==1&&e[0].dataType!==10)throw new Error("Input type must be float or float16.");if(e.length>=2){let t=e[0].dims.length*2===e[1].dims[0];if(e.length===4&&(t=e[3].dims[0]*2===e[1].dims[0]),!t)throw new Error("The pads should be a 1D tensor of shape [2 * input_rank] or [2 * num_axes].")}},Ld=(e,t,r)=>{let a="";for(let n=t-1;n>=0;--n)a+=`
            k = i32(${e.indicesGet("indices",n)}) - ${X("uniforms.pads",n,r)};
            if (k < 0) {
              break;
            }
            if (k >= i32(${X("uniforms.x_shape",n,t)})) {
              break;
            }
            offset += k * i32(${X("uniforms.x_strides",n,t)});
        `;return`
          value = ${e.type.value}(uniforms.constant_value);
          for (var i = 0; i < 1; i++) {
            var offset = 0;
            var k = 0;
            ${a}
            value = x[offset];
          }
      `},Vd=(e,t,r)=>{let a="";for(let n=t-1;n>=0;--n)a+=`
                k = i32(${e.indicesGet("indices",n)}) - ${X("uniforms.pads",n,r)};
                if (k < 0) {
                  k = -k;
                }
                {
                  let _2n_1 = 2 * (i32(${X("uniforms.x_shape",n,t)}) - 1);
                  k = k % _2n_1;
                  if(k >= i32(${X("uniforms.x_shape",n,t)})) {
                    k = _2n_1 - k;
                  }
                }
                offset += k * i32(${X("uniforms.x_strides",n,t)});
            `;return`
              var offset = 0;
              var k = 0;
              ${a}
              value = x[offset];
          `},Wd=(e,t,r)=>{let a="";for(let n=t-1;n>=0;--n)a+=`
                k = i32(${e.indicesGet("indices",n)}) - ${X("uniforms.pads",n,r)};
                if (k < 0) {
                  k = 0;
                }
                if (k >= i32(${X("uniforms.x_shape",n,t)})) {
                  k = i32(${X("uniforms.x_shape",n,t)}) - 1;
                }
                offset += k * i32(${X("uniforms.x_strides",n,t)});
            `;return`
              var offset = 0;
              var k = 0;
              ${a}
              value = x[offset];
          `},qd=(e,t,r)=>{let a="";for(let n=t-1;n>=0;--n)a+=`
                k = i32(${e.indicesGet("indices",n)}) - ${X("uniforms.pads",n,r)};
                if (k < 0)  {
                  k += i32(${X("uniforms.x_shape",n,t)}]);
                }
                if (k >= i32(${X("uniforms.x_shape",n,t)})) {
                  k -= i32(${X("uniforms.x_shape",n,t)});
                }
                offset += k * i32(${X("uniforms.x_strides",n,t)});
            `;return`
              var offset = 0;
              var k = 0;
              ${a}
              value = x[offset];
          `},Fd=(e,t,r)=>{switch(r.mode){case 0:return Ld(e,t,r.pads.length);case 1:return Vd(e,t,r.pads.length);case 2:return Wd(e,t,r.pads.length);case 3:return qd(e,t,r.pads.length);default:throw new Error("Invalid mode")}},Hd=(e,t)=>{let r=z.padShape(e[0].dims.slice(),t.pads),a=e[0].dims,n=z.size(r),i=[{type:12,data:n},{type:6,data:t.pads}],s=e.length>=3&&e[2].data;t.mode===0&&i.push({type:s?e[2].dataType:1,data:t.value}),i.push(...ee(e[0].dims,r));let o=["rank"],d=c=>{let h=Y("output",e[0].dataType,r.length),u=M("x",e[0].dataType,a.length),f=u.type.value,m=Fd(h,a.length,t),_=[{name:"output_size",type:"u32"},{name:"pads",type:"i32",length:t.pads.length}];return t.mode===0&&_.push({name:"constant_value",type:s?f:"f32"}),`
            ${c.registerUniforms(_).declareVariables(u,h)}
            ${c.mainStart()}
            ${c.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.output_size")}

            let indices = ${h.offsetToIndices("global_idx")};

            var value = ${f}(0);
            ${m}
            output[global_idx] = value;
        }`};return{name:"Pad",shaderCache:{hint:`${t.mode}${s}`,inputDependencies:o},getRunData:()=>({outputs:[{dims:r,dataType:e[0].dataType}],dispatchGroup:{x:Math.ceil(z.size(r)/64)},programUniforms:i}),getShaderSource:d}},Gd=(e,t)=>{if(e.length>1){let r=e[1].getBigInt64Array(),a=e.length>=3&&e[2].data?e[2].dataType===10?e[2].getUint16Array()[0]:e[2].getFloat32Array()[0]:0,n=e[0].dims.length,i=new Int32Array(2*n).fill(0);if(e.length>=4){let o=e[3].getBigInt64Array();for(let d=0;d<o.length;d++)i[Number(o[d])]=Number(r[d]),i[Number(o[d])+n]=Number(r[d+o.length])}else r.forEach((o,d)=>i[Number(d)]=Number(o));let s=[];return i.forEach(o=>s.push(o)),{mode:t.mode,value:a,pads:s}}else return t},Kf=(e,t)=>{jd(e.inputs);let r=Gd(e.inputs,t);e.compute(Hd(e.inputs,r),{inputs:[0]})}}),Ar,hi,fi,mi,gi,Zd,Kd,yi,_i,Qf,Yf,vi,Jf,Xf,bi,em,tm,rm,am,U_=j(()=>{ut(),ie(),le(),de(),Ar=e=>{if(Se.webgpu.validateInputContent&&(!e||e.length!==1))throw new Error("Pool ops requires 1 input.")},hi=(e,t,r)=>{let a=t.format==="NHWC",n=e.dims.slice();a&&n.splice(1,0,n.pop());let i=Object.hasOwnProperty.call(t,"dilations"),s=t.kernelShape.slice(),o=t.strides.slice(),d=i?t.dilations.slice():[],c=t.pads.slice();Ha.adjustPoolAttributes(r,n,s,o,d,c);let h=Ha.computePoolOutputShape(r,n,o,d,s,c,t.autoPad),u=Object.assign({},t);i?Object.assign(u,{kernelShape:s,strides:o,pads:c,dilations:d,cacheKey:t.cacheKey}):Object.assign(u,{kernelShape:s,strides:o,pads:c,cacheKey:t.cacheKey});let f=h.slice();return f.push(f.splice(1,1)[0]),[u,a?f:h]},fi=(e,t)=>{let r=t.format==="NHWC",a=z.size(e),n=z.size(t.kernelShape),i=[{type:12,data:a},{type:12,data:n}],s=[{name:"outputSize",type:"u32"},{name:"kernelSize",type:"u32"}];if(t.kernelShape.length<=2){let o=t.kernelShape[t.kernelShape.length-1],d=t.strides[t.strides.length-1],c=t.pads[t.pads.length/2-1],h=t.pads[t.pads.length-1],u=!!(c+h);i.push({type:12,data:o},{type:12,data:d},{type:12,data:c},{type:12,data:h}),s.push({name:"kw",type:"u32"},{name:"sw",type:"u32"},{name:"pwStart",type:"u32"},{name:"pwEnd",type:"u32"});let f=!1;if(t.kernelShape.length===2){let m=t.kernelShape[t.kernelShape.length-2],_=t.strides[t.strides.length-2],g=t.pads[t.pads.length/2-2],w=t.pads[t.pads.length-2];f=!!(g+w),i.push({type:12,data:m},{type:12,data:_},{type:12,data:g},{type:12,data:w}),s.push({name:"kh",type:"u32"},{name:"sh",type:"u32"},{name:"phStart",type:"u32"},{name:"phEnd",type:"u32"})}return[i,s,!0,u,f]}else{if(r)throw new Error("Pooling with kernelShape.length > 2 is not supported for NHWC format.");let o=z.computeStrides(t.kernelShape);i.push({type:12,data:o},{type:12,data:t.pads},{type:12,data:t.strides}),s.push({name:"kernelStrides",type:"u32",length:o.length},{name:"pads",type:"u32",length:t.pads.length},{name:"strides",type:"u32",length:t.strides.length});let d=t.pads.reduce((c,h)=>c+h);return[i,s,!!d,!1,!1]}},mi=(e,t,r,a,n,i,s,o,d,c,h,u)=>{let f=n.format==="NHWC",m=t.type.value,_=Y("output",t.type.tensor,a);if(n.kernelShape.length<=2){let g="",w="",x="",b=r-(f?2:1);if(h?g=`
                for (var i: u32 = 0u; i < uniforms.kw; i++) {
                  xIndices[${b}] = indices[${b}] * uniforms.sw - uniforms.pwStart + i;
                  if (xIndices[${b}] < 0 || xIndices[${b}]
                      >= uniforms.x_shape[${b}]) {
                    pad++;
                    continue;
                  }
                  let x_val = x[${t.indicesToOffset("xIndices")}];
                  ${i}
                }`:g=`
                for (var i: u32 = 0u; i < uniforms.kw; i++) {
                  xIndices[${b}] = indices[${b}] * uniforms.sw - uniforms.pwStart + i;
                  let x_val = x[${t.indicesToOffset("xIndices")}];
                  ${i}
                }`,n.kernelShape.length===2){let k=r-(f?3:2);u?w=`
                for (var j: u32 = 0u; j < uniforms.kh; j++) {
                  xIndices[${k}] = indices[${k}] * uniforms.sh - uniforms.phStart + j;
                  if (xIndices[${k}] < 0 || xIndices[${k}] >= uniforms.x_shape[${k}]) {
                    pad += i32(uniforms.kw);
                    continue;
                  }
              `:w=`
                for (var j: u32 = 0u; j < uniforms.kh; j++) {
                  xIndices[${k}] = indices[${k}] * uniforms.sh - uniforms.phStart + j;
                `,x=`
              }
            `}return`
            ${e.registerUniforms(d).declareVariables(t,_)}

            ${e.mainStart()}
              ${e.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.outputSize")}

              let indices = ${_.offsetToIndices("global_idx")};
              var xIndices = ${_.offsetToIndices("global_idx")};

              var value = ${m}(${o});
              var pad = 0;
              ${w}
              ${g}
              ${x}
              ${s}

              output[global_idx] = value;
            }`}else{if(f)throw new Error("Pooling with kernelShape.length > 2 is not supported for NHWC format.");let g=n.kernelShape.length,w=n.pads.length,x="";return c?x=`
                if (xIndices[j] >= uniforms.x_shape[j]) {
                  pad++;
                  isPad = true;
                  break;
                }
              }
              if (!isPad) {
                let x_val = x[${t.indicesToOffset("xIndices")}];
                ${i}
              }`:x=`
              }
              let x_val = x[${t.indicesToOffset("xIndices")}];
              ${i}
            `,`
            ${e.registerUniforms(d).declareVariables(t,_)}

            ${e.mainStart()}
              ${e.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.outputSize")}
              let indices = ${_.offsetToIndices("global_idx")};
              var xIndices = ${_.offsetToIndices("global_idx")};

              var offsets: array<u32, ${g}>;

              var value = ${m}(${o});
              var pad = 0;
              var isPad = false;

              for (var i: u32 = 0u; i < uniforms.kernelSize; i++) {
                var offset = i;
                for (var j = 0u; j < ${g-1}u; j++) {
                  offsets[j] = offset / ${X("uniforms.kernelStrides","j",g)};
                  offset -= offsets[j] * ${X("uniforms.kernelStrides","j",g)};
                }
                offsets[${g-1}] = offset;

                isPad = false;
                for (var j = ${r-g}u; j < ${r}u; j++) {
                  xIndices[j] = indices[j] * ${X("uniforms.strides",`j - ${r-g}u`,g)}
                    + offsets[j - ${r-g}u] - ${X("uniforms.pads","j - 2u",w)};
                  ${x}
              }
              ${s}

              output[global_idx] = value;
            }`}},gi=e=>`${e.format};${e.ceilMode};${e.autoPad};${e.kernelShape.length}`,Zd=e=>`${gi(e)};${e.countIncludePad}`,Kd=e=>`${gi(e)};${e.storageOrder};${e.dilations}`,yi=e=>({format:e.format,autoPad:["NOTSET","VALID","SAME_UPPER","SAME_LOWER"][e.auto_pad],ceilMode:e.ceil_mode,kernelShape:e.kernel_shape,strides:e.strides,pads:e.pads}),_i=(e,t,r,a)=>{let[n,i]=hi(t,a,r),s=M("x",t.dataType,t.dims.length),o=s.type.value,d="value += x_val;",c="";n.countIncludePad?c+=`value /= ${o}(uniforms.kernelSize);`:c+=`value /= ${o}(i32(uniforms.kernelSize) - pad);`;let[h,u,f,m,_]=fi(i,n);h.push(...ee(t.dims,i));let g=["rank"];return{name:e,shaderCache:{hint:`${a.cacheKey};${f};${m};${_}`,inputDependencies:g},getRunData:()=>({outputs:[{dims:i,dataType:t.dataType}],dispatchGroup:{x:Math.ceil(z.size(i)/64)},programUniforms:h}),getShaderSource:w=>mi(w,s,t.dims.length,i.length,n,d,c,0,u,f,m,_)}},Qf=e=>{let t=e.count_include_pad!==0,r=yi(e);if(r.ceilMode!==0)throw new Error("using ceil() in shape computation is not yet supported for AveragePool");let a={countIncludePad:t,...r,cacheKey:""};return{...a,cacheKey:Zd(a)}},Yf=(e,t)=>{Ar(e.inputs),e.compute(_i("AveragePool",e.inputs[0],!1,t))},vi={autoPad:"",ceilMode:0,countIncludePad:!1,kernelShape:[],strides:[],pads:[],storageOrder:0,dilations:[]},Jf=e=>{let t=e.format;return{format:t,...vi,cacheKey:t}},Xf=(e,t)=>{Ar(e.inputs),e.compute(_i("GlobalAveragePool",e.inputs[0],!0,t))},bi=(e,t,r,a)=>{let[n,i]=hi(t,a,r),s=`
      value = max(x_val, value);
    `,o="",d=M("x",t.dataType,t.dims.length),c=["rank"],[h,u,f,m,_]=fi(i,n);return h.push(...ee(t.dims,i)),{name:e,shaderCache:{hint:`${a.cacheKey};${f};${m};${_}`,inputDependencies:c},getRunData:()=>({outputs:[{dims:i,dataType:t.dataType}],dispatchGroup:{x:Math.ceil(z.size(i)/64)},programUniforms:h}),getShaderSource:g=>mi(g,d,t.dims.length,i.length,n,s,o,t.dataType===10?-65504:-1e5,u,f,m,_)}},em=(e,t)=>{Ar(e.inputs),e.compute(bi("MaxPool",e.inputs[0],!1,t))},tm=e=>{let t=e.storage_order,r=e.dilations,a=yi(e);if(t!==0)throw new Error("column major storage order is not yet supported for MaxPool");if(a.ceilMode!==0)throw new Error("using ceil() in shape computation is not yet supported for MaxPool");let n={storageOrder:t,dilations:r,...a,cacheKey:""};return{...n,cacheKey:Kd(n)}},rm=e=>{let t=e.format;return{format:t,...vi,cacheKey:t}},am=(e,t)=>{Ar(e.inputs),e.compute(bi("GlobalMaxPool",e.inputs[0],!0,t))}}),Qd,Yd,nm,im,j_=j(()=>{ie(),le(),ze(),de(),Qd=(e,t)=>{if(e.length<2||e.length>3)throw new Error("DequantizeLinear requires 2 or 3 inputs.");if(e.length===3&&e[1].dims===e[2].dims)throw new Error("x-scale and x-zero-point must have the same shape.");if(e.length===3&&e[0].dataType!==e[2].dataType)throw new Error("x and x-zero-point must have the same data type.");if(e[0].dataType===6&&e.length>2)throw new Error("In the case of dequantizing int32 there is no zero point.");if(e[1].dims.length!==0&&e[1].dims.length!==1&&e[1].dims.length!==e[0].dims.length)throw new Error("scale input must be a scalar, a 1D tensor, or have the same rank as the input tensor.");if(e.length>2){if(e[0].dataType!==e[2].dataType)throw new Error("x and x-zero-point must have the same data type.");if(e[1].dims.length!==e[2].dims.length)throw new Error("scale and zero-point inputs must have the same rank.");if(!e[1].dims.map((r,a)=>r===e[2].dims[a]).reduce((r,a)=>r&&a,!0))throw new Error("scale and zero-point inputs must have the same shape.")}if(t.blockSize>0){if(e[1].dims.length===0||e[1].dims.length===1&&e[1].dims[0]===1)throw new Error("blockSize must be set only for block quantization.");if(!e[1].dims.map((n,i)=>i===t.axis||n===e[0].dims[i]).reduce((n,i)=>n&&i,!0))throw new Error("For block qunatization, scale input shape to match the input shape except for the axis");if(e[1].dims.length!==e[0].dims.length)throw new Error("For block qunatization the scale input rank must be the same as the x rank.");let r=e[0].dims[t.axis],a=e[1].dims[t.axis];if(t.blockSize<Math.ceil(r/a)||t.blockSize>Math.ceil(r/(a-1)-1))throw new Error("blockSize must be with in the range [ceil(dI / Si), ceil(dI / (Si - 1) - 1)].")}},Yd=(e,t)=>{let r=z.normalizeAxis(t.axis,e[0].dims.length),a=e[0].dataType,n=a===3,i=e[0].dims,s=e[1].dataType,o=z.size(i),d=a===3||a===2,c=d?[Math.ceil(z.size(e[0].dims)/4)]:e[0].dims,h=e[1].dims,u=e.length>2?e[2]:void 0,f=u?d?[Math.ceil(z.size(u.dims)/4)]:u.dims:void 0,m=h.length===0||h.length===1&&h[0]===1,_=m===!1&&h.length===1,g=Ee(o),w=m&&(!d||g===4),x=w?g:1,b=w&&!d?g:1,k=M("input",d?12:a,c.length,b),S=M("scale",s,h.length),T=u?M("zero_point",d?12:a,f.length):void 0,E=Y("output",s,i.length,x),I=[k,S];T&&I.push(T);let N=[c,h];u&&N.push(f);let D=[{type:12,data:o/x},{type:12,data:r},{type:12,data:t.blockSize},...ee(...N,i)],V=A=>{let W=[{name:"output_size",type:"u32"},{name:"axis",type:"u32"},{name:"block_size",type:"u32"}];return`
      ${A.registerUniforms(W).declareVariables(...I,E)}
      ${A.mainStart()}
          ${A.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.output_size")}
          let output_indices = ${E.offsetToIndices("global_idx")};

          // Set input x
          ${d?`
            let input = ${k.getByOffset("global_idx / 4")};
            let x_vec = ${n?"unpack4xI8(input)":"unpack4xU8(input)"};
            let x_value = ${x===1?"x_vec[global_idx % 4]":"x_vec"};`:`let x_value = ${k.getByOffset("global_idx")};`};

          // Set scale input
          ${m?`let scale_value= ${S.getByOffset("0")}`:_?`
            let scale_index = ${E.indicesGet("output_indices","uniforms.axis")};
            let scale_value= ${S.getByOffset("scale_index")};`:`
            var scale_indices: ${S.type.indices} = output_indices;
            let index = ${S.indicesGet("scale_indices","uniforms.axis")} / uniforms.block_size;
            ${S.indicesSet("scale_indices","uniforms.axis","index")};
            let scale_value= ${S.getByIndices("scale_indices")};`};

          // Set zero-point input
          ${T?m?d?`
                let zero_point_input = ${T.getByOffset("0")};
                let zero_point_vec =  ${n?"unpack4xI8(zero_point_input)":"unpack4xU8(zero_point_input)"};
                let zero_point_value= zero_point_vec[0]`:`let zero_point_value = ${T.getByOffset("0")}`:_?d?`
                let zero_point_index = ${E.indicesGet("output_indices","uniforms.axis")};
                let zero_point_input = ${T.getByOffset("zero_point_index / 4")};
                let zero_point_vec =  ${n?"unpack4xI8(zero_point_input)":"unpack4xU8(zero_point_input)"};
                let zero_point_value = zero_point_vec[zero_point_index % 4]`:`
                let zero_point_index = ${E.indicesGet("output_indices","uniforms.axis")};
                let zero_point_value = ${T.getByOffset("zero_point_index")};`:d?`
                let zero_point_offset = ${S.indicesToOffset("scale_indices")};
                let zero_point_input = ${T.getByOffset("zero_point_offset / 4")};
                let zero_point_vec = ${n?"unpack4xI8(zero_point_input)":"unpack4xU8(zero_point_input)"};
                let zero_point_value = zero_point_vec[zero_point_offset % 4];`:`let zero_point_value = ${T.getByIndices("scale_indices")};`:`let zero_point_value = ${d?n?"i32":"u32":k.type.value}(0);`};
      // Compute and write output
      ${E.setByOffset("global_idx",`${E.type.value}(x_value - zero_point_value) * scale_value`)};
      }`};return{name:"DequantizeLinear",shaderCache:{hint:t.cacheKey,inputDependencies:T?["rank","rank","rank"]:["rank","rank"]},getShaderSource:V,getRunData:()=>({outputs:[{dims:i,dataType:s}],dispatchGroup:{x:Math.ceil(o/x/64),y:1,z:1},programUniforms:D})}},nm=(e,t)=>{Qd(e.inputs,t),e.compute(Yd(e.inputs,t))},im=e=>xe({axis:e.axis,blockSize:e.blockSize})}),Jd,Xd,sm,L_=j(()=>{ut(),ie(),de(),Jd=(e,t,r)=>{let a=e===t,n=e<t&&r<0,i=e>t&&r>0;if(a||n||i)throw new Error("Range these inputs' contents are invalid.")},Xd=(e,t,r,a)=>{let n=Math.abs(Math.ceil((t-e)/r)),i=[n],s=n,o=[{type:12,data:s},{type:a,data:e},{type:a,data:r},...ee(i)],d=c=>{let h=Y("output",a,i.length),u=h.type.value,f=[{name:"outputSize",type:"u32"},{name:"start",type:u},{name:"delta",type:u}];return`
        ${c.registerUniforms(f).declareVariables(h)}
        ${c.mainStart()}
        ${c.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.outputSize")}
        output[global_idx] = uniforms.start + ${u}(global_idx) * uniforms.delta;
      }`};return{name:"Range",shaderCache:{hint:`${a}`},getShaderSource:d,getRunData:()=>({outputs:[{dims:i,dataType:a}],dispatchGroup:{x:Math.ceil(s/64)},programUniforms:o})}},sm=e=>{let t=0,r=0,a=0;e.inputs[0].dataType===6?(t=e.inputs[0].getInt32Array()[0],r=e.inputs[1].getInt32Array()[0],a=e.inputs[2].getInt32Array()[0]):e.inputs[0].dataType===1&&(t=e.inputs[0].getFloat32Array()[0],r=e.inputs[1].getFloat32Array()[0],a=e.inputs[2].getFloat32Array()[0]),Se.webgpu.validateInputContent&&Jd(t,r,a),e.compute(Xd(t,r,a,e.inputs[0].dataType),{inputs:[]})}}),ec,tc,om,um,V_=j(()=>{ie(),le(),ze(),de(),ec=(e,t,r,a)=>{if(e!=="none"&&a!=="i32"&&a!=="u32"&&a!=="f32")throw new Error(`Input ${a} is not supported with reduction ${e}.`);let n=`{
                var oldValue = 0;
                loop {
                  let newValueF32 =`,i=`;
                  let newValue = bitcast<i32>(newValueF32);
                  let res = atomicCompareExchangeWeak(&${t}, oldValue, newValue);
                  if res.exchanged {
                    break;
                  }
                  oldValue = res.old_value;
                }
              }`;switch(e){case"none":return`${t}=${r};`;case"add":return a==="i32"||a==="u32"?`atomicAdd(&${t}, bitcast<${a}>(${r}));`:`
              ${n}bitcast<${a}>(oldValue) + (${r})${i}`;case"max":return a==="i32"||a==="u32"?`atomicMax(&${t}, bitcast<${a}>(${r}));`:`
                ${n}max(bitcast<f32>(oldValue), (${r}))${i}`;case"min":return a==="i32"||a==="u32"?`atomicMin(&${t}, bitcast<${a}>(${r}));`:`${n}min(bitcast<${a}>(oldValue), (${r}))${i}`;case"mul":return`${n}(bitcast<${a}>(oldValue) * (${r}))${i}`;default:throw new Error(`Reduction ${e} is not supported.`)}},tc=(e,t)=>{let r=e[0].dims,a=e[1].dims,n=r,i=1,s=Math.ceil(z.size(a)/i),o=a[a.length-1],d=z.sizeFromDimension(r,o),c=[{type:12,data:s},{type:12,data:o},{type:12,data:d},...ee(e[1].dims,e[2].dims,n)],h=u=>{let f=M("indices",e[1].dataType,e[1].dims.length),m=M("updates",e[2].dataType,e[2].dims.length,i),_=t.reduction!=="none"&&t.reduction!==""?Dp("output",e[0].dataType,n.length):Y("output",e[0].dataType,n.length,i);return`
      ${u.registerUniform("output_size","u32").registerUniform("last_index_dimension","u32").registerUniform("num_updates_elements","u32").declareVariables(f,m,_)}
      ${u.mainStart()}
        ${u.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.output_size")}
  var data_offset = 0u;
  let indices_start = uniforms.last_index_dimension * global_idx;
  let indices_end = indices_start + uniforms.last_index_dimension;
  for (var i = indices_start; i < indices_end; i++) {
    var index = i32(indices[i].x);
    ${e[0].dims.length===1?`
    let element_count_dim = uniforms.output_strides;
    let dim_value = uniforms.output_shape;`:`
    let element_count_dim = uniforms.output_strides[i - indices_start];
    let dim_value = uniforms.output_shape[i - indices_start + uniforms.last_index_dimension];`}
    if (index >= 0) {
      if (index >= i32(dim_value)) {
        index = i32(dim_value - 1);
      }
    } else {
      if (index < -i32(dim_value)) {
        index = 0;
      } else {
        index += i32(dim_value);
      }
    }
    data_offset += u32((u32(index) * element_count_dim));
  }

  for (var i = 0u; i < uniforms.num_updates_elements; i++) {
    let value = updates[uniforms.num_updates_elements * global_idx + i];
    ${ec(t.reduction,"output[data_offset + i]","value",_.type.value)}
  }

      }`};return{name:"ScatterND",shaderCache:{hint:`${t.cacheKey}_${t.reduction}`,inputDependencies:["rank","rank"]},getRunData:()=>({outputs:[{dims:n,dataType:e[0].dataType}],dispatchGroup:{x:Math.ceil(s/64)},programUniforms:c}),getShaderSource:h}},om=e=>xe({reduction:e.reduction}),um=(e,t)=>{e.compute(tc(e.inputs,t),{inputs:[e.inputs[1],e.inputs[2]],outputs:[]})}}),rc,ac,nc,wi,ic,sc,oc,uc,lc,dc,cc,pc,$i,hc,fc,mc,gc,yc,lm,dm,W_=j(()=>{ie(),le(),ze(),de(),rc=(e,t)=>{if(e.every(r=>r>0||(()=>{throw new Error("Resize requires scales input values to be positive")})),e.length>0){if(t.mode==="linear"){if(!(e.length===2||e.length===3||e.length===4&&e[0]===1&&e[1]===1||e.length===4&&e[0]===1&&e[3]===1||e.length===5&&e[0]===1&&e[1]===1))throw new Error(`For linear mode, Resize requires scales to be 2D, 3D, 4D with either two outermost or one innermost and
            one outermost scale values equal to 1, or 5D with two outermost scale values equal to 1`)}else if(t.mode==="cubic"&&!(e.length===2||e.length===4&&e[0]===1&&e[1]===1||e.length===4&&e[0]===1&&e[3]===1))throw new Error("Resize requires scales input size to be 2 or 4 for cubic mode")}},ac=(e,t,r)=>{t.every(n=>n>=0&&n<r||(()=>{throw new Error("Resize requires axes input values to be positive and less than rank")}));let a=new Array(r).fill(1);return t.forEach((n,i)=>a[n]=e[i]),a},nc=(e,t,r,a,n,i)=>{let[s,o,d]=r>10?[1,2,3]:[-1,e.length>1?1:-1,-1],c=e[0].dims.length;if(s>0&&e.length>s&&e[s].dims.length>0)e[s].getFloat32Array().forEach(h=>i.push(h));else if(t.coordinateTransformMode==="tf_crop_and_resize")throw new Error("Resize requires RoI input to be specified when coordinateTransformMode is tfCropAndResize");if(o>0&&e.length>o&&e[o].dims.length===1&&e[o].dims[0]>0){if(e[o].getFloat32Array().forEach(h=>a.push(h)),a.length!==0&&a.length!==c&&r>=18&&a.length!==t.axes.length)throw new Error("Resize requires scales input size to be same as input rank or axes size for opset 18 and up");rc(a,t),t.axes.length>0&&ac(a,t.axes,c).forEach((h,u)=>a[u]=h)}if(d>0&&e.length>d&&e[d].dims.length===1&&e[d].dims[0]>0&&(e[d].getBigInt64Array().forEach(h=>n.push(Number(h))),n.length!==0&&n.length!==c&&r>=18&&n.length!==t.axes.length))throw new Error("Resize requires sizes input size to be same as input rank or axes size for opset 18 and up");if(t.axes.length>0){if(a.length!==0&&a.length!==t.axes.length)throw new Error('Resize requires "scales" input size to be of axes rank when axes attributes is specified');if(n.length!==0&&n.length!==t.axes.length)throw new Error('Resize requires "sizes" input size to be of rank axes rank when axes attributes is specified')}if(typeof a<"u"&&typeof n<"u"&&a.length>0&&n.length>c)throw new Error("Resize requires only of scales or sizes to be specified")},wi=(e,t,r,a)=>`
  // The whole part and the fractional part are calculated separately due to inaccuracy of floating
  // point division. As an example, f32(21) / f32(7) may evaluate to 2.99... instead of 3, causing an
  // offset-by-one error later in floor().
  let big = (${e}) * (${t});
  let whole = ${a}(big / (${r}));
  let fract = ${a}(big % (${r})) / ${a}(${r});
  return whole + fract;
`,ic=(e,t)=>`fn getOriginalCoordinateFromResizedCoordinate(xResized: u32, xScale: f32, lengthResized: u32,
     lengthOriginal: u32, roiStart: f32, roiEnd: f32) -> ${t} { `+(()=>{switch(e){case"asymmetric":return`
          if (xScale < 1.0 || floor(xScale) != xScale) {
            return ${t}(xResized) / ${t}(xScale);
          } else {
            ${wi("xResized","lengthOriginal","lengthResized",t)}
          }
        `;case"pytorch_half_pixel":return`if (lengthResized > 1) {
                    return (${t}(xResized) + 0.5) / ${t}(xScale) - 0.5;
                  } else {
                    return 0.0;
                  }`;case"tf_half_pixel_for_nn":return`return (${t}(xResized) + 0.5) / ${t}(xScale);`;case"align_corners":return`if (lengthResized == 1) {
                    return 0.0;
                  } else {
                    ${wi("xResized","lengthOriginal - 1","lengthResized - 1",t)}
                  }`;case"tf_crop_and_resize":return`if (lengthResized > 1) {
                    return ${t}(roiStart) * ${t}(lengthOriginal - 1) +
                        (${t}(xResized) * ${t}(roiEnd - roiStart) * ${t}(lengthOriginal - 1)) /
                        ${t}(lengthResized - 1);
                  } else {
                    return 0.5 * ${t}(roiStart + roiEnd) * ${t}(lengthOriginal - 1);
                  }`;case"half_pixel_symmetric":return`const outputWidth = ${t}xScale * ${t}(lengthResized);
                  const adjustment = ${t}(lengthResized) / outputWidth;
                  const center = ${t}(lengthOriginal) / 2;
                  const offset = center * (1 - adjustment);
                  return offset + ((${t}(xResized) + 0.5) / ${t}(xScale)) - 0.5;`;case"half_pixel":return`return ((${t}(xResized) + 0.5) / ${t}(xScale)) - 0.5;`;default:throw new Error(`Coordinate transform mode ${e} is not supported`)}})()+"}",sc=(e,t,r)=>`fn getNearestPixelFromOriginal(xOriginal: ${r}, isDownSample: bool) -> ${r} {`+(()=>{switch(e){case"round_prefer_ceil":return"if (fract(xOriginal) == 0.5) {             return ceil(xOriginal);           } else {             return round(xOriginal);           }";case"floor":return"return floor(xOriginal);";case"ceil":return"return ceil(xOriginal);";case"round_prefer_floor":return"if (fract(xOriginal) == 0.5) {                     return floor(xOriginal);                   } else {                     return round(xOriginal);                   }";default:if(t<11)return"if (isDownSample)                     {                       return ceil(xOriginal);                     } else {                       return xOriginal;                     }";throw new Error(`Nearest mode ${e} is not supported`)}})()+"}",oc=(e,t,r)=>{let a=new Array(r).fill(0).concat(new Array(r).fill(1)),n=e.length===0?a:e.slice();return t.length>0?(t.forEach((i,s)=>{a[i]=n[s],a[s+r]=n[t.length+s]}),a):n},uc=(e,t,r,a)=>{let n=[];if(r.length>0)if(a.length>0){if(e.forEach(i=>n.push(i)),Math.max(...a)>e.length)throw new Error("axes is out of bound");a.forEach((i,s)=>n[i]=r[s])}else r.forEach(i=>n.push(i));else{if(t.length===0)throw new Error("Resize requires either scales or sizes.");n=e.map((i,s)=>Math.round(i*t[s]))}return n},lc=(e,t,r)=>{let a=(()=>{switch(r.keepAspectRatioPolicy){case"not_larger":return r.axes.length>0?Math.min(...r.axes.map(i=>t[i]),Number.MAX_VALUE):Math.min(...t,Number.MAX_VALUE);case"not_smaller":return r.axes.length>0?Math.max(...r.axes.map(i=>t[i]),Number.MIN_VALUE):Math.max(...t,Number.MIN_VALUE);default:throw new Error(`Keep aspect ratio policy ${r.keepAspectRatioPolicy} is not supported`)}})();t.fill(1,0,t.length);let n=e.slice();return r.axes.length>0?(r.axes.forEach(i=>t[i]=a),r.axes.forEach(i=>n[i]=Math.round(e[i]*t[i]))):(t.fill(a,0,t.length),n.forEach((i,s)=>n[s]=Math.round(i*t[s]))),n},dc=(e,t,r,a,n)=>`
    fn calculateOriginalIndicesFromOutputIndices(output_indices: ${e.type.indices}) -> array<${e.type.value}, ${r.length}> {
      var original_indices: array<${e.type.value}, ${r.length}>;
      for (var i:u32 = 0; i < ${r.length}; i++) {
        var output_index = ${e.indicesGet("output_indices","i")};
        var scale = ${X("uniforms.scales","i",a)};
        var roi_low = ${X("uniforms.roi","i",n)};
        var roi_hi = ${X("uniforms.roi",`i + ${t.length}`,n)};
        if (scale == 1.0) {
          original_indices[i] = ${e.type.value}(output_index);
        } else {
          var input_shape_i = ${X("uniforms.input_shape","i",t.length)};
          var output_shape_i = ${X("uniforms.output_shape","i",r.length)};
          original_indices[i] = getOriginalCoordinateFromResizedCoordinate(output_index, scale, output_shape_i,
                                                                           input_shape_i, roi_low, roi_hi);
        }
      }
      return original_indices;
    }`,cc=(e,t,r,a,n,i,s)=>`
    fn calculateInputIndicesFromOutputIndices(output_indices: ${t.type.indices}) -> ${e.type.indices} {
      var input_indices: ${e.type.indices};
      for (var i:u32 = 0; i < ${a.length}; i++) {
        var output_index = ${t.indicesGet("output_indices","i")};
        var input_index: u32;
        var scale = ${X("uniforms.scales","i",n)};
        if (scale == 1.0) {
          input_index = output_index;
        } else {
          var roi_low = ${X("uniforms.roi","i",i)};
          var roi_hi = ${X("uniforms.roi",`i + ${r.length}`,i)};
          var input_shape_i = ${X("uniforms.input_shape","i",r.length)};
          var output_shape_i = ${X("uniforms.output_shape","i",a.length)};
          var original_idx = getOriginalCoordinateFromResizedCoordinate(output_index, scale, output_shape_i,
                                                                        input_shape_i, roi_low, roi_hi);
          if (!${s} || (original_idx >= 0 && original_idx < ${t.type.value}(input_shape_i))) {
            if (original_idx < 0) {
              input_index = 0;
            } else if (original_idx > ${t.type.value}(input_shape_i - 1)) {
              input_index = input_shape_i - 1;
            } else {
              input_index = u32(getNearestPixelFromOriginal(original_idx, scale < 1));
            }
          } else {
            input_index = u32(original_idx);
          }
        }
        ${e.indicesSet("input_indices","i","input_index")}
      }
      return input_indices;
    }`,pc=(e,t)=>`
    fn checkInputIndices(input_indices: ${e.type.indices}) -> bool {
      for (var i:u32 = 0; i < ${t.length}; i++) {
        var input_index = ${e.indicesGet("input_indices","i")};
        if (input_index < 0 || input_index >= ${X("uniforms.input_shape","i",t.length)}) {
          return false;
        }
      }
      return true;
    }`,$i=(e,t,r,a)=>e.rank>a?`
    ${e.indicesSet("input_indices",t,"channel")};
    ${e.indicesSet("input_indices",r,"batch")};
`:"",hc=(e,t,r,a,n)=>{let[i,s,o,d]=r.length===2?[-1,0,1,-1]:[0,2,3,1],c=e.type.value;return`
    fn getInputValue(batch: u32, channel: u32, row: u32, col: u32) -> ${c} {
      var input_indices: ${e.type.indices};
      ${e.indicesSet("input_indices",s,`max(0, min(row, ${r[s]} - 1))`)};
      ${e.indicesSet("input_indices",o,`max(0, min(col, ${r[o]} - 1))`)};
      ${$i(e,d,i,2)}
      return ${e.getByIndices("input_indices")};
    }

    fn bilinearInterpolation(output_indices: ${t.type.indices}) -> ${c} {
      var originalIndices = calculateOriginalIndicesFromOutputIndices(output_indices);
      var row:${c} = originalIndices[${s}];
      var col:${c} = originalIndices[${o}];
      ${a?`if (row < 0 || row > (${r[s]} - 1) || col < 0 || col > (${r[o]} - 1)) {
        return ${n};
      }`:""};
      row = max(0, min(row, ${r[s]} - 1));
      col = max(0, min(col, ${r[o]} - 1));
      var row1: u32 = u32(row);
      var col1: u32 = u32(col);
      var row2: u32 = u32(row + 1);
      var col2: u32 = u32(col + 1);
      var channel: u32 = ${r.length>2?`u32(originalIndices[${d}])`:"0"};
      var batch: u32 =  ${r.length>2?`u32(originalIndices[${i}])`:"0"};
      var x11: ${c} = getInputValue(batch, channel, row1, col1);
      var x12: ${c} = getInputValue(batch, channel, row1, col2);
      var x21: ${c} = getInputValue(batch, channel, row2, col1);
      var x22: ${c} = getInputValue(batch, channel, row2, col2);
      var dx1: ${c} = abs(row - ${c}(row1));
      var dx2: ${c} = abs(${c}(row2) - row);
      var dy1: ${c} = abs(col - ${c}(col1));
      var dy2: ${c} = abs(${c}(col2) - col);
      if (row1 == row2) {
        dx1 = 0.5;
        dx2 = 0.5;
      }
      if (col1 == col2) {
        dy1 = 0.5;
        dy2 = 0.5;
      }
      return (x11 * dx2 * dy2 + x12 * dx2 * dy1 + x21 * dx1 * dy2 + x22 * dx1 * dy1);
    }`},fc=(e,t,r,a,n,i,s,o,d,c)=>{let h=r.length===2,[u,f]=h?[0,1]:[2,3],m=e.type.value,_=g=>{let w=g===u?"row":"col";return`
      fn ${w}CubicInterpolation(input_indices: ${e.type.indices}, output_indices: ${t.type.indices}) -> ${m} {
        var output_index = ${t.indicesGet("output_indices",g)};
        var originalIdx: ${m} = getOriginalCoordinateFromResizedCoordinate(output_index, ${n[g]},
        ${a[g]}, ${r[g]}, ${i[g]}, ${i[g]} + ${r.length});
        var fractOriginalIdx: ${m} = originalIdx - floor(originalIdx);
        var coefs = getCubicInterpolationCoefs(fractOriginalIdx);

        if (${o} && (originalIdx < 0 || originalIdx > (${r[g]} - 1))) {
          return ${d};
        }
        var data: array<${m}, 4> = array<${m}, 4>(0.0, 0.0, 0.0, 0.0);
        for (var i: i32 = -1; i < 3; i++) {
          var ${w}: ${m} = originalIdx + ${m}(i);
          if (${w} < 0 || ${w} >= ${r[g]}) {
            ${c?`coefs[i + 1] = 0.0;
                        continue;`:o?`return ${d};`:`${w} = max(0, min(${w}, ${r[g]} - 1));`};
          }
        var input_indices_copy: ${e.type.indices} = input_indices;
          ${e.indicesSet("input_indices_copy",g,`u32(${w})`)};
          data[i + 1] = ${g===u?e.getByIndices("input_indices_copy"):"rowCubicInterpolation(input_indices_copy, output_indices)"};
        }
        return cubicInterpolation1D(data, coefs);
      }`};return`
    ${_(u)};
    ${_(f)};
  fn getCubicInterpolationCoefs(s: ${m}) -> array<${m}, 4> {
    var absS = abs(s);
    var coeffs: array<${m}, 4> = array<${m}, 4>(0.0, 0.0, 0.0, 0.0);
    var oneMinusAbsS: ${m} = 1.0 - absS;
    var twoMinusAbsS: ${m} = 2.0 - absS;
    var onePlusAbsS: ${m} = 1.0 + absS;
    coeffs[0] = ((${s} * onePlusAbsS - 5 * ${s}) * onePlusAbsS + 8 * ${s}) * onePlusAbsS - 4 * ${s};
    coeffs[1] = ((${s} + 2) * absS - (${s} + 3)) * absS * absS + 1;
    coeffs[2] = ((${s} + 2) * oneMinusAbsS - (${s} + 3)) * oneMinusAbsS * oneMinusAbsS + 1;
    coeffs[3] = ((${s} * twoMinusAbsS - 5 * ${s}) * twoMinusAbsS + 8 * ${s}) * twoMinusAbsS - 4 * ${s};
    return coeffs;
  }

  fn cubicInterpolation1D(x: array<${m}, 4>, coefs: array<${m}, 4>) -> ${m} {
    var coefsSum: ${m} = coefs[0] + coefs[1] + coefs[2] + coefs[3];
    return (x[0] * coefs[0] + x[1] * coefs[1]+ x[2] * coefs[2]+ x[3] * coefs[3]) / coefsSum;
  }

  fn bicubicInterpolation(output_indices: ${t.type.indices}) -> ${m} {
    var input_indices: ${e.type.indices} = output_indices;
    return colCubicInterpolation(input_indices, output_indices);
  }
    `},mc=(e,t,r,a,n)=>{let[i,s,o,d,c]=r.length===3?[-1,0,1,2,-1]:[0,2,3,4,1],h=e.type.value;return`
    fn getInputValue(batch: u32, channel: u32, depth:u32, height: u32, width: u32) -> ${h} {
      var input_indices: ${e.type.indices};
      ${e.indicesSet("input_indices",s,`max(0, min(depth, ${r[s]} - 1))`)};
      ${e.indicesSet("input_indices",o,`max(0, min(height, ${r[o]} - 1))`)};
      ${e.indicesSet("input_indices",d,`max(0, min(width, ${r[d]} - 1))`)};
      ${$i(e,c,i,3)}
      return ${e.getByIndices("input_indices")};
    }

    fn trilinearInterpolation(output_indices: ${t.type.indices}) -> ${h} {
      var originalIndices = calculateOriginalIndicesFromOutputIndices(output_indices);
      var depth:${h} = originalIndices[${s}];
      var height:${h} = originalIndices[${o}];
      var width:${h} = originalIndices[${d}];
      ${a?`if (depth < 0 || depth > (${r[s]} - 1) || height < 0 || height > (${r[o]} - 1) || width < 0 || (width > ${r[d]} - 1)) {
      return ${n};
        }`:""};

    depth = max(0, min(depth, ${r[s]} - 1));
      height = max(0, min(height, ${r[o]} - 1));
      width = max(0, min(width, ${r[d]} - 1));
      var depth1: u32 = u32(depth);
      var height1: u32 = u32(height);
      var width1: u32 = u32(width);
      var depth2: u32 = u32(depth + 1);
      var height2: u32 = u32(height + 1);
      var width2: u32 = u32(width + 1);
      var channel: u32 = ${r.length>3?`u32(originalIndices[${c}])`:"0"};
      var batch: u32 =  ${r.length>3?`u32(originalIndices[${i}])`:"0"};

      var x111: ${h} = getInputValue(batch, channel, depth1, height1, width1);
      var x112: ${h} = getInputValue(batch, channel, depth1, height1, width2);
      var x121: ${h} = getInputValue(batch, channel, depth1, height2, width1);
      var x122: ${h} = getInputValue(batch, channel, depth1, height2, width2);
      var x211: ${h} = getInputValue(batch, channel, depth2, height1, width1);
      var x212: ${h} = getInputValue(batch, channel, depth2, height1, width2);
      var x221: ${h} = getInputValue(batch, channel, depth2, height2, width1);
      var x222: ${h} = getInputValue(batch, channel, depth2, height2, width2);
      var dx1: ${h} = abs(depth - ${h}(depth1));
      var dx2: ${h} = abs(${h}(depth2) - depth);
      var dy1: ${h} = abs(height - ${h}(height1));
      var dy2: ${h} = abs(${h}(height2) - height);
      var dz1: ${h} = abs(width - ${h}(width1));
      var dz2: ${h} = abs(${h}(width2) - width);
      if (depth1 == depth2) {
        dx1 = 0.5;
        dx2 = 0.5;
      }
      if (height1 == height2) {
        dy1 = 0.5;
        dy2 = 0.5;
      }
      if (width1 == width2) {
        dz1 = 0.5;
        dz2 = 0.5;
      }
      return (x111 * dx2 * dy2 * dz2 + x112 * dx2 * dy2 * dz1 + x121 * dx2 * dy1 *dz2 + x122 * dx2 * dy1 * dz1 +
              x211 * dx1 * dy2 * dz2 + x212 * dx1 * dy2 * dz1 + x221 * dx1 * dy1 *dz2 + x222 * dx1 * dy1 * dz1);
    }`},gc=(e,t,r,a,n,i)=>{let s=e.dims,o=oc(i,t.axes,s.length),d=uc(s,a,n,t.axes),c=a.slice();a.length===0&&(c=s.map((b,k)=>b===0?1:d[k]/b),t.keepAspectRatioPolicy!=="stretch"&&(d=lc(s,c,t)));let h=Y("output",e.dataType,d.length),u=M("input",e.dataType,s.length),f=z.size(d),m=s.length===d.length&&s.every((b,k)=>b===d[k]),_=t.coordinateTransformMode==="tf_crop_and_resize",g=t.extrapolationValue,w=u.type.value,x=b=>`
      ${m?"":`
      ${ic(t.coordinateTransformMode,w)};
      ${(()=>{switch(t.mode){case"nearest":return`
              ${pc(u,s)};
              ${sc(t.nearestMode,r,w)};
              ${cc(u,h,s,d,c.length,o.length,_)};
              `;case"linear":return`
              ${dc(h,s,d,c.length,o.length)};
              ${(()=>{if(s.length===2||s.length===4)return`${hc(u,h,s,_,g)}`;if(s.length===3||s.length===5)return`${mc(u,h,s,_,g)}`;throw Error("Linear mode only supports input dims 2, 3, 4 and 5 are supported in linear mode.")})()};
            `;case"cubic":return`
            ${(()=>{if(s.length===2||s.length===4)return`${fc(u,h,s,d,c,o,t.cubicCoeffA,_,t.extrapolationValue,t.excludeOutside)}`;throw Error("Cubic mode only supports input dims 2 and 4 are supported in linear mode.")})()};
            `;default:throw Error("Invalid resize mode")}})()};
      `}
      ${b.registerUniform("output_size","u32").registerUniform("scales","f32",c.length).registerUniform("roi","f32",o.length).declareVariables(u,h)}
      ${b.mainStart()}
        ${b.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.output_size")}
        ${m?"output[global_idx] = input[global_idx];":`
        let output_indices = ${h.offsetToIndices("global_idx")};
        var input_indices: ${u.type.indices};
        ${(()=>{switch(t.mode){case"nearest":return`input_indices = calculateInputIndicesFromOutputIndices(output_indices);
                if (checkInputIndices(input_indices)) {
                  output[global_idx] = ${u.getByIndices("input_indices")};
                } else {
                  output[global_idx] = ${t.extrapolationValue};
                }`;case"linear":return`output[global_idx] = ${s.length===2||s.length===4?"bilinearInterpolation":"trilinearInterpolation"}(output_indices);`;case"cubic":return"output[global_idx] = bicubicInterpolation(output_indices);";default:throw Error(`Unsupported resize mode: ${t.mode}`)}})()};
`}
      }`;return{name:"Resize",shaderCache:{hint:`${t.cacheKey}|${r}|${c.length>0?t.mode==="cubic"?c:c.length:""}|${n.length>0?n:""}|${o.length>0?o:""}|${m}|${t.mode==="nearest"?s.length:s}`,inputDependencies:["rank"]},getShaderSource:x,getRunData:()=>({outputs:[{dims:d,dataType:e.dataType}],dispatchGroup:{x:Math.ceil(f/64)},programUniforms:[{type:12,data:f},{type:1,data:c},{type:1,data:o},...ee(s,d)]})}},yc=e=>{let t=e.customDataBuffer;return new Uint32Array(t,t.byteOffset,1)[0]},lm=(e,t)=>{let r=[],a=[],n=[],i=yc(e);if(t.antialias!==0)throw Error("Only default value (0) for Antialias attribute is supported");nc(e.inputs,t,i,r,a,n),e.compute(gc(e.inputs[0],t,i,r,a,n),{inputs:[0]})},dm=e=>{let t=e.antialias,r=e.axes,a=e.coordinateTransformMode,n=e.cubicCoeffA,i=e.excludeOutside!==0,s=e.extrapolationValue,o=e.keepAspectRatioPolicy,d=e.mode,c=e.nearestMode===""?"simple":e.nearestMode;return xe({antialias:t,axes:r,coordinateTransformMode:a,cubicCoeffA:n,excludeOutside:i,extrapolationValue:s,keepAspectRatioPolicy:o,mode:d,nearestMode:c})}}),_c,vc,cm,q_=j(()=>{ie(),le(),ze(),de(),_c=(e,t)=>{let[r,a,n,i]=e,{numHeads:s,rotaryEmbeddingDim:o}=t;if(r.dims.length!==3&&r.dims.length!==4)throw new Error(`Input 'x' is expected to have 3 or 4 dimensions, got ${r.dims.length}`);if(!z.areEqual(a.dims,[])&&!z.areEqual(a.dims,[1])&&a.dims.length!==2)throw new Error(`Input 'position_ids' is expected to have 0, 1, or 2 dimensions, got ${a.dims.length}`);if(n.dims.length!==2)throw new Error(`Input 'cos_cache' is expected to have 2 dimensions, got ${n.dims.length}`);if(i.dims.length!==2)throw new Error(`Input 'sin_cache' is expected to have 2 dimensions, got ${i.dims.length}`);if(!z.areEqual(n.dims,i.dims))throw new Error("Inputs 'cos_cache' and 'sin_cache' are expected to have the same shape");if(o>0&&s===0)throw new Error("num_heads must be provided if rotary_embedding_dim is specified");let d=r.dims[0],c=r.dims[r.dims.length-2],h=n.dims[0],u=z.sizeFromDimension(r.dims,1)/c,f=o===0?n.dims[1]*2:u/s;if(o>f)throw new Error("rotary_embedding_dim must be less than or equal to head_size");if(a.dims.length===2){if(d!==a.dims[0])throw new Error(`Input 'position_ids' dimension 0 should be of size batch_size, got ${a.dims[0]}`);if(c!==a.dims[1])throw new Error(`Input 'position_ids' dimension 1 should be of size sequence_length, got ${a.dims[1]}`)}if(f/2!==n.dims[1]&&o/2!==n.dims[1])throw new Error(`Input 'cos_cache' dimension 1 should be same as head_size / 2 or rotary_embedding_dim / 2, got ${n.dims[1]}`);if(c>h)throw new Error("Updating cos_cache and sin_cache in RotaryEmbedding is not currently supported")},vc=(e,t)=>{let{interleaved:r,numHeads:a,rotaryEmbeddingDim:n,scale:i}=t,s=e[0].dims[0],o=z.sizeFromDimension(e[0].dims,1),d=e[0].dims[e[0].dims.length-2],c=o/d,h=e[2].dims[1],u=n===0?h*2:c/a,f=new Array(s,d,c/u,u-h),m=z.computeStrides(f),_=[{type:1,data:i},{type:12,data:f},{type:12,data:m},...e[0].dims.length===3?new Array({type:12,data:[o,c,u,1]}):[],...e[0].dims.length===4?new Array({type:12,data:[o,u,d*u,1]}):[],...ee(e[0].dims,e[1].dims,e[2].dims,e[3].dims,e[0].dims)],g=w=>{let x=M("input",e[0].dataType,e[0].dims.length),b=M("position_ids",e[1].dataType,e[1].dims.length),k=M("cos_cache",e[2].dataType,e[2].dims.length),S=M("sin_cache",e[3].dataType,e[3].dims.length),T=Y("output",e[0].dataType,e[0].dims.length);return w.registerUniforms([{name:"scale",type:"f32"},{name:"global_shape",type:"u32",length:f.length},{name:"global_strides",type:"u32",length:m.length},{name:"input_output_strides",type:"u32",length:m.length}]),`
        ${w.declareVariables(x,b,k,S,T)}

        ${w.mainStart(hr)}
          let half_rotary_emb_dim = uniforms.${k.name}_shape[1];
          let bsnh = global_idx / uniforms.global_strides % uniforms.global_shape;
          let size = uniforms.global_shape[0] * uniforms.global_strides[0];
          ${w.guardAgainstOutOfBoundsWorkgroupSizes("size")}

          if (bsnh[3] < half_rotary_emb_dim) {
            let position_ids_idx =
                ${b.broadcastedIndicesToOffset("bsnh.xy",Y("",b.type.tensor,2))};
            let position_id =
                u32(${b.getByOffset("position_ids_idx")}) + select(0, bsnh[1], position_ids_idx == 0);
            let i = dot(bsnh, uniforms.input_output_strides) + select(0, bsnh[3], ${r});
            let j = i + select(half_rotary_emb_dim, 1, ${r});
            let re = ${x.getByOffset("i")} * ${k.get("position_id","bsnh[3]")} -
                ${x.getByOffset("j")} * ${S.get("position_id","bsnh[3]")};
            ${T.setByOffset("i","re")}
            let im = ${x.getByOffset("i")} * ${S.get("position_id","bsnh[3]")} +
                ${x.getByOffset("j")} * ${k.get("position_id","bsnh[3]")};
            ${T.setByOffset("j","im")}
          } else {
            let k = dot(bsnh, uniforms.input_output_strides) + half_rotary_emb_dim;
            ${T.setByOffset("k",x.getByOffset("k"))}
          }
        }`};return{name:"RotaryEmbedding",shaderCache:{hint:xe({interleaved:r}).cacheKey,inputDependencies:["rank","rank","rank","rank"]},getShaderSource:g,getRunData:()=>({outputs:[{dims:e[0].dims,dataType:e[0].dataType}],dispatchGroup:{x:Math.ceil(z.size(f)/hr)},programUniforms:_})}},cm=(e,t)=>{_c(e.inputs,t),e.compute(vc(e.inputs,t))}}),bc,wc,pm,F_=j(()=>{ie(),le(),de(),bc=e=>{if(!e||e.length<3)throw new Error("layerNorm requires at least 3 inputs.");let t=e[0],r=e[1],a=e[2];if(t.dataType!==r.dataType||t.dataType!==a.dataType)throw new Error("All inputs must have the same data type");if(t.dims.length!==3&&t.dims.length!==2)throw new Error("Input must be 2D or 3D");if(r.dims.length!==3&&r.dims.length!==2)throw new Error("Skip must be 2D or 3D");let n=t.dims[t.dims.length-1],i=t.dims[t.dims.length-2];if(r.dims[r.dims.length-1]!==n)throw new Error("Skip must have the same hidden size as input");if(r.dims[r.dims.length-2]!==i)throw new Error("Skip must have the same sequence length as input");if(a.dims.length!==1)throw new Error("Gamma must be 1D");if(a.dims[a.dims.length-1]!==n)throw new Error("Gamma must have the same hidden size as input");if(e.length>3){let s=e[3];if(s.dims.length!==1)throw new Error("Beta must be 1D");if(s.dims[s.dims.length-1]!==n)throw new Error("Beta must have the same hidden size as input")}if(e.length>4){let s=e[4];if(s.dims.length!==1)throw new Error("Bias must be 1D");if(s.dims[s.dims.length-1]!==n)throw new Error("Bias must have the same hidden size as input")}},wc=(e,t,r,a)=>{let n=t.simplified,i=e[0].dims,s=z.size(i),o=i,d=s,c=i.slice(-1)[0],h=a?i.slice(0,-1).concat(1):[],u=!n&&e.length>3,f=e.length>4,m=a&&r>1,_=a&&r>2,g=r>3,w=64,x=Ee(c),b=[{type:12,data:d},{type:12,data:x},{type:12,data:c},{type:1,data:t.epsilon}],k=T=>{let E=[{name:"output_size",type:"u32"},{name:"components",type:"u32"},{name:"hidden_size",type:"u32"},{name:"epsilon",type:"f32"}],I=[M("x",e[0].dataType,e[0].dims,x),M("skip",e[1].dataType,e[1].dims,x),M("gamma",e[2].dataType,e[2].dims,x)];u&&I.push(M("beta",e[3].dataType,e[3].dims,x)),f&&I.push(M("bias",e[4].dataType,e[4].dims,x)),I.push(Y("output",e[0].dataType,o,x)),m&&I.push(Y("mean_output",1,h)),_&&I.push(Y("inv_std_output",1,h)),g&&I.push(Y("input_skip_bias_sum",e[0].dataType,o,x));let N=Ne(e[0].dataType),D=Ne(1,x);return`

      ${T.registerUniforms(E).declareVariables(...I)}
      var<workgroup> sum_shared : array<${D}, ${w}>;
      var<workgroup> sum_squared_shared : array<${D}, ${w}>;

      ${T.mainStart([w,1,1])}
        let ix = local_id.x;
        let iy = global_id.x / ${w};

        let hidden_size_vectorized: u32 = uniforms.hidden_size / uniforms.components;
        var stride = hidden_size_vectorized / ${w};
        let offset = ix * stride + iy * hidden_size_vectorized;
        let offset1d = stride * ix;
        if (ix == ${w-1}) {
          stride = hidden_size_vectorized - stride * ix;
        }
        for (var i: u32 = 0; i < stride; i++) {
          let skip_value = skip[offset + i];
          let bias_value = ${f?"bias[offset1d + i]":N+"(0.0)"};
          let input_value = x[offset + i];
          let value = input_value + skip_value + bias_value;
          ${g?"input_skip_bias_sum[offset + i] = value;":""}
          output[offset + i] = value;
          let f32_value = ${dr(N,x,"value")};
          sum_shared[ix] += f32_value;
          sum_squared_shared[ix] += f32_value * f32_value;
        }
        workgroupBarrier();

        var reduce_size : u32 = ${w};
        for (var curr_size = reduce_size >> 1;  curr_size > 0; curr_size = reduce_size >> 1) {
          reduce_size = curr_size + (reduce_size & 1);
          if (ix < curr_size) {
            sum_shared[ix] += sum_shared[ix + reduce_size];
            sum_squared_shared[ix] += sum_squared_shared[ix + reduce_size];
          }
          workgroupBarrier();
        }

        let sum = sum_shared[0];
        let square_sum = sum_squared_shared[0];
        let mean = ${Mt("sum",x)} / f32(uniforms.hidden_size);
        let inv_std_dev = inverseSqrt(${Mt("square_sum",x)} / f32(uniforms.hidden_size) ${n?"":"- mean * mean"} + uniforms.epsilon);
        ${m?"mean_output[global_idx] = mean;":""}
        ${_?"inv_std_output[global_idx] = inv_std_dev;":""}

        for (var i: u32 = 0; i < stride; i++) {
          output[offset + i] = (output[offset + i] ${n?"":`- ${N}(mean)`}) *
            ${N}(inv_std_dev) * gamma[offset1d + i]
            ${u?"+ beta[offset1d + i]":""};
        }
      }`},S=[{dims:o,dataType:e[0].dataType}];return r>1&&S.push({dims:h,dataType:1}),r>2&&S.push({dims:h,dataType:1}),r>3&&S.push({dims:i,dataType:e[0].dataType}),{name:"SkipLayerNormalization",shaderCache:{hint:`${x};${m};${_};${g}`,inputDependencies:e.map((T,E)=>"type")},getShaderSource:k,getRunData:()=>({outputs:S,dispatchGroup:{x:Math.ceil(d/c)},programUniforms:b})}},pm=(e,t)=>{bc(e.inputs);let r=[0];e.outputCount>1&&r.push(-3),e.outputCount>2&&r.push(-3),e.outputCount>3&&r.push(3),e.compute(wc(e.inputs,t,e.outputCount,!1),{outputs:r})}}),$c,zr,xc,xi,kc,Sc,hm,fm,H_=j(()=>{ie(),le(),ze(),de(),$c=(e,t)=>{if(!e||e.length<1)throw new Error("too few inputs");if(t.axes.length!==0){if(t.axes.length!==t.starts.length||t.axes.length!==t.ends.length)throw new Error("axes, starts and ends must have the same length")}else if(t.starts.length!==t.ends.length)throw new Error("starts and ends must have the same length");e.slice(1).forEach((r,a)=>{if(e[a+1].dataType!==6&&e[a+1].dataType!==7)throw new Error(`Input ${a} must be an array of int32 or int64`)})},zr=(e,t)=>{let r=[];if(e.length>t)if(e[t].dataType===7)e[t].getBigInt64Array().forEach(a=>r.push(Number(a)));else if(e[t].dataType===6)e[t].getInt32Array().forEach(a=>r.push(Number(a)));else throw new Error(`Input ${t} must be an array of int32 or int64`);return r},xc=(e,t)=>{if(e.length>1){let r=zr(e,1),a=zr(e,2),n=zr(e,3);return n.length===0&&(n=[...Array(e[0].dims.length).keys()]),xe({starts:r,ends:a,axes:n})}else return t},xi=(e,t,r,a,n)=>{let i=e;return e<0&&(i+=r[a[t]]),n[t]<0?Math.max(0,Math.min(i,r[a[t]]-1)):Math.max(0,Math.min(i,r[a[t]]))},kc=(e,t,r)=>`fn calculateInputIndices(output_indices: ${t.type.indices}) -> ${e.type.indices} {
          var input_indices: ${e.type.indices};
          var carry = 0u;
          for (var i = ${r.length}; i >= 0; i--) {
            let input_shape_i = ${X("uniforms.input_shape","i",r.length)};
            let steps_i = ${X("uniforms.steps","i",r.length)};
            let signs_i = ${X("uniforms.signs","i",r.length)};
            let starts_i = ${X("uniforms.starts","i",r.length)};
            var output_index = ${t.indicesGet("output_indices","i")};
            var input_index = output_index * steps_i + starts_i + carry;
            carry = input_index / input_shape_i;
            input_index = input_index % input_shape_i;
            if (signs_i < 0) {
              input_index = input_shape_i - input_index - 1u + starts_i;
            }
            ${e.indicesSet("input_indices","i","input_index")};
          }
          return input_indices;
      }`,Sc=(e,t)=>{let r=e[0].dims,a=z.size(r),n=t.axes.length>0?z.normalizeAxes(t.axes,r.length):[...Array(r.length).keys()],i=zr(e,4);i.forEach(x=>x!==0||(()=>{throw new Error("step cannot be 0")})),i.length===0&&(i=Array(n.length).fill(1));let s=t.starts.map((x,b)=>xi(x,b,r,n,i)),o=t.ends.map((x,b)=>xi(x,b,r,n,i));if(n.length!==s.length||n.length!==o.length)throw new Error("start, ends and axes should have the same number of elements");if(n.length!==r.length)for(let x=0;x<r.length;++x)n.includes(x)||(s.splice(x,0,0),o.splice(x,0,r[x]),i.splice(x,0,1));let d=i.map(x=>Math.sign(x));i.forEach((x,b,k)=>{if(x<0){let S=(o[b]-s[b])/x,T=s[b],E=T+S*i[b];s[b]=E,o[b]=T,k[b]=-x}});let c=r.slice(0);n.forEach((x,b)=>{c[x]=Math.ceil((o[x]-s[x])/i[x])});let h={dims:c,dataType:e[0].dataType},u=Y("output",e[0].dataType,c.length),f=M("input",e[0].dataType,e[0].dims.length),m=z.size(c),_=[{name:"outputSize",type:"u32"},{name:"starts",type:"u32",length:s.length},{name:"signs",type:"i32",length:d.length},{name:"steps",type:"u32",length:i.length}],g=[{type:12,data:m},{type:12,data:s},{type:6,data:d},{type:12,data:i},...ee(e[0].dims,c)],w=x=>`
      ${x.registerUniforms(_).declareVariables(f,u)}
        ${kc(f,u,r)}
        ${x.mainStart()}
          ${x.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.outputSize")}
          let output_indices = ${u.offsetToIndices("global_idx")};
          let input_indices = calculateInputIndices(output_indices);
          ${u.setByOffset("global_idx",f.getByIndices("input_indices"))}
      }`;return{name:"Slice",shaderCache:{hint:`${d.length}_${s.length}_${i.length}`,inputDependencies:["rank"]},getShaderSource:w,getRunData:()=>({outputs:[h],dispatchGroup:{x:Math.ceil(a/64)},programUniforms:g})}},hm=(e,t)=>{$c(e.inputs,t);let r=xc(e.inputs,t);e.compute(Sc(e.inputs,r),{inputs:[0]})},fm=e=>{let t=e.starts,r=e.ends,a=e.axes;return xe({starts:t,ends:r,axes:a})}}),Tc,Cc,mm,gm,G_=j(()=>{ie(),le(),ze(),Dt(),de(),Tc=e=>{if(!e||e.length!==1)throw new Error("Softmax op requires 1 input.")},Cc=(e,t)=>{let r=e.inputs[0],a=r.dims,n=z.size(a),i=a.length,s=z.normalizeAxis(t.axis,i),o=s<a.length-1,d,c=[];o?(c=Array.from({length:i},(I,N)=>N),c[s]=i-1,c[i-1]=s,d=e.compute(He(r,c),{inputs:[r],outputs:[-1]})[0]):d=r;let h=d.dims,u=h[i-1],f=n/u,m=Ee(u),_=u/m,g=64;f===1&&(g=256);let w=(I,N)=>N===4?`max(max(${I}.x, ${I}.y), max(${I}.z, ${I}.w))`:N===2?`max(${I}.x, ${I}.y)`:N===3?`max(max(${I}.x, ${I}.y), ${I}.z)`:I,x=M("x",d.dataType,d.dims,m),b=Y("result",d.dataType,d.dims,m),k=x.type.value,S=Ne(d.dataType)==="f32"?`var threadMax = ${k}(-3.402823e+38f);`:`var threadMax = ${k}(-65504.0h);`,T=I=>`
      var<workgroup> rowMaxShared : ${k};
      var<workgroup> rowSumShared : ${k};
      var<workgroup> threadShared : array<${k}, ${g}>;

      fn getValue(row: i32, col: i32, row_stride: i32) -> ${k} {
        let index = row * row_stride + col;
        return x[index];
      }

      fn setValue(row: i32, col: i32, row_stride: i32, value: ${k}) {
        let index = row * row_stride + col;
        result[index] = value;
      }
      ${I.registerUniform("packedCols","i32").declareVariables(x,b)}
      ${I.mainStart(g)}
        let gindex = i32(global_idx);
        let lindex = i32(local_idx);
        const wg = ${g};
        let row = gindex / wg;
        let cols = uniforms.packedCols;
        let row_stride : i32 = uniforms.packedCols;

        // find the rows max
        ${S}
        for (var col = lindex; col < cols; col += wg) {
          let value = getValue(row, col, row_stride);
          threadMax = max(threadMax, value);
        }
        if (lindex < cols) {
          threadShared[lindex] = threadMax;
        }
        workgroupBarrier();

        var reduceSize = min(cols, wg);
        for (var currSize = reduceSize >> 1;  currSize > 0; currSize = reduceSize >> 1) {
          reduceSize = currSize + (reduceSize & 1);
          if (lindex < currSize) {
            threadShared[lindex] = max(threadShared[lindex], threadShared[lindex + reduceSize]);
          }
          workgroupBarrier();
        }
        if (lindex == 0) {
          rowMaxShared = ${k}(${w("threadShared[0]",m)});
        }
        workgroupBarrier();

        // find the rows sum
        var threadSum = ${k}(0.0);
        for (var col = lindex; col < cols; col += wg) {
          let subExp = exp(getValue(row, col, row_stride) - rowMaxShared);
          threadSum += subExp;
        }
        threadShared[lindex] = threadSum;
        workgroupBarrier();

        for (var currSize = wg >> 1;  currSize > 0; currSize = currSize >> 1) {
          if (lindex < currSize) {
            threadShared[lindex] = threadShared[lindex] + threadShared[lindex + currSize];
          }
          workgroupBarrier();
        }
        if (lindex == 0) {
          rowSumShared = ${k}(${Mt("threadShared[0]",m)});
        }
        workgroupBarrier();

        // calculate final value for each element in the row
        for (var col = lindex; col < cols; col += wg) {
          let value = exp(getValue(row, col, row_stride) - rowMaxShared) / rowSumShared;
          setValue(row, col, row_stride, value);
        }
      }`,E=e.compute({name:"Softmax",shaderCache:{hint:`${m};${g}`,inputDependencies:["type"]},getRunData:()=>({outputs:[{dims:h,dataType:d.dataType}],dispatchGroup:{x:f},programUniforms:[{type:6,data:_}]}),getShaderSource:T},{inputs:[d],outputs:[o?-1:0]})[0];o&&e.compute(He(E,c),{inputs:[E]})},mm=(e,t)=>{Tc(e.inputs),Cc(e,t)},gm=e=>xe({axis:e.axis})}),ki,Ic,Ec,Ac,ym,Z_=j(()=>{ie(),le(),de(),ki=e=>Array.from(e.getBigInt64Array(),Number),Ic=e=>{if(!e||e.length!==2)throw new Error("Tile requires 2 inputs.");if(e[0].dataType!==1&&e[0].dataType!==10&&e[0].dataType!==6&&e[0].dataType!==12)throw new Error("Tile only support float, float16, int32, and uint32 data types");if(e[1].dataType!==7)throw new Error("Tile `repeats` input should be of int64 data type");if(e[1].dims.length!==1)throw new Error("Tile `repeats` input should be 1-D");if(ki(e[1]).length!==e[0].dims.length)throw new Error("Tile `repeats` input should have same number of elements as rank of input data tensor")},Ec=(e,t)=>{let r=[];for(let a=0;a<e.length;++a)r.push(e[a]*t[a]);return r},Ac=(e,t)=>{let r=e[0].dims,a=t??ki(e[1]),n=Ec(r,a),i=z.size(n),s=e[0].dataType,o=M("input",s,r.length),d=Y("output",s,n.length),c=h=>`
      const inputShape = ${o.indices(...r)};
      ${h.registerUniform("output_size","u32").declareVariables(o,d)}
      ${h.mainStart()}
      ${h.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.output_size")}
      let output_indices = ${d.offsetToIndices("global_idx")};
      var input_indices: ${o.type.indices};
      for (var i = 0; i < ${r.length}; i++) {
        let input_dim_i = ${o.indicesGet("uniforms.input_shape","i")};
        let input_dim_value = ${d.indicesGet("output_indices","i")}  % input_dim_i;

        ${o.indicesSet("input_indices","i","input_dim_value")}
      }
      ${d.setByOffset("global_idx",o.getByIndices("input_indices"))}
    }`;return{name:"Tile",shaderCache:{hint:`${a}`,inputDependencies:["rank"]},getRunData:()=>({outputs:[{dims:n,dataType:e[0].dataType}],dispatchGroup:{x:Math.ceil(i/64)},programUniforms:[{type:12,data:i},...ee(e[0].dims,n)]}),getShaderSource:c}},ym=e=>{Ic(e.inputs),e.compute(Ac(e.inputs),{inputs:[0]})}}),zc,Oc,_m,K_=j(()=>{ie(),le(),de(),zc=(e,t,r,a,n)=>{let i=Y("output_data",n,r.length,4),s=M("a_data",t[1].dataType,t[1].dims.length,4),o=M("b_data",t[2].dataType,t[2].dims.length,4),d=M("c_data",t[0].dataType,t[0].dims.length,4),c,h=(u,f,m)=>`select(${f}, ${u}, ${m})`;if(!a)c=i.setByOffset("global_idx",h(s.getByOffset("global_idx"),o.getByOffset("global_idx"),d.getByOffset("global_idx")));else{let u=(f,m,_="")=>{let g=`a_data[index_a${m}][component_a${m}]`,w=`b_data[index_b${m}][component_b${m}]`,x=`bool(c_data[index_c${m}] & (0xffu << (component_c${m} * 8)))`;return`
            let output_indices${m} = ${i.offsetToIndices(`global_idx * 4u + ${m}u`)};
            let offset_a${m} = ${s.broadcastedIndicesToOffset(`output_indices${m}`,i)};
            let offset_b${m} = ${o.broadcastedIndicesToOffset(`output_indices${m}`,i)};
            let offset_c${m} = ${d.broadcastedIndicesToOffset(`output_indices${m}`,i)};
            let index_a${m} = offset_a${m} / 4u;
            let index_b${m} = offset_b${m} / 4u;
            let index_c${m} = offset_c${m} / 4u;
            let component_a${m} = offset_a${m} % 4u;
            let component_b${m} = offset_b${m} % 4u;
            let component_c${m} = offset_c${m} % 4u;
            ${f}[${m}] = ${_}(${h(g,w,x)});
          `};n===9?c=`
            var data = vec4<u32>(0);
            ${u("data",0,"u32")}
            ${u("data",1,"u32")}
            ${u("data",2,"u32")}
            ${u("data",3,"u32")}
            output_data[global_idx] = dot(vec4<u32>(0x1, 0x100, 0x10000, 0x1000000), vec4<u32>(data));`:c=`
            ${u("output_data[global_idx]",0)}
            ${u("output_data[global_idx]",1)}
            ${u("output_data[global_idx]",2)}
            ${u("output_data[global_idx]",3)}
          `}return`
        ${e.registerUniform("vec_size","u32").declareVariables(d,s,o,i)}
        ${e.mainStart()}
        ${e.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.vec_size")}
        ${c}
      }`},Oc=e=>{let t=e[1].dims,r=e[2].dims,a=e[0].dims,n=e[1].dataType,i=!(z.areEqual(t,r)&&z.areEqual(r,a)),s=t,o=z.size(t);if(i){let c=pr.calcShape(pr.calcShape(t,r,!1),a,!1);if(!c)throw new Error("Can't perform where op on the given tensors");s=c,o=z.size(s)}let d=Math.ceil(o/4);return{name:"Where",shaderCache:{inputDependencies:["rank","rank","rank"]},getShaderSource:c=>zc(c,e,s,i,n),getRunData:()=>({outputs:[{dims:s,dataType:n}],dispatchGroup:{x:Math.ceil(o/64/4)},programUniforms:[{type:12,data:d},...ee(a,t,r,s)]})}},_m=e=>{e.compute(Oc(e.inputs))}}),vm,Q_=j(()=>{l_(),Ts(),d_(),c_(),p_(),h_(),f_(),v_(),w_(),$_(),x_(),k_(),S_(),T_(),C_(),I_(),E_(),A_(),z_(),O_(),R_(),M_(),N_(),B_(),D_(),Uf(),P_(),U_(),j_(),L_(),V_(),Ss(),W_(),q_(),F_(),H_(),G_(),Vf(),Z_(),Dt(),Cs(),K_(),vm=new Map([["Abs",[ph]],["Acos",[hh]],["Acosh",[fh]],["Add",[Zh]],["ArgMax",[uh,Wi]],["ArgMin",[oh,Wi]],["Asin",[mh]],["Asinh",[gh]],["Atan",[yh]],["Atanh",[_h]],["Attention",[lh]],["AveragePool",[Yf,Qf]],["BatchNormalization",[dh]],["BiasAdd",[ch]],["BiasSplitGelu",[Gh]],["Cast",[bh,vh]],["Ceil",[$h]],["Clip",[wh]],["Concat",[nf,sf]],["Conv",[Ki,Zi]],["ConvTranspose",[gf,mf]],["Cos",[xh]],["Cosh",[kh]],["CumSum",[yf,_f]],["DepthToSpace",[vf,bf]],["DequantizeLinear",[nm,im]],["Div",[Kh]],["Einsum",[wf,$f]],["Elu",[Sh,Ur]],["Equal",[Qh]],["Erf",[Th]],["Exp",[Ch]],["Expand",[xf]],["FastGelu",[kf]],["Floor",[Ih]],["FusedConv",[Ki,Zi]],["Gather",[Tf,Sf]],["GatherElements",[Of,zf]],["GatherBlockQuantized",[Ef,Af]],["GatherND",[Cf,If]],["Gelu",[Eh]],["Gemm",[Mf,Rf]],["GlobalAveragePool",[Xf,Jf]],["GlobalMaxPool",[am,rm]],["Greater",[ef]],["GreaterOrEqual",[rf]],["GridSample",[Nf,Bf]],["GroupQueryAttention",[Wf]],["HardSigmoid",[Dh,Bh]],["InstanceNormalization",[qf]],["LayerNormalization",[Ff]],["LeakyRelu",[Ah,Ur]],["Less",[tf]],["LessOrEqual",[af]],["Log",[Fh]],["MatMul",[Hf]],["MatMulNBits",[Gf,Zf]],["MaxPool",[em,tm]],["Mul",[Yh]],["MultiHeadAttention",[Pf,Df]],["Neg",[Oh]],["Not",[zh]],["Pad",[Kf]],["Pow",[Jh]],["QuickGelu",[Hh,Ur]],["Range",[sm]],["Reciprocal",[Rh]],["ReduceMin",[rh]],["ReduceMean",[Yp]],["ReduceMax",[th]],["ReduceSum",[nh]],["ReduceProd",[ah]],["ReduceL1",[Jp]],["ReduceL2",[Xp]],["ReduceLogSum",[sh]],["ReduceLogSumExp",[eh]],["ReduceSumSquare",[ih]],["Relu",[Mh]],["Resize",[lm,dm]],["RotaryEmbedding",[cm]],["ScatterND",[um,om]],["Sigmoid",[Nh]],["Sin",[Ph]],["Sinh",[Uh]],["Slice",[hm,fm]],["SkipLayerNormalization",[pm]],["Split",[jf,Lf]],["Sqrt",[jh]],["Softmax",[mm,gm]],["Sub",[Xh]],["Tan",[Lh]],["Tanh",[Vh]],["ThresholdedRelu",[qh,Ur]],["Tile",[ym]],["Transpose",[Up,jp]],["Where",[_m]]])}),bm,Y_=j(()=>{ut(),xt(),de(),bm=class{constructor(e){this.backend=e,this.repo=new Map,this.attributesBound=!1}getArtifact(e){return this.repo.get(e)}setArtifact(e,t){this.repo.set(e,t)}run(e,t,r,a,n){st(e.programInfo.name);let i=this.backend.device,s=this.backend.getComputePassEncoder();this.backend.writeTimestamp(this.backend.pendingDispatchNumber*2);let o=[];for(let c of t)o.push({binding:o.length,resource:{buffer:c.buffer}});for(let c of r)o.push({binding:o.length,resource:{buffer:c.buffer}});n&&o.push({binding:o.length,resource:n});let d=i.createBindGroup({layout:e.computePipeline.getBindGroupLayout(0),entries:o,label:e.programInfo.name});if(this.backend.sessionStatus==="capturing"){let c={kernelId:this.backend.currentKernelId,computePipeline:e.computePipeline,bindGroup:d,dispatchGroup:a};this.backend.capturedCommandList.get(this.backend.currentSessionId).push(c)}s.setPipeline(e.computePipeline),s.setBindGroup(0,d),s.dispatchWorkgroups(...a),this.backend.writeTimestamp(this.backend.pendingDispatchNumber*2+1),this.backend.pendingDispatchNumber++,(this.backend.pendingDispatchNumber>=this.backend.maxDispatchNumber||this.backend.queryType==="at-passes")&&this.backend.endComputePass(),this.backend.pendingDispatchNumber>=this.backend.maxDispatchNumber&&this.backend.flush(),Qe(e.programInfo.name)}dispose(){}build(e,t){st(e.name);let r=this.backend.device,a=[];[{feature:"shader-f16",extension:"f16"},{feature:"subgroups",extension:"subgroups"},{feature:"subgroups-f16",extension:"subgroups_f16"}].forEach(c=>{r.features.has(c.feature)&&a.push(`enable ${c.extension};`)});let n=Pp(t,this.backend.device.limits),i=e.getShaderSource(n),s=`${a.join(`
`)}
${n.additionalImplementations}
${i}`,o=r.createShaderModule({code:s,label:e.name});$e("verbose",()=>`[WebGPU] ${e.name} shader code: ${s}`);let d=r.createComputePipeline({compute:{module:o,entryPoint:"main"},layout:"auto",label:e.name});return Qe(e.name),{programInfo:e,computePipeline:d,uniformVariablesInfo:n.variablesInfo}}normalizeDispatchGroupSize(e){let t=typeof e=="number"?e:e.x,r=typeof e=="number"?1:e.y||1,a=typeof e=="number"?1:e.z||1,n=this.backend.device.limits.maxComputeWorkgroupsPerDimension;if(t<=n&&r<=n&&a<=n)return[t,r,a];let i=t*r*a,s=Math.ceil(Math.sqrt(i));if(s>n){if(s=Math.ceil(Math.cbrt(i)),s>n)throw new Error("Total dispatch size exceeds WebGPU maximum.");return[s,s,s]}else return[s,s,1]}}}),Rc,Mc,Nc,Bc,wm,J_=j(()=>{ut(),ie(),xt(),Op(),o_(),Q_(),Y_(),Rc=(e,t)=>{if(t.length!==e.length)throw new Error(`inputDependencies length ${t.length} is not equal to inputTensors length ${e.length}.`);let r=[];for(let a=0;a<e.length;++a){let n=e[a].dataType;switch(t[a]){case"none":{r.push("");break}case"type":{r.push(`${n}`);break}case"rank":{let i=e[a].dims.length;r.push(`${n};${i}`);break}case"dims":{let i=e[a].dims.join(",");r.push(`${n};${i}`);break}default:throw new Error(`unsupported input dependency: ${t[a]}`)}}return r.join("|")},Mc=(e,t,r)=>{let a=e.name;return e.shaderCache?.hint&&(a+="["+e.shaderCache.hint+"]"),a+=":"+r+`:${Rc(t,e.shaderCache?.inputDependencies??new Array(t.length).fill("dims"))}`,a},Nc=class{constructor(e){e&&(this.architecture=e.architecture,this.vendor=e.vendor)}isArchitecture(e){return this.architecture===e}isVendor(e){return this.vendor===e}},Bc=class{constructor(e){this.subgroupsSupported=e.features.has("subgroups"),this.subgroupsF16Supported=e.features.has("subgroups");let t=e.limits;!this.subgroupsSupported||!t.minSubgroupSize||!t.maxSubgroupSize?this.subgroupSizeRange=void 0:this.subgroupSizeRange=[t.minSubgroupSize,t.maxSubgroupSize]}},wm=class{constructor(){this.currentSessionId=null,this.currentKernelId=null,this.commandEncoder=null,this.computePassEncoder=null,this.maxDispatchNumber=16,this.pendingDispatchNumber=0,this.pendingKernels=[],this.pendingQueries=new Map,this.sessionStatus="default",this.capturedCommandList=new Map,this.capturedPendingKernels=new Map,this.sessionExternalDataMapping=new Map}get currentKernelCustomData(){if(this.currentKernelId===null)throw new Error("currentKernelCustomData(): currentKernelId is null. (should not happen)");let e=this.kernelCustomData.get(this.currentKernelId);return e||(e={},this.kernelCustomData.set(this.currentKernelId,e)),e}async initialize(e,t){this.env=e;let r=[],a={requiredLimits:{maxComputeWorkgroupStorageSize:t.limits.maxComputeWorkgroupStorageSize,maxComputeWorkgroupsPerDimension:t.limits.maxComputeWorkgroupsPerDimension,maxStorageBufferBindingSize:t.limits.maxStorageBufferBindingSize,maxBufferSize:t.limits.maxBufferSize,maxComputeInvocationsPerWorkgroup:t.limits.maxComputeInvocationsPerWorkgroup,maxComputeWorkgroupSizeX:t.limits.maxComputeWorkgroupSizeX,maxComputeWorkgroupSizeY:t.limits.maxComputeWorkgroupSizeY,maxComputeWorkgroupSizeZ:t.limits.maxComputeWorkgroupSizeZ},requiredFeatures:r},n=i=>t.features.has(i)&&r.push(i)&&!0;n("chromium-experimental-timestamp-query-inside-passes")||n("timestamp-query"),n("shader-f16"),n("subgroups")&&n("subgroups-f16"),this.device=await t.requestDevice(a),this.deviceInfo=new Bc(this.device),this.adapterInfo=new Nc(t.info||await t.requestAdapterInfo()),this.gpuDataManager=Rp(this),this.programManager=new bm(this),this.kernels=new Map,this.kernelPersistentData=new Map,this.kernelCustomData=new Map,ws(e.logLevel,!!e.debug),this.device.onuncapturederror=i=>{i.error instanceof GPUValidationError&&console.error(`An uncaught WebGPU validation error was raised: ${i.error.message}`)},Object.defineProperty(this.env.webgpu,"device",{value:this.device,writable:!1,enumerable:!0,configurable:!1}),Object.defineProperty(this.env.webgpu,"adapter",{value:t,writable:!1,enumerable:!0,configurable:!1}),this.setQueryType()}dispose(){typeof this.querySet<"u"&&this.querySet.destroy(),this.gpuDataManager.dispose()}getCommandEncoder(){return this.commandEncoder||(this.commandEncoder=this.device.createCommandEncoder()),this.commandEncoder}getComputePassEncoder(){if(!this.computePassEncoder){let e=this.getCommandEncoder(),t={};this.queryType==="at-passes"&&(t.timestampWrites={querySet:this.querySet,beginningOfPassWriteIndex:this.pendingDispatchNumber*2,endOfPassWriteIndex:this.pendingDispatchNumber*2+1}),this.computePassEncoder=e.beginComputePass(t)}return this.computePassEncoder}endComputePass(){this.computePassEncoder&&(this.computePassEncoder.end(),this.computePassEncoder=null)}flush(){if(!this.commandEncoder)return;st(),this.endComputePass();let e;this.queryType!=="none"&&(this.commandEncoder.resolveQuerySet(this.querySet,0,this.pendingDispatchNumber*2,this.queryResolveBuffer,0),e=this.device.createBuffer({size:this.pendingDispatchNumber*2*8,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST}),this.pendingQueries.set(e,this.pendingKernels),this.pendingKernels=[],this.commandEncoder.copyBufferToBuffer(this.queryResolveBuffer,0,e,0,this.pendingDispatchNumber*2*8)),this.device.queue.submit([this.commandEncoder.finish()]),this.gpuDataManager.refreshPendingBuffers(),this.commandEncoder=null,this.pendingDispatchNumber=0,this.queryType!=="none"&&e.mapAsync(GPUMapMode.READ).then(()=>{let t=new BigUint64Array(e.getMappedRange()),r=this.pendingQueries.get(e);for(let a=0;a<t.length/2;a++){let n=r[a],i=n.kernelId,s=this.kernels.get(i),o=s.kernelType,d=s.kernelName,c=n.programName,h=n.inputTensorViews,u=n.outputTensorViews,f=t[a*2],m=t[a*2+1];typeof this.queryTimeBase>"u"&&(this.queryTimeBase=f);let _=Number(f-this.queryTimeBase),g=Number(m-this.queryTimeBase);if(!Number.isSafeInteger(_)||!Number.isSafeInteger(g))throw new RangeError("incorrect timestamp range");if(this.env.webgpu.profiling?.ondata)this.env.webgpu.profiling.ondata({version:1,inputsMetadata:h.map(w=>({dims:w.dims,dataType:Ht(w.dataType)})),outputsMetadata:u.map(w=>({dims:w.dims,dataType:Ht(w.dataType)})),kernelId:i,kernelType:o,kernelName:d,programName:c,startTime:_,endTime:g});else{let w="";h.forEach((b,k)=>{w+=`input[${k}]: [${b.dims}] | ${Ht(b.dataType)}, `});let x="";u.forEach((b,k)=>{x+=`output[${k}]: [${b.dims}] | ${Ht(b.dataType)}, `}),console.log(`[profiling] kernel "${i}|${o}|${d}|${c}" ${w}${x}execution time: ${g-_} ns`)}Fr("GPU",`${c}::${f}::${m}`)}e.unmap(),this.pendingQueries.delete(e)}),Qe()}run(e,t,r,a,n,i){st(e.name);let s=[];for(let b=0;b<t.length;++b){let k=t[b].data;if(k===0)continue;let S=this.gpuDataManager.get(k);if(!S)throw new Error(`no GPU data for input: ${k}`);s.push(S)}let{outputs:o,dispatchGroup:d,programUniforms:c}=e.getRunData(t),h=r.length===0?o.map((b,k)=>k):r;if(h.length!==o.length)throw new Error(`Output size ${h.length} must be equal to ${o.length}.`);let u=[],f=[];for(let b=0;b<o.length;++b){if(!Number.isInteger(h[b])||h[b]<-3||h[b]>=i)throw new Error(`Invalid output index: ${h[b]}`);if(h[b]===-3)continue;let k=h[b]===-1,S=h[b]===-2,T=k||S?n(o[b].dataType,o[b].dims):a(h[b],o[b].dataType,o[b].dims);if(u.push(T),T.data===0)continue;let E=this.gpuDataManager.get(T.data);if(!E)throw new Error(`no GPU data for output: ${T.data}`);if(k&&this.temporaryData.push(E),S){let I=this.kernelPersistentData.get(this.currentKernelId);I||(I=[],this.kernelPersistentData.set(this.currentKernelId,I)),I.push(E)}f.push(E)}if(s.length!==t.length||f.length!==u.length){if(f.length===0)return Qe(e.name),u;throw new Error(`Program ${e.name} has zero-sized tensor(s) in inputs or outputs. This is not supported now.`)}let m;if(c){let b=0,k=[];c.forEach(I=>{let N=typeof I.data=="number"?[I.data]:I.data;if(N.length===0)return;let D=I.type===10?2:4,V,A;I.type===10?(A=N.length>4?16:N.length>2?8:N.length*D,V=N.length>4?16:D*N.length):(A=N.length<=2?N.length*D:16,V=16),b=Math.ceil(b/A)*A,k.push(b);let W=I.type===10?8:4;b+=N.length>4?Math.ceil(N.length/W)*V:N.length*D});let S=16;b=Math.ceil(b/S)*S;let T=new ArrayBuffer(b);c.forEach((I,N)=>{let D=k[N],V=typeof I.data=="number"?[I.data]:I.data;if(I.type===6)new Int32Array(T,D,V.length).set(V);else if(I.type===12)new Uint32Array(T,D,V.length).set(V);else if(I.type===10)new Uint16Array(T,D,V.length).set(V);else if(I.type===1)new Float32Array(T,D,V.length).set(V);else throw new Error(`Unsupported uniform type: ${Ht(I.type)}`)});let E=this.gpuDataManager.create(b,GPUBufferUsage.COPY_DST|GPUBufferUsage.UNIFORM);this.device.queue.writeBuffer(E.buffer,0,T,0,b),this.gpuDataManager.release(E.id),m={offset:0,size:b,buffer:E.buffer}}let _=this.programManager.normalizeDispatchGroupSize(d),g=_[1]===1&&_[2]===1,w=Mc(e,t,g),x=this.programManager.getArtifact(w);if(x||(x=this.programManager.build(e,_),this.programManager.setArtifact(w,x),$e("info",()=>`[artifact] key: ${w}, programName: ${e.name}`)),c&&x.uniformVariablesInfo){if(c.length!==x.uniformVariablesInfo.length)throw new Error(`Uniform variables count mismatch: expect ${x.uniformVariablesInfo.length}, got ${c.length} in program "${x.programInfo.name}".`);for(let b=0;b<c.length;b++){let k=c[b],S=k.type,T=typeof k.data=="number"?1:k.data.length,[E,I]=x.uniformVariablesInfo[b];if(S!==E||T!==I)throw new Error(`Uniform variable ${b} mismatch: expect type ${E} with size ${I}, got type ${S} with size ${T} in program "${x.programInfo.name}".`)}}if($e("info",()=>`[ProgramManager] run "${e.name}" (key=${w}) with ${_[0]}x${_[1]}x${_[2]}`),this.queryType!=="none"||this.sessionStatus==="capturing"){let b={kernelId:this.currentKernelId,programName:x.programInfo.name,inputTensorViews:t,outputTensorViews:u};this.pendingKernels.push(b),this.sessionStatus==="capturing"&&this.capturedPendingKernels.get(this.currentSessionId).push(b)}return this.programManager.run(x,s,f,_,m),Qe(e.name),u}upload(e,t){this.gpuDataManager.upload(e,t)}memcpy(e,t){this.gpuDataManager.memcpy(e,t)}async download(e,t){await this.gpuDataManager.download(e,t)}alloc(e){return this.gpuDataManager.create(e).id}free(e){return this.gpuDataManager.release(e)}createKernel(e,t,r,a){let n=vm.get(e);if(!n)throw new Error(`kernel not implemented: ${e}`);let i={kernelType:e,kernelName:a,kernelEntry:n[0],attributes:[n[1],r]};this.kernels.set(t,i)}releaseKernel(e){let t=this.kernelPersistentData.get(e);if(t){for(let r of t)this.gpuDataManager.release(r.id);this.kernelPersistentData.delete(e)}this.kernelCustomData.delete(e),this.kernels.delete(e)}computeKernel(e,t,r){let a=this.kernels.get(e);if(!a)throw new Error(`kernel not created: ${e}`);let n=a.kernelType,i=a.kernelName,s=a.kernelEntry,o=a.attributes;if(this.currentKernelId!==null)throw new Error(`kernel "[${n}] ${i}" is not allowed to be called recursively`);this.currentKernelId=e,o[0]&&(o[1]=o[0](o[1]),o[0]=void 0),$e("info",()=>`[WebGPU] Start to run kernel "[${n}] ${i}"...`);let d=this.env.debug;this.temporaryData=[];try{return d&&this.device.pushErrorScope("validation"),s(t,o[1]),0}catch(c){return r.push(Promise.resolve(`[WebGPU] Kernel "[${n}] ${i}" failed. ${c}`)),1}finally{d&&r.push(this.device.popErrorScope().then(c=>c?`GPU validation error for kernel "[${n}] ${i}": ${c.message}`:null));for(let c of this.temporaryData)this.gpuDataManager.release(c.id);this.temporaryData=[],this.currentKernelId=null}}registerBuffer(e,t,r,a){let n=this.sessionExternalDataMapping.get(e);n||(n=new Map,this.sessionExternalDataMapping.set(e,n));let i=n.get(t),s=this.gpuDataManager.registerExternalBuffer(r,a,i);return n.set(t,[s,r]),s}unregisterBuffers(e){let t=this.sessionExternalDataMapping.get(e);t&&(t.forEach(r=>this.gpuDataManager.unregisterExternalBuffer(r[0])),this.sessionExternalDataMapping.delete(e))}getBuffer(e){let t=this.gpuDataManager.get(e);if(!t)throw new Error(`no GPU data for buffer: ${e}`);return t.buffer}createDownloader(e,t,r){return async()=>{let a=await ji(this,e,t);return $s(a.buffer,r)}}writeTimestamp(e){this.queryType==="inside-passes"&&this.computePassEncoder.writeTimestamp(this.querySet,e)}setQueryType(){this.queryType="none",(this.env.webgpu.profiling?.mode==="default"||(typeof this.env.trace>"u"?this.env.wasm.trace:this.env.trace))&&(this.device.features.has("chromium-experimental-timestamp-query-inside-passes")?this.queryType="inside-passes":this.device.features.has("timestamp-query")&&(this.queryType="at-passes"),this.queryType!=="none"&&typeof this.querySet>"u"&&(this.querySet=this.device.createQuerySet({type:"timestamp",count:this.maxDispatchNumber*2}),this.queryResolveBuffer=this.device.createBuffer({size:this.maxDispatchNumber*2*8,usage:GPUBufferUsage.COPY_SRC|GPUBufferUsage.QUERY_RESOLVE})))}captureBegin(){$e("info","captureBegin"),this.capturedCommandList.get(this.currentSessionId)||this.capturedCommandList.set(this.currentSessionId,[]),this.capturedPendingKernels.get(this.currentSessionId)||this.capturedPendingKernels.set(this.currentSessionId,[]),this.flush(),this.sessionStatus="capturing"}captureEnd(){$e("info","captureEnd"),this.flush(),this.sessionStatus="default"}replay(){$e("info","replay"),this.sessionStatus="replaying";let e=this.capturedCommandList.get(this.currentSessionId),t=this.capturedPendingKernels.get(this.currentSessionId),r=e.length;this.pendingKernels=[];for(let a=0;a<r;a++){let n=this.getComputePassEncoder(),i=e[a];this.writeTimestamp(this.pendingDispatchNumber*2),n.setPipeline(i.computePipeline),n.setBindGroup(0,i.bindGroup),n.dispatchWorkgroups(...i.dispatchGroup),this.writeTimestamp(this.pendingDispatchNumber*2+1),this.pendingDispatchNumber++,this.queryType!=="none"&&this.pendingKernels.push(t[a]),(this.pendingDispatchNumber>=this.maxDispatchNumber||this.queryType==="at-passes")&&this.endComputePass(),this.pendingDispatchNumber>=this.maxDispatchNumber&&this.flush()}this.flush(),this.sessionStatus="default"}onCreateSession(){this.gpuDataManager.onCreateSession()}onReleaseSession(e){this.unregisterBuffers(e),this.capturedCommandList.has(e)&&this.capturedCommandList.delete(e),this.capturedPendingKernels.has(e)&&this.capturedPendingKernels.delete(e),this.gpuDataManager.onReleaseSession(e)}onRunStart(e){this.currentSessionId=e,this.setQueryType()}}}),Dc,Si,Pc,Ti,Ci,Ii,Uc,$m,X_=j(()=>{xt(),Dc=1,Si=()=>Dc++,Pc=new Map([["float32",32],["float16",16],["int32",32],["uint32",32],["int64",64],["uint64",64],["int8",8],["uint8",8],["int4",4],["uint4",4]]),Ti=(e,t)=>{let r=Pc.get(e);if(!r)throw new Error("Unsupported data type.");return t.length>0?Math.ceil(t.reduce((a,n)=>a*n)*r/8):0},Ci=class{constructor(e){this.sessionId=e.sessionId,this.mlContext=e.context,this.mlTensor=e.tensor,this.dataType=e.dataType,this.tensorShape=e.shape}get tensor(){return this.mlTensor}get type(){return this.dataType}get shape(){return this.tensorShape}get byteLength(){return Ti(this.dataType,this.tensorShape)}destroy(){$e("verbose",()=>"[WebNN] TensorWrapper.destroy"),this.mlTensor.destroy()}write(e){this.mlContext.writeTensor(this.mlTensor,e)}async read(e){return e?this.mlContext.readTensor(this.mlTensor,e):this.mlContext.readTensor(this.mlTensor)}canReuseTensor(e,t,r){return this.mlContext===e&&this.dataType===t&&this.tensorShape.length===r.length&&this.tensorShape.every((a,n)=>a===r[n])}},Ii=class{constructor(e,t){this.tensorManager=e,this.wrapper=t}get tensorWrapper(){return this.wrapper}releaseTensor(){this.tensorWrapper&&(this.tensorManager.releaseTensor(this.tensorWrapper),this.wrapper=void 0)}async ensureTensor(e,t,r,a){if(this.wrapper){if(this.wrapper.canReuseTensor(e,t,r))return this.wrapper.tensor;if(a){if(this.wrapper.byteLength!==Ti(t,r))throw new Error("Unable to copy data to tensor with different size.");this.activeUpload=new Uint8Array(await this.wrapper.read())}this.tensorManager.releaseTensor(this.wrapper)}let n=typeof MLTensorUsage>"u"?void 0:MLTensorUsage.READ|MLTensorUsage.WRITE;return this.wrapper=await this.tensorManager.getCachedTensor(t,r,n,!0,!0),a&&this.activeUpload&&(this.wrapper.write(this.activeUpload),this.activeUpload=void 0),this.wrapper.tensor}upload(e){if(this.wrapper)if(e.byteLength===this.wrapper.byteLength){this.wrapper.write(e);return}else $e("verbose",()=>"Data size does not match tensor size. Releasing tensor."),this.releaseTensor();this.activeUpload?this.activeUpload.set(e):this.activeUpload=new Uint8Array(e)}async download(e){if(this.activeUpload)if(e){e instanceof ArrayBuffer?new Uint8Array(e).set(this.activeUpload):new Uint8Array(e.buffer,e.byteOffset,e.byteLength).set(this.activeUpload);return}else return this.activeUpload.buffer;if(!this.wrapper)throw new Error("Tensor has not been created.");return e?this.wrapper.read(e):this.wrapper.read()}},Uc=class{constructor(e){this.backend=e,this.tensorTrackersById=new Map,this.freeTensors=[],this.externalTensors=new Set}reserveTensorId(){let e=Si();return this.tensorTrackersById.set(e,new Ii(this)),e}releaseTensorId(e){let t=this.tensorTrackersById.get(e);t&&(this.tensorTrackersById.delete(e),t.tensorWrapper&&this.releaseTensor(t.tensorWrapper))}async ensureTensor(e,t,r,a){$e("verbose",()=>`[WebNN] TensorManager.ensureTensor {tensorId: ${e}, dataType: ${t}, shape: ${r}, copyOld: ${a}}`);let n=this.tensorTrackersById.get(e);if(!n)throw new Error("Tensor not found.");return n.ensureTensor(this.backend.currentContext,t,r,a)}upload(e,t){let r=this.tensorTrackersById.get(e);if(!r)throw new Error("Tensor not found.");r.upload(t)}async download(e,t){$e("verbose",()=>`[WebNN] TensorManager.download {tensorId: ${e}, dstBuffer: ${t?.byteLength}}`);let r=this.tensorTrackersById.get(e);if(!r)throw new Error("Tensor not found.");return r.download(t)}releaseTensorsForSession(e){for(let t of this.freeTensors)t.sessionId===e&&t.destroy();this.freeTensors=this.freeTensors.filter(t=>t.sessionId!==e)}registerTensor(e,t,r,a){let n=Si(),i=new Ci({sessionId:this.backend.currentSessionId,context:e,tensor:t,dataType:r,shape:a});return this.tensorTrackersById.set(n,new Ii(this,i)),this.externalTensors.add(i),n}async getCachedTensor(e,t,r,a,n){let i=this.backend.currentSessionId,s=this.backend.currentContext;for(let[d,c]of this.freeTensors.entries())if(c.canReuseTensor(s,e,t)){$e("verbose",()=>`[WebNN] Reusing tensor {dataType: ${e}, shape: ${t}}`);let h=this.freeTensors.splice(d,1)[0];return h.sessionId=i,h}$e("verbose",()=>`[WebNN] MLContext.createTensor {dataType: ${e}, shape: ${t}}`);let o=await s.createTensor({dataType:e,shape:t,dimensions:t,usage:r,writable:a,readable:n});return new Ci({sessionId:i,context:s,tensor:o,dataType:e,shape:t})}releaseTensor(e){this.externalTensors.has(e)&&this.externalTensors.delete(e),this.freeTensors.push(e)}},$m=(...e)=>new Uc(...e)}),Ei,jc,xm,e0=j(()=>{ie(),tr(),Op(),X_(),xt(),Ei=new Map([[1,"float32"],[10,"float16"],[6,"int32"],[12,"uint32"],[7,"int64"],[13,"uint64"],[22,"int4"],[21,"uint4"],[3,"int8"],[2,"uint8"],[9,"uint8"]]),jc=(e,t)=>{if(e===t)return!0;if(e===void 0||t===void 0)return!1;let r=Object.keys(e).sort(),a=Object.keys(t).sort();return r.length===a.length&&r.every((n,i)=>n===a[i]&&e[n]===t[n])},xm=class{constructor(e){this.tensorManager=$m(this),this.mlContextBySessionId=new Map,this.sessionIdsByMLContext=new Map,this.mlContextCache=[],ws(e.logLevel,!!e.debug)}get currentSessionId(){if(this.activeSessionId===void 0)throw new Error("No active session");return this.activeSessionId}onRunStart(e){this.activeSessionId=e}async createMLContext(e){if(e instanceof GPUDevice){let r=this.mlContextCache.findIndex(a=>a.gpuDevice===e);if(r!==-1)return this.mlContextCache[r].mlContext;{let a=await navigator.ml.createContext(e);return this.mlContextCache.push({gpuDevice:e,mlContext:a}),a}}else if(e===void 0){let r=this.mlContextCache.findIndex(a=>a.options===void 0&&a.gpuDevice===void 0);if(r!==-1)return this.mlContextCache[r].mlContext;{let a=await navigator.ml.createContext();return this.mlContextCache.push({mlContext:a}),a}}let t=this.mlContextCache.findIndex(r=>jc(r.options,e));if(t!==-1)return this.mlContextCache[t].mlContext;{let r=await navigator.ml.createContext(e);return this.mlContextCache.push({options:e,mlContext:r}),r}}get currentContext(){let e=this.getMLContext(this.currentSessionId);if(!e)throw new Error(`No MLContext found for session ${this.currentSessionId}`);return e}registerMLContext(e,t){this.mlContextBySessionId.set(e,t);let r=this.sessionIdsByMLContext.get(t);r||(r=new Set,this.sessionIdsByMLContext.set(t,r)),r.add(e)}onReleaseSession(e){let t=this.mlContextBySessionId.get(e);if(!t)return;this.tensorManager.releaseTensorsForSession(e),this.mlContextBySessionId.delete(e);let r=this.sessionIdsByMLContext.get(t);if(r.delete(e),r.size===0){this.sessionIdsByMLContext.delete(t);let a=this.mlContextCache.findIndex(n=>n.mlContext===t);a!==-1&&this.mlContextCache.splice(a,1)}}getMLContext(e){return this.mlContextBySessionId.get(e)}reserveTensorId(){return this.tensorManager.reserveTensorId()}releaseTensorId(e){$e("verbose",()=>`[WebNN] releaseTensorId {tensorId: ${e}}`),this.tensorManager.releaseTensorId(e)}async ensureTensor(e,t,r,a){let n=Ei.get(t);if(!n)throw new Error(`Unsupported ONNX data type: ${t}`);return this.tensorManager.ensureTensor(e,n,r,a)}uploadTensor(e,t){if(!Me().shouldTransferToMLTensor)throw new Error("Trying to upload to a MLTensor while shouldTransferToMLTensor is false");$e("verbose",()=>`[WebNN] uploadTensor {tensorId: ${e}, data: ${t.byteLength}}`),this.tensorManager.upload(e,t)}async downloadTensor(e,t){return this.tensorManager.download(e,t)}createMLTensorDownloader(e,t){return async()=>{let r=await this.tensorManager.download(e);return $s(r,t)}}registerMLTensor(e,t,r){let a=Ei.get(t);if(!a)throw new Error(`Unsupported ONNX data type: ${t}`);let n=this.tensorManager.registerTensor(this.currentContext,e,a,r);return $e("verbose",()=>`[WebNN] registerMLTensor {tensor: ${e}, dataType: ${a}, dimensions: ${r}} -> {tensorId: ${n}}`),n}registerMLConstant(e,t,r,a,n,i){if(!i)throw new Error("External mounted files are not available.");let s=e;e.startsWith("./")&&(s=e.substring(2));let o=i.get(s);if(!o)throw new Error(`File with name ${s} not found in preloaded files.`);if(t+r>o.byteLength)throw new Error("Out of bounds: data offset and length exceed the external file data size.");let d=o.slice(t,t+r).buffer,c;switch(n.dataType){case"float32":c=new Float32Array(d);break;case"float16":c=new Uint16Array(d);break;case"int32":c=new Int32Array(d);break;case"uint32":c=new Uint32Array(d);break;case"int64":c=new BigInt64Array(d);break;case"uint64":c=new BigUint64Array(d);break;case"int8":c=new Int8Array(d);break;case"int4":case"uint4":case"uint8":c=new Uint8Array(d);break;default:throw new Error(`Unsupported data type: ${n.dataType} in creating WebNN Constant from external data.`)}return $e("verbose",()=>`[WebNN] registerMLConstant {dataType: ${n.dataType}, shape: ${n.shape}}}`),a.constant(n,c)}flush(){}}}),km={};da(km,{init:()=>Sm});var Na,Lc,Sm,t0=j(()=>{ie(),J_(),xt(),le(),e0(),Na=class Tm{constructor(t,r,a,n){this.module=t,this.dataType=r,this.data=a,this.dims=n}getFloat32Array(){if(this.dataType!==1)throw new Error("Invalid data type");let t=z.size(this.dims);return t===0?new Float32Array:new Float32Array(this.module.HEAP8.buffer,this.data,t)}getBigInt64Array(){if(this.dataType!==7)throw new Error("Invalid data type");let t=z.size(this.dims);return t===0?new BigInt64Array:new BigInt64Array(this.module.HEAP8.buffer,this.data,t)}getInt32Array(){if(this.dataType!==6)throw new Error("Invalid data type");let t=z.size(this.dims);return t===0?new Int32Array:new Int32Array(this.module.HEAP8.buffer,this.data,t)}getUint16Array(){if(this.dataType!==10&&this.dataType!==4)throw new Error("Invalid data type");let t=z.size(this.dims);return t===0?new Uint16Array:new Uint16Array(this.module.HEAP8.buffer,this.data,t)}reshape(t){if(z.size(t)!==z.size(this.dims))throw new Error("Invalid new shape");return new Tm(this.module,this.dataType,this.data,t)}},Lc=class{constructor(e,t,r){this.module=e,this.backend=t,this.customDataOffset=0,this.customDataSize=0,this.adapterInfo=t.adapterInfo,this.deviceInfo=t.deviceInfo;let a=e.PTR_SIZE,n=r/e.PTR_SIZE,i=a===4?"i32":"i64";this.opKernelContext=Number(e.getValue(a*n++,i));let s=Number(e.getValue(a*n++,i));this.outputCount=Number(e.getValue(a*n++,i)),this.customDataOffset=Number(e.getValue(a*n++,"*")),this.customDataSize=Number(e.getValue(a*n++,i));let o=[];for(let d=0;d<s;d++){let c=Number(e.getValue(a*n++,i)),h=Number(e.getValue(a*n++,"*")),u=Number(e.getValue(a*n++,i)),f=[];for(let m=0;m<u;m++)f.push(Number(e.getValue(a*n++,i)));o.push(new Na(e,c,h,f))}this.inputs=o}get kernelCustomData(){return this.backend.currentKernelCustomData}get customDataBuffer(){return this.module.HEAPU8.subarray(this.customDataOffset,this.customDataOffset+this.customDataSize)}compute(e,t){let r=t?.inputs?.map(s=>typeof s=="number"?this.inputs[s]:s)??this.inputs,a=t?.outputs??[],n=(s,o,d)=>new Na(this.module,o,this.output(s,d),d),i=(s,o)=>{let d=lr(s,o);if(!d)throw new Error(`Unsupported data type: ${s}`);let c=d>0?this.backend.gpuDataManager.create(d).id:0;return new Na(this.module,s,c,o)};return this.backend.run(e,r,a,n,i,this.outputCount)}output(e,t){let r=this.module.stackSave();try{let a=this.module.PTR_SIZE,n=a===4?"i32":"i64",i=this.module.stackAlloc((1+t.length)*a);this.module.setValue(i,t.length,n);for(let s=0;s<t.length;s++)this.module.setValue(i+a*(s+1),t[s],n);return this.module._JsepOutput(this.opKernelContext,e,i)}catch(a){throw new Error(`Failed to generate kernel's output[${e}] with dims [${t}]. If you are running with pre-allocated output, please make sure the output type/dims are correct. Error: ${a}`)}finally{this.module.stackRestore(r)}}},Sm=async(e,t,r,a)=>{let n=t.jsepInit;if(!n)throw new Error("Failed to initialize JSEP. The WebAssembly module is not built with JSEP support.");if(e==="webgpu"){let i=new wm;await i.initialize(r,a),n("webgpu",[i,s=>i.alloc(Number(s)),s=>i.free(s),(s,o,d,c=!1)=>{if(c)$e("verbose",()=>`[WebGPU] jsepCopyGpuToGpu: src=${Number(s)}, dst=${Number(o)}, size=${Number(d)}`),i.memcpy(Number(s),Number(o));else{$e("verbose",()=>`[WebGPU] jsepCopyCpuToGpu: dataOffset=${Number(s)}, gpuDataId=${Number(o)}, size=${Number(d)}`);let h=t.HEAPU8.subarray(Number(s>>>0),Number(s>>>0)+Number(d));i.upload(Number(o),h)}},async(s,o,d)=>{$e("verbose",()=>`[WebGPU] jsepCopyGpuToCpu: gpuDataId=${s}, dataOffset=${o}, size=${d}`),await i.download(Number(s),()=>t.HEAPU8.subarray(Number(o)>>>0,Number(o+d)>>>0))},(s,o,d)=>i.createKernel(s,Number(o),d,t.UTF8ToString(t._JsepGetNodeName(Number(o)))),s=>i.releaseKernel(s),(s,o,d,c)=>{$e("verbose",()=>`[WebGPU] jsepRun: sessionHandle=${d}, kernel=${s}, contextDataOffset=${o}`);let h=new Lc(t,i,Number(o));return i.computeKernel(Number(s),h,c)},()=>i.captureBegin(),()=>i.captureEnd(),()=>i.replay()])}else{let i=new xm(r);n("webnn",[i,()=>i.reserveTensorId(),s=>i.releaseTensorId(s),async(s,o,d,c)=>i.ensureTensor(s,o,d,c),(s,o)=>{i.uploadTensor(s,o)},async(s,o)=>i.downloadTensor(s,o)])}}}),Vc,Rs,Ms,zt,Wc,Ka,Ns,Bs,Ai,Ds,Ps,Us,Cm=j(()=>{i_(),s_(),ie(),tr(),gs(),zp(),Vc=(e,t)=>{Me()._OrtInit(e,t)!==0&&be("Can't initialize onnxruntime.")},Rs=async e=>{Vc(e.wasm.numThreads,Fa(e.logLevel))},Ms=async(e,t)=>{{let r=(t0(),Wa(km)).init;if(t==="webgpu"){if(typeof navigator>"u"||!navigator.gpu)throw new Error("WebGPU is not supported in current environment");let a=e.webgpu.adapter;if(a){if(typeof a.limits!="object"||typeof a.features!="object"||typeof a.requestDevice!="function")throw new Error("Invalid GPU adapter set in `env.webgpu.adapter`. It must be a GPUAdapter object.")}else{let n=e.webgpu.powerPreference;if(n!==void 0&&n!=="low-power"&&n!=="high-performance")throw new Error(`Invalid powerPreference setting: "${n}"`);let i=e.webgpu.forceFallbackAdapter;if(i!==void 0&&typeof i!="boolean")throw new Error(`Invalid forceFallbackAdapter setting: "${i}"`);if(a=await navigator.gpu.requestAdapter({powerPreference:n,forceFallbackAdapter:i}),!a)throw new Error('Failed to get GPU adapter. You may need to enable flag "--enable-unsafe-webgpu" if you are using Chrome.')}await r("webgpu",Me(),e,a)}if(t==="webnn"){if(typeof navigator>"u"||!navigator.ml)throw new Error("WebNN is not supported in current environment");await r("webnn",Me(),e)}}},zt=new Map,Wc=e=>{let t=Me(),r=t.stackSave();try{let a=t.PTR_SIZE,n=t.stackAlloc(2*a);t._OrtGetInputOutputCount(e,n,n+a)!==0&&be("Can't get session input/output count.");let i=a===4?"i32":"i64";return[Number(t.getValue(n,i)),Number(t.getValue(n+a,i))]}finally{t.stackRestore(r)}},Ka=e=>{let t=Me(),r=t._malloc(e.byteLength);if(r===0)throw new Error(`Can't create a session. failed to allocate a buffer of size ${e.byteLength}.`);return t.HEAPU8.set(e,r),[r,e.byteLength]},Ns=async(e,t)=>{let r,a,n=Me();Array.isArray(e)?[r,a]=e:e.buffer===n.HEAPU8.buffer?[r,a]=[e.byteOffset,e.byteLength]:[r,a]=Ka(e);let i=0,s=0,o=0,d=[],c=[],h=[];try{if([s,d]=Ap(t),t?.externalData&&n.mountExternalData){let b=[];for(let k of t.externalData){let S=typeof k=="string"?k:k.path;b.push(bs(typeof k=="string"?k:k.data).then(T=>{n.mountExternalData(S,T)}))}await Promise.all(b)}for(let b of t?.executionProviders??[])if((typeof b=="string"?b:b.name)==="webnn"){if(n.shouldTransferToMLTensor=!1,typeof b!="string"){let k=b,S=k?.context,T=k?.gpuDevice,E=k?.deviceType,I=k?.powerPreference;S?n.currentContext=S:T?n.currentContext=await n.jsepCreateMLContext(T):n.currentContext=await n.jsepCreateMLContext({deviceType:E,powerPreference:I})}else n.currentContext=await n.jsepCreateMLContext();break}i=await n._OrtCreateSession(r,a,s),i===0&&be("Can't create a session."),n.jsepOnCreateSession?.(),n.currentContext&&(n.jsepRegisterMLContext(i,n.currentContext),n.currentContext=void 0,n.shouldTransferToMLTensor=!0);let[u,f]=Wc(i),m=!!t?.enableGraphCapture,_=[],g=[],w=[];for(let b=0;b<u;b++){let k=n._OrtGetInputName(i,b);k===0&&be("Can't get an input name."),c.push(k),_.push(n.UTF8ToString(k))}for(let b=0;b<f;b++){let k=n._OrtGetOutputName(i,b);k===0&&be("Can't get an output name."),h.push(k);let S=n.UTF8ToString(k);g.push(S);{if(m&&t?.preferredOutputLocation===void 0){w.push("gpu-buffer");continue}let T=typeof t?.preferredOutputLocation=="string"?t.preferredOutputLocation:t?.preferredOutputLocation?.[S]??"cpu";if(T!=="cpu"&&T!=="cpu-pinned"&&T!=="gpu-buffer"&&T!=="ml-tensor")throw new Error(`Not supported preferred output location: ${T}.`);if(m&&T!=="gpu-buffer")throw new Error(`Not supported preferred output location: ${T}. Only 'gpu-buffer' location is supported when enableGraphCapture is true.`);w.push(T)}}let x=null;return w.some(b=>b==="gpu-buffer"||b==="ml-tensor")&&(o=n._OrtCreateBinding(i),o===0&&be("Can't create IO binding."),x={handle:o,outputPreferredLocations:w,outputPreferredLocationsEncoded:w.map(b=>Ui(b))}),zt.set(i,[i,c,h,x,m,!1]),[i,_,g]}catch(u){throw c.forEach(f=>n._OrtFree(f)),h.forEach(f=>n._OrtFree(f)),o!==0&&n._OrtReleaseBinding(o)!==0&&be("Can't release IO binding."),i!==0&&n._OrtReleaseSession(i)!==0&&be("Can't release session."),u}finally{n._free(r),s!==0&&n._OrtReleaseSessionOptions(s)!==0&&be("Can't release session options."),d.forEach(u=>n._free(u)),n.unmountExternalData?.()}},Bs=e=>{let t=Me(),r=zt.get(e);if(!r)throw new Error(`cannot release session. invalid session id: ${e}`);let[a,n,i,s,o]=r;s&&(o&&t._OrtClearBoundOutputs(s.handle)!==0&&be("Can't clear bound outputs."),t._OrtReleaseBinding(s.handle)!==0&&be("Can't release IO binding.")),t.jsepOnReleaseSession?.(e),n.forEach(d=>t._OrtFree(d)),i.forEach(d=>t._OrtFree(d)),t._OrtReleaseSession(a)!==0&&be("Can't release session."),zt.delete(e)},Ai=(e,t,r,a,n,i=!1)=>{if(!e){t.push(0);return}let s=Me(),o=s.PTR_SIZE,d=e[0],c=e[1],h=e[3],u,f;if(d==="string"&&(h==="gpu-buffer"||h==="ml-tensor"))throw new Error("String tensor is not supported on GPU.");if(i&&h!=="gpu-buffer")throw new Error(`External buffer must be provided for input/output index ${n} when enableGraphCapture is true.`);if(h==="gpu-buffer"){let g=e[2].gpuBuffer;f=lr(Dr(d),c);let w=s.jsepRegisterBuffer;if(!w)throw new Error('Tensor location "gpu-buffer" is not supported without using WebGPU.');u=w(a,n,g,f)}else if(h==="ml-tensor"){let g=e[2].mlTensor;f=lr(Dr(d),c);let w=s.jsepRegisterMLTensor;if(!w)throw new Error('Tensor location "ml-tensor" is not supported without using WebNN.');u=w(g,Dr(d),c)}else{let g=e[2];if(Array.isArray(g)){f=o*g.length,u=s._malloc(f),r.push(u);for(let w=0;w<g.length;w++){if(typeof g[w]!="string")throw new TypeError(`tensor data at index ${w} is not a string`);s.setValue(u+w*o,Pe(g[w],r),"*")}}else f=g.byteLength,u=s._malloc(f),r.push(u),s.HEAPU8.set(new Uint8Array(g.buffer,g.byteOffset,f),u)}let m=s.stackSave(),_=s.stackAlloc(4*c.length);try{c.forEach((w,x)=>s.setValue(_+x*o,w,o===4?"i32":"i64"));let g=s._OrtCreateTensor(Dr(d),u,f,_,c.length,Ui(h));g===0&&be(`Can't create tensor for input/output. session=${a}, index=${n}.`),t.push(g)}finally{s.stackRestore(m)}},Ds=async(e,t,r,a,n,i)=>{let s=Me(),o=s.PTR_SIZE,d=zt.get(e);if(!d)throw new Error(`cannot run inference. invalid session id: ${e}`);let c=d[0],h=d[1],u=d[2],f=d[3],m=d[4],_=d[5],g=t.length,w=a.length,x=0,b=[],k=[],S=[],T=[],E=s.stackSave(),I=s.stackAlloc(g*o),N=s.stackAlloc(g*o),D=s.stackAlloc(w*o),V=s.stackAlloc(w*o);try{s.jsepOnRunStart?.(c),[x,b]=Ep(i);for(let P=0;P<g;P++)Ai(r[P],k,T,e,t[P],m);for(let P=0;P<w;P++)Ai(n[P],S,T,e,g+a[P],m);for(let P=0;P<g;P++)s.setValue(I+P*o,k[P],"*"),s.setValue(N+P*o,h[t[P]],"*");for(let P=0;P<w;P++)s.setValue(D+P*o,S[P],"*"),s.setValue(V+P*o,u[a[P]],"*");if(f&&!_){let{handle:P,outputPreferredLocations:J,outputPreferredLocationsEncoded:ne}=f;if(h.length!==g)throw new Error(`input count from feeds (${g}) is expected to be always equal to model's input count (${h.length}).`);for(let F=0;F<g;F++){let se=t[F];await s._OrtBindInput(P,h[se],k[F])!==0&&be(`Can't bind input[${F}] for session=${e}.`)}for(let F=0;F<w;F++){let se=a[F];n[F]?.[3]?s._OrtBindOutput(P,u[se],S[F],0)!==0&&be(`Can't bind pre-allocated output[${F}] for session=${e}.`):s._OrtBindOutput(P,u[se],0,ne[se])!==0&&be(`Can't bind output[${F}] to ${J[F]} for session=${e}.`)}zt.set(e,[c,h,u,f,m,!0])}let A;f?A=await s._OrtRunWithBinding(c,f.handle,w,D,x):A=await s._OrtRun(c,N,I,g,V,w,D,x),A!==0&&be("failed to call OrtRun().");let W=[];for(let P=0;P<w;P++){let J=Number(s.getValue(D+P*o,"*"));if(J===S[P]){W.push(n[P]);continue}let ne=s.stackSave(),F=s.stackAlloc(4*o),se=!1,ce,K=0;try{s._OrtGetTensorData(J,F,F+o,F+2*o,F+3*o)!==0&&be(`Can't access output tensor data on index ${P}.`);let Te=o===4?"i32":"i64",U=Number(s.getValue(F,Te));K=s.getValue(F+o,"*");let G=s.getValue(F+o*2,"*"),ye=Number(s.getValue(F+o*3,Te)),ge=[];for(let Ce=0;Ce<ye;Ce++)ge.push(Number(s.getValue(G+Ce*o,Te)));s._OrtFree(G)!==0&&be("Can't free memory for tensor dims.");let Re=ge.reduce((Ce,ke)=>Ce*ke,1);ce=Ht(U);let gt=f?.outputPreferredLocations[a[P]];if(ce==="string"){if(gt==="gpu-buffer"||gt==="ml-tensor")throw new Error("String tensor is not supported on GPU.");let Ce=[];for(let ke=0;ke<Re;ke++){let kt=s.getValue(K+ke*o,"*"),wr=s.getValue(K+(ke+1)*o,"*"),fn=ke===Re-1?void 0:wr-kt;Ce.push(s.UTF8ToString(kt,fn))}W.push([ce,ge,Ce,"cpu"])}else if(gt==="gpu-buffer"&&Re>0){let Ce=s.jsepGetBuffer;if(!Ce)throw new Error('preferredLocation "gpu-buffer" is not supported without using WebGPU.');let ke=Ce(K),kt=lr(U,Re);if(kt===void 0||!_s(ce))throw new Error(`Unsupported data type: ${ce}`);se=!0,W.push([ce,ge,{gpuBuffer:ke,download:s.jsepCreateDownloader(ke,kt,ce),dispose:()=>{s._OrtReleaseTensor(J)!==0&&be("Can't release tensor.")}},"gpu-buffer"])}else if(gt==="ml-tensor"&&Re>0){let Ce=s.jsepEnsureTensor;if(!Ce)throw new Error('preferredLocation "ml-tensor" is not supported without using WebNN.');if(lr(U,Re)===void 0||!vs(ce))throw new Error(`Unsupported data type: ${ce}`);let ke=await Ce(K,U,ge,!1);se=!0,W.push([ce,ge,{mlTensor:ke,download:s.jsepCreateMLTensorDownloader(K,ce),dispose:()=>{s.jsepReleaseTensorId(K),s._OrtReleaseTensor(J)}},"ml-tensor"])}else{let Ce=ys(ce),ke=new Ce(Re);new Uint8Array(ke.buffer,ke.byteOffset,ke.byteLength).set(s.HEAPU8.subarray(K,K+ke.byteLength)),W.push([ce,ge,ke,"cpu"])}}finally{s.stackRestore(ne),ce==="string"&&K&&s._free(K),se||s._OrtReleaseTensor(J)}}return f&&!m&&(s._OrtClearBoundOutputs(f.handle)!==0&&be("Can't clear bound outputs."),zt.set(e,[c,h,u,f,m,!1])),W}finally{s.stackRestore(E),k.forEach(A=>s._OrtReleaseTensor(A)),S.forEach(A=>s._OrtReleaseTensor(A)),T.forEach(A=>s._free(A)),x!==0&&s._OrtReleaseRunOptions(x),b.forEach(A=>s._free(A))}},Ps=e=>{let t=Me(),r=zt.get(e);if(!r)throw new Error("invalid session id");let a=r[0],n=t._OrtEndProfiling(a);n===0&&be("Can't get an profile file name."),t._OrtFree(n)},Us=e=>{let t=[];for(let r of e){let a=r[2];!Array.isArray(a)&&"buffer"in a&&t.push(a.buffer)}return t}}),Ot,Ze,sr,Or,Rr,Ba,zi,Da,Wt,qt,qc,Im,Em,Am,zm,Om,Rm,Mm,Nm=j(()=>{ut(),Cm(),tr(),fs(),Ot=()=>!!Se.wasm.proxy&&typeof document<"u",sr=!1,Or=!1,Rr=!1,Da=new Map,Wt=(e,t)=>{let r=Da.get(e);r?r.push(t):Da.set(e,[t])},qt=()=>{if(sr||!Or||Rr||!Ze)throw new Error("worker not ready")},qc=e=>{switch(e.data.type){case"init-wasm":sr=!1,e.data.err?(Rr=!0,zi[1](e.data.err)):(Or=!0,zi[0]()),Ba&&(URL.revokeObjectURL(Ba),Ba=void 0);break;case"init-ep":case"copy-from":case"create":case"release":case"run":case"end-profiling":{let t=Da.get(e.data.type);e.data.err?t.shift()[1](e.data.err):t.shift()[0](e.data.out);break}}},Im=async()=>{if(!Or){if(sr)throw new Error("multiple calls to 'initWasm()' detected.");if(Rr)throw new Error("previous call to 'initWasm()' failed.");if(sr=!0,Ot())return new Promise((e,t)=>{Ze?.terminate(),Cp().then(([r,a])=>{try{Ze=a,Ze.onerror=i=>t(i),Ze.onmessage=qc,zi=[e,t];let n={type:"init-wasm",in:Se};!n.in.wasm.wasmPaths&&(r||import.meta.url?.startsWith("file:"))&&(n.in.wasm.wasmPaths={wasm:new URL("/assets/ort-wasm-simd-threaded.jsep-Y7jqkEt_.wasm",import.meta.url).href}),Ze.postMessage(n),Ba=r}catch(n){t(n)}},t)});try{await ms(Se.wasm),await Rs(Se),Or=!0}catch(e){throw Rr=!0,e}finally{sr=!1}}},Em=async e=>{if(Ot())return qt(),new Promise((t,r)=>{Wt("init-ep",[t,r]);let a={type:"init-ep",in:{epName:e,env:Se}};Ze.postMessage(a)});await Ms(Se,e)},Am=async e=>Ot()?(qt(),new Promise((t,r)=>{Wt("copy-from",[t,r]);let a={type:"copy-from",in:{buffer:e}};Ze.postMessage(a,[e.buffer])})):Ka(e),zm=async(e,t)=>{if(Ot()){if(t?.preferredOutputLocation)throw new Error('session option "preferredOutputLocation" is not supported for proxy.');return qt(),new Promise((r,a)=>{Wt("create",[r,a]);let n={type:"create",in:{model:e,options:{...t}}},i=[];e instanceof Uint8Array&&i.push(e.buffer),Ze.postMessage(n,i)})}else return Ns(e,t)},Om=async e=>{if(Ot())return qt(),new Promise((t,r)=>{Wt("release",[t,r]);let a={type:"release",in:e};Ze.postMessage(a)});Bs(e)},Rm=async(e,t,r,a,n,i)=>{if(Ot()){if(r.some(s=>s[3]!=="cpu"))throw new Error("input tensor on GPU is not supported for proxy.");if(n.some(s=>s))throw new Error("pre-allocated output tensor is not supported for proxy.");return qt(),new Promise((s,o)=>{Wt("run",[s,o]);let d=r,c={type:"run",in:{sessionId:e,inputIndices:t,inputs:d,outputIndices:a,options:i}};Ze.postMessage(c,Us(d))})}else return Ds(e,t,r,a,n,i)},Mm=async e=>{if(Ot())return qt(),new Promise((t,r)=>{Wt("end-profiling",[t,r]);let a={type:"end-profiling",in:e};Ze.postMessage(a)});Ps(e)}}),Oi,Fc,Bm,r0=j(()=>{ut(),Nm(),ie(),hs(),zp(),Oi=(e,t)=>{switch(e.location){case"cpu":return[e.type,e.dims,e.data,"cpu"];case"gpu-buffer":return[e.type,e.dims,{gpuBuffer:e.gpuBuffer},"gpu-buffer"];case"ml-tensor":return[e.type,e.dims,{mlTensor:e.mlTensor},"ml-tensor"];default:throw new Error(`invalid data location: ${e.location} for ${t()}`)}},Fc=e=>{switch(e[3]){case"cpu":return new nt(e[0],e[2],e[1]);case"gpu-buffer":{let t=e[0];if(!_s(t))throw new Error(`not supported data type: ${t} for deserializing GPU tensor`);let{gpuBuffer:r,download:a,dispose:n}=e[2];return nt.fromGpuBuffer(r,{dataType:t,dims:e[1],download:a,dispose:n})}case"ml-tensor":{let t=e[0];if(!vs(t))throw new Error(`not supported data type: ${t} for deserializing MLTensor tensor`);let{mlTensor:r,download:a,dispose:n}=e[2];return nt.fromMLTensor(r,{dataType:t,dims:e[1],download:a,dispose:n})}default:throw new Error(`invalid data location: ${e[3]}`)}},Bm=class{async fetchModelAndCopyToWasmMemory(e){return Am(await bs(e))}async loadModel(e,t){st();let r;typeof e=="string"?r=await this.fetchModelAndCopyToWasmMemory(e):r=e,[this.sessionId,this.inputNames,this.outputNames]=await zm(r,t),Qe()}async dispose(){return Om(this.sessionId)}async run(e,t,r){st();let a=[],n=[];Object.entries(e).forEach(u=>{let f=u[0],m=u[1],_=this.inputNames.indexOf(f);if(_===-1)throw new Error(`invalid input '${f}'`);a.push(m),n.push(_)});let i=[],s=[];Object.entries(t).forEach(u=>{let f=u[0],m=u[1],_=this.outputNames.indexOf(f);if(_===-1)throw new Error(`invalid output '${f}'`);i.push(m),s.push(_)});let o=a.map((u,f)=>Oi(u,()=>`input "${this.inputNames[n[f]]}"`)),d=i.map((u,f)=>u?Oi(u,()=>`output "${this.outputNames[s[f]]}"`):null),c=await Rm(this.sessionId,n,o,s,d,r),h={};for(let u=0;u<c.length;u++)h[this.outputNames[s[u]]]=i[u]??Fc(c[u]);return Qe(),h}startProfiling(){}endProfiling(){Mm(this.sessionId)}}}),Dm={};da(Dm,{OnnxruntimeWebAssemblyBackend:()=>Ji,initializeFlags:()=>Yi,wasmBackend:()=>Pm});var Yi,Ji,Pm,a0=j(()=>{ut(),Nm(),r0(),Yi=()=>{if((typeof Se.wasm.initTimeout!="number"||Se.wasm.initTimeout<0)&&(Se.wasm.initTimeout=0),Se.wasm.simd===!1&&console.warn('Deprecated property "env.wasm.simd" is set to false. non-SIMD build is no longer provided, and this setting will be ignored.'),typeof Se.wasm.proxy!="boolean"&&(Se.wasm.proxy=!1),typeof Se.wasm.trace!="boolean"&&(Se.wasm.trace=!1),typeof Se.wasm.numThreads!="number"||!Number.isInteger(Se.wasm.numThreads)||Se.wasm.numThreads<=0)if(typeof self<"u"&&!self.crossOriginIsolated)Se.wasm.numThreads=1;else{let e=typeof navigator>"u"?Vy("node:os").cpus().length:navigator.hardwareConcurrency;Se.wasm.numThreads=Math.min(4,Math.ceil((e||1)/2))}},Ji=class{async init(e){Yi(),await Im(),await Em(e)}async createInferenceSessionHandler(e,t){let r=new Bm;return await r.loadModel(e,t),Promise.resolve(r)}},Pm=new Ji});ut();ut();ut();var n0="1.21.0-dev.20250206-d981b153d3",i0=wp;{let e=(a0(),Wa(Dm)).wasmBackend;Gt("webgpu",e,5),Gt("webnn",e,5),Gt("cpu",e,10),Gt("wasm",e,10)}Object.defineProperty(Se.versions,"web",{value:n0,enumerable:!0});const s0=Object.freeze(Object.defineProperty({__proto__:null,get InferenceSession(){return ps},get TRACE(){return Fr},get TRACE_FUNC_BEGIN(){return st},get TRACE_FUNC_END(){return Qe},get Tensor(){return nt},default:i0,get env(){return Se},get registerBackend(){return Gt}},Symbol.toStringTag,{value:"Module"}));var o0=Object.create,Um=Object.defineProperty,u0=Object.getOwnPropertyDescriptor,jm=Object.getOwnPropertyNames,l0=Object.getPrototypeOf,d0=Object.prototype.hasOwnProperty,js=(e,t)=>function(){return t||(0,e[jm(e)[0]])((t={exports:{}}).exports,t),t.exports},c0=(e,t,r,a)=>{if(t&&typeof t=="object"||typeof t=="function")for(let n of jm(t))!d0.call(e,n)&&n!==r&&Um(e,n,{get:()=>t[n],enumerable:!(a=u0(t,n))||a.enumerable});return e},sn=(e,t,r)=>(r=e!=null?o0(l0(e)):{},c0(!e||!e.__esModule?Um(r,"default",{value:e,enumerable:!0}):r,e)),p0=js({"../../node_modules/.pnpm/iota-array@1.0.0/node_modules/iota-array/iota.js"(e,t){function r(a){for(var n=new Array(a),i=0;i<a;++i)n[i]=i;return n}t.exports=r}}),h0=js({"../../node_modules/.pnpm/is-buffer@1.1.6/node_modules/is-buffer/index.js"(e,t){t.exports=function(n){return n!=null&&(r(n)||a(n)||!!n._isBuffer)};function r(n){return!!n.constructor&&typeof n.constructor.isBuffer=="function"&&n.constructor.isBuffer(n)}function a(n){return typeof n.readFloatLE=="function"&&typeof n.slice=="function"&&r(n.slice(0,0))}}}),on=js({"../../node_modules/.pnpm/ndarray@1.0.19/node_modules/ndarray/ndarray.js"(e,t){var r=p0(),a=h0(),n=typeof Float64Array<"u";function i(u,f){return u[0]-f[0]}function s(){var u=this.stride,f=new Array(u.length),m;for(m=0;m<f.length;++m)f[m]=[Math.abs(u[m]),m];f.sort(i);var _=new Array(f.length);for(m=0;m<_.length;++m)_[m]=f[m][1];return _}function o(u,f){var m=["View",f,"d",u].join("");f<0&&(m="View_Nil"+u);var _=u==="generic";if(f===-1){var g="function "+m+"(a){this.data=a;};var proto="+m+".prototype;proto.dtype='"+u+"';proto.index=function(){return -1};proto.size=0;proto.dimension=-1;proto.shape=proto.stride=proto.order=[];proto.lo=proto.hi=proto.transpose=proto.step=function(){return new "+m+"(this.data);};proto.get=proto.set=function(){};proto.pick=function(){return null};return function construct_"+m+"(a){return new "+m+"(a);}",V=new Function(g);return V()}else if(f===0){var g="function "+m+"(a,d) {this.data = a;this.offset = d};var proto="+m+".prototype;proto.dtype='"+u+"';proto.index=function(){return this.offset};proto.dimension=0;proto.size=1;proto.shape=proto.stride=proto.order=[];proto.lo=proto.hi=proto.transpose=proto.step=function "+m+"_copy() {return new "+m+"(this.data,this.offset)};proto.pick=function "+m+"_pick(){return TrivialArray(this.data);};proto.valueOf=proto.get=function "+m+"_get(){return "+(_?"this.data.get(this.offset)":"this.data[this.offset]")+"};proto.set=function "+m+"_set(v){return "+(_?"this.data.set(this.offset,v)":"this.data[this.offset]=v")+"};return function construct_"+m+"(a,b,c,d){return new "+m+"(a,d)}",V=new Function("TrivialArray",g);return V(c[u][0])}var g=["'use strict'"],w=r(f),x=w.map(function(A){return"i"+A}),b="this.offset+"+w.map(function(A){return"this.stride["+A+"]*i"+A}).join("+"),k=w.map(function(A){return"b"+A}).join(","),S=w.map(function(A){return"c"+A}).join(",");g.push("function "+m+"(a,"+k+","+S+",d){this.data=a","this.shape=["+k+"]","this.stride=["+S+"]","this.offset=d|0}","var proto="+m+".prototype","proto.dtype='"+u+"'","proto.dimension="+f),g.push("Object.defineProperty(proto,'size',{get:function "+m+"_size(){return "+w.map(function(A){return"this.shape["+A+"]"}).join("*"),"}})"),f===1?g.push("proto.order=[0]"):(g.push("Object.defineProperty(proto,'order',{get:"),f<4?(g.push("function "+m+"_order(){"),f===2?g.push("return (Math.abs(this.stride[0])>Math.abs(this.stride[1]))?[1,0]:[0,1]}})"):f===3&&g.push("var s0=Math.abs(this.stride[0]),s1=Math.abs(this.stride[1]),s2=Math.abs(this.stride[2]);if(s0>s1){if(s1>s2){return [2,1,0];}else if(s0>s2){return [1,2,0];}else{return [1,0,2];}}else if(s0>s2){return [2,0,1];}else if(s2>s1){return [0,1,2];}else{return [0,2,1];}}})")):g.push("ORDER})")),g.push("proto.set=function "+m+"_set("+x.join(",")+",v){"),_?g.push("return this.data.set("+b+",v)}"):g.push("return this.data["+b+"]=v}"),g.push("proto.get=function "+m+"_get("+x.join(",")+"){"),_?g.push("return this.data.get("+b+")}"):g.push("return this.data["+b+"]}"),g.push("proto.index=function "+m+"_index(",x.join(),"){return "+b+"}"),g.push("proto.hi=function "+m+"_hi("+x.join(",")+"){return new "+m+"(this.data,"+w.map(function(A){return["(typeof i",A,"!=='number'||i",A,"<0)?this.shape[",A,"]:i",A,"|0"].join("")}).join(",")+","+w.map(function(A){return"this.stride["+A+"]"}).join(",")+",this.offset)}");var T=w.map(function(A){return"a"+A+"=this.shape["+A+"]"}),E=w.map(function(A){return"c"+A+"=this.stride["+A+"]"});g.push("proto.lo=function "+m+"_lo("+x.join(",")+"){var b=this.offset,d=0,"+T.join(",")+","+E.join(","));for(var I=0;I<f;++I)g.push("if(typeof i"+I+"==='number'&&i"+I+">=0){d=i"+I+"|0;b+=c"+I+"*d;a"+I+"-=d}");g.push("return new "+m+"(this.data,"+w.map(function(A){return"a"+A}).join(",")+","+w.map(function(A){return"c"+A}).join(",")+",b)}"),g.push("proto.step=function "+m+"_step("+x.join(",")+"){var "+w.map(function(A){return"a"+A+"=this.shape["+A+"]"}).join(",")+","+w.map(function(A){return"b"+A+"=this.stride["+A+"]"}).join(",")+",c=this.offset,d=0,ceil=Math.ceil");for(var I=0;I<f;++I)g.push("if(typeof i"+I+"==='number'){d=i"+I+"|0;if(d<0){c+=b"+I+"*(a"+I+"-1);a"+I+"=ceil(-a"+I+"/d)}else{a"+I+"=ceil(a"+I+"/d)}b"+I+"*=d}");g.push("return new "+m+"(this.data,"+w.map(function(A){return"a"+A}).join(",")+","+w.map(function(A){return"b"+A}).join(",")+",c)}");for(var N=new Array(f),D=new Array(f),I=0;I<f;++I)N[I]="a[i"+I+"]",D[I]="b[i"+I+"]";g.push("proto.transpose=function "+m+"_transpose("+x+"){"+x.map(function(A,W){return A+"=("+A+"===undefined?"+W+":"+A+"|0)"}).join(";"),"var a=this.shape,b=this.stride;return new "+m+"(this.data,"+N.join(",")+","+D.join(",")+",this.offset)}"),g.push("proto.pick=function "+m+"_pick("+x+"){var a=[],b=[],c=this.offset");for(var I=0;I<f;++I)g.push("if(typeof i"+I+"==='number'&&i"+I+">=0){c=(c+this.stride["+I+"]*i"+I+")|0}else{a.push(this.shape["+I+"]);b.push(this.stride["+I+"])}");g.push("var ctor=CTOR_LIST[a.length+1];return ctor(this.data,a,b,c)}"),g.push("return function construct_"+m+"(data,shape,stride,offset){return new "+m+"(data,"+w.map(function(A){return"shape["+A+"]"}).join(",")+","+w.map(function(A){return"stride["+A+"]"}).join(",")+",offset)}");var V=new Function("CTOR_LIST","ORDER",g.join(`
`));return V(c[u],s)}function d(u){if(a(u))return"buffer";if(n)switch(Object.prototype.toString.call(u)){case"[object Float64Array]":return"float64";case"[object Float32Array]":return"float32";case"[object Int8Array]":return"int8";case"[object Int16Array]":return"int16";case"[object Int32Array]":return"int32";case"[object Uint8Array]":return"uint8";case"[object Uint16Array]":return"uint16";case"[object Uint32Array]":return"uint32";case"[object Uint8ClampedArray]":return"uint8_clamped";case"[object BigInt64Array]":return"bigint64";case"[object BigUint64Array]":return"biguint64"}return Array.isArray(u)?"array":"generic"}var c={float32:[],float64:[],int8:[],int16:[],int32:[],uint8:[],uint16:[],uint32:[],array:[],uint8_clamped:[],bigint64:[],biguint64:[],buffer:[],generic:[]};function h(u,f,m,_){if(u===void 0){var S=c.array[0];return S([])}else typeof u=="number"&&(u=[u]);f===void 0&&(f=[u.length]);var g=f.length;if(m===void 0){m=new Array(g);for(var w=g-1,x=1;w>=0;--w)m[w]=x,x*=f[w]}if(_===void 0){_=0;for(var w=0;w<g;++w)m[w]<0&&(_-=(f[w]-1)*m[w])}for(var b=d(u),k=c[b];k.length<=g+1;)k.push(o(b,k.length-1));var S=k[g+1];return S(u,f,m,_)}t.exports=h}}),f0=typeof global=="object"&&global&&global.Object===Object&&global,m0=f0,g0=typeof self=="object"&&self&&self.Object===Object&&self,y0=m0||g0||Function("return this")(),Ls=y0,_0=Ls.Symbol,Qa=_0,Lm=Object.prototype,v0=Lm.hasOwnProperty,b0=Lm.toString,Mr=Qa?Qa.toStringTag:void 0;function w0(e){var t=v0.call(e,Mr),r=e[Mr];try{e[Mr]=void 0;var a=!0}catch{}var n=b0.call(e);return a&&(t?e[Mr]=r:delete e[Mr]),n}var $0=w0,x0=Object.prototype,k0=x0.toString;function S0(e){return k0.call(e)}var T0=S0,C0="[object Null]",I0="[object Undefined]",Hc=Qa?Qa.toStringTag:void 0;function E0(e){return e==null?e===void 0?I0:C0:Hc&&Hc in Object(e)?$0(e):T0(e)}var A0=E0;function z0(e){var t=typeof e;return e!=null&&(t=="object"||t=="function")}var Vm=z0,O0="[object AsyncFunction]",R0="[object Function]",M0="[object GeneratorFunction]",N0="[object Proxy]";function B0(e){if(!Vm(e))return!1;var t=A0(e);return t==R0||t==M0||t==O0||t==N0}var D0=B0,P0=Ls["__core-js_shared__"],Ri=P0,Gc=(function(){var e=/[^.]+$/.exec(Ri&&Ri.keys&&Ri.keys.IE_PROTO||"");return e?"Symbol(src)_1."+e:""})();function U0(e){return!!Gc&&Gc in e}var j0=U0,L0=Function.prototype,V0=L0.toString;function W0(e){if(e!=null){try{return V0.call(e)}catch{}try{return e+""}catch{}}return""}var q0=W0,F0=/[\\^$.*+?()[\]{}|]/g,H0=/^\[object .+?Constructor\]$/,G0=Function.prototype,Z0=Object.prototype,K0=G0.toString,Q0=Z0.hasOwnProperty,Y0=RegExp("^"+K0.call(Q0).replace(F0,"\\$&").replace(/hasOwnProperty|(function).*?(?=\\\()| for .+?(?=\\\])/g,"$1.*?")+"$");function J0(e){if(!Vm(e)||j0(e))return!1;var t=D0(e)?Y0:H0;return t.test(q0(e))}var X0=J0;function ev(e,t){return e?.[t]}var tv=ev;function rv(e,t){var r=tv(e,t);return X0(r)?r:void 0}var Wm=rv,av=Wm(Object,"create"),Gr=av;function nv(){this.__data__=Gr?Gr(null):{},this.size=0}var iv=nv;function sv(e){var t=this.has(e)&&delete this.__data__[e];return this.size-=t?1:0,t}var ov=sv,uv="__lodash_hash_undefined__",lv=Object.prototype,dv=lv.hasOwnProperty;function cv(e){var t=this.__data__;if(Gr){var r=t[e];return r===uv?void 0:r}return dv.call(t,e)?t[e]:void 0}var pv=cv,hv=Object.prototype,fv=hv.hasOwnProperty;function mv(e){var t=this.__data__;return Gr?t[e]!==void 0:fv.call(t,e)}var gv=mv,yv="__lodash_hash_undefined__";function _v(e,t){var r=this.__data__;return this.size+=this.has(e)?0:1,r[e]=Gr&&t===void 0?yv:t,this}var vv=_v;function _r(e){var t=-1,r=e==null?0:e.length;for(this.clear();++t<r;){var a=e[t];this.set(a[0],a[1])}}_r.prototype.clear=iv;_r.prototype.delete=ov;_r.prototype.get=pv;_r.prototype.has=gv;_r.prototype.set=vv;var Zc=_r;function bv(){this.__data__=[],this.size=0}var wv=bv;function $v(e,t){return e===t||e!==e&&t!==t}var xv=$v;function kv(e,t){for(var r=e.length;r--;)if(xv(e[r][0],t))return r;return-1}var un=kv,Sv=Array.prototype,Tv=Sv.splice;function Cv(e){var t=this.__data__,r=un(t,e);if(r<0)return!1;var a=t.length-1;return r==a?t.pop():Tv.call(t,r,1),--this.size,!0}var Iv=Cv;function Ev(e){var t=this.__data__,r=un(t,e);return r<0?void 0:t[r][1]}var Av=Ev;function zv(e){return un(this.__data__,e)>-1}var Ov=zv;function Rv(e,t){var r=this.__data__,a=un(r,e);return a<0?(++this.size,r.push([e,t])):r[a][1]=t,this}var Mv=Rv;function vr(e){var t=-1,r=e==null?0:e.length;for(this.clear();++t<r;){var a=e[t];this.set(a[0],a[1])}}vr.prototype.clear=wv;vr.prototype.delete=Iv;vr.prototype.get=Av;vr.prototype.has=Ov;vr.prototype.set=Mv;var Nv=vr,Bv=Wm(Ls,"Map"),Dv=Bv;function Pv(){this.size=0,this.__data__={hash:new Zc,map:new(Dv||Nv),string:new Zc}}var Uv=Pv;function jv(e){var t=typeof e;return t=="string"||t=="number"||t=="symbol"||t=="boolean"?e!=="__proto__":e===null}var Lv=jv;function Vv(e,t){var r=e.__data__;return Lv(t)?r[typeof t=="string"?"string":"hash"]:r.map}var ln=Vv;function Wv(e){var t=ln(this,e).delete(e);return this.size-=t?1:0,t}var qv=Wv;function Fv(e){return ln(this,e).get(e)}var Hv=Fv;function Gv(e){return ln(this,e).has(e)}var Zv=Gv;function Kv(e,t){var r=ln(this,e),a=r.size;return r.set(e,t),this.size+=r.size==a?0:1,this}var Qv=Kv;function br(e){var t=-1,r=e==null?0:e.length;for(this.clear();++t<r;){var a=e[t];this.set(a[0],a[1])}}br.prototype.clear=Uv;br.prototype.delete=qv;br.prototype.get=Hv;br.prototype.has=Zv;br.prototype.set=Qv;var qm=br,Yv="Expected a function";function Vs(e,t){if(typeof e!="function"||t!=null&&typeof t!="function")throw new TypeError(Yv);var r=function(){var a=arguments,n=t?t.apply(this,a):a[0],i=r.cache;if(i.has(n))return i.get(n);var s=e.apply(this,a);return r.cache=i.set(n,s)||i,s};return r.cache=new(Vs.Cache||qm),r}Vs.Cache=qm;var Jv=Vs,Ws=sn(on()),Fm=class Xi{constructor(t,r){this.type="application/octet-stream",this.params={},this.type=t,this.params=r}toString(){const t=[];for(const r in this.params){const a=this.params[r];t.push(`${r}=${a}`)}return[this.type,...t].join(";")}static create(t,r){return new Xi(t,r)}isIdentical(t){return this.type===t.type&&this.params===t.params}isEqual(t){return this.type===t.type}static fromString(t){const[r,...a]=t.split(";"),n={};for(const i of a){const[s,o]=i.split("=");n[s.trim()]=o.trim()}return new Xi(r,n)}},Mi=sn(on());async function Xv(e){const t=Fm.fromString(e.type);switch(t.type){case"image/x-alpha8":{const r=parseInt(t.params.width),a=parseInt(t.params.height);return(0,Mi.default)(new Uint8Array(await e.arrayBuffer()),[a,r,1])}case"image/x-rgba8":{const r=parseInt(t.params.width),a=parseInt(t.params.height);return(0,Mi.default)(new Uint8Array(await e.arrayBuffer()),[a,r,4])}case"application/octet-stream":case"image/png":case"image/jpeg":case"image/jpg":case"image/webp":{const r=await createImageBitmap(e),a=rb(r);return(0,Mi.default)(new Uint8Array(a.data),[a.height,a.width,4])}default:throw new Error(`Invalid format: ${t.type} with params: ${t.params}`)}}async function dn(e,t=.8,r="image/png"){const[a,n,i]=e.shape;switch(r){case"image/x-alpha8":case"image/x-rgba8":{const d=Fm.create(r,{width:n.toString(),height:a.toString()});return new Blob([e.data],{type:d.toString()})}case"image/png":case"image/jpeg":case"image/webp":{const d=new ImageData(new Uint8ClampedArray(e.data),n,a);var s=Hm(d.width,d.height),o=s.getContext("2d");return o.putImageData(d,0,0),s.convertToBlob({quality:t,type:r})}default:throw new Error(`Invalid format: ${r}`)}}function eb(e){return new RegExp("^(?:[a-z+]+:)?//","i").test(e)}function tb(e,t){return eb(e)?e:new URL(e,t).href}function rb(e){var t=Hm(e.width,e.height),r=t.getContext("2d");return r.drawImage(e,0,0),r.getImageData(0,0,t.width,t.height)}function ab(e){if(typeof Uint8Array<"u")return new Uint8Array(e);if(typeof Uint8ClampedArray<"u")return new Uint8ClampedArray(e);if(typeof Uint16Array<"u")return new Uint16Array(e);if(typeof Uint32Array<"u")return new Uint32Array(e);if(typeof Float32Array<"u")return new Float32Array(e);if(typeof Float64Array<"u")return new Float64Array(e);throw new Error("TypedArray not supported")}function es(e,t,r,a=!1){const[n,i,s]=e.shape;let o=i/t,d=n/r;a&&(o=d=Math.max(o,d)>1?Math.max(o,d):Math.min(o,d));const c=(0,Ws.default)(ab(s*t*r),[r,t,s]);for(let h=0;h<r;h++)for(let u=0;u<t;u++){const f=u*o,m=h*d,_=Math.max(Math.floor(f),0),g=Math.min(Math.ceil(f),i-1),w=Math.max(Math.floor(m),0),x=Math.min(Math.ceil(m),n-1),b=f-_,k=m-w;for(let S=0;S<s;S++){const T=e.get(w,_,S),E=e.get(w,g,S),I=e.get(x,_,S),N=e.get(x,g,S),D=(1-b)*(1-k)*T+b*(1-k)*E+(1-b)*k*I+b*k*N;c.set(h,u,S,D)}}return c}function nb(e,t=[128,128,128],r=[256,256,256]){var a=e.data;const[n,i,s]=e.shape,o=n*i,d=new Float32Array(3*o);for(let c=0,h=0;c<a.length;c+=4,h+=1)d[h]=(a[c]-t[0])/r[0],d[h+o]=(a[c+1]-t[1])/r[1],d[h+o+o]=(a[c+2]-t[2])/r[2];return(0,Ws.default)(d,[1,3,n,i])}async function Zr(e,t){return typeof e=="string"&&(e=tb(e,t.publicPath),e=new URL(e)),e instanceof URL&&(e=await(await fetch(e,{})).blob()),(e instanceof ArrayBuffer||ArrayBuffer.isView(e))&&(e=new Blob([e])),e instanceof Blob&&(e=await Xv(e)),e}function ib(e){const t=new Uint8Array(e.data.length);for(let r=0;r<e.data.length;r++)t[r]=e.data[r]*255;return(0,Ws.default)(t,e.shape)}function Hm(e,t){let r;if(typeof OffscreenCanvas<"u"?r=new OffscreenCanvas(e,t):r=document.createElement("canvas"),!r)throw new Error("Canvas nor OffscreenCanvas are available in the current context.");return r}var sb=sn(on()),Gm=async()=>navigator.gpu===void 0?!1:await navigator.gpu.requestAdapter()!==null,ob=()=>navigator.hardwareConcurrency??4;async function Kc(e,t){return URL.createObjectURL(await Zm(e,t))}async function Zm(e,t){const r=new URL("resources.json",t.publicPath),a=await fetch(r);if(!a.ok)throw new Error("Resource metadata not found. Ensure that the config.publicPath is configured correctly.");const i=(await a.json())[e];if(!i)throw new Error(`Resource ${e} not found. Ensure that the config.publicPath is configured correctly.`);const s=i.chunks;let o=0;const d=s.map(async u=>{const f=u.offsets[1]-u.offsets[0],m=t.publicPath?new URL(u.name,t.publicPath).toString():u.name,g=await(await fetch(m,t.fetchArgs)).blob();if(f!==g.size)throw new Error(`Failed to fetch ${e} with size ${f} but got ${g.size}`);return t.progress&&(o+=f,t.progress(`fetch:${e}`,o,i.size)),g}),c=await Promise.all(d),h=new Blob(c,{type:i.mime});if(h.size!==i.size)throw new Error(`Failed to fetch ${e} with size ${i.size} but got ${h.size}`);return h}var Nr=null,Km=async e=>(Nr!==null||(e?Nr=(await fu(async()=>{const{default:t}=await import("./ort.webgpu.bundle.min-BK0W-OBH.js");return{default:t}},[])).default:Nr=(await fu(async()=>{const{default:t}=await Promise.resolve().then(()=>s0);return{default:t}},void 0)).default),Nr);async function ub(e,t){const r=t.device==="gpu"&&await Gm(),a=r&&t.proxyToWorker,n=[r?"webgpu":"wasm"],i=await Km(r);t.debug&&(console.debug("	Using WebGPU:",r),console.debug("	Proxy to Worker:",a),i.env.debug=!0,i.env.logLevel="verbose"),i.env.wasm.numThreads=ob(),i.env.wasm.proxy=a;const s=r?"/onnxruntime-web/ort-wasm-simd-threaded.jsep":"/onnxruntime-web/ort-wasm-simd-threaded",o=await Kc(`${s}.wasm`,t),d=await Kc(`${s}.mjs`,t);i.env.wasm.wasmPaths={mjs:d,wasm:o},t.debug&&console.debug("ort.env.wasm:",i.env.wasm);const c={executionProviders:n,graphOptimizationLevel:"all",executionMode:"parallel",enableCpuMemArena:!0};return await i.InferenceSession.create(e,c).catch(u=>{throw new Error(`Failed to create session: "${u}". Please check if the publicPath is set correctly.`)})}async function lb(e,t,r,a){const n=a.device==="gpu"&&await Gm(),i=await Km(n),s={};for(const[c,h]of t)s[c]=new i.Tensor("float32",new Float32Array(h.data),h.shape);const o=await e.run(s,{}),d=[];for(const c of r){const h=o[c],u=h.dims,f=h.data,m=(0,sb.default)(f,u);d.push(m)}return d}var ve;(function(e){e.assertEqual=n=>n;function t(n){}e.assertIs=t;function r(n){throw new Error}e.assertNever=r,e.arrayToEnum=n=>{const i={};for(const s of n)i[s]=s;return i},e.getValidEnumValues=n=>{const i=e.objectKeys(n).filter(o=>typeof n[n[o]]!="number"),s={};for(const o of i)s[o]=n[o];return e.objectValues(s)},e.objectValues=n=>e.objectKeys(n).map(function(i){return n[i]}),e.objectKeys=typeof Object.keys=="function"?n=>Object.keys(n):n=>{const i=[];for(const s in n)Object.prototype.hasOwnProperty.call(n,s)&&i.push(s);return i},e.find=(n,i)=>{for(const s of n)if(i(s))return s},e.isInteger=typeof Number.isInteger=="function"?n=>Number.isInteger(n):n=>typeof n=="number"&&isFinite(n)&&Math.floor(n)===n;function a(n,i=" | "){return n.map(s=>typeof s=="string"?`'${s}'`:s).join(i)}e.joinValues=a,e.jsonStringifyReplacer=(n,i)=>typeof i=="bigint"?i.toString():i})(ve||(ve={}));var ts;(function(e){e.mergeShapes=(t,r)=>({...t,...r})})(ts||(ts={}));var Q=ve.arrayToEnum(["string","nan","number","integer","float","boolean","date","bigint","symbol","function","undefined","null","array","object","unknown","promise","void","never","map","set"]),wt=e=>{switch(typeof e){case"undefined":return Q.undefined;case"string":return Q.string;case"number":return isNaN(e)?Q.nan:Q.number;case"boolean":return Q.boolean;case"function":return Q.function;case"bigint":return Q.bigint;case"symbol":return Q.symbol;case"object":return Array.isArray(e)?Q.array:e===null?Q.null:e.then&&typeof e.then=="function"&&e.catch&&typeof e.catch=="function"?Q.promise:typeof Map<"u"&&e instanceof Map?Q.map:typeof Set<"u"&&e instanceof Set?Q.set:typeof Date<"u"&&e instanceof Date?Q.date:Q.object;default:return Q.unknown}},L=ve.arrayToEnum(["invalid_type","invalid_literal","custom","invalid_union","invalid_union_discriminator","invalid_enum_value","unrecognized_keys","invalid_arguments","invalid_return_type","invalid_date","invalid_string","too_small","too_big","invalid_intersection_types","not_multiple_of","not_finite"]),db=e=>JSON.stringify(e,null,2).replace(/"([^"]+)":/g,"$1:"),it=class Qm extends Error{get errors(){return this.issues}constructor(t){super(),this.issues=[],this.addIssue=a=>{this.issues=[...this.issues,a]},this.addIssues=(a=[])=>{this.issues=[...this.issues,...a]};const r=new.target.prototype;Object.setPrototypeOf?Object.setPrototypeOf(this,r):this.__proto__=r,this.name="ZodError",this.issues=t}format(t){const r=t||function(i){return i.message},a={_errors:[]},n=i=>{for(const s of i.issues)if(s.code==="invalid_union")s.unionErrors.map(n);else if(s.code==="invalid_return_type")n(s.returnTypeError);else if(s.code==="invalid_arguments")n(s.argumentsError);else if(s.path.length===0)a._errors.push(r(s));else{let o=a,d=0;for(;d<s.path.length;){const c=s.path[d];d===s.path.length-1?(o[c]=o[c]||{_errors:[]},o[c]._errors.push(r(s))):o[c]=o[c]||{_errors:[]},o=o[c],d++}}};return n(this),a}static assert(t){if(!(t instanceof Qm))throw new Error(`Not a ZodError: ${t}`)}toString(){return this.message}get message(){return JSON.stringify(this.issues,ve.jsonStringifyReplacer,2)}get isEmpty(){return this.issues.length===0}flatten(t=r=>r.message){const r={},a=[];for(const n of this.issues)n.path.length>0?(r[n.path[0]]=r[n.path[0]]||[],r[n.path[0]].push(t(n))):a.push(t(n));return{formErrors:a,fieldErrors:r}}get formErrors(){return this.flatten()}};it.create=e=>new it(e);var fr=(e,t)=>{let r;switch(e.code){case L.invalid_type:e.received===Q.undefined?r="Required":r=`Expected ${e.expected}, received ${e.received}`;break;case L.invalid_literal:r=`Invalid literal value, expected ${JSON.stringify(e.expected,ve.jsonStringifyReplacer)}`;break;case L.unrecognized_keys:r=`Unrecognized key(s) in object: ${ve.joinValues(e.keys,", ")}`;break;case L.invalid_union:r="Invalid input";break;case L.invalid_union_discriminator:r=`Invalid discriminator value. Expected ${ve.joinValues(e.options)}`;break;case L.invalid_enum_value:r=`Invalid enum value. Expected ${ve.joinValues(e.options)}, received '${e.received}'`;break;case L.invalid_arguments:r="Invalid function arguments";break;case L.invalid_return_type:r="Invalid function return type";break;case L.invalid_date:r="Invalid date";break;case L.invalid_string:typeof e.validation=="object"?"includes"in e.validation?(r=`Invalid input: must include "${e.validation.includes}"`,typeof e.validation.position=="number"&&(r=`${r} at one or more positions greater than or equal to ${e.validation.position}`)):"startsWith"in e.validation?r=`Invalid input: must start with "${e.validation.startsWith}"`:"endsWith"in e.validation?r=`Invalid input: must end with "${e.validation.endsWith}"`:ve.assertNever(e.validation):e.validation!=="regex"?r=`Invalid ${e.validation}`:r="Invalid";break;case L.too_small:e.type==="array"?r=`Array must contain ${e.exact?"exactly":e.inclusive?"at least":"more than"} ${e.minimum} element(s)`:e.type==="string"?r=`String must contain ${e.exact?"exactly":e.inclusive?"at least":"over"} ${e.minimum} character(s)`:e.type==="number"?r=`Number must be ${e.exact?"exactly equal to ":e.inclusive?"greater than or equal to ":"greater than "}${e.minimum}`:e.type==="date"?r=`Date must be ${e.exact?"exactly equal to ":e.inclusive?"greater than or equal to ":"greater than "}${new Date(Number(e.minimum))}`:r="Invalid input";break;case L.too_big:e.type==="array"?r=`Array must contain ${e.exact?"exactly":e.inclusive?"at most":"less than"} ${e.maximum} element(s)`:e.type==="string"?r=`String must contain ${e.exact?"exactly":e.inclusive?"at most":"under"} ${e.maximum} character(s)`:e.type==="number"?r=`Number must be ${e.exact?"exactly":e.inclusive?"less than or equal to":"less than"} ${e.maximum}`:e.type==="bigint"?r=`BigInt must be ${e.exact?"exactly":e.inclusive?"less than or equal to":"less than"} ${e.maximum}`:e.type==="date"?r=`Date must be ${e.exact?"exactly":e.inclusive?"smaller than or equal to":"smaller than"} ${new Date(Number(e.maximum))}`:r="Invalid input";break;case L.custom:r="Invalid input";break;case L.invalid_intersection_types:r="Intersection results could not be merged";break;case L.not_multiple_of:r=`Number must be a multiple of ${e.multipleOf}`;break;case L.not_finite:r="Number must be finite";break;default:r=t.defaultError,ve.assertNever(e)}return{message:r}},Ym=fr;function cb(e){Ym=e}function Ya(){return Ym}var Ja=e=>{const{data:t,path:r,errorMaps:a,issueData:n}=e,i=[...r,...n.path||[]],s={...n,path:i};if(n.message!==void 0)return{...n,path:i,message:n.message};let o="";const d=a.filter(c=>!!c).slice().reverse();for(const c of d)o=c(s,{data:t,defaultError:o}).message;return{...n,path:i,message:o}},pb=[];function H(e,t){const r=Ya(),a=Ja({issueData:t,data:e.data,path:e.path,errorMaps:[e.common.contextualErrorMap,e.schemaErrorMap,r,r===fr?void 0:fr].filter(n=>!!n)});e.common.issues.push(a)}var Ve=class Jm{constructor(){this.value="valid"}dirty(){this.value==="valid"&&(this.value="dirty")}abort(){this.value!=="aborted"&&(this.value="aborted")}static mergeArray(t,r){const a=[];for(const n of r){if(n.status==="aborted")return ue;n.status==="dirty"&&t.dirty(),a.push(n.value)}return{status:t.value,value:a}}static async mergeObjectAsync(t,r){const a=[];for(const n of r){const i=await n.key,s=await n.value;a.push({key:i,value:s})}return Jm.mergeObjectSync(t,a)}static mergeObjectSync(t,r){const a={};for(const n of r){const{key:i,value:s}=n;if(i.status==="aborted"||s.status==="aborted")return ue;i.status==="dirty"&&t.dirty(),s.status==="dirty"&&t.dirty(),i.value!=="__proto__"&&(typeof s.value<"u"||n.alwaysSet)&&(a[i.value]=s.value)}return{status:t.value,value:a}}},ue=Object.freeze({status:"aborted"}),cr=e=>({status:"dirty",value:e}),Le=e=>({status:"valid",value:e}),rs=e=>e.status==="aborted",as=e=>e.status==="dirty",Xt=e=>e.status==="valid",Kr=e=>typeof Promise<"u"&&e instanceof Promise;function Xa(e,t,r,a){if(typeof t=="function"?e!==t||!0:!t.has(e))throw new TypeError("Cannot read private member from an object whose class did not declare it");return t.get(e)}function Xm(e,t,r,a,n){if(typeof t=="function"?e!==t||!0:!t.has(e))throw new TypeError("Cannot write private member to an object whose class did not declare it");return t.set(e,r),r}var te;(function(e){e.errToObj=t=>typeof t=="string"?{message:t}:t||{},e.toString=t=>typeof t=="string"?t:t?.message})(te||(te={}));var Lr,Vr,mt=class{constructor(e,t,r,a){this._cachedPath=[],this.parent=e,this.data=t,this._path=r,this._key=a}get path(){return this._cachedPath.length||(this._key instanceof Array?this._cachedPath.push(...this._path,...this._key):this._cachedPath.push(...this._path,this._key)),this._cachedPath}},Qc=(e,t)=>{if(Xt(t))return{success:!0,data:t.value};if(!e.common.issues.length)throw new Error("Validation failed but no issues detected.");return{success:!1,get error(){if(this._error)return this._error;const r=new it(e.common.issues);return this._error=r,this._error}}};function pe(e){if(!e)return{};const{errorMap:t,invalid_type_error:r,required_error:a,description:n}=e;if(t&&(r||a))throw new Error(`Can't use "invalid_type_error" or "required_error" in conjunction with custom error map.`);return t?{errorMap:t,description:n}:{errorMap:(s,o)=>{var d,c;const{message:h}=e;return s.code==="invalid_enum_value"?{message:h??o.defaultError}:typeof o.data>"u"?{message:(d=h??a)!==null&&d!==void 0?d:o.defaultError}:s.code!=="invalid_type"?{message:o.defaultError}:{message:(c=h??r)!==null&&c!==void 0?c:o.defaultError}},description:n}}var he=class{get description(){return this._def.description}_getType(e){return wt(e.data)}_getOrReturnCtx(e,t){return t||{common:e.parent.common,data:e.data,parsedType:wt(e.data),schemaErrorMap:this._def.errorMap,path:e.path,parent:e.parent}}_processInputParams(e){return{status:new Ve,ctx:{common:e.parent.common,data:e.data,parsedType:wt(e.data),schemaErrorMap:this._def.errorMap,path:e.path,parent:e.parent}}}_parseSync(e){const t=this._parse(e);if(Kr(t))throw new Error("Synchronous parse encountered promise.");return t}_parseAsync(e){const t=this._parse(e);return Promise.resolve(t)}parse(e,t){const r=this.safeParse(e,t);if(r.success)return r.data;throw r.error}safeParse(e,t){var r;const a={common:{issues:[],async:(r=t?.async)!==null&&r!==void 0?r:!1,contextualErrorMap:t?.errorMap},path:t?.path||[],schemaErrorMap:this._def.errorMap,parent:null,data:e,parsedType:wt(e)},n=this._parseSync({data:e,path:a.path,parent:a});return Qc(a,n)}"~validate"(e){var t,r;const a={common:{issues:[],async:!!this["~standard"].async},path:[],schemaErrorMap:this._def.errorMap,parent:null,data:e,parsedType:wt(e)};if(!this["~standard"].async)try{const n=this._parseSync({data:e,path:[],parent:a});return Xt(n)?{value:n.value}:{issues:a.common.issues}}catch(n){!((r=(t=n?.message)===null||t===void 0?void 0:t.toLowerCase())===null||r===void 0)&&r.includes("encountered")&&(this["~standard"].async=!0),a.common={issues:[],async:!0}}return this._parseAsync({data:e,path:[],parent:a}).then(n=>Xt(n)?{value:n.value}:{issues:a.common.issues})}async parseAsync(e,t){const r=await this.safeParseAsync(e,t);if(r.success)return r.data;throw r.error}async safeParseAsync(e,t){const r={common:{issues:[],contextualErrorMap:t?.errorMap,async:!0},path:t?.path||[],schemaErrorMap:this._def.errorMap,parent:null,data:e,parsedType:wt(e)},a=this._parse({data:e,path:r.path,parent:r}),n=await(Kr(a)?a:Promise.resolve(a));return Qc(r,n)}refine(e,t){const r=a=>typeof t=="string"||typeof t>"u"?{message:t}:typeof t=="function"?t(a):t;return this._refinement((a,n)=>{const i=e(a),s=()=>n.addIssue({code:L.custom,...r(a)});return typeof Promise<"u"&&i instanceof Promise?i.then(o=>o?!0:(s(),!1)):i?!0:(s(),!1)})}refinement(e,t){return this._refinement((r,a)=>e(r)?!0:(a.addIssue(typeof t=="function"?t(r,a):t),!1))}_refinement(e){return new ot({schema:this,typeName:oe.ZodEffects,effect:{type:"refinement",refinement:e}})}superRefine(e){return this._refinement(e)}constructor(e){this.spa=this.safeParseAsync,this._def=e,this.parse=this.parse.bind(this),this.safeParse=this.safeParse.bind(this),this.parseAsync=this.parseAsync.bind(this),this.safeParseAsync=this.safeParseAsync.bind(this),this.spa=this.spa.bind(this),this.refine=this.refine.bind(this),this.refinement=this.refinement.bind(this),this.superRefine=this.superRefine.bind(this),this.optional=this.optional.bind(this),this.nullable=this.nullable.bind(this),this.nullish=this.nullish.bind(this),this.array=this.array.bind(this),this.promise=this.promise.bind(this),this.or=this.or.bind(this),this.and=this.and.bind(this),this.transform=this.transform.bind(this),this.brand=this.brand.bind(this),this.default=this.default.bind(this),this.catch=this.catch.bind(this),this.describe=this.describe.bind(this),this.pipe=this.pipe.bind(this),this.readonly=this.readonly.bind(this),this.isNullable=this.isNullable.bind(this),this.isOptional=this.isOptional.bind(this),this["~standard"]={version:1,vendor:"zod",validate:t=>this["~validate"](t)}}optional(){return ft.create(this,this._def)}nullable(){return Bt.create(this,this._def)}nullish(){return this.nullable().optional()}array(){return er.create(this)}promise(){return yr.create(this,this._def)}or(e){return ra.create([this,e],this._def)}and(e){return aa.create(this,e,this._def)}transform(e){return new ot({...pe(this._def),schema:this,typeName:oe.ZodEffects,effect:{type:"transform",transform:e}})}default(e){const t=typeof e=="function"?e:()=>e;return new oa({...pe(this._def),innerType:this,defaultValue:t,typeName:oe.ZodDefault})}brand(){return new qs({typeName:oe.ZodBranded,type:this,...pe(this._def)})}catch(e){const t=typeof e=="function"?e:()=>e;return new ua({...pe(this._def),innerType:this,catchValue:t,typeName:oe.ZodCatch})}describe(e){const t=this.constructor;return new t({...this._def,description:e})}pipe(e){return Fs.create(this,e)}readonly(){return la.create(this)}isOptional(){return this.safeParse(void 0).success}isNullable(){return this.safeParse(null).success}},hb=/^c[^\s-]{8,}$/i,fb=/^[0-9a-z]+$/,mb=/^[0-9A-HJKMNP-TV-Z]{26}$/i,gb=/^[0-9a-fA-F]{8}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{12}$/i,yb=/^[a-z0-9_-]{21}$/i,_b=/^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]*$/,vb=/^[-+]?P(?!$)(?:(?:[-+]?\d+Y)|(?:[-+]?\d+[.,]\d+Y$))?(?:(?:[-+]?\d+M)|(?:[-+]?\d+[.,]\d+M$))?(?:(?:[-+]?\d+W)|(?:[-+]?\d+[.,]\d+W$))?(?:(?:[-+]?\d+D)|(?:[-+]?\d+[.,]\d+D$))?(?:T(?=[\d+-])(?:(?:[-+]?\d+H)|(?:[-+]?\d+[.,]\d+H$))?(?:(?:[-+]?\d+M)|(?:[-+]?\d+[.,]\d+M$))?(?:[-+]?\d+(?:[.,]\d+)?S)?)??$/,bb=/^(?!\.)(?!.*\.\.)([A-Z0-9_'+\-\.]*)[A-Z0-9_+-]@([A-Z0-9][A-Z0-9\-]*\.)+[A-Z]{2,}$/i,wb="^(\\p{Extended_Pictographic}|\\p{Emoji_Component})+$",Ni,$b=/^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])$/,xb=/^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\/(3[0-2]|[12]?[0-9])$/,kb=/^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))$/,Sb=/^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))\/(12[0-8]|1[01][0-9]|[1-9]?[0-9])$/,Tb=/^([0-9a-zA-Z+/]{4})*(([0-9a-zA-Z+/]{2}==)|([0-9a-zA-Z+/]{3}=))?$/,Cb=/^([0-9a-zA-Z-_]{4})*(([0-9a-zA-Z-_]{2}(==)?)|([0-9a-zA-Z-_]{3}(=)?))?$/,eg="((\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-((0[13578]|1[02])-(0[1-9]|[12]\\d|3[01])|(0[469]|11)-(0[1-9]|[12]\\d|30)|(02)-(0[1-9]|1\\d|2[0-8])))",Ib=new RegExp(`^${eg}$`);function tg(e){let t="([01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d";return e.precision?t=`${t}\\.\\d{${e.precision}}`:e.precision==null&&(t=`${t}(\\.\\d+)?`),t}function Eb(e){return new RegExp(`^${tg(e)}$`)}function rg(e){let t=`${eg}T${tg(e)}`;const r=[];return r.push(e.local?"Z?":"Z"),e.offset&&r.push("([+-]\\d{2}:?\\d{2})"),t=`${t}(${r.join("|")})`,new RegExp(`^${t}$`)}function Ab(e,t){return!!((t==="v4"||!t)&&$b.test(e)||(t==="v6"||!t)&&kb.test(e))}function zb(e,t){if(!_b.test(e))return!1;try{const[r]=e.split("."),a=r.replace(/-/g,"+").replace(/_/g,"/").padEnd(r.length+(4-r.length%4)%4,"="),n=JSON.parse(atob(a));return!(typeof n!="object"||n===null||!n.typ||!n.alg||t&&n.alg!==t)}catch{return!1}}function Ob(e,t){return!!((t==="v4"||!t)&&xb.test(e)||(t==="v6"||!t)&&Sb.test(e))}var mr=class Wr extends he{_parse(t){if(this._def.coerce&&(t.data=String(t.data)),this._getType(t)!==Q.string){const i=this._getOrReturnCtx(t);return H(i,{code:L.invalid_type,expected:Q.string,received:i.parsedType}),ue}const a=new Ve;let n;for(const i of this._def.checks)if(i.kind==="min")t.data.length<i.value&&(n=this._getOrReturnCtx(t,n),H(n,{code:L.too_small,minimum:i.value,type:"string",inclusive:!0,exact:!1,message:i.message}),a.dirty());else if(i.kind==="max")t.data.length>i.value&&(n=this._getOrReturnCtx(t,n),H(n,{code:L.too_big,maximum:i.value,type:"string",inclusive:!0,exact:!1,message:i.message}),a.dirty());else if(i.kind==="length"){const s=t.data.length>i.value,o=t.data.length<i.value;(s||o)&&(n=this._getOrReturnCtx(t,n),s?H(n,{code:L.too_big,maximum:i.value,type:"string",inclusive:!0,exact:!0,message:i.message}):o&&H(n,{code:L.too_small,minimum:i.value,type:"string",inclusive:!0,exact:!0,message:i.message}),a.dirty())}else if(i.kind==="email")bb.test(t.data)||(n=this._getOrReturnCtx(t,n),H(n,{validation:"email",code:L.invalid_string,message:i.message}),a.dirty());else if(i.kind==="emoji")Ni||(Ni=new RegExp(wb,"u")),Ni.test(t.data)||(n=this._getOrReturnCtx(t,n),H(n,{validation:"emoji",code:L.invalid_string,message:i.message}),a.dirty());else if(i.kind==="uuid")gb.test(t.data)||(n=this._getOrReturnCtx(t,n),H(n,{validation:"uuid",code:L.invalid_string,message:i.message}),a.dirty());else if(i.kind==="nanoid")yb.test(t.data)||(n=this._getOrReturnCtx(t,n),H(n,{validation:"nanoid",code:L.invalid_string,message:i.message}),a.dirty());else if(i.kind==="cuid")hb.test(t.data)||(n=this._getOrReturnCtx(t,n),H(n,{validation:"cuid",code:L.invalid_string,message:i.message}),a.dirty());else if(i.kind==="cuid2")fb.test(t.data)||(n=this._getOrReturnCtx(t,n),H(n,{validation:"cuid2",code:L.invalid_string,message:i.message}),a.dirty());else if(i.kind==="ulid")mb.test(t.data)||(n=this._getOrReturnCtx(t,n),H(n,{validation:"ulid",code:L.invalid_string,message:i.message}),a.dirty());else if(i.kind==="url")try{new URL(t.data)}catch{n=this._getOrReturnCtx(t,n),H(n,{validation:"url",code:L.invalid_string,message:i.message}),a.dirty()}else i.kind==="regex"?(i.regex.lastIndex=0,i.regex.test(t.data)||(n=this._getOrReturnCtx(t,n),H(n,{validation:"regex",code:L.invalid_string,message:i.message}),a.dirty())):i.kind==="trim"?t.data=t.data.trim():i.kind==="includes"?t.data.includes(i.value,i.position)||(n=this._getOrReturnCtx(t,n),H(n,{code:L.invalid_string,validation:{includes:i.value,position:i.position},message:i.message}),a.dirty()):i.kind==="toLowerCase"?t.data=t.data.toLowerCase():i.kind==="toUpperCase"?t.data=t.data.toUpperCase():i.kind==="startsWith"?t.data.startsWith(i.value)||(n=this._getOrReturnCtx(t,n),H(n,{code:L.invalid_string,validation:{startsWith:i.value},message:i.message}),a.dirty()):i.kind==="endsWith"?t.data.endsWith(i.value)||(n=this._getOrReturnCtx(t,n),H(n,{code:L.invalid_string,validation:{endsWith:i.value},message:i.message}),a.dirty()):i.kind==="datetime"?rg(i).test(t.data)||(n=this._getOrReturnCtx(t,n),H(n,{code:L.invalid_string,validation:"datetime",message:i.message}),a.dirty()):i.kind==="date"?Ib.test(t.data)||(n=this._getOrReturnCtx(t,n),H(n,{code:L.invalid_string,validation:"date",message:i.message}),a.dirty()):i.kind==="time"?Eb(i).test(t.data)||(n=this._getOrReturnCtx(t,n),H(n,{code:L.invalid_string,validation:"time",message:i.message}),a.dirty()):i.kind==="duration"?vb.test(t.data)||(n=this._getOrReturnCtx(t,n),H(n,{validation:"duration",code:L.invalid_string,message:i.message}),a.dirty()):i.kind==="ip"?Ab(t.data,i.version)||(n=this._getOrReturnCtx(t,n),H(n,{validation:"ip",code:L.invalid_string,message:i.message}),a.dirty()):i.kind==="jwt"?zb(t.data,i.alg)||(n=this._getOrReturnCtx(t,n),H(n,{validation:"jwt",code:L.invalid_string,message:i.message}),a.dirty()):i.kind==="cidr"?Ob(t.data,i.version)||(n=this._getOrReturnCtx(t,n),H(n,{validation:"cidr",code:L.invalid_string,message:i.message}),a.dirty()):i.kind==="base64"?Tb.test(t.data)||(n=this._getOrReturnCtx(t,n),H(n,{validation:"base64",code:L.invalid_string,message:i.message}),a.dirty()):i.kind==="base64url"?Cb.test(t.data)||(n=this._getOrReturnCtx(t,n),H(n,{validation:"base64url",code:L.invalid_string,message:i.message}),a.dirty()):ve.assertNever(i);return{status:a.value,value:t.data}}_regex(t,r,a){return this.refinement(n=>t.test(n),{validation:r,code:L.invalid_string,...te.errToObj(a)})}_addCheck(t){return new Wr({...this._def,checks:[...this._def.checks,t]})}email(t){return this._addCheck({kind:"email",...te.errToObj(t)})}url(t){return this._addCheck({kind:"url",...te.errToObj(t)})}emoji(t){return this._addCheck({kind:"emoji",...te.errToObj(t)})}uuid(t){return this._addCheck({kind:"uuid",...te.errToObj(t)})}nanoid(t){return this._addCheck({kind:"nanoid",...te.errToObj(t)})}cuid(t){return this._addCheck({kind:"cuid",...te.errToObj(t)})}cuid2(t){return this._addCheck({kind:"cuid2",...te.errToObj(t)})}ulid(t){return this._addCheck({kind:"ulid",...te.errToObj(t)})}base64(t){return this._addCheck({kind:"base64",...te.errToObj(t)})}base64url(t){return this._addCheck({kind:"base64url",...te.errToObj(t)})}jwt(t){return this._addCheck({kind:"jwt",...te.errToObj(t)})}ip(t){return this._addCheck({kind:"ip",...te.errToObj(t)})}cidr(t){return this._addCheck({kind:"cidr",...te.errToObj(t)})}datetime(t){var r,a;return typeof t=="string"?this._addCheck({kind:"datetime",precision:null,offset:!1,local:!1,message:t}):this._addCheck({kind:"datetime",precision:typeof t?.precision>"u"?null:t?.precision,offset:(r=t?.offset)!==null&&r!==void 0?r:!1,local:(a=t?.local)!==null&&a!==void 0?a:!1,...te.errToObj(t?.message)})}date(t){return this._addCheck({kind:"date",message:t})}time(t){return typeof t=="string"?this._addCheck({kind:"time",precision:null,message:t}):this._addCheck({kind:"time",precision:typeof t?.precision>"u"?null:t?.precision,...te.errToObj(t?.message)})}duration(t){return this._addCheck({kind:"duration",...te.errToObj(t)})}regex(t,r){return this._addCheck({kind:"regex",regex:t,...te.errToObj(r)})}includes(t,r){return this._addCheck({kind:"includes",value:t,position:r?.position,...te.errToObj(r?.message)})}startsWith(t,r){return this._addCheck({kind:"startsWith",value:t,...te.errToObj(r)})}endsWith(t,r){return this._addCheck({kind:"endsWith",value:t,...te.errToObj(r)})}min(t,r){return this._addCheck({kind:"min",value:t,...te.errToObj(r)})}max(t,r){return this._addCheck({kind:"max",value:t,...te.errToObj(r)})}length(t,r){return this._addCheck({kind:"length",value:t,...te.errToObj(r)})}nonempty(t){return this.min(1,te.errToObj(t))}trim(){return new Wr({...this._def,checks:[...this._def.checks,{kind:"trim"}]})}toLowerCase(){return new Wr({...this._def,checks:[...this._def.checks,{kind:"toLowerCase"}]})}toUpperCase(){return new Wr({...this._def,checks:[...this._def.checks,{kind:"toUpperCase"}]})}get isDatetime(){return!!this._def.checks.find(t=>t.kind==="datetime")}get isDate(){return!!this._def.checks.find(t=>t.kind==="date")}get isTime(){return!!this._def.checks.find(t=>t.kind==="time")}get isDuration(){return!!this._def.checks.find(t=>t.kind==="duration")}get isEmail(){return!!this._def.checks.find(t=>t.kind==="email")}get isURL(){return!!this._def.checks.find(t=>t.kind==="url")}get isEmoji(){return!!this._def.checks.find(t=>t.kind==="emoji")}get isUUID(){return!!this._def.checks.find(t=>t.kind==="uuid")}get isNANOID(){return!!this._def.checks.find(t=>t.kind==="nanoid")}get isCUID(){return!!this._def.checks.find(t=>t.kind==="cuid")}get isCUID2(){return!!this._def.checks.find(t=>t.kind==="cuid2")}get isULID(){return!!this._def.checks.find(t=>t.kind==="ulid")}get isIP(){return!!this._def.checks.find(t=>t.kind==="ip")}get isCIDR(){return!!this._def.checks.find(t=>t.kind==="cidr")}get isBase64(){return!!this._def.checks.find(t=>t.kind==="base64")}get isBase64url(){return!!this._def.checks.find(t=>t.kind==="base64url")}get minLength(){let t=null;for(const r of this._def.checks)r.kind==="min"&&(t===null||r.value>t)&&(t=r.value);return t}get maxLength(){let t=null;for(const r of this._def.checks)r.kind==="max"&&(t===null||r.value<t)&&(t=r.value);return t}};mr.create=e=>{var t;return new mr({checks:[],typeName:oe.ZodString,coerce:(t=e?.coerce)!==null&&t!==void 0?t:!1,...pe(e)})};function Rb(e,t){const r=(e.toString().split(".")[1]||"").length,a=(t.toString().split(".")[1]||"").length,n=r>a?r:a,i=parseInt(e.toFixed(n).replace(".","")),s=parseInt(t.toFixed(n).replace(".",""));return i%s/Math.pow(10,n)}var Qr=class ns extends he{constructor(){super(...arguments),this.min=this.gte,this.max=this.lte,this.step=this.multipleOf}_parse(t){if(this._def.coerce&&(t.data=Number(t.data)),this._getType(t)!==Q.number){const i=this._getOrReturnCtx(t);return H(i,{code:L.invalid_type,expected:Q.number,received:i.parsedType}),ue}let a;const n=new Ve;for(const i of this._def.checks)i.kind==="int"?ve.isInteger(t.data)||(a=this._getOrReturnCtx(t,a),H(a,{code:L.invalid_type,expected:"integer",received:"float",message:i.message}),n.dirty()):i.kind==="min"?(i.inclusive?t.data<i.value:t.data<=i.value)&&(a=this._getOrReturnCtx(t,a),H(a,{code:L.too_small,minimum:i.value,type:"number",inclusive:i.inclusive,exact:!1,message:i.message}),n.dirty()):i.kind==="max"?(i.inclusive?t.data>i.value:t.data>=i.value)&&(a=this._getOrReturnCtx(t,a),H(a,{code:L.too_big,maximum:i.value,type:"number",inclusive:i.inclusive,exact:!1,message:i.message}),n.dirty()):i.kind==="multipleOf"?Rb(t.data,i.value)!==0&&(a=this._getOrReturnCtx(t,a),H(a,{code:L.not_multiple_of,multipleOf:i.value,message:i.message}),n.dirty()):i.kind==="finite"?Number.isFinite(t.data)||(a=this._getOrReturnCtx(t,a),H(a,{code:L.not_finite,message:i.message}),n.dirty()):ve.assertNever(i);return{status:n.value,value:t.data}}gte(t,r){return this.setLimit("min",t,!0,te.toString(r))}gt(t,r){return this.setLimit("min",t,!1,te.toString(r))}lte(t,r){return this.setLimit("max",t,!0,te.toString(r))}lt(t,r){return this.setLimit("max",t,!1,te.toString(r))}setLimit(t,r,a,n){return new ns({...this._def,checks:[...this._def.checks,{kind:t,value:r,inclusive:a,message:te.toString(n)}]})}_addCheck(t){return new ns({...this._def,checks:[...this._def.checks,t]})}int(t){return this._addCheck({kind:"int",message:te.toString(t)})}positive(t){return this._addCheck({kind:"min",value:0,inclusive:!1,message:te.toString(t)})}negative(t){return this._addCheck({kind:"max",value:0,inclusive:!1,message:te.toString(t)})}nonpositive(t){return this._addCheck({kind:"max",value:0,inclusive:!0,message:te.toString(t)})}nonnegative(t){return this._addCheck({kind:"min",value:0,inclusive:!0,message:te.toString(t)})}multipleOf(t,r){return this._addCheck({kind:"multipleOf",value:t,message:te.toString(r)})}finite(t){return this._addCheck({kind:"finite",message:te.toString(t)})}safe(t){return this._addCheck({kind:"min",inclusive:!0,value:Number.MIN_SAFE_INTEGER,message:te.toString(t)})._addCheck({kind:"max",inclusive:!0,value:Number.MAX_SAFE_INTEGER,message:te.toString(t)})}get minValue(){let t=null;for(const r of this._def.checks)r.kind==="min"&&(t===null||r.value>t)&&(t=r.value);return t}get maxValue(){let t=null;for(const r of this._def.checks)r.kind==="max"&&(t===null||r.value<t)&&(t=r.value);return t}get isInt(){return!!this._def.checks.find(t=>t.kind==="int"||t.kind==="multipleOf"&&ve.isInteger(t.value))}get isFinite(){let t=null,r=null;for(const a of this._def.checks){if(a.kind==="finite"||a.kind==="int"||a.kind==="multipleOf")return!0;a.kind==="min"?(r===null||a.value>r)&&(r=a.value):a.kind==="max"&&(t===null||a.value<t)&&(t=a.value)}return Number.isFinite(r)&&Number.isFinite(t)}};Qr.create=e=>new Qr({checks:[],typeName:oe.ZodNumber,coerce:e?.coerce||!1,...pe(e)});var Yr=class is extends he{constructor(){super(...arguments),this.min=this.gte,this.max=this.lte}_parse(t){if(this._def.coerce)try{t.data=BigInt(t.data)}catch{return this._getInvalidInput(t)}if(this._getType(t)!==Q.bigint)return this._getInvalidInput(t);let a;const n=new Ve;for(const i of this._def.checks)i.kind==="min"?(i.inclusive?t.data<i.value:t.data<=i.value)&&(a=this._getOrReturnCtx(t,a),H(a,{code:L.too_small,type:"bigint",minimum:i.value,inclusive:i.inclusive,message:i.message}),n.dirty()):i.kind==="max"?(i.inclusive?t.data>i.value:t.data>=i.value)&&(a=this._getOrReturnCtx(t,a),H(a,{code:L.too_big,type:"bigint",maximum:i.value,inclusive:i.inclusive,message:i.message}),n.dirty()):i.kind==="multipleOf"?t.data%i.value!==BigInt(0)&&(a=this._getOrReturnCtx(t,a),H(a,{code:L.not_multiple_of,multipleOf:i.value,message:i.message}),n.dirty()):ve.assertNever(i);return{status:n.value,value:t.data}}_getInvalidInput(t){const r=this._getOrReturnCtx(t);return H(r,{code:L.invalid_type,expected:Q.bigint,received:r.parsedType}),ue}gte(t,r){return this.setLimit("min",t,!0,te.toString(r))}gt(t,r){return this.setLimit("min",t,!1,te.toString(r))}lte(t,r){return this.setLimit("max",t,!0,te.toString(r))}lt(t,r){return this.setLimit("max",t,!1,te.toString(r))}setLimit(t,r,a,n){return new is({...this._def,checks:[...this._def.checks,{kind:t,value:r,inclusive:a,message:te.toString(n)}]})}_addCheck(t){return new is({...this._def,checks:[...this._def.checks,t]})}positive(t){return this._addCheck({kind:"min",value:BigInt(0),inclusive:!1,message:te.toString(t)})}negative(t){return this._addCheck({kind:"max",value:BigInt(0),inclusive:!1,message:te.toString(t)})}nonpositive(t){return this._addCheck({kind:"max",value:BigInt(0),inclusive:!0,message:te.toString(t)})}nonnegative(t){return this._addCheck({kind:"min",value:BigInt(0),inclusive:!0,message:te.toString(t)})}multipleOf(t,r){return this._addCheck({kind:"multipleOf",value:t,message:te.toString(r)})}get minValue(){let t=null;for(const r of this._def.checks)r.kind==="min"&&(t===null||r.value>t)&&(t=r.value);return t}get maxValue(){let t=null;for(const r of this._def.checks)r.kind==="max"&&(t===null||r.value<t)&&(t=r.value);return t}};Yr.create=e=>{var t;return new Yr({checks:[],typeName:oe.ZodBigInt,coerce:(t=e?.coerce)!==null&&t!==void 0?t:!1,...pe(e)})};var Jr=class extends he{_parse(e){if(this._def.coerce&&(e.data=!!e.data),this._getType(e)!==Q.boolean){const r=this._getOrReturnCtx(e);return H(r,{code:L.invalid_type,expected:Q.boolean,received:r.parsedType}),ue}return Le(e.data)}};Jr.create=e=>new Jr({typeName:oe.ZodBoolean,coerce:e?.coerce||!1,...pe(e)});var Xr=class ag extends he{_parse(t){if(this._def.coerce&&(t.data=new Date(t.data)),this._getType(t)!==Q.date){const i=this._getOrReturnCtx(t);return H(i,{code:L.invalid_type,expected:Q.date,received:i.parsedType}),ue}if(isNaN(t.data.getTime())){const i=this._getOrReturnCtx(t);return H(i,{code:L.invalid_date}),ue}const a=new Ve;let n;for(const i of this._def.checks)i.kind==="min"?t.data.getTime()<i.value&&(n=this._getOrReturnCtx(t,n),H(n,{code:L.too_small,message:i.message,inclusive:!0,exact:!1,minimum:i.value,type:"date"}),a.dirty()):i.kind==="max"?t.data.getTime()>i.value&&(n=this._getOrReturnCtx(t,n),H(n,{code:L.too_big,message:i.message,inclusive:!0,exact:!1,maximum:i.value,type:"date"}),a.dirty()):ve.assertNever(i);return{status:a.value,value:new Date(t.data.getTime())}}_addCheck(t){return new ag({...this._def,checks:[...this._def.checks,t]})}min(t,r){return this._addCheck({kind:"min",value:t.getTime(),message:te.toString(r)})}max(t,r){return this._addCheck({kind:"max",value:t.getTime(),message:te.toString(r)})}get minDate(){let t=null;for(const r of this._def.checks)r.kind==="min"&&(t===null||r.value>t)&&(t=r.value);return t!=null?new Date(t):null}get maxDate(){let t=null;for(const r of this._def.checks)r.kind==="max"&&(t===null||r.value<t)&&(t=r.value);return t!=null?new Date(t):null}};Xr.create=e=>new Xr({checks:[],coerce:e?.coerce||!1,typeName:oe.ZodDate,...pe(e)});var en=class extends he{_parse(e){if(this._getType(e)!==Q.symbol){const r=this._getOrReturnCtx(e);return H(r,{code:L.invalid_type,expected:Q.symbol,received:r.parsedType}),ue}return Le(e.data)}};en.create=e=>new en({typeName:oe.ZodSymbol,...pe(e)});var ea=class extends he{_parse(e){if(this._getType(e)!==Q.undefined){const r=this._getOrReturnCtx(e);return H(r,{code:L.invalid_type,expected:Q.undefined,received:r.parsedType}),ue}return Le(e.data)}};ea.create=e=>new ea({typeName:oe.ZodUndefined,...pe(e)});var ta=class extends he{_parse(e){if(this._getType(e)!==Q.null){const r=this._getOrReturnCtx(e);return H(r,{code:L.invalid_type,expected:Q.null,received:r.parsedType}),ue}return Le(e.data)}};ta.create=e=>new ta({typeName:oe.ZodNull,...pe(e)});var gr=class extends he{constructor(){super(...arguments),this._any=!0}_parse(e){return Le(e.data)}};gr.create=e=>new gr({typeName:oe.ZodAny,...pe(e)});var Kt=class extends he{constructor(){super(...arguments),this._unknown=!0}_parse(e){return Le(e.data)}};Kt.create=e=>new Kt({typeName:oe.ZodUnknown,...pe(e)});var $t=class extends he{_parse(e){const t=this._getOrReturnCtx(e);return H(t,{code:L.invalid_type,expected:Q.never,received:t.parsedType}),ue}};$t.create=e=>new $t({typeName:oe.ZodNever,...pe(e)});var tn=class extends he{_parse(e){if(this._getType(e)!==Q.undefined){const r=this._getOrReturnCtx(e);return H(r,{code:L.invalid_type,expected:Q.void,received:r.parsedType}),ue}return Le(e.data)}};tn.create=e=>new tn({typeName:oe.ZodVoid,...pe(e)});var er=class La extends he{_parse(t){const{ctx:r,status:a}=this._processInputParams(t),n=this._def;if(r.parsedType!==Q.array)return H(r,{code:L.invalid_type,expected:Q.array,received:r.parsedType}),ue;if(n.exactLength!==null){const s=r.data.length>n.exactLength.value,o=r.data.length<n.exactLength.value;(s||o)&&(H(r,{code:s?L.too_big:L.too_small,minimum:o?n.exactLength.value:void 0,maximum:s?n.exactLength.value:void 0,type:"array",inclusive:!0,exact:!0,message:n.exactLength.message}),a.dirty())}if(n.minLength!==null&&r.data.length<n.minLength.value&&(H(r,{code:L.too_small,minimum:n.minLength.value,type:"array",inclusive:!0,exact:!1,message:n.minLength.message}),a.dirty()),n.maxLength!==null&&r.data.length>n.maxLength.value&&(H(r,{code:L.too_big,maximum:n.maxLength.value,type:"array",inclusive:!0,exact:!1,message:n.maxLength.message}),a.dirty()),r.common.async)return Promise.all([...r.data].map((s,o)=>n.type._parseAsync(new mt(r,s,r.path,o)))).then(s=>Ve.mergeArray(a,s));const i=[...r.data].map((s,o)=>n.type._parseSync(new mt(r,s,r.path,o)));return Ve.mergeArray(a,i)}get element(){return this._def.type}min(t,r){return new La({...this._def,minLength:{value:t,message:te.toString(r)}})}max(t,r){return new La({...this._def,maxLength:{value:t,message:te.toString(r)}})}length(t,r){return new La({...this._def,exactLength:{value:t,message:te.toString(r)}})}nonempty(t){return this.min(1,t)}};er.create=(e,t)=>new er({type:e,minLength:null,maxLength:null,exactLength:null,typeName:oe.ZodArray,...pe(t)});function or(e){if(e instanceof Ye){const t={};for(const r in e.shape){const a=e.shape[r];t[r]=ft.create(or(a))}return new Ye({...e._def,shape:()=>t})}else return e instanceof er?new er({...e._def,type:or(e.element)}):e instanceof ft?ft.create(or(e.unwrap())):e instanceof Bt?Bt.create(or(e.unwrap())):e instanceof Nt?Nt.create(e.items.map(t=>or(t))):e}var Ye=class at extends he{constructor(){super(...arguments),this._cached=null,this.nonstrict=this.passthrough,this.augment=this.extend}_getCached(){if(this._cached!==null)return this._cached;const t=this._def.shape(),r=ve.objectKeys(t);return this._cached={shape:t,keys:r}}_parse(t){if(this._getType(t)!==Q.object){const c=this._getOrReturnCtx(t);return H(c,{code:L.invalid_type,expected:Q.object,received:c.parsedType}),ue}const{status:a,ctx:n}=this._processInputParams(t),{shape:i,keys:s}=this._getCached(),o=[];if(!(this._def.catchall instanceof $t&&this._def.unknownKeys==="strip"))for(const c in n.data)s.includes(c)||o.push(c);const d=[];for(const c of s){const h=i[c],u=n.data[c];d.push({key:{status:"valid",value:c},value:h._parse(new mt(n,u,n.path,c)),alwaysSet:c in n.data})}if(this._def.catchall instanceof $t){const c=this._def.unknownKeys;if(c==="passthrough")for(const h of o)d.push({key:{status:"valid",value:h},value:{status:"valid",value:n.data[h]}});else if(c==="strict")o.length>0&&(H(n,{code:L.unrecognized_keys,keys:o}),a.dirty());else if(c!=="strip")throw new Error("Internal ZodObject error: invalid unknownKeys value.")}else{const c=this._def.catchall;for(const h of o){const u=n.data[h];d.push({key:{status:"valid",value:h},value:c._parse(new mt(n,u,n.path,h)),alwaysSet:h in n.data})}}return n.common.async?Promise.resolve().then(async()=>{const c=[];for(const h of d){const u=await h.key,f=await h.value;c.push({key:u,value:f,alwaysSet:h.alwaysSet})}return c}).then(c=>Ve.mergeObjectSync(a,c)):Ve.mergeObjectSync(a,d)}get shape(){return this._def.shape()}strict(t){return te.errToObj,new at({...this._def,unknownKeys:"strict",...t!==void 0?{errorMap:(r,a)=>{var n,i,s,o;const d=(s=(i=(n=this._def).errorMap)===null||i===void 0?void 0:i.call(n,r,a).message)!==null&&s!==void 0?s:a.defaultError;return r.code==="unrecognized_keys"?{message:(o=te.errToObj(t).message)!==null&&o!==void 0?o:d}:{message:d}}}:{}})}strip(){return new at({...this._def,unknownKeys:"strip"})}passthrough(){return new at({...this._def,unknownKeys:"passthrough"})}extend(t){return new at({...this._def,shape:()=>({...this._def.shape(),...t})})}merge(t){return new at({unknownKeys:t._def.unknownKeys,catchall:t._def.catchall,shape:()=>({...this._def.shape(),...t._def.shape()}),typeName:oe.ZodObject})}setKey(t,r){return this.augment({[t]:r})}catchall(t){return new at({...this._def,catchall:t})}pick(t){const r={};return ve.objectKeys(t).forEach(a=>{t[a]&&this.shape[a]&&(r[a]=this.shape[a])}),new at({...this._def,shape:()=>r})}omit(t){const r={};return ve.objectKeys(this.shape).forEach(a=>{t[a]||(r[a]=this.shape[a])}),new at({...this._def,shape:()=>r})}deepPartial(){return or(this)}partial(t){const r={};return ve.objectKeys(this.shape).forEach(a=>{const n=this.shape[a];t&&!t[a]?r[a]=n:r[a]=n.optional()}),new at({...this._def,shape:()=>r})}required(t){const r={};return ve.objectKeys(this.shape).forEach(a=>{if(t&&!t[a])r[a]=this.shape[a];else{let i=this.shape[a];for(;i instanceof ft;)i=i._def.innerType;r[a]=i}}),new at({...this._def,shape:()=>r})}keyof(){return lg(ve.objectKeys(this.shape))}};Ye.create=(e,t)=>new Ye({shape:()=>e,unknownKeys:"strip",catchall:$t.create(),typeName:oe.ZodObject,...pe(t)});Ye.strictCreate=(e,t)=>new Ye({shape:()=>e,unknownKeys:"strict",catchall:$t.create(),typeName:oe.ZodObject,...pe(t)});Ye.lazycreate=(e,t)=>new Ye({shape:e,unknownKeys:"strip",catchall:$t.create(),typeName:oe.ZodObject,...pe(t)});var ra=class extends he{_parse(e){const{ctx:t}=this._processInputParams(e),r=this._def.options;function a(n){for(const s of n)if(s.result.status==="valid")return s.result;for(const s of n)if(s.result.status==="dirty")return t.common.issues.push(...s.ctx.common.issues),s.result;const i=n.map(s=>new it(s.ctx.common.issues));return H(t,{code:L.invalid_union,unionErrors:i}),ue}if(t.common.async)return Promise.all(r.map(async n=>{const i={...t,common:{...t.common,issues:[]},parent:null};return{result:await n._parseAsync({data:t.data,path:t.path,parent:i}),ctx:i}})).then(a);{let n;const i=[];for(const o of r){const d={...t,common:{...t.common,issues:[]},parent:null},c=o._parseSync({data:t.data,path:t.path,parent:d});if(c.status==="valid")return c;c.status==="dirty"&&!n&&(n={result:c,ctx:d}),d.common.issues.length&&i.push(d.common.issues)}if(n)return t.common.issues.push(...n.ctx.common.issues),n.result;const s=i.map(o=>new it(o));return H(t,{code:L.invalid_union,unionErrors:s}),ue}}get options(){return this._def.options}};ra.create=(e,t)=>new ra({options:e,typeName:oe.ZodUnion,...pe(t)});var bt=e=>e instanceof na?bt(e.schema):e instanceof ot?bt(e.innerType()):e instanceof ia?[e.value]:e instanceof ca?e.options:e instanceof sa?ve.objectValues(e.enum):e instanceof oa?bt(e._def.innerType):e instanceof ea?[void 0]:e instanceof ta?[null]:e instanceof ft?[void 0,...bt(e.unwrap())]:e instanceof Bt?[null,...bt(e.unwrap())]:e instanceof qs||e instanceof la?bt(e.unwrap()):e instanceof ua?bt(e._def.innerType):[],ng=class ig extends he{_parse(t){const{ctx:r}=this._processInputParams(t);if(r.parsedType!==Q.object)return H(r,{code:L.invalid_type,expected:Q.object,received:r.parsedType}),ue;const a=this.discriminator,n=r.data[a],i=this.optionsMap.get(n);return i?r.common.async?i._parseAsync({data:r.data,path:r.path,parent:r}):i._parseSync({data:r.data,path:r.path,parent:r}):(H(r,{code:L.invalid_union_discriminator,options:Array.from(this.optionsMap.keys()),path:[a]}),ue)}get discriminator(){return this._def.discriminator}get options(){return this._def.options}get optionsMap(){return this._def.optionsMap}static create(t,r,a){const n=new Map;for(const i of r){const s=bt(i.shape[t]);if(!s.length)throw new Error(`A discriminator value for key \`${t}\` could not be extracted from all schema options`);for(const o of s){if(n.has(o))throw new Error(`Discriminator property ${String(t)} has duplicate value ${String(o)}`);n.set(o,i)}}return new ig({typeName:oe.ZodDiscriminatedUnion,discriminator:t,options:r,optionsMap:n,...pe(a)})}};function ss(e,t){const r=wt(e),a=wt(t);if(e===t)return{valid:!0,data:e};if(r===Q.object&&a===Q.object){const n=ve.objectKeys(t),i=ve.objectKeys(e).filter(o=>n.indexOf(o)!==-1),s={...e,...t};for(const o of i){const d=ss(e[o],t[o]);if(!d.valid)return{valid:!1};s[o]=d.data}return{valid:!0,data:s}}else if(r===Q.array&&a===Q.array){if(e.length!==t.length)return{valid:!1};const n=[];for(let i=0;i<e.length;i++){const s=e[i],o=t[i],d=ss(s,o);if(!d.valid)return{valid:!1};n.push(d.data)}return{valid:!0,data:n}}else return r===Q.date&&a===Q.date&&+e==+t?{valid:!0,data:e}:{valid:!1}}var aa=class extends he{_parse(e){const{status:t,ctx:r}=this._processInputParams(e),a=(n,i)=>{if(rs(n)||rs(i))return ue;const s=ss(n.value,i.value);return s.valid?((as(n)||as(i))&&t.dirty(),{status:t.value,value:s.data}):(H(r,{code:L.invalid_intersection_types}),ue)};return r.common.async?Promise.all([this._def.left._parseAsync({data:r.data,path:r.path,parent:r}),this._def.right._parseAsync({data:r.data,path:r.path,parent:r})]).then(([n,i])=>a(n,i)):a(this._def.left._parseSync({data:r.data,path:r.path,parent:r}),this._def.right._parseSync({data:r.data,path:r.path,parent:r}))}};aa.create=(e,t,r)=>new aa({left:e,right:t,typeName:oe.ZodIntersection,...pe(r)});var Nt=class sg extends he{_parse(t){const{status:r,ctx:a}=this._processInputParams(t);if(a.parsedType!==Q.array)return H(a,{code:L.invalid_type,expected:Q.array,received:a.parsedType}),ue;if(a.data.length<this._def.items.length)return H(a,{code:L.too_small,minimum:this._def.items.length,inclusive:!0,exact:!1,type:"array"}),ue;!this._def.rest&&a.data.length>this._def.items.length&&(H(a,{code:L.too_big,maximum:this._def.items.length,inclusive:!0,exact:!1,type:"array"}),r.dirty());const i=[...a.data].map((s,o)=>{const d=this._def.items[o]||this._def.rest;return d?d._parse(new mt(a,s,a.path,o)):null}).filter(s=>!!s);return a.common.async?Promise.all(i).then(s=>Ve.mergeArray(r,s)):Ve.mergeArray(r,i)}get items(){return this._def.items}rest(t){return new sg({...this._def,rest:t})}};Nt.create=(e,t)=>{if(!Array.isArray(e))throw new Error("You must pass an array of schemas to z.tuple([ ... ])");return new Nt({items:e,typeName:oe.ZodTuple,rest:null,...pe(t)})};var og=class os extends he{get keySchema(){return this._def.keyType}get valueSchema(){return this._def.valueType}_parse(t){const{status:r,ctx:a}=this._processInputParams(t);if(a.parsedType!==Q.object)return H(a,{code:L.invalid_type,expected:Q.object,received:a.parsedType}),ue;const n=[],i=this._def.keyType,s=this._def.valueType;for(const o in a.data)n.push({key:i._parse(new mt(a,o,a.path,o)),value:s._parse(new mt(a,a.data[o],a.path,o)),alwaysSet:o in a.data});return a.common.async?Ve.mergeObjectAsync(r,n):Ve.mergeObjectSync(r,n)}get element(){return this._def.valueType}static create(t,r,a){return r instanceof he?new os({keyType:t,valueType:r,typeName:oe.ZodRecord,...pe(a)}):new os({keyType:mr.create(),valueType:t,typeName:oe.ZodRecord,...pe(r)})}},rn=class extends he{get keySchema(){return this._def.keyType}get valueSchema(){return this._def.valueType}_parse(e){const{status:t,ctx:r}=this._processInputParams(e);if(r.parsedType!==Q.map)return H(r,{code:L.invalid_type,expected:Q.map,received:r.parsedType}),ue;const a=this._def.keyType,n=this._def.valueType,i=[...r.data.entries()].map(([s,o],d)=>({key:a._parse(new mt(r,s,r.path,[d,"key"])),value:n._parse(new mt(r,o,r.path,[d,"value"]))}));if(r.common.async){const s=new Map;return Promise.resolve().then(async()=>{for(const o of i){const d=await o.key,c=await o.value;if(d.status==="aborted"||c.status==="aborted")return ue;(d.status==="dirty"||c.status==="dirty")&&t.dirty(),s.set(d.value,c.value)}return{status:t.value,value:s}})}else{const s=new Map;for(const o of i){const d=o.key,c=o.value;if(d.status==="aborted"||c.status==="aborted")return ue;(d.status==="dirty"||c.status==="dirty")&&t.dirty(),s.set(d.value,c.value)}return{status:t.value,value:s}}}};rn.create=(e,t,r)=>new rn({valueType:t,keyType:e,typeName:oe.ZodMap,...pe(r)});var an=class us extends he{_parse(t){const{status:r,ctx:a}=this._processInputParams(t);if(a.parsedType!==Q.set)return H(a,{code:L.invalid_type,expected:Q.set,received:a.parsedType}),ue;const n=this._def;n.minSize!==null&&a.data.size<n.minSize.value&&(H(a,{code:L.too_small,minimum:n.minSize.value,type:"set",inclusive:!0,exact:!1,message:n.minSize.message}),r.dirty()),n.maxSize!==null&&a.data.size>n.maxSize.value&&(H(a,{code:L.too_big,maximum:n.maxSize.value,type:"set",inclusive:!0,exact:!1,message:n.maxSize.message}),r.dirty());const i=this._def.valueType;function s(d){const c=new Set;for(const h of d){if(h.status==="aborted")return ue;h.status==="dirty"&&r.dirty(),c.add(h.value)}return{status:r.value,value:c}}const o=[...a.data.values()].map((d,c)=>i._parse(new mt(a,d,a.path,c)));return a.common.async?Promise.all(o).then(d=>s(d)):s(o)}min(t,r){return new us({...this._def,minSize:{value:t,message:te.toString(r)}})}max(t,r){return new us({...this._def,maxSize:{value:t,message:te.toString(r)}})}size(t,r){return this.min(t,r).max(t,r)}nonempty(t){return this.min(1,t)}};an.create=(e,t)=>new an({valueType:e,minSize:null,maxSize:null,typeName:oe.ZodSet,...pe(t)});var ug=class Va extends he{constructor(){super(...arguments),this.validate=this.implement}_parse(t){const{ctx:r}=this._processInputParams(t);if(r.parsedType!==Q.function)return H(r,{code:L.invalid_type,expected:Q.function,received:r.parsedType}),ue;function a(o,d){return Ja({data:o,path:r.path,errorMaps:[r.common.contextualErrorMap,r.schemaErrorMap,Ya(),fr].filter(c=>!!c),issueData:{code:L.invalid_arguments,argumentsError:d}})}function n(o,d){return Ja({data:o,path:r.path,errorMaps:[r.common.contextualErrorMap,r.schemaErrorMap,Ya(),fr].filter(c=>!!c),issueData:{code:L.invalid_return_type,returnTypeError:d}})}const i={errorMap:r.common.contextualErrorMap},s=r.data;if(this._def.returns instanceof yr){const o=this;return Le(async function(...d){const c=new it([]),h=await o._def.args.parseAsync(d,i).catch(m=>{throw c.addIssue(a(d,m)),c}),u=await Reflect.apply(s,this,h);return await o._def.returns._def.type.parseAsync(u,i).catch(m=>{throw c.addIssue(n(u,m)),c})})}else{const o=this;return Le(function(...d){const c=o._def.args.safeParse(d,i);if(!c.success)throw new it([a(d,c.error)]);const h=Reflect.apply(s,this,c.data),u=o._def.returns.safeParse(h,i);if(!u.success)throw new it([n(h,u.error)]);return u.data})}}parameters(){return this._def.args}returnType(){return this._def.returns}args(...t){return new Va({...this._def,args:Nt.create(t).rest(Kt.create())})}returns(t){return new Va({...this._def,returns:t})}implement(t){return this.parse(t)}strictImplement(t){return this.parse(t)}static create(t,r,a){return new Va({args:t||Nt.create([]).rest(Kt.create()),returns:r||Kt.create(),typeName:oe.ZodFunction,...pe(a)})}},na=class extends he{get schema(){return this._def.getter()}_parse(e){const{ctx:t}=this._processInputParams(e);return this._def.getter()._parse({data:t.data,path:t.path,parent:t})}};na.create=(e,t)=>new na({getter:e,typeName:oe.ZodLazy,...pe(t)});var ia=class extends he{_parse(e){if(e.data!==this._def.value){const t=this._getOrReturnCtx(e);return H(t,{received:t.data,code:L.invalid_literal,expected:this._def.value}),ue}return{status:"valid",value:e.data}}get value(){return this._def.value}};ia.create=(e,t)=>new ia({value:e,typeName:oe.ZodLiteral,...pe(t)});function lg(e,t){return new ca({values:e,typeName:oe.ZodEnum,...pe(t)})}var ca=class ls extends he{constructor(){super(...arguments),Lr.set(this,void 0)}_parse(t){if(typeof t.data!="string"){const r=this._getOrReturnCtx(t),a=this._def.values;return H(r,{expected:ve.joinValues(a),received:r.parsedType,code:L.invalid_type}),ue}if(Xa(this,Lr)||Xm(this,Lr,new Set(this._def.values)),!Xa(this,Lr).has(t.data)){const r=this._getOrReturnCtx(t),a=this._def.values;return H(r,{received:r.data,code:L.invalid_enum_value,options:a}),ue}return Le(t.data)}get options(){return this._def.values}get enum(){const t={};for(const r of this._def.values)t[r]=r;return t}get Values(){const t={};for(const r of this._def.values)t[r]=r;return t}get Enum(){const t={};for(const r of this._def.values)t[r]=r;return t}extract(t,r=this._def){return ls.create(t,{...this._def,...r})}exclude(t,r=this._def){return ls.create(this.options.filter(a=>!t.includes(a)),{...this._def,...r})}};Lr=new WeakMap;ca.create=lg;var sa=class extends he{constructor(){super(...arguments),Vr.set(this,void 0)}_parse(e){const t=ve.getValidEnumValues(this._def.values),r=this._getOrReturnCtx(e);if(r.parsedType!==Q.string&&r.parsedType!==Q.number){const a=ve.objectValues(t);return H(r,{expected:ve.joinValues(a),received:r.parsedType,code:L.invalid_type}),ue}if(Xa(this,Vr)||Xm(this,Vr,new Set(ve.getValidEnumValues(this._def.values))),!Xa(this,Vr).has(e.data)){const a=ve.objectValues(t);return H(r,{received:r.data,code:L.invalid_enum_value,options:a}),ue}return Le(e.data)}get enum(){return this._def.values}};Vr=new WeakMap;sa.create=(e,t)=>new sa({values:e,typeName:oe.ZodNativeEnum,...pe(t)});var yr=class extends he{unwrap(){return this._def.type}_parse(e){const{ctx:t}=this._processInputParams(e);if(t.parsedType!==Q.promise&&t.common.async===!1)return H(t,{code:L.invalid_type,expected:Q.promise,received:t.parsedType}),ue;const r=t.parsedType===Q.promise?t.data:Promise.resolve(t.data);return Le(r.then(a=>this._def.type.parseAsync(a,{path:t.path,errorMap:t.common.contextualErrorMap})))}};yr.create=(e,t)=>new yr({type:e,typeName:oe.ZodPromise,...pe(t)});var ot=class extends he{innerType(){return this._def.schema}sourceType(){return this._def.schema._def.typeName===oe.ZodEffects?this._def.schema.sourceType():this._def.schema}_parse(e){const{status:t,ctx:r}=this._processInputParams(e),a=this._def.effect||null,n={addIssue:i=>{H(r,i),i.fatal?t.abort():t.dirty()},get path(){return r.path}};if(n.addIssue=n.addIssue.bind(n),a.type==="preprocess"){const i=a.transform(r.data,n);if(r.common.async)return Promise.resolve(i).then(async s=>{if(t.value==="aborted")return ue;const o=await this._def.schema._parseAsync({data:s,path:r.path,parent:r});return o.status==="aborted"?ue:o.status==="dirty"||t.value==="dirty"?cr(o.value):o});{if(t.value==="aborted")return ue;const s=this._def.schema._parseSync({data:i,path:r.path,parent:r});return s.status==="aborted"?ue:s.status==="dirty"||t.value==="dirty"?cr(s.value):s}}if(a.type==="refinement"){const i=s=>{const o=a.refinement(s,n);if(r.common.async)return Promise.resolve(o);if(o instanceof Promise)throw new Error("Async refinement encountered during synchronous parse operation. Use .parseAsync instead.");return s};if(r.common.async===!1){const s=this._def.schema._parseSync({data:r.data,path:r.path,parent:r});return s.status==="aborted"?ue:(s.status==="dirty"&&t.dirty(),i(s.value),{status:t.value,value:s.value})}else return this._def.schema._parseAsync({data:r.data,path:r.path,parent:r}).then(s=>s.status==="aborted"?ue:(s.status==="dirty"&&t.dirty(),i(s.value).then(()=>({status:t.value,value:s.value}))))}if(a.type==="transform")if(r.common.async===!1){const i=this._def.schema._parseSync({data:r.data,path:r.path,parent:r});if(!Xt(i))return i;const s=a.transform(i.value,n);if(s instanceof Promise)throw new Error("Asynchronous transform encountered during synchronous parse operation. Use .parseAsync instead.");return{status:t.value,value:s}}else return this._def.schema._parseAsync({data:r.data,path:r.path,parent:r}).then(i=>Xt(i)?Promise.resolve(a.transform(i.value,n)).then(s=>({status:t.value,value:s})):i);ve.assertNever(a)}};ot.create=(e,t,r)=>new ot({schema:e,typeName:oe.ZodEffects,effect:t,...pe(r)});ot.createWithPreprocess=(e,t,r)=>new ot({schema:t,effect:{type:"preprocess",transform:e},typeName:oe.ZodEffects,...pe(r)});var ft=class extends he{_parse(e){return this._getType(e)===Q.undefined?Le(void 0):this._def.innerType._parse(e)}unwrap(){return this._def.innerType}};ft.create=(e,t)=>new ft({innerType:e,typeName:oe.ZodOptional,...pe(t)});var Bt=class extends he{_parse(e){return this._getType(e)===Q.null?Le(null):this._def.innerType._parse(e)}unwrap(){return this._def.innerType}};Bt.create=(e,t)=>new Bt({innerType:e,typeName:oe.ZodNullable,...pe(t)});var oa=class extends he{_parse(e){const{ctx:t}=this._processInputParams(e);let r=t.data;return t.parsedType===Q.undefined&&(r=this._def.defaultValue()),this._def.innerType._parse({data:r,path:t.path,parent:t})}removeDefault(){return this._def.innerType}};oa.create=(e,t)=>new oa({innerType:e,typeName:oe.ZodDefault,defaultValue:typeof t.default=="function"?t.default:()=>t.default,...pe(t)});var ua=class extends he{_parse(e){const{ctx:t}=this._processInputParams(e),r={...t,common:{...t.common,issues:[]}},a=this._def.innerType._parse({data:r.data,path:r.path,parent:{...r}});return Kr(a)?a.then(n=>({status:"valid",value:n.status==="valid"?n.value:this._def.catchValue({get error(){return new it(r.common.issues)},input:r.data})})):{status:"valid",value:a.status==="valid"?a.value:this._def.catchValue({get error(){return new it(r.common.issues)},input:r.data})}}removeCatch(){return this._def.innerType}};ua.create=(e,t)=>new ua({innerType:e,typeName:oe.ZodCatch,catchValue:typeof t.catch=="function"?t.catch:()=>t.catch,...pe(t)});var nn=class extends he{_parse(e){if(this._getType(e)!==Q.nan){const r=this._getOrReturnCtx(e);return H(r,{code:L.invalid_type,expected:Q.nan,received:r.parsedType}),ue}return{status:"valid",value:e.data}}};nn.create=e=>new nn({typeName:oe.ZodNaN,...pe(e)});var Mb=Symbol("zod_brand"),qs=class extends he{_parse(e){const{ctx:t}=this._processInputParams(e),r=t.data;return this._def.type._parse({data:r,path:t.path,parent:t})}unwrap(){return this._def.type}},Fs=class dg extends he{_parse(t){const{status:r,ctx:a}=this._processInputParams(t);if(a.common.async)return(async()=>{const i=await this._def.in._parseAsync({data:a.data,path:a.path,parent:a});return i.status==="aborted"?ue:i.status==="dirty"?(r.dirty(),cr(i.value)):this._def.out._parseAsync({data:i.value,path:a.path,parent:a})})();{const n=this._def.in._parseSync({data:a.data,path:a.path,parent:a});return n.status==="aborted"?ue:n.status==="dirty"?(r.dirty(),{status:"dirty",value:n.value}):this._def.out._parseSync({data:n.value,path:a.path,parent:a})}}static create(t,r){return new dg({in:t,out:r,typeName:oe.ZodPipeline})}},la=class extends he{_parse(e){const t=this._def.innerType._parse(e),r=a=>(Xt(a)&&(a.value=Object.freeze(a.value)),a);return Kr(t)?t.then(a=>r(a)):r(t)}unwrap(){return this._def.innerType}};la.create=(e,t)=>new la({innerType:e,typeName:oe.ZodReadonly,...pe(t)});function Yc(e,t){const r=typeof e=="function"?e(t):typeof e=="string"?{message:e}:e;return typeof r=="string"?{message:r}:r}function cg(e,t={},r){return e?gr.create().superRefine((a,n)=>{var i,s;const o=e(a);if(o instanceof Promise)return o.then(d=>{var c,h;if(!d){const u=Yc(t,a),f=(h=(c=u.fatal)!==null&&c!==void 0?c:r)!==null&&h!==void 0?h:!0;n.addIssue({code:"custom",...u,fatal:f})}});if(!o){const d=Yc(t,a),c=(s=(i=d.fatal)!==null&&i!==void 0?i:r)!==null&&s!==void 0?s:!0;n.addIssue({code:"custom",...d,fatal:c})}}):gr.create()}var Nb={object:Ye.lazycreate},oe;(function(e){e.ZodString="ZodString",e.ZodNumber="ZodNumber",e.ZodNaN="ZodNaN",e.ZodBigInt="ZodBigInt",e.ZodBoolean="ZodBoolean",e.ZodDate="ZodDate",e.ZodSymbol="ZodSymbol",e.ZodUndefined="ZodUndefined",e.ZodNull="ZodNull",e.ZodAny="ZodAny",e.ZodUnknown="ZodUnknown",e.ZodNever="ZodNever",e.ZodVoid="ZodVoid",e.ZodArray="ZodArray",e.ZodObject="ZodObject",e.ZodUnion="ZodUnion",e.ZodDiscriminatedUnion="ZodDiscriminatedUnion",e.ZodIntersection="ZodIntersection",e.ZodTuple="ZodTuple",e.ZodRecord="ZodRecord",e.ZodMap="ZodMap",e.ZodSet="ZodSet",e.ZodFunction="ZodFunction",e.ZodLazy="ZodLazy",e.ZodLiteral="ZodLiteral",e.ZodEnum="ZodEnum",e.ZodEffects="ZodEffects",e.ZodNativeEnum="ZodNativeEnum",e.ZodOptional="ZodOptional",e.ZodNullable="ZodNullable",e.ZodDefault="ZodDefault",e.ZodCatch="ZodCatch",e.ZodPromise="ZodPromise",e.ZodBranded="ZodBranded",e.ZodPipeline="ZodPipeline",e.ZodReadonly="ZodReadonly"})(oe||(oe={}));var Bb=(e,t={message:`Input not instance of ${e.name}`})=>cg(r=>r instanceof e,t),pg=mr.create,hg=Qr.create,Db=nn.create,Pb=Yr.create,fg=Jr.create,Ub=Xr.create,jb=en.create,Lb=ea.create,Vb=ta.create,Wb=gr.create,qb=Kt.create,Fb=$t.create,Hb=tn.create,Gb=er.create,Zb=Ye.create,Kb=Ye.strictCreate,Qb=ra.create,Yb=ng.create,Jb=aa.create,Xb=Nt.create,ew=og.create,tw=rn.create,rw=an.create,aw=ug.create,nw=na.create,iw=ia.create,sw=ca.create,ow=sa.create,uw=yr.create,Jc=ot.create,lw=ft.create,dw=Bt.create,cw=ot.createWithPreprocess,pw=Fs.create,hw=()=>pg().optional(),fw=()=>hg().optional(),mw=()=>fg().optional(),gw={string:e=>mr.create({...e,coerce:!0}),number:e=>Qr.create({...e,coerce:!0}),boolean:e=>Jr.create({...e,coerce:!0}),bigint:e=>Yr.create({...e,coerce:!0}),date:e=>Xr.create({...e,coerce:!0})},yw=ue,De=Object.freeze({__proto__:null,defaultErrorMap:fr,setErrorMap:cb,getErrorMap:Ya,makeIssue:Ja,EMPTY_PATH:pb,addIssueToContext:H,ParseStatus:Ve,INVALID:ue,DIRTY:cr,OK:Le,isAborted:rs,isDirty:as,isValid:Xt,isAsync:Kr,get util(){return ve},get objectUtil(){return ts},ZodParsedType:Q,getParsedType:wt,ZodType:he,datetimeRegex:rg,ZodString:mr,ZodNumber:Qr,ZodBigInt:Yr,ZodBoolean:Jr,ZodDate:Xr,ZodSymbol:en,ZodUndefined:ea,ZodNull:ta,ZodAny:gr,ZodUnknown:Kt,ZodNever:$t,ZodVoid:tn,ZodArray:er,ZodObject:Ye,ZodUnion:ra,ZodDiscriminatedUnion:ng,ZodIntersection:aa,ZodTuple:Nt,ZodRecord:og,ZodMap:rn,ZodSet:an,ZodFunction:ug,ZodLazy:na,ZodLiteral:ia,ZodEnum:ca,ZodNativeEnum:sa,ZodPromise:yr,ZodEffects:ot,ZodTransformer:ot,ZodOptional:ft,ZodNullable:Bt,ZodDefault:oa,ZodCatch:ua,ZodNaN:nn,BRAND:Mb,ZodBranded:qs,ZodPipeline:Fs,ZodReadonly:la,custom:cg,Schema:he,ZodSchema:he,late:Nb,get ZodFirstPartyTypeKind(){return oe},coerce:gw,any:Wb,array:Gb,bigint:Pb,boolean:fg,date:Ub,discriminatedUnion:Yb,effect:Jc,enum:sw,function:aw,instanceof:Bb,intersection:Jb,lazy:nw,literal:iw,map:tw,nan:Db,nativeEnum:ow,never:Fb,null:Vb,nullable:dw,number:hg,object:Zb,oboolean:mw,onumber:fw,optional:lw,ostring:hw,pipeline:pw,preprocess:cw,promise:uw,record:ew,set:rw,strictObject:Kb,string:pg,symbol:jb,transformer:Jc,tuple:Xb,undefined:Lb,union:Qb,unknown:qb,void:Hb,NEVER:yw,ZodIssueCode:L,quotelessJson:db,ZodError:it}),Xc={name:"@imgly/background-removal",version:"1.7.0"},_w=De.object({publicPath:De.string().optional().describe("The public path to the wasm files and the onnx model.").default("https://staticimgly.com/@imgly/background-removal-data/${PACKAGE_VERSION}/dist/").transform(e=>e.replace("${PACKAGE_NAME}",Xc.name).replace("${PACKAGE_VERSION}",Xc.version)),debug:De.boolean().default(!1).describe("Whether to enable debug logging."),rescale:De.boolean().default(!0).describe("Whether to rescale the image."),device:De.enum(["cpu","gpu"]).default("cpu").describe("The device to run the model on."),proxyToWorker:De.boolean().default(!1).describe("Whether to proxy inference to a web worker."),fetchArgs:De.any().default({}).describe("Arguments to pass to fetch when loading the model."),progress:De.function().args(De.string(),De.number(),De.number()).returns(De.void()).describe("Progress callback.").optional(),model:De.preprocess(e=>{switch(e){case"large":return"isnet";case"small":return"isnet_quint8";case"medium":return"isnet_fp16";default:return e}},De.enum(["isnet","isnet_fp16","isnet_quint8"])).default("medium"),output:De.object({format:De.enum(["image/png","image/jpeg","image/webp","image/x-rgba8","image/x-alpha8"]).default("image/png"),quality:De.number().default(.8)}).default({})}).default({}).transform(e=>(e.debug&&console.log("Config:",e),e.debug&&!e.progress&&(e.progress=e.progress??((t,r,a)=>{console.debug(`Downloading ${t}: ${r} of ${a}`)}),crossOriginIsolated||e.debug&&console.debug("Cross-Origin-Isolated is not enabled. Performance will be degraded. Please see  https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/SharedArrayBuffer.")),e));function mg(e){return _w.parse(e??{})}var vw=sn(on());async function bw(e){e.debug&&console.debug("Loading model...",e.model);const t=e.model,a=await(await Zm(`/models/${t}`,e)).arrayBuffer();return await ub(a,e)}async function ww(e){e=mg(e);const t=await bw(e);return{config:e,session:{base:t}}}async function Hs(e,t,r){const[n,i,s]=e.shape,o=!1;let d=es(e,1024,1024,o);const c=nb(d);let h=await lb(r.base,[["input",c]],["output"],t),u=(0,vw.default)(h[0].data,[1024,1024,1]),f=ib(u);return t.rescale?(f=es(f,i,n,o),[f,e]):[f,d]}var cn=Jv(ww,e=>JSON.stringify(e));async function $w(e){await cn(e)}async function xw(e,t){const{config:r,session:a}=await cn(t);r.progress&&r.progress("compute:decode",0,4);const n=await Zr(e,r);r.progress?.("compute:inference",1,4);const[i,s]=await Hs(n,r,a);r.progress?.("compute:mask",2,4);const o=s,[d,c]=o.shape,h=d*c;for(let f=0;f<h;f+=1)o.data[4*f+3]=i.data[f];r.progress?.("compute:encode",3,4);const u=await dn(o,r.output.quality,r.output.format);return r.progress?.("compute:encode",4,4),u}async function kw(e,t){const{config:r,session:a}=await cn(t),n=await Zr(e,r),[i,s]=await Hs(n,r,a),o=s,[d,c,h]=o.shape,u=d*c;for(let m=0;m<u;m+=1)o.data[4*m+3]=255-i.data[m];return await dn(o,r.output.quality,r.output.format)}var Sw=gg;async function gg(e,t){const{config:r,session:a}=await cn(t),n=await Zr(e,r);let[i,s,o]=n.shape;const[d,c]=await Hs(n,r,a),h=s*i,u=n;for(let m=0;m<h;m+=1){const _=4*m;let g=d.data[m];u.data[_]=255,u.data[_+1]=255,u.data[_+2]=255,u.data[_+3]=g}return await dn(u,r.output.quality,r.output.format)}async function Tw(e,t,r){r=mg(r);const a=await Zr(e,r),[n,i,s]=a.shape,o=await Zr(t,r),[d,c,h]=o.shape,u=d!==n||c!==i?es(o,i,n):o,f=i*n;for(let _=0;_<f;_+=1){const g=s*_,w=h*_;a.data[g+3]=u.data[w+3]}return await dn(a,r.output.quality,r.output.format)}const Bw=Object.freeze(Object.defineProperty({__proto__:null,alphamask:Sw,applySegmentationMask:Tw,preload:$w,removeBackground:xw,removeForeground:kw,segmentForeground:gg},Symbol.toStringTag,{value:"Module"})),Cw={FFT_SIZE:4096,HOP_SIZE:1024,TRAINING_SAMPLES:343980,MODEL_SPEC_BINS:2048,MODEL_SPEC_FRAMES:336,SEGMENT_OVERLAP:.25,TRACKS:["drums","bass","other","vocals"]},Bi=new Map,Di=new Map,Pi=new Map;function Iw(e){if(Bi.has(e))return Bi.get(e);const t=new Float32Array(e/2),r=new Float32Array(e/2);for(let n=0;n<e/2;n++){const i=-2*Math.PI*n/e;t[n]=Math.cos(i),r[n]=Math.sin(i)}const a={real:t,imag:r};return Bi.set(e,a),a}function Ew(e){if(Di.has(e))return Di.get(e);const t=new Float32Array(e/2),r=new Float32Array(e/2);for(let n=0;n<e/2;n++){const i=2*Math.PI*n/e;t[n]=Math.cos(i),r[n]=Math.sin(i)}const a={real:t,imag:r};return Di.set(e,a),a}function yg(e){if(Pi.has(e))return Pi.get(e);const t=new Float32Array(e);for(let r=0;r<e;r++)t[r]=.5*(1-Math.cos(2*Math.PI*r/e));return Pi.set(e,t),t}function _g(e,t){let r=0;for(let a=0;a<t;a++)r=r<<1|e&1,e>>=1;return r}function Aw(e,t,r,a){const n=Math.log2(a)|0,i=Iw(a);for(let s=0;s<a;s++){const o=_g(s,n);e[s]=r[o],t[s]=0}for(let s=2;s<=a;s*=2){const o=s/2,d=a/s;for(let c=0;c<a;c+=s)for(let h=0;h<o;h++){const u=h*d,f=i.real[u],m=i.imag[u],_=c+h,g=c+h+o,w=e[_],x=t[_],b=e[g]*f-t[g]*m,k=e[g]*m+t[g]*f;e[_]=w+b,t[_]=x+k,e[g]=w-b,t[g]=x-k}}}function zw(e,t,r,a,n){const i=Math.log2(n)|0,s=Ew(n);for(let o=0;o<n;o++){const d=_g(o,i);e[o]=r[d],t[o]=a[d]}for(let o=2;o<=n;o*=2){const d=o/2,c=n/o;for(let h=0;h<n;h+=o)for(let u=0;u<d;u++){const f=u*c,m=s.real[f],_=s.imag[f],g=h+u,w=h+u+d,x=e[g],b=t[g],k=e[w]*m-t[w]*_,S=e[w]*_+t[w]*m;e[g]=x+k,t[g]=b+S,e[w]=x-k,t[w]=b-S}}for(let o=0;o<n;o++)e[o]/=n,t[o]/=n}function ep(e,t,r){const a=Math.floor((e.length-t)/r)+1,n=t/2+1,i=yg(t),s=1/Math.sqrt(t),o=new Float32Array(a*n),d=new Float32Array(a*n),c=new Float32Array(t),h=new Float32Array(t),u=new Float32Array(t);for(let f=0;f<a;f++){const m=f*r;for(let g=0;g<t;g++)u[g]=e[m+g]*i[g];Aw(c,h,u,t);const _=f*n;for(let g=0;g<n;g++)o[_+g]=c[g]*s,d[_+g]=h[g]*s}return{real:o,imag:d,numFrames:a,numBins:n}}function tp(e,t,r,a,n,i,s){const o=s,d=new Float32Array(o),c=new Float32Array(o),h=yg(n),u=Math.sqrt(n),f=new Float32Array(n),m=new Float32Array(n),_=new Float32Array(n),g=new Float32Array(n);for(let w=0;w<r;w++){f.fill(0),m.fill(0);for(let b=0;b<a;b++)f[b]=e[w*a+b],m[b]=t[w*a+b];for(let b=1;b<a-1;b++)f[n-b]=f[b],m[n-b]=-m[b];zw(_,g,f,m,n);const x=w*i;for(let b=0;b<n&&x+b<o;b++)d[x+b]+=_[b]*h[b]*u,c[x+b]+=h[b]*h[b]}for(let w=0;w<o;w++)c[w]>1e-8&&(d[w]/=c[w]);return d}function Pa(e,t,r){const a=e.length,n=new Float32Array(t+a+r);for(let i=0;i<t;i++){const s=Math.min(t-i,a-1);n[i]=e[s]}n.set(e,t);for(let i=0;i<r;i++){const s=Math.max(0,a-2-i);n[t+a+i]=e[s]}return n}const{FFT_SIZE:Zt,HOP_SIZE:ur,TRAINING_SAMPLES:Rt,MODEL_SPEC_BINS:pn,MODEL_SPEC_FRAMES:hn,SEGMENT_OVERLAP:Ow,TRACKS:rp}=Cw;function Rw(e){const a=pn,n=hn,i=[];for(let s=0;s<4;s++){const o={leftReal:new Float32Array(a*n),leftImag:new Float32Array(a*n),rightReal:new Float32Array(a*n),rightImag:new Float32Array(a*n)};for(let d=0;d<n;d++)for(let c=0;c<a;c++){const h=s*4*a*n,u=c*n+d;o.leftReal[u]=e[h+0*a*n+c*n+d],o.leftImag[u]=e[h+1*a*n+c*n+d],o.rightReal[u]=e[h+2*a*n+c*n+d],o.rightImag[u]=e[h+3*a*n+c*n+d]}i.push(o)}return i}function Mw(e,t){const r=pn,a=hn,n=ur,i=r+1,s=a+4,o=(b,k)=>{const S=new Float32Array(s*i),T=new Float32Array(s*i);for(let E=0;E<a;E++)for(let I=0;I<r;I++){const N=I*a+E,V=(E+2)*i+I;S[V]=b[N],T[V]=k[N]}return{real:S,imag:T}},d=o(e.leftReal,e.leftImag),c=o(e.rightReal,e.rightImag),h=Zt/2,u=Math.floor(n/2)*3,f=(s-1)*n+Zt,m=tp(d.real,d.imag,s,i,Zt,n,f),_=tp(c.real,c.imag,s,i,Zt,n,f),g=h+u,w=m.subarray(g,g+t),x=_.subarray(g,g+t);return{left:new Float32Array(w),right:new Float32Array(x)}}function Nw(e,t){const r=Rt,a=new Float32Array(r),n=new Float32Array(r),i=Math.min(e.length,r);a.set(e.subarray(0,i)),n.set(t.subarray(0,i));const s=Math.ceil(r/ur),o=Math.floor(ur/2)*3,d=o+s*ur-r,c=Pa(a,o,d),h=Pa(n,o,d),u=Zt/2,f=Pa(c,u,u),m=Pa(h,u,u),_=ep(f,Zt,ur),g=ep(m,Zt,ur),w=pn,x=hn,b=2,k=new Float32Array(4*w*x);for(let T=0;T<x;T++){const E=T+b;for(let I=0;I<w;I++){const N=E*_.numBins+I;k[0*w*x+I*x+T]=_.real[N],k[1*w*x+I*x+T]=_.imag[N],k[2*w*x+I*x+T]=g.real[N],k[3*w*x+I*x+T]=g.imag[N]}}const S=new Float32Array(2*r);return S.set(a,0),S.set(n,r),{waveform:S,magSpec:k,numBins:w,numFrames:x,originalLength:e.length}}class Dw{constructor(t={}){this.ort=t.ort||null,this.session=null,this.modelPath=t.modelPath||"./htdemucs_embedded.onnx",this.sessionOptions=t.sessionOptions||{},this.onProgress=t.onProgress||(()=>{}),this.onLog=t.onLog||(()=>{}),this.onDownloadProgress=t.onDownloadProgress||(()=>{})}async loadModel(t){if(!this.ort)throw new Error("ONNX Runtime not provided. Pass ort in constructor options.");this.onLog("model","Loading model...");let r;if(t instanceof ArrayBuffer)r=t;else{const n=await fetch(t||this.modelPath),i=n.headers.get("Content-Length");if(i&&n.body){const s=parseInt(i,10),o=n.body.getReader(),d=[];let c=0;for(;;){const{done:f,value:m}=await o.read();if(f)break;d.push(m),c+=m.length,this.onDownloadProgress(c,s)}const h=new Uint8Array(c);let u=0;for(const f of d)h.set(f,u),u+=f.length;r=h.buffer}else r=await n.arrayBuffer()}const a={executionProviders:["webgpu","wasm"],graphOptimizationLevel:"basic"};return this.session=await this.ort.InferenceSession.create(r,{...a,...this.sessionOptions}),this.onLog("model","Model loaded successfully"),this.session}async separate(t,r){if(!this.session)throw new Error("Model not loaded. Call loadModel() first.");const a=t.length,n=Math.floor(Rt*(1-Ow)),i=Math.ceil((a-Rt)/n)+1,s=rp.map(()=>({left:new Float32Array(a),right:new Float32Array(a)})),o=new Float32Array(a);let d=0;for(let c=0;c<a;c+=n){const u=Math.min(c+Rt,a)-c,f=new Float32Array(Rt),m=new Float32Array(Rt);for(let A=0;A<u;A++)f[A]=t[c+A],m[A]=r[c+A];const _=Nw(f,m),g=new this.ort.Tensor("float32",_.waveform,[1,2,Rt]),w=new this.ort.Tensor("float32",_.magSpec,[1,4,pn,hn]),x={};x[this.session.inputNames[0]]=g,this.session.inputNames.length>1&&(x[this.session.inputNames[1]]=w);const b=await this.session.run(x);let k=null,S=null,T=null;for(const A of this.session.outputNames){const W=b[A];W.dims.length===4&&W.dims[2]===2?(k=W.data,S=W.dims):W.dims.length===5&&W.dims[2]===4&&(T=W.data)}if(!k)throw new Error("Could not find time-domain output tensor");let E=null;if(T){const A=Rw(T);E=[];for(let W=0;W<4;W++){const P=Mw(A[W],Rt),J=S[2],ne=S[3],F=new Float32Array(ne),se=new Float32Array(ne);for(let K=0;K<ne;K++)F[K]=k[W*J*ne+0*ne+K],se[K]=k[W*J*ne+1*ne+K];const ce={left:new Float32Array(ne),right:new Float32Array(ne)};for(let K=0;K<ne;K++)ce.left[K]=F[K]+(P.left[K]||0),ce.right[K]=se[K]+(P.right[K]||0);E.push(ce)}}const I=S[1],N=S[2],D=S[3],V=new Float32Array(u);for(let A=0;A<u;A++){const W=Math.min(A/(n*.5),1),P=Math.min((u-A)/(n*.5),1);V[A]=Math.min(W,P)}for(let A=0;A<I;A++)for(let W=0;W<u&&c+W<a;W++){let P,J;if(E)P=E[A].left[W],J=E[A].right[W];else{const ne=A*N*D+0*D+W,F=A*N*D+1*D+W;P=k[ne],J=k[F]}s[A].left[c+W]+=P*V[W],s[A].right[c+W]+=J*V[W]}for(let A=0;A<u&&c+A<a;A++)o[c+A]+=V[A];d++,this.onProgress({progress:d/i,currentSegment:d,totalSegments:i})}for(let c=0;c<rp.length;c++)for(let h=0;h<a;h++)o[h]>0&&(s[c].left[h]/=o[h],s[c].right[h]/=o[h]);return{drums:s[0],bass:s[1],other:s[2],vocals:s[3]}}}export{i0 as $,Dw as D,fu as _,Se as a,Bw as i,s0 as o,xw as r};
