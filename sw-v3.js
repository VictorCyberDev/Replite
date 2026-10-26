const CACHE='replite-cinema-v4';
const SHELL=['/','/index.html','/styles.css','/ui-v3.css','/app-v3.js','/download-helper-v4.js','/manifest.webmanifest','/icon-192.svg','/icon-512.svg'];
const DOWNLOAD_ROUTE='/_replite_download';

function safeDownloadName(name='movie-video'){
  return String(name).replace(/[\r\n"\\/:*?<>|]+/g,'-').slice(0,180)||'movie-video';
}

function allowedArchiveSource(raw){
  try{
    const url=new URL(raw);
    const archiveHost=url.hostname==='archive.org'||url.hostname.endsWith('.archive.org');
    return url.protocol==='https:'&&archiveHost&&url.pathname.startsWith('/download/')?url:null;
  }catch{return null}
}

async function streamDownload(requestUrl){
  const request=new URL(requestUrl);
  const source=allowedArchiveSource(request.searchParams.get('src')||'');
  if(!source)return new Response('Invalid download source',{status:400});

  const name=safeDownloadName(request.searchParams.get('name')||decodeURIComponent(source.pathname.split('/').pop()||'movie-video'));
  let upstream;
  try{
    upstream=await fetch(source.href,{mode:'cors',credentials:'omit',redirect:'follow'});
  }catch{
    return Response.redirect(source.href,302);
  }

  if(!upstream.ok||!upstream.body)return Response.redirect(source.href,302);

  const headers=new Headers();
  headers.set('Content-Type',upstream.headers.get('content-type')||'application/octet-stream');
  headers.set('Content-Disposition',`attachment; filename="${name}"`);
  const length=upstream.headers.get('content-length');
  if(length)headers.set('Content-Length',length);
  headers.set('Cache-Control','no-store');
  return new Response(upstream.body,{status:200,headers});
}

self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate',event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))));
  self.clients.claim();
});

self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  const url=new URL(event.request.url);

  if(url.origin===self.location.origin&&url.pathname===DOWNLOAD_ROUTE){
    event.respondWith(streamDownload(event.request.url));
    return;
  }

  if(url.origin!==self.location.origin)return;
  event.respondWith(
    fetch(event.request).then(response=>{
      const copy=response.clone();
      caches.open(CACHE).then(cache=>cache.put(event.request,copy));
      return response;
    }).catch(()=>caches.match(event.request).then(hit=>hit||caches.match('/index.html')))
  );
});
