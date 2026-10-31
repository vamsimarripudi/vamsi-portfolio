import {createMcpHandler,McpServer} from '@modelcontextprotocol/server';
import {toNodeHandler} from '@modelcontextprotocol/node';
import * as z from 'zod/v4';

const annotations={readOnlyHint:true,destructiveHint:false,openWorldHint:false};
const jsonContent=value=>[{type:'text',text:JSON.stringify(value)}];
const baseUrl=siteUrl=>String(siteUrl||'').replace(/\/$/,'')+'/';
const publicUrl=(siteUrl,path)=>new URL(String(path||'').replace(/^\//,''),baseUrl(siteUrl)).toString();
const postId=slug=>'post:'+slug;
const seriesId=slug=>'series:'+slug;
const typeOf=id=>String(id||'').startsWith('post:')?'post':String(id||'').startsWith('series:')?'series':null;
const slugOf=id=>String(id||'').slice(String(id||'').indexOf(':')+1);
const categoryMap={latest:'Latest',wishes:'Wishes',builds:'Builds',notes:'Notes',journal:'Journal',moments:'Moments'};

const publicPostSummary=(post,journalSeries,siteUrl)=>({
  id:postId(post.slug),
  title:String(post.title||'Untitled'),
  type:String(post.type||''),
  category:String(post.category||''),
  excerpt:String(post.excerpt||'').slice(0,500),
  publishedAt:String(post.published_at||''),
  url:publicUrl(siteUrl,'post/'+encodeURIComponent(post.slug)),
  series:(()=>{
    const assignment=journalSeries.assignment(post.id);
    return assignment?{slug:assignment.slug,title:assignment.title,chapter:Number(assignment.partNumber)}:null;
  })()
});

const publicSeriesSummary=(series,siteUrl)=>({
  id:seriesId(series.slug),
  slug:series.slug,
  title:series.title,
  summary:series.summary||'',
  chapterCount:series.parts.length,
  url:publicUrl(siteUrl,'series/'+encodeURIComponent(series.slug))
});

export function createCornerPublicTools({store,journalSeries,siteUrl}){
  const search=({query})=>{
    const q=String(query||'').trim();
    if(!q)return {results:[]};
    const posts=store.search(q,20).map(post=>({
      id:postId(post.slug),title:post.title,url:publicUrl(siteUrl,'post/'+encodeURIComponent(post.slug))
    }));
    const needle=q.toLocaleLowerCase();
    const series=journalSeries.publicSlugs().map(slug=>journalSeries.published(slug)).filter(Boolean)
      .filter(item=>(item.title+' '+item.summary).toLocaleLowerCase().includes(needle))
      .map(item=>({id:seriesId(item.slug),title:item.title,url:publicUrl(siteUrl,'series/'+encodeURIComponent(item.slug))}));
    const seen=new Set(),results=[];
    for(const item of [...posts,...series]){
      if(seen.has(item.id))continue;seen.add(item.id);results.push(item);
      if(results.length>=20)break;
    }
    return {results};
  };

  const fetch=({id})=>{
    const kind=typeOf(id),slug=slugOf(id);
    if(kind==='post'){
      const post=store.getPost(slug);
      if(!post)return null;
      const assignment=journalSeries.assignment(post.id);
      const media=store.listMedia(post.id).filter(item=>String(item.mime_type||'').startsWith('image/')).slice(0,12)
        .map(item=>({
          url:publicUrl(siteUrl,'media/'+encodeURIComponent(item.storage_key)),
          alt:String(item.alt_text||post.title||'Photograph'),
          width:Number(item.width)||null,height:Number(item.height)||null
        }));
      return {
        id:postId(post.slug),title:post.title,text:String(post.body||''),url:publicUrl(siteUrl,'post/'+encodeURIComponent(post.slug)),
        metadata:{
          type:post.type,category:post.category,publishedAt:post.published_at,
          series:assignment?{slug:assignment.slug,title:assignment.title,chapter:Number(assignment.partNumber)}:null,
          images:media
        }
      };
    }
    if(kind==='series'){
      const series=journalSeries.published(slug);
      if(!series)return null;
      const chapters=series.parts.map(part=>({
        chapter:Number(part.partNumber),title:part.title,excerpt:String(part.excerpt||'').slice(0,500),
        url:publicUrl(siteUrl,'post/'+encodeURIComponent(part.slug))
      }));
      return {
        id:seriesId(series.slug),title:series.title,
        text:[series.summary||'',...chapters.map(ch=>`Chapter ${String(ch.chapter).padStart(2,'0')}: ${ch.title}\n${ch.excerpt}`)].filter(Boolean).join('\n\n'),
        url:publicUrl(siteUrl,'series/'+encodeURIComponent(series.slug)),
        metadata:{status:series.status||'ongoing',chapterCount:chapters.length,chapters}
      };
    }
    return null;
  };

  const listPosts=({category='latest',limit=10}={})=>{
    const key=String(category||'latest').toLowerCase(),label=categoryMap[key]||'Latest';
    const take=Math.max(1,Math.min(20,Number(limit)||10));
    const feed=store.getFeed({category:label,limit:take});
    return {posts:feed.items.slice(0,take).map(post=>publicPostSummary(post,journalSeries,siteUrl))};
  };

  const listSeries=()=>({
    series:journalSeries.publicSlugs().map(slug=>journalSeries.published(slug)).filter(Boolean)
      .map(item=>publicSeriesSummary(item,siteUrl))
  });

  return {search,fetch,listPosts,listSeries};
}

export function createCornerMcpHandler({store,journalSeries,siteUrl}){
  const tools=createCornerPublicTools({store,journalSeries,siteUrl});
  return createMcpHandler(()=>{
    const server=new McpServer(
      {name:'vamsis-corner',version:'1.0.0'},
      {instructions:"Vamsi's Corner exposes only publicly published stories and public Journal series. Use search and fetch for content discovery and citation. Never claim access to drafts, Studio accounts, private comments, member data, scheduling, publishing, deletion, or other write actions: those are intentionally not exposed by this public MCP server."}
    );

    server.registerTool('search',{
      title:"Search Vamsi's Corner",
      description:"Search only publicly published Vamsi's Corner stories and public Journal series. Use when the user wants to find something previously published.",
      inputSchema:z.object({query:z.string().min(1).max(100)}),
      outputSchema:z.object({results:z.array(z.object({id:z.string(),title:z.string(),url:z.string().url()}))}),
      annotations
    },async({query})=>{
      const value=tools.search({query});
      return {structuredContent:value,content:jsonContent(value)};
    });

    server.registerTool('fetch',{
      title:"Read a Vamsi's Corner item",
      description:"Retrieve the public text and citation URL for a search result returned by search. Accepts only public post:slug or series:slug identifiers.",
      inputSchema:z.object({id:z.string().min(6).max(180)}),
      outputSchema:z.object({
        id:z.string(),title:z.string(),text:z.string(),url:z.string().url(),metadata:z.record(z.string(),z.unknown()).optional()
      }),
      annotations
    },async({id})=>{
      const value=tools.fetch({id});
      if(!value)return {isError:true,content:[{type:'text',text:'Public Corner item not found.'}]};
      return {structuredContent:value,content:jsonContent(value)};
    });

    server.registerTool('list_published_posts',{
      title:"List published Corner stories",
      description:"List recent publicly published Corner stories, optionally scoped to one public collection. This never returns drafts or scheduled private posts.",
      inputSchema:z.object({
        category:z.enum(['latest','wishes','builds','notes','journal','moments']).optional(),
        limit:z.number().int().min(1).max(20).optional()
      }),
      outputSchema:z.object({posts:z.array(z.object({
        id:z.string(),title:z.string(),type:z.string(),category:z.string(),excerpt:z.string(),publishedAt:z.string(),url:z.string().url(),
        series:z.object({slug:z.string(),title:z.string(),chapter:z.number().int()}).nullable()
      }))}),
      annotations
    },async input=>{
      const value=tools.listPosts(input);
      return {structuredContent:value,content:jsonContent(value)};
    });

    server.registerTool('list_public_series',{
      title:"List public Journal series",
      description:"List Journal series that currently contain at least one published chapter, with public citation URLs and chapter counts.",
      inputSchema:z.object({}),
      outputSchema:z.object({series:z.array(z.object({
        id:z.string(),slug:z.string(),title:z.string(),summary:z.string(),chapterCount:z.number().int(),url:z.string().url()
      }))}),
      annotations
    },async()=>{
      const value=tools.listSeries();
      return {structuredContent:value,content:jsonContent(value)};
    });

    return server;
  },{responseMode:'json'});
}

export function createCornerMcpNodeHandler(options){
  const handler=createCornerMcpHandler(options);
  return {handle:toNodeHandler(handler),close:()=>handler.close()};
}
