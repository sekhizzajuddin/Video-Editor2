function u(a){const i=o=>{const t=o.trim().replace(",",".").split(":");if(t.length<3)return 0;const s=parseFloat(t[0])||0,n=parseFloat(t[1])||0,e=parseFloat(t[2])||0;return s*3600+n*60+e},l=a.trim().replace(/\r\n/g,`
`).split(/\n\s*\n/),r=[];for(const o of l){const t=o.split(`
`).map(n=>n.trim()).filter(Boolean),s=t.findIndex(n=>n.includes("-->"));if(s!==-1){const e=t[s].split("-->"),c=i(e[0]),p=i(e[1]),m=t.slice(s+1).join(`
`);r.push({startTime:c,duration:Math.max(.2,p-c),text:m})}}return r}export{u as parseSRT};
