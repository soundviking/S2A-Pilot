window.S2ATechnicalPreview=(()=>{
// Lightweight preview for this application's own drawing instructions.
// The PDF download and the SVG pages use the same page layout, text and JPEGs.
const escapeXml=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
const color=values=>`rgb(${values.map(v=>Math.round(Number(v)*255)).join(',')})`;
function jpegUrl(bytes){let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));return 'data:image/jpeg;base64,'+btoa(binary);}
function svgPage(page,index,title){
 let fill='#000',stroke='#000',width=.7;const drawing=[];
 for(const raw of page.content.split('\n')){
  const line=raw.trim();if(!line)continue;
  let match;
  if((match=line.match(/^([\d.]+) ([\d.]+) ([\d.]+) (rg|RG)$/))){if(match[4]==='rg')fill=color(match.slice(1,4));else stroke=color(match.slice(1,4));continue;}
  if((match=line.match(/^BT \/(F[12]) ([\d.]+) Tf 1 0 0 1 ([-\d.]+) ([-\d.]+) Tm <([A-F\d]*)> Tj ET$/))){
   const bytes=Uint8Array.from(match[5].match(/../g)||[],v=>parseInt(v,16));
   const text=new TextDecoder('windows-1252').decode(bytes);
   drawing.push(`<text x="${match[3]}" y="${-Number(match[4])}" transform="scale(1 -1)" font-family="Arial,Helvetica,sans-serif" font-size="${match[2]}" font-weight="${match[1]==='F2'?700:400}" fill="${fill}">${escapeXml(text)}</text>`);continue;
  }
  if((match=line.match(/^([-\d.]+) ([-\d.]+) ([-\d.]+) ([-\d.]+) re ([fS])$/))){drawing.push(`<rect x="${match[1]}" y="${match[2]}" width="${match[3]}" height="${match[4]}" fill="${match[5]==='f'?fill:'none'}" stroke="${match[5]==='S'?stroke:'none'}" stroke-width="${width}"/>`);continue;}
  if((match=line.match(/^q ([-\d.]+) 0 0 ([-\d.]+) ([-\d.]+) ([-\d.]+) cm \/Im(\d+) Do Q$/))){
   const image=page.images[Number(match[5])-1];if(!image)throw new Error('Visuel de conduite manquant');
   drawing.push(`<image x="${match[3]}" y="${-(Number(match[4])+Number(match[2]))}" width="${match[1]}" height="${match[2]}" transform="scale(1 -1)" href="${jpegUrl(image.bytes)}" preserveAspectRatio="none"/>`);continue;
  }
  if(/\b(?:m|l|c|h)\b/.test(line)){
   const tokens=line.split(/\s+/),path=[];let args=[],paint=null;
   for(const token of tokens){
    if(/^-?\d+(?:\.\d+)?$/.test(token)){args.push(token);continue;}
    if(token==='w'){width=Number(args.pop());args=[];continue;}
    if(['m','l','c'].includes(token)){path.push(({m:'M',l:'L',c:'C'})[token]+args.join(' '));args=[];continue;}
    if(token==='h'){path.push('Z');continue;}
    if(token==='f'||token==='S')paint=token;
   }
   if(!paint)throw new Error('Dessin de conduite non reconnu');
   drawing.push(`<path d="${path.join(' ')}" fill="${paint==='f'?fill:'none'}" stroke="${paint==='S'?stroke:'none'}" stroke-width="${width}"/>`);continue;
  }
  throw new Error('Instruction de conduite non reconnue');
 }
 return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 595 842" width="595" height="842" role="img" aria-label="${escapeXml(`Page ${index+1} sur ${page.totalPages} — ${title}`)}"><title>${escapeXml(`Conduite technique — ${title} — page ${index+1}`)}</title><rect width="595" height="842" fill="white"/><g transform="translate(0 842) scale(1 -1)">${drawing.join('')}</g></svg>`;
}
function mountTechnicalPreview(pages,title,controls){
 const {container,minus,plus,label,fit}=controls;let zoom=1,disposed=false;
 const fragment=document.createDocumentFragment(),elements=[];
 pages.forEach((page,index)=>{const element=document.createElement('article');element.className='pdfPreviewPage';element.setAttribute('aria-label',`Page ${index+1} sur ${pages.length}`);element.innerHTML=svgPage({...page,totalPages:pages.length},index,title);elements.push(element);fragment.append(element);});
 container.replaceChildren(fragment);
 function layout(){if(disposed)return;const padding=parseFloat(getComputedStyle(container).paddingLeft)*2,baseWidth=Math.min(794,Math.max(100,container.clientWidth-padding));for(const element of elements)element.style.width=`${Math.round(baseWidth*zoom)}px`;label.textContent=`${Math.round(zoom*100)} %`;minus.disabled=zoom<=1;plus.disabled=zoom>=3;}
 function change(value){const old=zoom;zoom=Math.max(1,Math.min(3,value));layout();container.scrollTop=container.scrollTop*zoom/old;}
 const zoomOut=()=>change(zoom-.25),zoomIn=()=>change(zoom+.25),fitPage=()=>{change(1);container.scrollLeft=0;};
 minus.addEventListener('click',zoomOut);plus.addEventListener('click',zoomIn);fit.addEventListener('click',fitPage);
 const observer=new ResizeObserver(layout);observer.observe(container);layout();
 return()=>{disposed=true;observer.disconnect();minus.removeEventListener('click',zoomOut);plus.removeEventListener('click',zoomIn);fit.removeEventListener('click',fitPage);container.replaceChildren();elements.length=0;};
}

return {mountTechnicalPreview};})();
