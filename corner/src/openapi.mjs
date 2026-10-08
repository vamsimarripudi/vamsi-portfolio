// Corner v1 is an additive facade. /api/* routes remain backward compatible.
const routes=[
['get','/api/v1','getApiIndex','API index'],['get','/api/v1/live','getLiveness','Process liveness'],
['get','/api/v1/ready','getReadiness','Database and storage readiness'],
['get','/api/v1/health','getHealth','Service health'],['get','/api/v1/openapi.json','getOpenApi','OpenAPI specification'],
['get','/api/v1/posts','listPosts','Cursor-paginated published posts'],
['get','/api/v1/posts/{slug}','readPost','Read published post'],
['post','/api/v1/posts/{postId}/reactions','toggleReaction','Legacy non-idempotent reaction toggle'],
['put','/api/v1/posts/{postId}/reactions','setReaction','Idempotently set reaction'],
['delete','/api/v1/posts/{postId}/reactions','clearReaction','Idempotently remove reaction'],
['get','/api/v1/posts/{postId}/comments','listComments','Approved public comments'],
['post','/api/v1/posts/{postId}/comments','submitComment','Submit a moderated comment'],
['get','/api/v1/search','searchPosts','Search published posts'],
['get','/api/v1/status','getStatus','Current status and upcoming teasers'],
['get','/api/v1/realtime/stream','streamEvents','Replayable Server-Sent Events'],
['post','/api/v1/analytics/event','recordAnalyticsEvent','Record allowed first-party event'],
['post','/api/v1/admin/login','signInOwner','Owner login and session cookie'],
['post','/api/v1/admin/logout','signOutOwner','Revoke owner session'],
['get','/api/v1/admin/overview','getOwnerOverview','Owner dashboard summary'],
['get','/api/v1/admin/posts','listAdminPosts','List owner posts'],
['post','/api/v1/admin/posts','createPost','Create draft with 201 Location'],
['get','/api/v1/admin/posts/{postId}','readAdminPost','Read draft or published post'],
['patch','/api/v1/admin/posts/{postId}','updatePost','Update with optimistic version'],
['delete','/api/v1/admin/posts/{postId}','archiveAdminPost','Reversible soft-delete/archive'],
['post','/api/v1/admin/posts/{postId}/publish','publishPost','Publish post'],
['post','/api/v1/admin/posts/{postId}/archive','archivePost','Archive post'],
['post','/api/v1/admin/posts/{postId}/restore','restorePost','Restore archived post'],
['post','/api/v1/admin/posts/{postId}/schedule','schedulePost','Schedule post or yearly wish'],
['post','/api/v1/admin/posts/{postId}/duplicate','duplicatePost','Duplicate post'],
['put','/api/v1/admin/status','updatePublicStatus','Set published status'],
['get','/api/v1/admin/comments','listAdminComments','Moderation queue'],
['get','/api/v1/admin/comments/{commentId}','readAdminComment','Read private comment'],
['patch','/api/v1/admin/comments/{commentId}','moderateComment','Moderate comment'],
['delete','/api/v1/admin/comments/{commentId}','deleteComment','Soft-delete comment'],
['get','/api/v1/admin/media','listMedia','List media metadata'],
['post','/api/v1/admin/media/upload','uploadMedia','Validate and upload bytes'],
['get','/api/v1/admin/media/{mediaId}','getMedia','Read private media metadata'],
['patch','/api/v1/admin/media/{mediaId}','updateMedia','Update media metadata'],
['delete','/api/v1/admin/media/{mediaId}','deleteMedia','Delete media and bytes'],
['get','/api/v1/admin/settings','readSettings','Read publication settings'],
['put','/api/v1/admin/settings','updateSettings','Update publication settings'],
['get','/api/v1/admin/analytics/summary','readAnalytics','Read owner analytics'],
['get','/api/v1/admin/ops','readOperations','Read scheduler and health diagnostics'],
];
const json={'application/json':{schema:{type:'object'}}};
const reply=(description)=>({description,content:json});
const paths={};
for(const [method,url,id,summary] of routes){
 const op={operationId:id,summary,tags:[url.includes('/admin/')?'Owner':'Public'],responses:{'200':reply('Success'),'400':reply('Invalid input'),'401':reply('Authentication required'),'403':reply('Forbidden'),'404':reply('Not found'),'429':reply('Too many requests')}};
 const placeholders=[...url.matchAll(/\{(\w+)\}/g)].map(m=>({in:'path',name:m[1],required:true,schema:{type:'string'}}));
 if(placeholders.length)op.parameters=placeholders;
 if(url.includes('/admin/')&&id!=='signInOwner')op.security=[{ownerSession:[]}];
 if(['post','put','patch'].includes(method)&&!['signOutOwner','publishPost','archivePost','restorePost','duplicatePost'].includes(id))op.requestBody={required:true,content:json};
 if(id==='uploadMedia')op.requestBody={required:true,content:{'image/png':{schema:{type:'string',format:'binary'}},'image/jpeg':{schema:{type:'string',format:'binary'}},'video/mp4':{schema:{type:'string',format:'binary'}}}};
 if(id==='createPost')op.responses['201']=reply('Created; Location header points to resource');
 if(id==='getReadiness')op.responses['503']=reply('Storage unavailable');
 if(id==='streamEvents')op.responses['200']={description:'Event stream',content:{'text/event-stream':{schema:{type:'string'}}}};
 (paths[url]??={})[method]=op;
}
export const openApiDocument=(baseUrl)=>({
 openapi:'3.1.0',
 info:{title:"Vamsi's Corner REST API",version:'1.0.0',description:'Versioned same-origin JSON API with legacy compatibility. Owner session is HttpOnly/Secure/SameSite=Strict. Mutations require matching Origin. Post DELETE is reversible archival. PUT and DELETE reactions are idempotent; POST toggle is legacy.'},
 servers:[{url:baseUrl}],tags:[{name:'Public'},{name:'Owner'}],paths,
 components:{securitySchemes:{ownerSession:{type:'apiKey',in:'cookie',name:'corner_session'}}},
});
