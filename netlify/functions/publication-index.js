'use strict';
const {handler:read}=require('./posts-read');
const R=require('../../publication/render'),D=require('../../publication/data');
exports.handler=async event=>{
 const headers={'Content-Type':'text/html; charset=utf-8','Cache-Control':'public, max-age=60, stale-while-revalidate=300'};
 if(!['GET','HEAD'].includes(event.httpMethod||'GET'))return {statusCode:405,headers:{...headers,Allow:'GET, HEAD'},body:''};
 try{const result=await read({...event,httpMethod:'GET',queryStringParameters:{limit:'200'}});if(result.statusCode!==200)throw Error('Unavailable');const data=JSON.parse(result.body);if(!Array.isArray(data))throw Error('Invalid data');const posts=D.merge(data),query=event.queryStringParameters||{};return {statusCode:200,headers,body:event.httpMethod==='HEAD'?'':query.view==='archive'?R.archive(posts,query):R.home(posts)};}catch{return {statusCode:503,headers:{...headers,'Cache-Control':'no-store','Retry-After':'60'},body:R.page({title:'Coverage temporarily unavailable',description:'The archive is temporarily unavailable.',noindex:true,content:'<section class="empty-state error-state"><h1>Coverage is temporarily unavailable.</h1><p>The source service did not respond. Please try again shortly.</p><button class="button" data-retry>Try again</button></section>'})};}
};
