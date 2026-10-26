const DOWNLOAD_ROUTE='/_replite_download';

function isArchiveDownload(href){
  try{
    const url=new URL(href,location.href);
    return url.protocol==='https:' && (url.hostname==='archive.org'||url.hostname.endsWith('.archive.org')) && url.pathname.startsWith('/download/');
  }catch{return false}
}

function fileNameFromHref(href){
  try{
    const url=new URL(href,location.href);
    const part=url.pathname.split('/').filter(Boolean).pop()||'movie-video';
    return decodeURIComponent(part).replace(/[\\/:*?"<>|]+/g,'-');
  }catch{return'movie-video'}
}

function upgradeDownloadLink(link){
  if(!(link instanceof HTMLAnchorElement)||link.dataset.repliteDownload==='1')return;
  const direct=link.href;
  if(!isArchiveDownload(direct))return;
  if(!('serviceWorker'in navigator)||!navigator.serviceWorker.controller)return;
  const name=fileNameFromHref(direct);
  link.dataset.directSource=direct;
  link.dataset.repliteDownload='1';
  link.href=`${DOWNLOAD_ROUTE}?src=${encodeURIComponent(direct)}&name=${encodeURIComponent(name)}`;
  link.removeAttribute('target');
  link.setAttribute('download',name);
  link.textContent='Download to phone';
}

function scanDownloadLinks(root=document){
  root.querySelectorAll?.('#movieDialog .quality-option a.primary').forEach(upgradeDownloadLink);
}

const observer=new MutationObserver(records=>{
  for(const record of records){
    for(const node of record.addedNodes){
      if(node.nodeType!==Node.ELEMENT_NODE)continue;
      if(node.matches?.('#movieDialog .quality-option a.primary'))upgradeDownloadLink(node);
      scanDownloadLinks(node);
    }
  }
});

observer.observe(document.documentElement,{childList:true,subtree:true});
scanDownloadLinks();

if('serviceWorker'in navigator){
  navigator.serviceWorker.addEventListener('controllerchange',()=>scanDownloadLinks());
}
