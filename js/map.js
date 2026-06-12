"use strict";
/* ====================================================================
   EMBERFORGE DEPTHS — act map: generation, rendering, node entry
   ==================================================================== */
const MAP_ROWS = 15, MAP_COLS = 7;
function nkey(r,c){ return r+'-'+c; }

function generateMap(){
  const nodes = {}, children = {};
  const addNode = (r,c)=>{ const k=nkey(r,c); if(!nodes[k]) nodes[k] = {r,c,type:null}; return k; };
  const addEdge = (a,b)=>{ (children[a] = children[a]||new Set()).add(b); };
  for(let p=0;p<6;p++){
    let c = rand(0, MAP_COLS-1);
    addNode(0,c);
    for(let r=0;r<MAP_ROWS-1;r++){
      const nc = Math.min(MAP_COLS-1, Math.max(0, c + rand(-1,1)));
      addNode(r+1,nc);
      addEdge(nkey(r,c), nkey(r+1,nc));
      c = nc;
    }
  }
  nodes['boss'] = {r:MAP_ROWS, c:(MAP_COLS-1)/2, type:'boss'};
  Object.keys(nodes).forEach(k=>{
    if(nodes[k].r === MAP_ROWS-1) addEdge(k, 'boss');
  });
  /* assign types */
  Object.keys(nodes).forEach(k=>{
    const n = nodes[k];
    if(k === 'boss') return;
    if(n.r === 0){ n.type = 'fight'; return; }
    if(n.r === 7){ n.type = 'treasure'; return; }
    if(n.r === MAP_ROWS-1){ n.type = 'rest'; return; }
    const r = randf();
    if(n.r >= 5 && r < .09) n.type = 'elite';
    else if(r < .20) n.type = 'rest';
    else if(r < .31) n.type = 'shop';
    else if(r < .52) n.type = 'event';
    else n.type = 'fight';
  });
  /* guarantee at least one shop & elite */
  const all = Object.keys(nodes).filter(k=>k!=='boss');
  ['shop','elite'].forEach(want=>{
    if(!all.some(k=>nodes[k].type===want)){
      const cands = all.filter(k=>nodes[k].type==='fight' && nodes[k].r>=5 && nodes[k].r<=12);
      if(cands.length) nodes[pick(cands)].type = want;
    }
  });
  const childArr = {};
  Object.keys(children).forEach(k=>childArr[k] = [...children[k]]);
  /* which of this act's bosses waits at the top */
  const bossIdx = rand(0, ACT_DATA[G.act].bosses.length - 1);
  return {nodes, children:childArr, bossIdx};
}

const NODE_ICONS = {fight:'⚔️', elite:'💀', rest:'🛏️', shop:'🛒', event:'❓', treasure:'🎁', boss:'👑'};
const NODE_NAMES = {fight:'Combat', elite:'ELITE combat — high risk, relic reward', rest:'Rest site — heal or upgrade',
                    shop:'The Rustmonger\'s shop', event:'Unknown — anything could happen', treasure:'Treasure', boss:'THE BOSS'};

function actBoss(){ return ACT_DATA[G.act].bosses[G.map.bossIdx || 0]; }

function availableKeys(){
  if(G.currentNodeKey === null)
    return Object.keys(G.map.nodes).filter(k=>G.map.nodes[k].r === 0);
  return G.map.children[G.currentNodeKey] || [];
}

