/* Local research reference. No network request is needed to load this wiki. */
(() => {
  'use strict';
  const data = window.WIKI_DATA;
  const main = document.getElementById('main');
  if (!data || !Array.isArray(data.entries)) {
    main.innerHTML = '<h1>Research data is unavailable</h1><p>Keep this page beside its <code>data/wiki-data.js</code> file, then open <code>index.html</code> again.</p>';
    return;
  }
  const list = value => value == null ? [] : Array.isArray(value) ? value : [value];
  const text = value => value == null ? '' : typeof value === 'object' ? (value.name || value.title || value.label || value.text || '') : String(value);
  const esc = value => text(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const plain = value => text(value).replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/[*_`#]/g, '').trim();
  const safeURL = value => {
    const url = text(value).trim();
    if (!url || /^(?:javascript|data|vbscript):/i.test(url) || /[\u0000-\u001f]/.test(url)) return '';
    return /^(?:https?:|file:|#|\.{0,2}\/)/i.test(url) || !/^[a-z][a-z\d+.-]*:/i.test(url) ? url : '';
  };
  const a = (url, label, cls = '', external = false) => {
    const safe = safeURL(url);
    return safe ? `<a href="${esc(safe)}"${cls ? ` class="${esc(cls)}"` : ''}${external ? ' target="_blank" rel="noopener noreferrer"' : ''}>${esc(label || url)}</a>` : esc(label || url);
  };
  function inline(value) {
    const slots = [];
    let source = text(value).replace(/\[([^\]]+)\]\(([^\s)]+)(?:\s+"[^"]*")?\)/g, (_, label, url) => {
      slots.push(a(url, label, '', /^https?:/i.test(url)));
      return `\u0001${slots.length - 1}\u0002`;
    });
    source = esc(source).replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/`([^`]+)`/g, '<span class="inline-code">$1</span>').replace(/\*([^*\n]+)\*/g, '<em>$1</em>');
    return source.replace(/\u0001(\d+)\u0002/g, (_, i) => slots[Number(i)]);
  }
  function prose(value) {
    return list(value).filter(Boolean).map(item => {
      if (typeof item === 'object') return `<p>${inline(item.note || item.text || item.description || item.summary || text(item))}</p>`;
      return String(item).split(/\n\s*\n/).filter(Boolean).map(p => `<p>${inline(p.replace(/\n/g, ' '))}</p>`).join('');
    }).join('');
  }
  const count = n => Number(n).toLocaleString('en-US');
  const collection = e => text(e.collection || e.collection_title || 'Research collection');
  const status = e => text(e.evidence_status || e.status || e.evidence || 'Research note');
  const category = e => text(e.category || e.theme || 'Uncategorised');
  const dateLabel = e => text(e.date_label || e.date_start || 'Date not established');
  const dateKey = e => text(e.date_sort || e.date_start || '');
  const yearOf = e => {
    const s = dateKey(e);
    if (/^(?:9999|unknown|undated)/i.test(s)) return null;
    const match = s.match(/^(-?\d{1,4})(?:\D|$)/);
    return match ? Number(match[1]) : null;
  };
  const lastYear = e => {
    const m = text(e.date_end_sort || e.date_end || e.date_sort || e.date_start).match(/^(-?\d{1,4})(?:\D|$)/);
    return m ? Number(m[1]) : yearOf(e);
  };
  const synopsis = e => plain(e.synopsis || e.summary || e.description || 'A research entry with source links and notes.');
  const brief = (value, length = 260) => {
    const clean = plain(value);
    return clean.length <= length ? clean : clean.slice(0, length).replace(/\s+\S*$/, '') + '…';
  };
  const routeFor = e => '#event/' + encodeURIComponent(e.id);
  const entries = [...data.entries].sort((x, y) => {
    const aYear = yearOf(x), bYear = yearOf(y);
    if (aYear == null && bYear != null) return 1;
    if (bYear == null && aYear != null) return -1;
    return (aYear ?? 0) - (bYear ?? 0) || dateKey(x).localeCompare(dateKey(y)) || text(x.title).localeCompare(text(y.title));
  });
  const byId = new Map(entries.map(e => [String(e.id), e]));
  const assets = list(data.assets);
  const byAsset = new Map(assets.map(e => [String(e.id), e]));
  const documents = list(data.documents);
  const byDoc = new Map(documents.map(d => [String(d.id), d]));
  const collections = [...new Set(entries.map(collection))].sort();
  const categories = [...new Set(entries.map(category))].sort();
  const statuses = [...new Set(entries.map(status))].sort();
  const searchText = new Map(entries.map(e => [String(e.id), [e.id,e.title,e.synopsis,e.summary,collection(e),category(e),...list(e.tags),...list(e.people).map(text),...list(e.places).map(p => typeof p === 'object' ? [p.name,p.address,p.geography].join(' ') : p)].join(' ').toLocaleLowerCase()]));
  let indexState = {q:'',collection:'',category:'',evidence:'',from:'',to:''};
  let shown = 60;
  let libraryQuery = '';
  let lastIndexHash = '#events';
  let timer;
  document.getElementById('sidebar-stats').innerHTML = `<dt>Research entries</dt><dd>${count(entries.length)}</dd><dt>Collections</dt><dd>${count(collections.length)}</dd><dt>Documents</dt><dd>${count(documents.length)}</dd><dt>Archived assets</dt><dd>${count(assets.length)}</dd>`;
  document.getElementById('build-date').textContent = data.meta?.updated || data.meta?.built || data.meta?.generated_at || data.meta?.built_at ? 'Updated ' + text(data.meta.updated || data.meta.built || data.meta.generated_at || data.meta.built_at).slice(0, 10) : 'Built from the research archive';
  const boundary = '<div class="boundary-banner"><strong>Research collection · not book canon.</strong> Historical accounts, uncertain leads and optional fictional interpretations retain their own labels. Incorporation into a book requires an explicit instruction from the owner.</div>';
  function setNav(name) {
    document.querySelectorAll('[data-nav]').forEach(el => { el.classList.toggle('active', el.dataset.nav === name); if(el.dataset.nav === name) el.setAttribute('aria-current','page'); else el.removeAttribute('aria-current'); });
  }
  function options(values, selected, all) { return `<option value="">${esc(all)}</option>` + values.map(v => `<option value="${esc(v)}"${v === selected ? ' selected' : ''}>${esc(v)}</option>`).join(''); }
  function filteredEntries() {
    const words = indexState.q.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
    return entries.filter(e => {
      if (indexState.collection && collection(e) !== indexState.collection) return false;
      if (indexState.category && category(e) !== indexState.category) return false;
      if (indexState.evidence && status(e) !== indexState.evidence) return false;
      if (words.length && !words.every(w => searchText.get(String(e.id)).includes(w))) return false;
      const from = indexState.from === '' ? null : Number(indexState.from), to = indexState.to === '' ? null : Number(indexState.to);
      if ((from != null || to != null) && yearOf(e) == null) return false;
      if (from != null && lastYear(e) < from) return false;
      if (to != null && yearOf(e) > to) return false;
      return true;
    });
  }
  function stateHash() { const p = new URLSearchParams(); Object.entries(indexState).forEach(([k,v]) => { if(v !== '')p.set(k,v); }); return '#events' + (p.toString() ? '?' + p : ''); }
  function saveIndexRoute() { lastIndexHash = stateHash(); history.replaceState(null, '', lastIndexHash); }
  function renderIndex() {
    setNav('events'); document.title = 'Chronological index · Umbra Research Wiki';
    main.innerHTML = `<div class="eyebrow">Umbra Against the Darkness · historical research</div><h1>Chronological index</h1><p class="page-intro">A record of events, people, places and historical conditions to explore. Follow an entry into its history, sources, maps and research notes, then consider the story possibilities separately.</p><div class="article-tabbar"><span class="selected">Events &amp; historical context</span><a href="#library">Documents &amp; reviews</a><span class="right">Oldest → newest</span></div>${boundary}<form class="filters" id="filter-form"><label class="search-label" for="search">Search the collection</label><input class="search-field" id="search" name="q" type="search" value="${esc(indexState.q)}" placeholder="Search events, people, places or a reference ID…" autocomplete="off"><div class="filter-grid"><label for="collection">Collection<select id="collection" name="collection">${options(collections,indexState.collection,'All collections')}</select></label><label for="category">Subject<select id="category" name="category">${options(categories,indexState.category,'All subjects')}</select></label><label for="evidence">Evidence label<select id="evidence" name="evidence">${options(statuses,indexState.evidence,'All evidence labels')}</select></label><label for="from" class="year-input">From year<input id="from" name="from" type="number" min="-9999" max="9999" value="${esc(indexState.from)}" placeholder="Any"></label><label for="to" class="year-input">To year<input id="to" name="to" type="number" min="-9999" max="9999" value="${esc(indexState.to)}" placeholder="Any"></label></div><div class="filter-actions"><button type="button" class="small-button" data-period="1928,1936">Chicago era: 1928–1936</button><button type="button" class="small-button" data-period=",">All dates</button><button type="button" class="text-button" id="reset-filters">Reset filters</button><span class="filter-hint">Date ranges overlap the selected years. Undated entries appear last.</span></div></form><div id="results" aria-live="polite" aria-atomic="false"></div>`;
    const form = document.getElementById('filter-form');
    form.addEventListener('submit', event => event.preventDefault());
    form.addEventListener('input', event => {
      if (!Object.hasOwn(indexState, event.target.name)) return;
      indexState[event.target.name] = event.target.value;
      clearTimeout(timer); timer = setTimeout(() => {shown=60;saveIndexRoute();renderResults();}, event.target.name === 'q' ? 140 : 0);
    });
    form.addEventListener('change', event => { if(Object.hasOwn(indexState,event.target.name)){indexState[event.target.name]=event.target.value;shown=60;saveIndexRoute();renderResults();} });
    form.querySelectorAll('[data-period]').forEach(button => button.addEventListener('click', () => {
      const [from,to] = button.dataset.period.split(',');indexState.from=from;indexState.to=to;form.elements.from.value=from;form.elements.to.value=to;shown=60;saveIndexRoute();renderResults();
    }));
    document.getElementById('reset-filters').addEventListener('click', () => {indexState={q:'',collection:'',category:'',evidence:'',from:'',to:''};shown=60;saveIndexRoute();renderIndex();document.getElementById('search').focus();});
    renderResults();
  }
  function renderResults() {
    const found = filteredEntries();
    const resultNode = document.getElementById('results'); if(!resultNode)return;
    let html = `<div class="results-bar"><strong>${count(found.length)} ${found.length === 1 ? 'research entry' : 'research entries'}</strong><span>${indexState.from || indexState.to ? esc(indexState.from || 'Earliest') + ' – ' + esc(indexState.to || 'Latest') : 'Complete collection'} · chronological order</span></div>`;
    if (!found.length) html += '<div class="empty-state"><h2>No matching entries</h2><p>Try a broader name, remove a filter, or widen the dates.</p></div>';
    let previousYear;
    for (const e of found.slice(0,shown)) {
      const year = yearOf(e); const label = year == null ? 'Undated & ongoing context' : year < 0 ? Math.abs(year) + ' BCE' : String(year);
      if(label !== previousYear){html += `<h2 class="timeline-year">${esc(label)}</h2>`;previousYear=label;}
      html += `<article class="event-row"><div class="event-date">${esc(dateLabel(e))}</div><div><h3 class="event-title">${a(routeFor(e),e.title)}</h3><p class="event-synopsis">${esc(brief(synopsis(e),245))}</p><div class="row-metadata"><span class="evidence-dot ${/lead|uncertain|folklore|unverified/i.test(status(e))?'caution':''}">${esc(status(e))}</span><span>${esc(collection(e))}</span><span>${esc(e.id)}</span></div></div></article>`;
    }
    if(found.length)html += `<div class="load-more">${shown < found.length ? '<button class="button" id="load-more">Show the next 60 entries</button>' : '<span class="small-note">End of this selection</span>'}<p>Showing ${count(Math.min(shown,found.length))} of ${count(found.length)} entries</p></div>`;
    resultNode.innerHTML = html;
    document.getElementById('load-more')?.addEventListener('click', () => { const y=window.scrollY;shown+=60;renderResults();window.scrollTo(0,y); });
  }
  function resolveDocument(value) {
    if(!value)return null;
    if(typeof value === 'object')return value;
    return byDoc.get(String(value)) || {href:value,title:plain(String(value).split(/[\\/]/).pop()).replace(/\.(?:md|html)$/i,'')};
  }
  function documentLink(value, fallback, note='') {
    const d = resolveDocument(value); if(!d)return '';
    return `<div class="document-link">${a(d.href || d.url || d.local_url, fallback || d.title || 'Open document')}${note ? `<small>${esc(note)}</small>` : ''}</div>`;
  }
  function renderSource(source, i) {
    if(typeof source === 'string')source = {url:source,title:source};
    return `<li id="source-${i+1}"><div class="source-title">${a(source.url || source.href,source.title || source.name || 'Source '+(i+1),'',true)}</div><div class="source-detail">${[source.publisher,source.kind,source.date].filter(Boolean).map(esc).join(' · ')}</div>${source.supports ? `<div class="source-support"><strong>Used for:</strong> ${inline(source.supports)}</div>` : '<div class="source-support muted">No claim-level support note was recorded for this citation.</div>'}${source.note || source.access ? `<div class="source-detail">${inline(source.note || source.access)}</div>` : ''}<span class="source-url">${esc(source.url || source.href)}</span></li>`;
  }
  function renderAsset(asset) {
    const url = asset.local_url || asset.href || asset.file;
    const isImage = /\.(?:jpe?g|png|gif|webp|svg)(?:$|\?)/i.test(url || '') || /^(?:image|JPEG|PNG)/i.test(asset.format || asset.mime || '');
    const media = isImage && safeURL(url) ? `<a href="${esc(safeURL(url))}" target="_blank" rel="noopener"><img src="${esc(safeURL(url))}" alt="${esc(asset.alt || asset.title || 'Archived reference image')}" loading="lazy"></a>` : `<a class="asset-download" href="${esc(safeURL(url) || '#')}" target="_blank" rel="noopener">${/pdf/i.test(asset.format || url) ? 'PDF' : 'DOCUMENT'}</a>`;
    return `<figure class="asset-card">${media}<figcaption><strong>${a(url,asset.title || asset.id,'',true)}</strong>${asset.description ? `<div>${inline(asset.description)}</div>` : ''}<div class="asset-meta">${[asset.creator,asset.date].filter(Boolean).map(esc).join(' · ')}</div><div class="asset-meta"><strong>Rights &amp; attribution</strong>${esc(asset.rights || 'No rights statement recorded; consult the original source before reuse.')}</div>${asset.source_url ? `<div class="asset-meta">${a(asset.source_url,'Original source','',true)}</div>` : ''}</figcaption></figure>`;
  }
  function entryAssets(e) {
    const ids = new Set([...list(e.asset_ids),...list(e.assets_ids)].map(String));
    return assets.filter(asset => ids.has(String(asset.id)) || list(asset.entry_ids).map(String).includes(String(e.id)));
  }
  function renderPlace(p) {
    if(typeof p === 'string')p = {name:p};
    return `<div class="place-card"><strong>${esc(p.name || p.title)}</strong>${p.address ? `<p>${esc(p.address)}</p>`:''}${p.geography ? `<p>${esc(p.geography)}</p>`:''}${p.map_url || p.url ? `<p>${a(p.map_url || p.url,'Open location map ↗','',true)}</p>`:''}<div class="precision">${esc(p.precision || 'Location precision was not recorded.')}</div></div>`;
  }
  function renderEntry(id, section) {
    const e = byId.get(id); if(!e){setNav('events');main.innerHTML=`<h1>Entry not found</h1><p>No entry with reference <strong>${esc(id)}</strong> is present in this build.</p><p>${a('#events','Return to the chronological index')}</p>`;return;}
    setNav('events');document.title=plain(e.title)+' · Umbra Research Wiki';
    const sources=list(e.sources), places=list(e.places), people=list(e.people), entryImages=entryAssets(e);
    const related = [...new Set([...list(e.related_ids),...list(e.see_also_v1),...list(e.cross_refs)].map(x=>typeof x==='object'?x.id:String(x)))].filter(x=>byId.has(x)&&x!==String(e.id)).slice(0,15);
    const originalDoc=resolveDocument(e.source_doc || e.source_document);
    const sourceHref=originalDoc ? text(originalDoc.href || originalDoc.url || originalDoc.local_url) : '';
    const sourceAnchor=text(e.source_anchor);
    const srcDoc=originalDoc ? {...originalDoc,href:sourceHref + (sourceAnchor && !sourceHref.includes('#') ? sourceAnchor : '')} : null;
    const review=e.review_doc || e.review_docs || e.fact_check_doc;
    const notes=[...list(e.notes),...list(e.research_notes)];
    const uncertain=[...list(e.uncertainties),...list(e.unverified)];
    const sections=[['account','Historical account / research notes'],['images','Images & documents'],['places','Locations & maps'],['sources','Sources & citations'],['notes','Research notes & reviews'],['related','Related entries'],['possibilities','Optional supernatural possibilities']];
    const synopsisText=synopsis(e);
    
    main.innerHTML=`<nav class="breadcrumb" aria-label="Breadcrumb">${a(lastIndexHash,'Chronological index')}<span aria-hidden="true">›</span><span>${esc(collection(e))}</span><span aria-hidden="true">›</span><span>${esc(e.id)}</span></nav><h1>${esc(e.title)}</h1><div class="article-tabbar"><span class="selected">Research article</span>${srcDoc?a(resolveDocument(srcDoc)?.href || srcDoc,'Source dossier'):''}<span class="right">${esc(status(e))}</span></div><p class="article-lead">${esc(brief(synopsisText,600))}</p>${boundary}<div class="article-layout"><div class="article-body"><section id="account"><h2>Historical account / research notes</h2><p class="small-note">Descriptions are imported with their original qualifiers and observations. The evidence label describes the source record; this wiki rebuild is not a new verification of every claim.</p>${prose(e.summary || e.description || synopsisText)}${e.theme ? `<p class="small-note"><strong>Research theme:</strong> ${inline(e.theme)}</p>`:''}</section><section id="images"><h2>Images &amp; documents</h2>${entryImages.length?`<div class="asset-grid">${entryImages.map(renderAsset).join('')}</div>`:'<p class="section-empty">No image or scan is archived against this entry yet.</p>'}${list(e.image_leads).length?`<h3>Image leads</h3><ul>${list(e.image_leads).map(x=>`<li>${typeof x==='object'?a(x.url || x.href,x.title || x.note || x.name,'',true):inline(x)}</li>`).join('')}</ul><p class="small-note">These leads are references to follow, not a claim that an image has been downloaded or cleared for reuse.</p>`:''}</section><section id="places"><h2>Locations &amp; maps</h2>${places.length?places.map(renderPlace).join(''):'<p class="section-empty">No specific location has been recorded.</p>'}<p class="small-note">Modern map links locate the recorded place or search phrase. They do not establish a historical address, original footprint or surveyed coordinate.</p></section><section id="sources"><h2>Sources &amp; citations</h2>${sources.length?`<ol class="source-list">${sources.map(renderSource).join('')}</ol>`:'<p class="section-empty">No external citation is listed in this record. Consult the source dossier and treat this as an unverified lead.</p>'}</section><section id="notes"><h2>Research notes &amp; reviews</h2>${uncertain.filter(Boolean).length?`<h3>Uncertainty &amp; cautions</h3>${prose(uncertain)}`:'<p class="small-note">No additional uncertainty note was recorded. This is not a guarantee that all details are established.</p>'}${notes.length?`<h3>Research observations</h3>${prose(notes)}`:''}${list(e.corrections).length?`<h3>Recorded corrections</h3>${prose(e.corrections)}`:''}${e.follow_up?`<h3>Further research</h3>${prose(e.follow_up)}`:''}${srcDoc?documentLink(srcDoc,'Open the original research dossier',e.source_heading?`Heading: ${e.source_heading}`:'Original notes preserve context and provenance.'):''}${list(review).map(d=>documentLink(d,'Open the research review','A chapter review is not a guarantee that every entry or every citation was individually checked.')).join('')}${e.fact_check_status?`<p class="small-note"><strong>Recorded review status:</strong> ${inline(e.fact_check_status)}</p>`:''}${e.provenance || e.retrieved?`<details class="research-detail"><summary>Record provenance</summary><div>${prose(e.provenance)}${e.retrieved?`<p>Recorded retrieval date: ${esc(e.retrieved)}</p>`:''}${e.source_line?`<p>Original dossier line: ${esc(e.source_line)}</p>`:''}</div></details>`:''}</section><section id="related"><h2>Related entries</h2>${related.length?`<ul class="related-list">${related.map(id=>`<li>${a(routeFor(byId.get(id)),byId.get(id).title)} <span class="muted">(${esc(dateLabel(byId.get(id)))})</span></li>`).join('')}</ul>`:'<p class="section-empty">No explicit cross-reference is recorded for this entry.</p>'}<div>${list(e.tags).map(t=>`<a class="category-tag" href="#events?q=${encodeURIComponent(text(t))}">${esc(t)}</a>`).join('')}</div></section><section id="possibilities" class="fiction-section"><div class="fiction-label">Optional fiction · owner consideration</div><h2>Supernatural possibilities</h2>${e.hook?`<blockquote>${inline(e.hook)}</blockquote>`:'<p>No supernatural suggestion has been recorded for this entry. The historical material remains available for the owner to connect.</p>'}${e.divergence?`<details class="research-detail"><summary>Existing alternate-history discussion</summary><div>${prose(e.divergence)}<p>Terms such as “resolved,” “delegated,” or “happened” in older research notes preserve the earlier discussion. They do not promote this entry or its interpretation into a book.</p></div></details>`:''}<p class="boundary">A possible direction, not an assigned mission or settled explanation. Discussion, selection or approval of a research idea does not authorize writing it into a book.</p></section></div><aside class="article-aside" aria-label="Article reference"><div class="info-box"><h2>At a glance</h2><dl><dt>Date</dt><dd>${esc(dateLabel(e))}${e.date_precision?`<br><span class="muted">${esc(e.date_precision)}</span>`:''}${e.date_note?`<br><span class="muted">${esc(e.date_note)}</span>`:''}</dd><dt>Collection</dt><dd>${esc(collection(e))}</dd><dt>Subject</dt><dd>${esc(category(e))}</dd><dt>Evidence</dt><dd>${esc(status(e))}</dd>${places.length?`<dt>Places</dt><dd><ul>${places.slice(0,8).map(p=>`<li>${esc(text(p))}</li>`).join('')}</ul></dd>`:''}${people.length?`<dt>People</dt><dd><ul>${people.slice(0,18).map(p=>`<li>${esc(text(p))}</li>`).join('')}</ul>${people.length>18?`<span class="muted">${people.length-18} further names in the source dossier</span>`:''}</dd>`:''}<dt>Sources</dt><dd>${count(sources.length)} listed</dd></dl><div class="entry-id">Reference ID: ${esc(e.id)}</div></div><nav class="toc" aria-label="On this page"><strong>Contents</strong><ol>${sections.map(([key,label])=>`<li><a href="${routeFor(e)}/${key}">${esc(label)}</a></li>`).join('')}</ol></nav></aside></div><div class="article-bottom">${a(lastIndexHash,'← Return to the chronological index')}<div><button class="small-button" id="copy-link">Copy article link</button><span class="status-message" id="copy-status" role="status"></span></div></div>`;
    document.getElementById('copy-link').addEventListener('click',async()=>{
      const url=location.href.split('#')[0]+routeFor(e), target=document.getElementById('copy-status');
      try {if(!navigator.clipboard?.writeText)throw new Error('Clipboard unavailable');await navigator.clipboard.writeText(url);target.textContent='Link copied';} catch {target.innerHTML=`<label>Article link <input type="text" value="${esc(url)}" readonly aria-label="Article link, select and copy"></label>`;target.querySelector('input').select();}
    });
    if(section)requestAnimationFrame(()=>document.getElementById(section)?.scrollIntoView());
  }
  function docKind(d) {return text(d.kind || d.role || d.type || 'Research document');}
  function renderLibrary() {
    setNav('library');document.title='Research library · Umbra Research Wiki';
    main.innerHTML=`<div class="eyebrow">Source dossiers · reviews · synthesis</div><h1>Research library</h1><p class="page-intro">The longer notes behind the event entries: source dossiers, historical checks, research syntheses and optional story proposals. Open a document to read its original context.</p><div class="article-tabbar"><span class="selected">Documents &amp; reviews</span><a href="#events">Chronological index</a><span class="right">${count(documents.length)} documents</span></div>${boundary}<label class="search-label" for="library-search">Find a document</label><input class="search-field" type="search" id="library-search" value="${esc(libraryQuery)}" placeholder="Search document titles, collections or types…"><div id="library-results" aria-live="polite"></div>`;
    document.getElementById('library-search').addEventListener('input',e=>{libraryQuery=e.target.value;renderLibraryResults();});renderLibraryResults();
  }
  function renderLibraryResults() {
    const words=libraryQuery.toLocaleLowerCase().split(/\s+/).filter(Boolean);
    const found=documents.filter(d=>words.every(w=>[d.title,d.collection,docKind(d),d.description,d.id].join(' ').toLocaleLowerCase().includes(w)));
    const groups=new Map();found.forEach(d=>{const key=text(d.collection || 'Shared reference');if(!groups.has(key))groups.set(key,[]);groups.get(key).push(d);});
    document.getElementById('library-results').innerHTML=`<div class="results-bar"><strong>${count(found.length)} ${found.length === 1 ? 'document' : 'documents'}</strong><span>Source notes retain their original wording</span></div>`+[...groups.entries()].map(([name,docs])=>`<section class="library-group"><h2>${esc(name)}</h2><ul class="doc-list">${docs.map(d=>`<li><div class="doc-kind">${esc(docKind(d))}</div><h3>${a(d.href || d.url || d.local_url,d.title || d.id)}</h3>${d.description?`<p>${esc(d.description)}</p>`:''}<p>${d.entry_count!=null?`${count(d.entry_count)} indexed ${d.entry_count === 1 ? 'entry' : 'entries'} · `:''}${esc(d.source_filename || d.filename || d.id || '')}${/seed|synthesis|fiction|thread|proposal/i.test(docKind(d)+' '+text(d.title))?' · Discussion and suggestions; not adopted book content':''}</p></li>`).join('')}</ul></section>`).join('')+(found.length?'':'<p class="empty-state">No documents match this search.</p>');
  }
  function renderAbout() {
    setNav('about');document.title='About · Umbra Research Wiki';
    main.innerHTML=`<div class="eyebrow">Purpose &amp; reading notes</div><h1>About this research wiki</h1><div class="article-tabbar"><span class="selected">Scope &amp; evidence</span><a href="#events">Chronological index</a></div><div class="prose"><p class="article-lead">A research reference for discovering the real events, people and places that may one day inform <em>Umbra Against the Darkness</em>.</p>${boundary}<h2>How to use the collection</h2><p>Start with the chronological index. Search an event, name, place or reference ID; narrow by collection, subject, evidence label or date. An entry opens with a synopsis and continues through the research account, archived material, location links, citations and review notes. Optional supernatural possibilities appear at the bottom.</p><p>Entries include events as well as people, institutions, places, folklore and historical background. They sort by the beginning of the date recorded in the research. A broad period or approximate date stays broad; its position in the index is not proof of an exact day. Date filters include periods that overlap the selected years. Undated records appear last.</p><h2>History, uncertainty and fiction</h2><table class="prose-table"><thead><tr><th>What you are reading</th><th>What it means</th></tr></thead><tbody><tr><td>Research account</td><td>The existing research description, with its source citations and qualifications preserved. It can include a researcher's interpretation; consult the underlying sources for consequential claims.</td></tr><tr><td>Evidence label</td><td>A label carried from the source record, such as documented, research lead or folklore. It is not a fresh guarantee of accuracy.</td></tr><tr><td>Review document</td><td>An existing check or correction report. A chapter having a review does not establish that every entry or every cited source was checked individually.</td></tr><tr><td>Supernatural possibility</td><td>An optional fictional direction for the owner to consider. It is not a historical conclusion, assigned mission or adopted storyline.</td></tr></tbody></table><h2>The book boundary</h2><p>This library is separate from book content and authority. Ordinary book reviews, patches, revisions, continuity checks and completeness assessments must exclude its research-only findings, gaps, hooks and proposed connections. They are not book defects or missing requirements.</p><p>Discussion, enthusiasm, selection, approval of an idea, or a decision made during research does not by itself authorize incorporation. Only an explicit owner instruction to write selected material into an identified book or section does that. Earlier “resolved” or “delegated” labels preserve provenance, not permission.</p><h2>Images, maps and source coverage</h2><p>Only archived assets are displayed as local illustrations. Each carries its recorded attribution and rights information. Image leads are clearly distinguished from downloaded material. Modern map links are locators; they do not prove historical boundaries or a precise period address.</p><p>Source links may require an internet connection, an archive subscription, or a later access check. A linked source is not a claim that its full content has been reviewed. In particular, a named YouTube video, description or feed item is not a completed video or transcript review; this collection does not establish complete coverage of Adam Selzer or any other channel.</p><h2>A shared research reference</h2><p>This public edition is hosted on GitHub Pages. Anyone with the link can read it without signing in. Its dark theme, search, research entries and archived assets are also included in the downloadable repository. External source and map links open only when selected. Four internal briefing, folder-inventory and session-dialogue documents remain in the local archive; all indexed research entries are included.</p><p>Book and lore content remain outside this build. No GPU processing is part of the research workflow.</p><h2>Collection inventory</h2><ul>${collections.map(name=>`<li>${a('#events?collection='+encodeURIComponent(name),name)} — ${count(entries.filter(e=>collection(e)===name).length)} entries</li>`).join('')}</ul><p>${a('#library',`Browse ${count(documents.length)} research documents`)} or ${a('#events','return to the chronological index')}.</p>${data.meta?.coverage_note?`<div class="notice">${inline(data.meta.coverage_note)}</div>`:''}</div>`;
  }
  let currentEvent='';
  function route() {
    clearTimeout(timer);
    const hash=location.hash || '#events';
    if(hash==='#main'){main.focus();return;}
    if(hash.startsWith('#event/')){
      const parts=hash.slice(7).split('/');let id;try{id=decodeURIComponent(parts[0]);}catch{id=parts[0];}
      if(currentEvent===id && parts[1]){document.getElementById(parts[1])?.scrollIntoView();return;}
      currentEvent=id;renderEntry(id,parts[1]);if(!parts[1])window.scrollTo(0,0);
    }else{
      currentEvent='';
      if(hash.startsWith('#library'))renderLibrary();
      else if(hash.startsWith('#about'))renderAbout();
      else {const query=hash.includes('?')?hash.slice(hash.indexOf('?')+1):'';const params=new URLSearchParams(query);Object.keys(indexState).forEach(k=>indexState[k]=params.get(k)||'');shown=60;lastIndexHash=stateHash();renderIndex();}
      window.scrollTo(0,0);
    }
  }
  window.addEventListener('hashchange',route);route();
})();
