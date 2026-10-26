const CATALOG='/catalog-v5.min.json';
const state={movies:[],mode:'foryou',query:'',visible:36,wiki:new Map()};
const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const norm=s=>String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'');
const watchedKey='replite-watched-v5';
let watched=new Set(JSON.parse(localStorage.getItem(watchedKey)||'[]'));
const savedWatched=m=>m.watched||watched.has(norm(m.title));
const saveWatched=()=>localStorage.setItem(watchedKey,JSON.stringify([...watched]));
const text=m=>`${m.title} ${m.year} ${m.country||''} ${(m.tags||[]).join(' ')} ${state.wiki.get(norm(m.wikiTitle||m.title))?.extract||''}`.toLowerCase();
const has=(m,re)=>re.test(text(m));
const modeMeta={
  foryou:['YOUR TASTE','Closest matches first'],new:['NEWER FILMS','Released 2024–2026'],homoerotic:['PHYSICAL TENSION','Homoerotic closeness'],masculine:['MASCULINE WORLDS','Sports, military, work and male groups'],latin:['LATIN AMERICA','Argentina, Brazil, Chile and beyond'],all:['FULL LIBRARY','All 500 modern queer films']
};
function filtered(){
  let a=state.movies.filter(m=>!savedWatched(m));
  if(state.mode==='new')a=a.filter(m=>Number(m.year)>=2024);
  if(state.mode==='homoerotic')a=a.filter(m=>has(m,/homoerotic|sexual tension|erotic|physical|nudity|sex|male friendship|intimacy|cruising|lover/));
  if(state.mode==='masculine')a=a.filter(m=>has(m,/masculin|football|rugby|boxing|swim|military|police|trucker|locker|sports|team|gaucho|factory|rural/));
  if(state.mode==='latin')a=a.filter(m=>has(m,/argentina|brazil|chile|uruguay|mexico|ecuador|guatemala|cuba|colombia|peru|latin/));
  if(state.query.trim()){
    const q=state.query.trim().toLowerCase();a=a.filter(m=>text(m).includes(q));
  }
  return [...a].sort((a,b)=>(a.curatedRank??999)-(b.curatedRank??999)||(b.score||0)-(a.score||0)||Number(b.year)-Number(a.year)||a.title.localeCompare(b.title));
}
function tagsFor(m){
  const t=text(m),out=[];
  [['male friendship',/friend|roommate|teammate/],['homoerotic',/homoerotic|sexual tension|physical closeness/],['masculine',/masculin|rugby|football|boxing|military|police|trucker|factory|gaucho/],['slow burn',/slow.?burn|restrained|quiet|gradual/],['erotic',/erotic|sex|sexual|cruising|escort/],['closeted',/closet|repress|secret affair/],['Latin America',/argentina|brazil|chile|uruguay|mexico|ecuador|guatemala|cuba|colombia|peru/]].forEach(([label,re])=>{if(re.test(t))out.push(label)});
  for(const q of m.tags||[]){if(out.length>=5)break;const label=q.replaceAll('-',' ');if(!out.includes(label)&&!['feature','gay male','narrative'].includes(label))out.push(label)}
  return out.slice(0,5);
}
function placeholder(title){return `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="500" height="750"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#1e1b2b"/><stop offset="1" stop-color="#08070b"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#g)"/><text x="50%" y="48%" text-anchor="middle" fill="#e9e4f0" font-family="sans-serif" font-size="26">${esc(title).slice(0,24)}</text><text x="50%" y="54%" text-anchor="middle" fill="#90879e" font-family="sans-serif" font-size="18">Replite Cinema</text></svg>`)}`}
function posterFor(m){return m.image||state.wiki.get(norm(m.wikiTitle||m.title))?.thumbnail?.source||placeholder(m.title)}
function card(m){
  const el=document.createElement('article');el.className='movie-card';const chips=tagsFor(m).slice(0,3).map(t=>`<span>${esc(t)}</span>`).join('');
  el.innerHTML=`<button class="poster-wrap open" aria-label="Open ${esc(m.title)}"><img class="poster" src="${posterFor(m)}" alt="${esc(m.title)} poster" loading="lazy"><b class="taste">${m.score||60}% fit</b></button><div class="card-body"><div class="yearline">${esc(m.year)}${m.country?` · ${esc(m.country)}`:''}</div><h4>${esc(m.title)}</h4><div class="mini-tags">${chips}</div><p class="card-summary">${esc((state.wiki.get(norm(m.wikiTitle||m.title))?.extract||'Modern gay narrative film.').slice(0,155))}</p><div class="actions"><button class="primary open">View film</button><button class="ghost watched">Watched</button></div></div>`;
  el.querySelectorAll('.open').forEach(b=>b.onclick=()=>openMovie(m));el.querySelector('.watched').onclick=()=>markWatched(m,true);return el;
}
function render(){
  const a=filtered();const meta=modeMeta[state.mode];$('#sectionLabel').textContent=meta[0];$('#sectionTitle').textContent=meta[1];$('#resultCount').textContent=`${a.length} films`;$('#unseenCount').textContent=state.movies.filter(m=>!savedWatched(m)).length;$('#modernCount').textContent=state.movies.filter(m=>Number(m.year)>=2020).length;$('#status').textContent=a.length?'':'No films match this filter.';$('#grid').replaceChildren(...a.slice(0,state.visible).map(card));$('#loadMore').classList.toggle('hidden',state.visible>=a.length);enrichVisible(a.slice(0,state.visible));
}
async function enrichVisible(list){
  const need=list.filter(m=>!m.image&&!state.wiki.has(norm(m.wikiTitle||m.title))).slice(0,36);if(!need.length)return;
  for(let i=0;i<need.length;i+=12){
    const batch=need.slice(i,i+12),titles=batch.map(m=>m.wikiTitle||m.title);const p=new URLSearchParams({action:'query',prop:'pageimages|extracts',piprop:'thumbnail',pithumbsize:'500',exintro:'1',explaintext:'1',redirects:'1',format:'json',origin:'*',titles:titles.join('|')});
    try{const r=await fetch(`https://en.wikipedia.org/w/api.php?${p}`);const j=await r.json();for(const pg of Object.values(j.query?.pages||{})){state.wiki.set(norm(pg.title),pg);const target=batch.find(m=>norm(m.wikiTitle||m.title)===norm(pg.title)||norm(m.title)===norm(pg.title));if(target)state.wiki.set(norm(target.wikiTitle||target.title),pg)}refreshPosters()}catch{}
    await new Promise(r=>setTimeout(r,250));
  }
}
function refreshPosters(){document.querySelectorAll('.movie-card').forEach((el,i)=>{const m=filtered()[i];if(!m)return;const info=state.wiki.get(norm(m.wikiTitle||m.title));const img=el.querySelector('img');const src=posterFor(m);if(img&&img.src!==src)img.src=src;const p=el.querySelector('.card-summary');if(p&&info?.extract)p.textContent=info.extract.slice(0,155)})}
function markWatched(m,rerender=false){watched.add(norm(m.title));saveWatched();if(rerender)render();if($('#movieDialog').open)$('#movieDialog').close()}
function providerLinks(m){
  const q=encodeURIComponent(`${m.title} ${m.year}`),q2=encodeURIComponent(`"${m.title}" ${m.year} official streaming rent buy`);
  return `<a class="provider primary" target="_blank" rel="noopener" href="https://www.justwatch.com/us/search?q=${q}">Check legal availability</a><a class="provider" target="_blank" rel="noopener" href="https://tv.apple.com/search?term=${encodeURIComponent(m.title)}">Apple TV</a><a class="provider" target="_blank" rel="noopener" href="https://www.amazon.com/s?k=${q}&i=instant-video">Prime Video</a><a class="provider" target="_blank" rel="noopener" href="https://www.google.com/search?q=${q2}">More official sources</a><a class="provider" target="_blank" rel="noopener" href="https://www.google.com/search?q=${encodeURIComponent(`site:gagaoolala.com "${m.title}"`)}">GagaOOLala</a><a class="provider" target="_blank" rel="noopener" href="https://www.google.com/search?q=${encodeURIComponent(`site:watch.dekkoo.com "${m.title}"`)}">Dekkoo</a>`;
}
async function openMovie(m){
  const d=$('#movieDialog');d.showModal();$('#dialogBody').innerHTML='<div class="loading">Loading film identity…</div>';
  let info=state.wiki.get(norm(m.wikiTitle||m.title));if(!info&&!m.image){await enrichVisible([m]);info=state.wiki.get(norm(m.wikiTitle||m.title))}
  const synopsis=info?.extract||'Modern gay narrative film.';const chips=tagsFor(m).map(t=>`<span>${esc(t)}</span>`).join('');
  const wiki=`https://en.wikipedia.org/wiki/${encodeURIComponent((m.wikiTitle||m.title).replaceAll(' ','_'))}`;
  $('#dialogBody').innerHTML=`<div class="detail"><img class="detail-poster" src="${posterFor(m)}" alt="${esc(m.title)} poster"><div class="detail-copy"><span class="eyebrow">${m.score||60}% TASTE MATCH</span><h2>${esc(m.title)}</h2><p class="meta">${esc(m.year)}${m.country?` · ${esc(m.country)}`:''}</p><div class="tag-row">${chips}</div><p class="synopsis">${esc(synopsis.slice(0,900))}</p><h3>Watch / download legally</h3><p class="small">Availability changes by country. These buttons search official providers for this exact title and year.</p><div class="providers">${providerLinks(m)}</div><div class="detail-actions"><a class="text-link" href="${wiki}" target="_blank" rel="noopener">Verify film identity ↗</a><button id="dialogWatched" class="ghost">Mark watched</button></div></div></div>`;
  $('#dialogWatched').onclick=()=>markWatched(m,true);
}
async function init(){
  try{const r=await fetch(CATALOG,{cache:'no-store'});state.movies=(await r.json()).map(d=>({title:d.t,year:String(d.y),country:d.c||'',score:d.s,curatedRank:d.r??999,watched:!!d.w,wikiTitle:d.k||d.t,tags:d.g||[]}));$('#totalCount').textContent=state.movies.length;render()}catch(e){$('#status').textContent='Could not load the catalogue.'}
}
$('#searchInput').addEventListener('input',e=>{state.query=e.target.value;state.visible=36;render()});
$('#filters').addEventListener('click',e=>{const b=e.target.closest('[data-mode]');if(!b)return;document.querySelectorAll('.filter').forEach(x=>x.classList.remove('active'));b.classList.add('active');state.mode=b.dataset.mode;state.visible=36;render()});
$('#loadMore').onclick=()=>{state.visible+=36;render()};$('#closeDialog').onclick=()=>$('#movieDialog').close();$('#movieDialog').addEventListener('click',e=>{if(e.target===$('#movieDialog'))$('#movieDialog').close()});
let installPrompt=null;window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();installPrompt=e});$('#installBtn').onclick=async()=>{if(installPrompt){installPrompt.prompt();await installPrompt.userChoice;installPrompt=null}else alert('In Chrome on Android: open the ⋮ menu and choose “Install app” or “Add to Home screen”.')};
if('serviceWorker' in navigator)navigator.serviceWorker.register('/sw.js').catch(()=>{});
init();