function renderMap(){
  const W = 700, rowH = 46, H = (MAP_ROWS+1)*rowH + 70;
  const xOf = c => 64 + c * ((W-128)/(MAP_COLS-1));
  const yOf = r => H - 40 - r*rowH;
  const avail = new Set(availableKeys());
  const visited = new Set(G.visitedKeys);
  let svg = `<svg viewBox="0 0 ${W} ${H}" id="mapsvg">`;
  /* edges */
  Object.keys(G.map.children).forEach(a=>{
    G.map.children[a].forEach(b=>{
      const na = G.map.nodes[a], nb = G.map.nodes[b];
      const onPath = visited.has(a) && visited.has(b);
      svg += `<line x1="${xOf(na.c)}" y1="${yOf(na.r)}" x2="${xOf(nb.c)}" y2="${yOf(nb.r)}"
              class="medge${onPath?' medge-done':''}"/>`;
    });
  });
  /* nodes */
  Object.keys(G.map.nodes).forEach(k=>{
    const n = G.map.nodes[k];
    const x = xOf(n.c), y = yOf(n.r);
    const isBoss = k === 'boss';
    const cls = ['mnode'];
    if(k === G.currentNodeKey) cls.push('mnode-current');
    else if(visited.has(k)) cls.push('mnode-visited');
    else if(avail.has(k)) cls.push('mnode-avail');
    else cls.push('mnode-locked');
    if(n.type === 'elite' || isBoss) cls.push('mnode-elite');
    const rr = isBoss ? 26 : 17;
    const tip = isBoss ? `${actBoss().name} — the boss of this act` : NODE_NAMES[n.type];
    svg += `<g class="${cls.join(' ')}" data-key="${k}" data-tt="${escapeHtml(tip)}">
      <circle cx="${x}" cy="${y}" r="${rr}"/>
      <text x="${x}" y="${y+ (isBoss?9:6)}" text-anchor="middle" font-size="${isBoss?26:17}">${isBoss?actBoss().sprite:NODE_ICONS[n.type]}</text></g>`;
  });
  svg += `</svg>`;
  $('map-wrap').innerHTML = svg;
  document.querySelectorAll('#mapsvg .mnode-avail').forEach(g=>{
    g.addEventListener('click', ()=>{ sfx('click'); enterNode(g.dataset.key); });
  });
  /* legend */
  $('map-legend').innerHTML = ['fight','elite','event','shop','rest','treasure']
    .map(t=>`<span class="legend-item">${NODE_ICONS[t]} ${t==='fight'?'combat':t}</span>`).join('');
  /* scroll so current position is in view */
  const wrap = $('map-wrap');
  const frac = G.currentNodeKey ? Math.max(0, 1 - (G.map.nodes[G.currentNodeKey].r+3)/(MAP_ROWS+1)) : 1;
  wrap.scrollTop = frac * Math.max(0, wrap.scrollHeight - wrap.clientHeight);
}

function enterNode(key){
  const n = G.map.nodes[key];
  G.currentNodeKey = key;
  G.visitedKeys.push(key);
  G.floorNum = G.act*16 + n.r + 1;
  G.runStats.floors++;
  renderTopbar();
  /* checkpoint BEFORE resolving — reloading replays this node identically */
  saveRun({pendingNode:key});
  resolveNode(key);
}

function resolveNode(key){
  const n = G.map.nodes[key];
  const A = ACT_DATA[G.act];
  switch(n.type){
    case 'fight':{
      const pool = n.r <= 4 ? A.early : A.late;
      startCombat(pick(pool), false);
      break;
    }
    case 'elite': startCombat(pick(A.elites), 'elite'); break;
    case 'boss': startCombat(actBoss().ids, 'boss'); break;
    case 'rest':
      $('rest-desc').textContent = `Heal ${G.ascension>=4?20:30}% of Max HP`;
      showScreen('screen-rest');
      if(G.relics.includes('scrapTithe')){ G.gold += 15; sfx('gold'); renderTopbar(); }
      break;
    case 'shop': openShop(); break;
    case 'event':
      if(G.relics.includes('coalRation')) heal(4);
      openEvent();
      break;
    case 'treasure':{
      const r = rollRelic();
      if(r){
        gainRelic(r);
        openOverlay(`<h2>🎁 Forgotten Cache</h2><p class="bigicon">${RELIC_DEFS[r].icon}</p>
          <p><b>${RELIC_DEFS[r].name}</b><br><span class="dim">${RELIC_DEFS[r].desc}</span></p>
          <button class="primary" onclick="resumeMap()">Continue</button>`);
      } else {
        G.gold += 55;
        openOverlay(`<h2>🎁 Forgotten Cache</h2><p>Picked clean — but they missed a pouch of <b>55 gold</b>.</p>
          <button class="primary" onclick="resumeMap()">Continue</button>`);
      }
      break;
    }
  }
}
