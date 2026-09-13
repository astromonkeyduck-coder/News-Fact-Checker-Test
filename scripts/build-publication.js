'use strict';
const fs=require('node:fs'),path=require('node:path');const root=path.resolve(__dirname,'..');
const R=require('../publication/render'),M=require('../publication/model'),D=require('../publication/data'),I=require('../publication/information');
require('./publication-shared-pages').buildSharedPages(root);
const raw=D.merge(require('../publication/data/posts.json')); const posts=M.prepare(raw);
function save(name,content){fs.writeFileSync(path.join(root,name),content);}
save('v2/index.html',R.home(raw));save('index.html',R.home(raw));save('archive.html',R.archive(raw));save('article.html',R.errorPage(404,''));
for(const name of I.paths)save(name.slice(1),I.information(name));
const G=require('../publication/story-guides');
const Inside=require('../publication/inside-story/render');
fs.mkdirSync(path.join(root,Inside.route),{recursive:true});
save(Inside.route.slice(1)+'index.html',R.page({title:Inside.title,description:Inside.description,canonical:Inside.route,insideStory:true,content:Inside.content()}));
for(const guide of [null,...G.guides]){const route=guide?G.href(guide):'/story-so-far/';fs.mkdirSync(path.join(root,route),{recursive:true});save(route.slice(1)+'index.html',R.page({title:guide?guide.title:'The story so far',description:guide?guide.intro:'Connected coverage, sourced claims and what changed.',canonical:route,active:'briefs',readingControls:true,content:guide?G.detailContent(guide,raw):G.indexContent()}));}
const staticPaths=['/',Inside.route,'/archive.html','/story-so-far/',...G.guides.map(G.href),...I.paths,'/contact.html','/editorial-policy.html','/privacy.html','/media-literacy-guide.html','/fact-checking-tips.html'];
const xml=s=>R.esc(s);
save('rss.xml',`<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>Noteworthy News</title><link>https://noteworthynews.co/</link><description>News updates and clearly labeled agency summaries.</description>${posts.slice(0,50).map(p=>`<item><title>${xml(p.title)}</title><link>https://noteworthynews.co${xml(p.href)}</link><guid isPermaLink="true">https://noteworthynews.co${xml(p.href)}</guid>${Date.parse(p.published)?`<pubDate>${new Date(p.published).toUTCString()}</pubDate>`:''}<description>${xml(p.summary||p.body.slice(0,300))}</description></item>`).join('')}</channel></rss>`);
save('publication-sitemap.xml',`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${[...staticPaths,...posts.map(p=>p.href)].map(p=>`<url><loc>https://noteworthynews.co${xml(p)}</loc></url>`).join('')}</urlset>`);
console.log(`Built publication: ${posts.length} listed records; ${I.paths.length} information pages; RSS and supplemental sitemap. No network calls or live writes.`);

require('./build-games');
