// iOS/Android in-app browsers commonly block window.print(); a real PDF remains usable.
export function printablePdfPath(kind){
  if(!['privacy','terms','cookies'].includes(kind))throw Error('Unsupported legal document');
  return '/legal-pdf/' + kind + '.pdf';
}
export function printLegalDocument(kind,host=window){
  const url=printablePdfPath(kind);
  const ua=String(host.navigator?.userAgent||'');
  const mobile=Boolean(host.matchMedia?.('(pointer:coarse)')?.matches)||/iPhone|iPad|iPod|Android/i.test(ua);
  if(mobile||typeof host.print!=='function'){host.location.assign(url);return 'pdf';}
  try{host.print();return 'print';}
  catch{host.location.assign(url);return 'pdf';}
}
