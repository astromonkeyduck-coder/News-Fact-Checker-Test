(function (root, factory) {
  const api = factory(typeof module === 'object' && module.exports ? require('../lib/contentNormalize') : root.ContentNormalize);
  if (typeof module === 'object' && module.exports) module.exports = api; else root.PublicationModel = api;
})(typeof window === 'object' ? window : {}, function (cn) {
  'use strict';
  const clean = value => typeof value === 'string' ? value.trim() : '';
  const url = value => { const s = clean(value); return /^(https?:\/\/|\/(?!\/))/.test(s) ? s : ''; };
  const date = p => p.datePosted || p.createdAt || p.created_at || p.Date || '';
  function normalize(p) {
    const id = String(p.id || p.postId || '');
    p = (typeof module === 'object' && module.exports ? require('../lib/publicationSourceQuality') : window.PublicationSourceQuality).publicationPost(p);
    const source = clean(p.sourceName || p.source);
    const agency = /^(usgs|fda|nws|noaa)$/i.test(source) || /^(usgs-|eq-|fda-)/.test(id);
    const title = cn.cleanHeadline(p, { maxLength: 10000 }).replace(/^(BREAKING|JUST IN|DEVELOPING|UPDATE|WATCH|ALERT)\s*[:—-]\s*/i, '');
    const body = cn.normalizeSocialPostText(p.story || p.text || p.content || p.Content || '');
    const media = cn.getPrimaryMedia(p) || {};
    const summary = clean(p.dek || p.summary || p.excerpt || p.description);
    let category = clean(p.category) || 'News';
    if (/^(usgs-|eq-)/.test(id)) category = 'Earthquakes';
    const sources = [].concat(p.source_references || [], p.source_urls || [], p.source_url || p.sourceUrl || [], p.x_url || p.link || p.url || []).map(s => typeof s === 'string' ? {url:s} : s).filter(s => s && url(s.url));
    const seen = new Set();
    return {...p, id, title, body, summary: summary === title || body.startsWith(summary) && summary === body ? '' : summary,
      category, agency, depth:p.depth ?? p.assets?.depth, source: source || (id.startsWith('fda-') ? 'FDA' : /^(usgs-|eq-)/.test(id) ? 'USGS' : 'Noteworthy News'),
      format: media.type === 'video' ? 'video' : media.type === 'image' ? 'photo' : 'text',
      type: clean(p.content_type) || (agency ? 'Automated agency summary' : 'News update'),
      published: date(p), media: {type:media.type, url:url(media.url).replace(/^\/media\/video\//,'https://video.twimg.com/'), poster:url(media.poster)},
      references: sources.filter(s => {if(seen.has(s.url)) return false; seen.add(s.url); return true;}).map(s => ({...s,url:url(s.url), distribution:s.kind==='distribution'||/https?:\/\/(?:www\.)?(?:x|twitter)\.com\/(?:NoteworthyNews|newsnoteworthy)\//i.test(s.url)||(!agency&&new RegExp('^https?:\\/\\/(?:www\\.)?(?:x|twitter)\\.com/(?:i|NoteworthyNews|newsnoteworthy)/status/'+id+'(?:[/?#]|$)','i').test(s.url))})),
      href:'/article.html?id=' + encodeURIComponent(id)};
  }
  function visible(p) {return p.id && p.title && !['draft','review','suppressed'].includes(p.editorial_status || p.editorial_state) && !p.review_required && !/volcano/i.test(p.category || '');}
  function prepare(posts) {return posts.map(normalize).filter(visible).sort((a,b)=>(Date.parse(b.published)||0)-(Date.parse(a.published)||0));}
  function filter(posts,state={}) {
    const q=clean(state.q).toLowerCase();
    const list=posts.filter(p=>(!state.category||p.category===state.category)&&(!state.format||p.format===state.format)&&(!state.alerts||p.agency)&&(!q||`${p.title} ${p.body} ${p.category} ${p.location || ''} ${p.source}`.toLowerCase().includes(q)));
    list.sort((a,b)=>((Date.parse(b.published)||0)-(Date.parse(a.published)||0))*(state.sort==='oldest'?-1:1));
    const page=Math.max(1, Math.min(1000,parseInt(state.page,10)||1));
    return {total:list.length, shown:list.slice(0,page*12), remaining:Math.max(0,list.length-page*12), page};
  }
  return {normalize,prepare,filter,url};
});
