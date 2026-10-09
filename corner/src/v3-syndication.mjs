import crypto from 'node:crypto';
const xml=(v)=>String(v??'').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g,'')
 .replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;')
 .replaceAll('"','&quot;').replaceAll("'",'&apos;');
const validDate=(value,alt='1970-01-01T00:00:00.000Z')=>{
 const date=new Date(value||alt);
 return Number.isNaN(date.getTime())?new Date(alt):date;
};
const origin=(value)=>{
 const url=new URL(String(value||''));
 if(!['https:','http:'].includes(url.protocol)||url.username||url.password||url.search||url.hash)
  throw new Error('Invalid syndication site URL');
 return url.href.replace(/\/$/,'');
};
const link=(base,slug)=>base+'/post/'+encodeURIComponent(slug);
const excerpt=(post)=>String(post.excerpt||post.body||'').slice(0,380);
/** Only database-published, already-due posts enter RSS/Atom.
 * Never include drafts, private identities, signup records, or demo samples.
 */
export function renderSyndication(store,{format='rss',baseUrl,title="Vamsi's Corner",now=new Date()}={}){
 if(!['rss','atom'].includes(format))throw new Error('Unsupported syndication format');
 const base=origin(baseUrl),stamp=validDate(now),iso=stamp.toISOString();
 const posts=store.all("SELECT slug,title,excerpt,body,type,published_at,updated_at FROM posts WHERE state='published' AND published_at IS NOT NULL AND published_at<=? ORDER BY published_at DESC,id DESC LIMIT 40",iso);
 const latest=posts[0]?validDate(posts[0].updated_at||posts[0].published_at):new Date(0);
 const xmlDecl='<?xml version="1.0" encoding="UTF-8"?>\n';
 let output;
 if(format==='rss'){
  const items=posts.map(p=>{
   const url=link(base,p.slug);
   return '<item><title>'+xml(p.title)+'</title><link>'+xml(url)+'</link>'+
    '<guid isPermaLink="true">'+xml(url)+'</guid><pubDate>'+validDate(p.published_at).toUTCString()+'</pubDate>'+
    '<description>'+xml(excerpt(p))+'</description><category>'+xml(p.type)+'</category></item>';
  }).join('');
  output=xmlDecl+'<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom"><channel>'+
   '<title>'+xml(title)+'</title><link>'+xml(base)+'</link>'+
   '<description>Published thoughts, updates and celebrations.</description><language>en</language>'+
   '<lastBuildDate>'+latest.toUTCString()+'</lastBuildDate>'+
   '<atom:link href="'+xml(base+'/rss.xml')+'" rel="self" type="application/rss+xml"/>'+
   items+'</channel></rss>';
 }else{
  const entries=posts.map(p=>{
   const url=link(base,p.slug);
   return '<entry><id>'+xml(url)+'</id><title>'+xml(p.title)+'</title>'+
    '<link href="'+xml(url)+'"/><published>'+validDate(p.published_at).toISOString()+'</published>'+
    '<updated>'+validDate(p.updated_at||p.published_at).toISOString()+'</updated>'+
    '<summary type="text">'+xml(excerpt(p))+'</summary><category term="'+xml(p.type)+'"/></entry>';
  }).join('');
  output=xmlDecl+'<feed xmlns="http://www.w3.org/2005/Atom">'+
   '<id>'+xml(base)+'</id><title>'+xml(title)+'</title>'+
   '<subtitle>Published thoughts, updates and celebrations.</subtitle>'+
   '<updated>'+latest.toISOString()+'</updated><author><name>Vamsi</name></author>'+
   '<link rel="self" type="application/atom+xml" href="'+xml(base+'/atom.xml')+'"/>'+
   '<link rel="alternate" type="text/html" href="'+xml(base)+'"/>'+entries+'</feed>';
 }
 return {xml:output,etag:'"'+crypto.createHash('sha256').update(output).digest('hex')+'"',items:posts.length};
}
