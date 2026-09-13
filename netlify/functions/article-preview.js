'use strict';
// Same complete HTML for people and crawlers; original article IDs remain canonical.
const {handler:read}=require('./posts-read');
const R=require('../../publication/render');
const D=require('../../publication/data');
exports.handler=async event=>{
 const id=event.queryStringParameters?.id || '';
 const headers={'Content-Type':'text/html; charset=utf-8','Cache-Control':'public, max-age=60, stale-while-revalidate=300'};
 if(!['GET','HEAD'].includes(event.httpMethod||'GET'))return {statusCode:405,headers:{...headers,Allow:'GET, HEAD'},body:''};
 try {
  if(!id) return {statusCode:404,headers:{...headers,'Cache-Control':'no-store'},body:R.errorPage(404,id)};
  if(D.editorial.articles.some(p=>String(p.id)===id&&!['published','corrected'].includes(p.state)))return {statusCode:404,headers:{...headers,'Cache-Control':'no-store'},body:R.errorPage(404,id)};
  const local=D.merge([]).find(p=>String(p.id)===id);
  const result=local?{statusCode:200,body:JSON.stringify([local])}:await read({...event,httpMethod:'GET',queryStringParameters:{id}});
  const posts=JSON.parse(result.body);const post=Array.isArray(posts)?posts[0]:null;
  if(result.statusCode!==200||!post){const status=result.statusCode>=500?503:404;return {statusCode:status,headers:{...headers,'Cache-Control':'no-store'},body:R.errorPage(status,id)};}
  let related=[];
  try {const feed=await read({...event,httpMethod:'GET',queryStringParameters:{limit:'200'}});if(feed.statusCode===200)related=JSON.parse(feed.body);} catch {}
  return {statusCode:200,headers,body:event.httpMethod==='HEAD'?'':R.article(post,Array.isArray(related)?D.merge(related):[])};
 }catch {return {statusCode:503,headers:{...headers,'Cache-Control':'no-store','Retry-After':'60'},body:R.errorPage(503,id)};}
};
