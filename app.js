// ================================================================
// CHAT TOWN COLORS  (up to 5 chats)
// ================================================================
const TOWN_PALETTE = [
  { color:0x4a9eff, hex:'#4a9eff', label:'Chat 1' },
  { color:0x7ed4ff, hex:'#7ed4ff', label:'Chat 2' },
  { color:0xa0c4e8, hex:'#a0c4e8', label:'Chat 3' },
  { color:0x2a6fbb, hex:'#2a6fbb', label:'Chat 4' },
  { color:0xb8d8f0, hex:'#b8d8f0', label:'Chat 5' },
];
const MAX_CHATS = 5;

// ================================================================
// PARSER + ANALYZER
// ================================================================
function parseWhatsApp(text) {
  const lines = text.split('\n');
  const messages = [];
  const patterns = [
    /^\[?(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}),?\s*(\d{1,2}:\d{2}(?::\d{2})?(?:\s*[APap][Mm])?)\]?\s*[-–]\s*([^:]+):\s*(.*)/,
    /^(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}),?\s+(\d{1,2}:\d{2}(?:\s*[APap][Mm])?)\s+-\s+([^:]+):\s*(.*)/,
  ];
  let cur = null;
  for (const line of lines) {
    let matched = false;
    for (const p of patterns) {
      const m = line.match(p);
      if (m) {
        if (cur) messages.push(cur);
        cur = { dateStr:m[1], timeStr:m[2], sender:m[3].trim(), content:m[4].trim() };
        matched = true; break;
      }
    }
    if (!matched && cur) cur.content += '\n' + line.trim();
  }
  if (cur) messages.push(cur);
  return messages;
}

function parseDate(s) {
  const p = s.split(/[\/\-\.]/);
  if (p.length < 3) return new Date();
  let [a,b,c] = p.map(Number);
  const y = c < 100 ? 2000+c : c;
  const mo = a > 12 ? b : a;
  const d  = a > 12 ? a : b;
  return new Date(y, mo-1, d);
}

function analyze(messages, chatName) {
  const sCount={}, sWords={}, sEmoji={};
  let images=0,videos=0,audio=0,stickers=0,links=0,totalEmojis=0,callMins=0,questions=0,longestMsg=0,totalWords=0;
  const dow=[0,0,0,0,0,0,0], hod=new Array(24).fill(0), monthly={};
  const emojiFreq={}, wordFreq={};
  const urlRx=/https?:\/\/[^\s]+/g;
  const emojiRx=/[\u{1F300}-\u{1FFFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu;

  for (const msg of messages) {
    const {sender,content,dateStr,timeStr} = msg;
    if (!sender) continue;
    if (/image omitted|photo omitted|<media omitted>/i.test(content)) images++;
    else if (/video omitted/i.test(content)) videos++;
    else if (/audio omitted|voice message/i.test(content)) audio++;
    else if (/sticker omitted/i.test(content)) stickers++;
    const callM = content.match(/(?:voice|video) call[,\s]+(\d+):(\d+)/i);
    if (callM) callMins += parseInt(callM[1])*60+parseInt(callM[2]);
    if (urlRx.test(content)) links++;
    if (content.includes('?')) questions++;
    const emojisHere = content.match(emojiRx)||[];
    totalEmojis += emojisHere.length;
    for (const e of emojisHere) emojiFreq[e]=(emojiFreq[e]||0)+1;
    const words = content.split(/\s+/).filter(w=>w.length>2&&!/https?/i.test(w));
    totalWords += words.length;
    if (words.length > longestMsg) longestMsg = words.length;
    for (const w of words) { const lw=w.toLowerCase().replace(/[^a-z]/g,''); if(lw.length>3) wordFreq[lw]=(wordFreq[lw]||0)+1; }
    if (!sCount[sender]) { sCount[sender]=0; sWords[sender]=0; sEmoji[sender]=0; }
    sCount[sender]++; sWords[sender]+=words.length; sEmoji[sender]+=emojisHere.length;
    try {
      const d = parseDate(dateStr);
      dow[d.getDay()]++;
      const mk=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
      monthly[mk]=(monthly[mk]||0)+1;
    } catch(e){}
    if (timeStr) {
      const hm=timeStr.match(/(\d+):(\d+)/);
      if (hm) { let h=parseInt(hm[1]); if(/pm/i.test(timeStr)&&h<12)h+=12; if(/am/i.test(timeStr)&&h===12)h=0; hod[Math.min(h,23)]++; }
    }
  }
  const total=Object.values(sCount).reduce((a,b)=>a+b,0)||1;
  const topSenders=Object.entries(sCount).sort((a,b)=>b[1]-a[1]).slice(0,10);
  const topEmojis=Object.entries(emojiFreq).sort((a,b)=>b[1]-a[1]).slice(0,8).map(e=>e[0]);
  const topWords=Object.entries(wordFreq).sort((a,b)=>b[1]-a[1]).slice(0,5).map(e=>e[0]);
  const maxHour=hod.indexOf(Math.max(...hod));
  const maxDay=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][dow.indexOf(Math.max(...dow))];
  const avgWords=(totalWords/Math.max(total,1)).toFixed(1);
  const monthData=Object.entries(monthly).sort();
  return { chatName, total,images,videos,audio,stickers,links,totalEmojis,callMins,questions,longestMsg,
    topSenders,topEmojis,topWords,dow,hod,monthData,avgWords,maxHour,maxDay,participants:topSenders.length };
}

// ================================================================
// FILE HANDLING — up to 5 slots
// ================================================================
let chatFiles = new Array(MAX_CHATS).fill(null); // {file, name} per slot
let allStats = [];

function initUploadGrid() {
  const grid = document.getElementById('uploadGrid');
  grid.innerHTML = '';
  for (let i = 0; i < MAX_CHATS; i++) {
    const slot = document.createElement('div');
    slot.className = 'upload-slot';
    slot.dataset.idx = i;
    const col = TOWN_PALETTE[i];
    slot.innerHTML = `
      <button class="slot-remove" data-idx="${i}" title="Remove">✕</button>
      <div class="slot-color-dot" style="background:${col.hex}"></div>
      <div class="slot-num">CHAT ${i+1}</div>
      <div class="slot-icon">+</div>
      <div class="slot-label">DROP .TXT HERE</div>
      <div class="slot-filename" style="display:none"></div>
    `;
    slot.addEventListener('click', (e) => {
      if (e.target.classList.contains('slot-remove')) return;
      triggerFileInput(i);
    });
    slot.addEventListener('dragover', e => { e.preventDefault(); slot.classList.add('drag'); });
    slot.addEventListener('dragleave', () => slot.classList.remove('drag'));
    slot.addEventListener('drop', e => {
      e.preventDefault(); slot.classList.remove('drag');
      const f = e.dataTransfer.files[0];
      if (f && f.name.endsWith('.txt')) assignFile(i, f);
    });
    // Remove button
    slot.querySelector('.slot-remove').addEventListener('click', e => {
      e.stopPropagation();
      assignFile(i, null);
    });
    grid.appendChild(slot);
  }
}

function triggerFileInput(idx) {
  const inp = document.createElement('input');
  inp.type = 'file'; inp.accept = '.txt';
  inp.onchange = () => { if (inp.files[0]) assignFile(idx, inp.files[0]); };
  inp.click();
}

function assignFile(idx, file) {
  chatFiles[idx] = file ? { file, name: file.name.replace('.txt','') } : null;
  const slot = document.querySelector(`.upload-slot[data-idx="${idx}"]`);
  const icon = slot.querySelector('.slot-icon');
  const label = slot.querySelector('.slot-label');
  const fname = slot.querySelector('.slot-filename');
  if (file) {
    slot.classList.add('filled');
    icon.textContent = '✓';
    label.style.display = 'none';
    fname.style.display = 'block';
    fname.textContent = file.name;
    TOWN_PALETTE[idx].label = file.name.replace('.txt','').replace(/_/g,' ');
  } else {
    slot.classList.remove('filled');
    icon.textContent = '+';
    label.style.display = '';
    fname.style.display = 'none';
    TOWN_PALETTE[idx].label = `Chat ${idx+1}`;
  }
  const filled = chatFiles.filter(Boolean).length;
  document.getElementById('goBtn').disabled = filled === 0;
}

initUploadGrid();
document.getElementById('goBtn').disabled = true;
document.getElementById('goBtn').addEventListener('click', startGame);

async function startGame() {
  const filled = chatFiles.map((c,i)=>c?i:-1).filter(i=>i>=0);
  if (!filled.length) return;

  const ls = document.getElementById('loadScreen');
  const sub = document.getElementById('loadSub');
  const bar = document.getElementById('loadBar');
  ls.classList.add('show');

  allStats = [];
  for (let k=0; k<filled.length; k++) {
    const idx = filled[k];
    const cf = chatFiles[idx];
    sub.textContent = `PARSING ${cf.name.toUpperCase()}…`;
    bar.style.width = ((k / filled.length) * 70) + '%';
    await delay(80);
    const text = await cf.file.text();
    const msgs = parseWhatsApp(text);
    allStats.push({ ...analyze(msgs, cf.name), townIdx: idx });
  }

  sub.textContent = 'RENDERING CITY…';
  bar.style.width = '85%';
  await delay(200);

  document.getElementById('overlay').classList.add('fade');
  await delay(500);
  document.getElementById('overlay').style.display='none';
  bar.style.width = '100%';
  await delay(200);

  initGame();
  ls.classList.remove('show');
  document.getElementById('hud').classList.add('show');
}

function delay(ms) { return new Promise(r=>setTimeout(r,ms)); }

// ================================================================
// DISTRICT DEFINITIONS  — each district gets towns (one per chat)
// ================================================================
function getDistricts() {
  const fmt = n => typeof n==='number' ? n.toLocaleString() : n;
  const fmtTime = m => m>60 ? `${Math.floor(m/60)}h ${m%60}m` : `${m}m`;
  const fmtHour = h => h===0?'12 AM':h<12?`${h} AM`:h===12?'12 PM':`${h-12} PM`;

  // Each district summarizes one metric, with per-chat town breakdown
  return [
    {
      id:'messages', name:'MESSAGE HUB', icon:'💬',
      pos:[0,0,0], height:9, size:22, buildings:32,
      metric: s => s.total,
      value: () => fmt(allStats.reduce((a,s)=>a+s.total,0)),
      unit: 'total messages',
      desc: () => `${allStats.length} chat${allStats.length>1?'s':''} · ${fmt(allStats.reduce((a,s)=>a+s.total,0))} messages total`,
      details: () => [
        {label:'TOTAL MESSAGES', val:fmt(allStats.reduce((a,s)=>a+s.total,0))},
        {label:'CHATS', val:allStats.length},
        {label:'PEAK DAY', val:allStats[0]?.maxDay||'—'},
        {label:'QUESTIONS', val:fmt(allStats.reduce((a,s)=>a+s.questions,0))},
      ],
    },
    {
      id:'media', name:'MEDIA VAULT', icon:'🖼️',
      pos:[-90,0,0], height:6, size:16, buildings:24,
      metric: s => s.images + s.videos + s.stickers,
      value: () => fmt(allStats.reduce((a,s)=>a+s.images+s.videos+s.stickers,0)),
      unit: 'media files',
      desc: () => `Photos · Videos · Stickers shared`,
      details: () => [
        {label:'PHOTOS', val:fmt(allStats.reduce((a,s)=>a+s.images,0))},
        {label:'VIDEOS', val:fmt(allStats.reduce((a,s)=>a+s.videos,0))},
        {label:'STICKERS', val:fmt(allStats.reduce((a,s)=>a+s.stickers,0))},
      ],
    },
    {
      id:'calls', name:'CALL TOWER', icon:'📞',
      pos:[90,0,0], height:7, size:14, buildings:18,
      metric: s => s.callMins,
      value: () => fmtTime(allStats.reduce((a,s)=>a+s.callMins,0)),
      unit: 'call minutes',
      desc: () => `${(allStats.reduce((a,s)=>a+s.callMins,0)/60).toFixed(1)}h of voice`,
      details: () => [
        {label:'TOTAL CALL TIME', val:fmtTime(allStats.reduce((a,s)=>a+s.callMins,0))},
        {label:'VOICE MSGS', val:fmt(allStats.reduce((a,s)=>a+s.audio,0))},
      ],
    },
    {
      id:'emojis', name:'EMOJI PLAZA', icon:'😄',
      pos:[0,0,-90], height:7, size:15, buildings:22,
      metric: s => s.totalEmojis,
      value: () => fmt(allStats.reduce((a,s)=>a+s.totalEmojis,0)),
      unit: 'emojis sent',
      desc: () => `Top: ${[...new Set(allStats.flatMap(s=>s.topEmojis))].slice(0,5).join(' ')}`,
      details: () => [
        {label:'TOTAL EMOJIS', val:fmt(allStats.reduce((a,s)=>a+s.totalEmojis,0))},
        {label:'TOP EMOJI', val:allStats[0]?.topEmojis[0]||'—'},
      ],
    },
    {
      id:'links', name:'LINK EXCHANGE', icon:'🔗',
      pos:[0,0,90], height:5, size:13, buildings:18,
      metric: s => s.links,
      value: () => fmt(allStats.reduce((a,s)=>a+s.links,0)),
      unit: 'links shared',
      desc: () => `URLs, articles & memes`,
      details: () => [
        {label:'LINKS SHARED', val:fmt(allStats.reduce((a,s)=>a+s.links,0))},
      ],
    },
    {
      id:'words', name:'WORD QUARTER', icon:'📝',
      pos:[-90,0,-90], height:6, size:14, buildings:20,
      metric: s => Math.round(parseFloat(s.avgWords)*s.total),
      value: () => fmt(allStats.reduce((a,s)=>a+Math.round(parseFloat(s.avgWords)*s.total),0)),
      unit: 'words written',
      desc: () => `Avg ${(allStats.reduce((a,s)=>a+parseFloat(s.avgWords),0)/Math.max(allStats.length,1)).toFixed(1)} words/msg`,
      details: () => [
        {label:'AVG WORDS/MSG', val:(allStats.reduce((a,s)=>a+parseFloat(s.avgWords),0)/Math.max(allStats.length,1)).toFixed(1)},
        {label:'LONGEST MSG', val:`${Math.max(...allStats.map(s=>s.longestMsg))} words`},
      ],
    },
    {
      id:'night', name:'NIGHT OWL', icon:'🦉',
      pos:[90,0,-90], height:10, size:12, buildings:16,
      metric: s => s.hod[s.maxHour],
      value: () => fmtHour(allStats[0]?.maxHour||0),
      unit: 'peak hour',
      desc: () => `Most active: ${allStats[0]?.maxDay||'—'}`,
      details: () => [
        {label:'PEAK HOUR', val:fmtHour(allStats[0]?.maxHour||0)},
        {label:'MOST ACTIVE DAY', val:allStats[0]?.maxDay||'—'},
      ],
    },
    {
      id:'people', name:'PEOPLE PLAZA', icon:'👥',
      pos:[90,0,90], height:7, size:15, buildings:20,
      metric: s => s.participants,
      value: () => fmt(allStats.reduce((a,s)=>a+s.participants,0)),
      unit: 'participants',
      desc: () => `Across all chats`,
      details: () => [
        {label:'TOTAL PARTICIPANTS', val:allStats.reduce((a,s)=>a+s.participants,0)},
        {label:'TOP SENDER', val:allStats[0]?.topSenders[0]?.[0]||'—'},
      ],
    },
    {
      id:'audio', name:'VOICE ALLEY', icon:'🎤',
      pos:[-90,0,90], height:5, size:12, buildings:16,
      metric: s => s.audio,
      value: () => fmt(allStats.reduce((a,s)=>a+s.audio,0)),
      unit: 'voice messages',
      desc: () => `Audio notes shared`,
      details: () => [
        {label:'VOICE MESSAGES', val:fmt(allStats.reduce((a,s)=>a+s.audio,0))},
      ],
    },
  ];
}

// ================================================================
// THREE.JS ENGINE
// ================================================================
let scene, camera, renderer, districts=[], player;
let keys={}, mouseDown=false, lastMouse={x:0,y:0}, yaw=0, pitch=0;
let minimapCtx;

// Blueprint palette
const BP = {
  bg:        0x071020,
  ground:    0x0a1628,
  roadDark:  0x0d1e36,
  gridLine:  0x0f2340,
  bldBase:   0x1a3a5c,
  bldMid:    0x2a5a8c,
  bldLight:  0x4a9eff,
  bldGlass:  0x7ed4ff,
  bldWhite:  0xddeeff,
  accent:    0x4a9eff,
  accentDim: 0x1a4a80,
};

function initGame() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(BP.bg);
  scene.fog = new THREE.Fog(0x071020, 180, 520);

  renderer = new THREE.WebGLRenderer({ antialias:true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  document.body.appendChild(renderer.domElement);

  camera = new THREE.PerspectiveCamera(65, window.innerWidth/window.innerHeight, 0.1, 1000);
  camera.position.set(0, 4, 22);

  // Lighting — cool, architectural, no warm tones
  scene.add(new THREE.AmbientLight(0x8ab8e8, 0.45));

  const keyLight = new THREE.DirectionalLight(0xc8e0ff, 1.1);
  keyLight.position.set(80, 160, 60);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.width = 2048; keyLight.shadow.mapSize.height = 2048;
  keyLight.shadow.camera.left=-220; keyLight.shadow.camera.right=220;
  keyLight.shadow.camera.top=220; keyLight.shadow.camera.bottom=-220;
  keyLight.shadow.camera.far=500;
  scene.add(keyLight);

  const fillLight = new THREE.DirectionalLight(0x3060a0, 0.4);
  fillLight.position.set(-60, 40, -80);
  scene.add(fillLight);

  const rimLight = new THREE.DirectionalLight(0x4a9eff, 0.2);
  rimLight.position.set(0, -10, -100);
  scene.add(rimLight);

  // Ground
  const groundGeo = new THREE.PlaneGeometry(700, 700);
  const groundMat = new THREE.MeshLambertMaterial({ color:BP.ground });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI/2; ground.receiveShadow = true;
  scene.add(ground);

  // Blueprint grid on ground
  buildGroundGrid();
  buildRoads();

  // Districts with towns
  const defs = getDistricts();
  defs.forEach(d => {
    d.towns = buildTownsForDistrict(d);
    buildDistrictGroup(d);
    districts.push(d);
  });

  player = { x:0, y:4, z:22, speed:0.22 };
  minimapCtx = document.getElementById('minimapCanvas').getContext('2d');
  buildTpButtons();

  // Events
  window.addEventListener('resize', onResize);
  window.addEventListener('keydown', e=>{ keys[e.code]=true; if(e.code==='Space') e.preventDefault(); });
  window.addEventListener('keyup',   e=>keys[e.code]=false);
  renderer.domElement.addEventListener('mousedown', e=>{ mouseDown=true; lastMouse={x:e.clientX,y:e.clientY}; });
  renderer.domElement.addEventListener('mouseup', ()=>mouseDown=false);
  renderer.domElement.addEventListener('mousemove', onMouseMove);
  renderer.domElement.addEventListener('click', onRaycast);
  renderer.domElement.addEventListener('touchstart', e=>{ mouseDown=true; lastMouse={x:e.touches[0].clientX,y:e.touches[0].clientY}; });
  renderer.domElement.addEventListener('touchmove', e=>{ e.preventDefault(); onMouseMoveTouch(e.touches[0]); },{passive:false});
  renderer.domElement.addEventListener('touchend', ()=>mouseDown=false);
  renderer.domElement.addEventListener('wheel', e=>{
    e.preventDefault();
    const d = e.deltaY>0 ? 1 : -1;
    const fx=Math.sin(yaw), fz=Math.cos(yaw);
    player.x += fx*d*3; player.z += fz*d*3; player.y += d*0.4;
    player.x=Math.max(-150,Math.min(150,player.x));
    player.z=Math.max(-150,Math.min(150,player.z));
    player.y=Math.max(1.5,Math.min(90,player.y));
  },{passive:false});

  animate();
}

// ── TOWN BUILDER: splits district into per-chat sectors ──────────
function buildTownsForDistrict(d) {
  if (!allStats.length) return [];
  const vals = allStats.map(s => Math.max(1, d.metric(s)));
  const total = vals.reduce((a,b)=>a+b,0);
  const towns = allStats.map((s,i) => ({
    stat: s,
    palette: TOWN_PALETTE[s.townIdx],
    value: vals[i],
    share: vals[i] / total,
    label: s.chatName,
  }));
  return towns;
}

// ── DISTRICT GROUP ────────────────────────────────────────────────
function buildDistrictGroup(d) {
  const [dx,,dz] = d.pos;
  d._group = new THREE.Group();
  d._group.position.set(dx, 0, dz);
  scene.add(d._group);

  // Concrete base plaza
  const plazaGeo = new THREE.BoxGeometry(d.size*2+6, 0.25, d.size*2+6);
  const plazaMat = new THREE.MeshLambertMaterial({ color:0x0e1e35 });
  const plaza = new THREE.Mesh(plazaGeo, plazaMat);
  plaza.position.y = 0.12; plaza.receiveShadow=true;
  d._group.add(plaza);

  // Thin border ring
  const borderGeo = new THREE.RingGeometry(d.size+2.5, d.size+3.2, 72);
  const borderMat = new THREE.MeshBasicMaterial({ color:BP.accent, side:THREE.DoubleSide, transparent:true, opacity:0.25 });
  const border = new THREE.Mesh(borderGeo, borderMat);
  border.rotation.x=-Math.PI/2; border.position.y=0.3;
  d._group.add(border);

  // Build town sectors
  if (d.towns.length === 0) {
    // fallback: single blueprint town
    buildTownSector(d._group, d, { palette:TOWN_PALETTE[0], share:1, label:'Chat 1' }, 0, 1, d.size);
  } else if (d.towns.length === 1) {
    buildTownSector(d._group, d, d.towns[0], 0, 1, d.size);
  } else {
    // divide district into angular sectors
    let startAngle = 0;
    d.towns.forEach((town, i) => {
      const endAngle = startAngle + town.share * Math.PI * 2;
      buildTownSector(d._group, d, town, startAngle, endAngle, d.size);
      // Thin divider line between towns
      const lineGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0,0.4,0),
        new THREE.Vector3(Math.cos(startAngle)*(d.size+3), 0.4, Math.sin(startAngle)*(d.size+3))
      ]);
      const lineMat = new THREE.LineBasicMaterial({ color:0x071020, linewidth:2 });
      d._group.add(new THREE.Line(lineGeo, lineMat));
      startAngle = endAngle;
    });
  }

  // Central landmark tower
  buildLandmark(d);

  // Floating label sprite
  d._label = buildLabel(d);
  d._group.add(d._label);
  d._group._district = d;
}

function buildTownSector(group, d, town, startAngle, endAngle, radius) {
  const pal = town.palette;
  const col = new THREE.Color(pal.color);
  const midAngle = (startAngle + endAngle) / 2;
  const bCount = Math.max(4, Math.round(d.buildings * town.share));
  const heightMult = town.share;

  for (let i=0; i<bCount; i++) {
    // Place buildings within this angular sector
    const angle = startAngle + (i / bCount) * (endAngle - startAngle) + 0.05;
    const r = 2.5 + Math.random() * (radius - 2.5);
    const bx = Math.cos(angle) * r;
    const bz = Math.sin(angle) * r;
    const isCore = r < radius * 0.45;
    const bh = 1.5 + Math.random() * d.height * (isCore ? 1.7 * heightMult : 0.7);
    const bw = 0.9 + Math.random() * 2.2;
    const bd = 0.9 + Math.random() * 2.2;

    // Blueprint building — light blue / white tones
    const brightness = 0.25 + Math.random() * 0.45;
    const bldCol = col.clone().lerp(new THREE.Color(0xddeeff), brightness);

    buildBlueprintBuilding(group, bx, bz, bw, bd, bh, bldCol, pal.color, isCore);
  }

  // Town sector label (small)
  if (d.towns.length > 1) {
    const labelR = radius * 0.65;
    const lx = Math.cos(midAngle) * labelR;
    const lz = Math.sin(midAngle) * labelR;
    const townLabel = buildTownLabel(town.label, pal.hex, town.share);
    townLabel.position.set(lx, d.height * 1.2 + 4, lz);
    group.add(townLabel);
  }
}

// ── BLUEPRINT BUILDING ────────────────────────────────────────────
function buildBlueprintBuilding(group, bx, bz, bw, bd, bh, col, accentCol, isCore) {
  const mat = new THREE.MeshLambertMaterial({ color: col });

  // Main body
  const body = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, bd), mat);
  body.position.set(bx, bh/2, bz);
  body.castShadow=true; body.receiveShadow=true;
  group.add(body);

  // Thin edge highlight lines (blueprint aesthetic)
  const edgeMat = new THREE.MeshBasicMaterial({ color:new THREE.Color(accentCol).lerp(new THREE.Color(0xffffff),0.5), transparent:true, opacity:0.18 });

  // Top cap (flat roof detail)
  const capGeo = new THREE.BoxGeometry(bw+0.06, 0.09, bd+0.06);
  const cap = new THREE.Mesh(capGeo, new THREE.MeshLambertMaterial({color:0xddeeff}));
  cap.position.set(bx, bh+0.045, bz);
  group.add(cap);

  // Floor bands every ~2 units
  const bands = Math.max(1, Math.floor(bh/2.2));
  for (let f=1; f<=bands; f++) {
    const y = (f/bands)*bh;
    const band = new THREE.Mesh(
      new THREE.BoxGeometry(bw+0.1, 0.08, bd+0.1),
      new THREE.MeshBasicMaterial({color:0x4a9eff, transparent:true, opacity:0.12})
    );
    band.position.set(bx, y, bz);
    group.add(band);
  }

  // Windows (blueprint style — subtle blue rectangles)
  addBlueprintWindows(group, bx, bh, bz, bw, bd, accentCol);

  // Setback top on tall buildings
  if (bh > 7 && isCore) {
    const tH = bh * 0.28;
    const top = new THREE.Mesh(new THREE.BoxGeometry(bw*0.7, tH, bd*0.7), mat);
    top.position.set(bx, bh + tH/2, bz);
    top.castShadow=true;
    group.add(top);
    // Roof cap
    const topCap = new THREE.Mesh(new THREE.BoxGeometry(bw*0.7+0.08,0.09,bd*0.7+0.08), cap.material);
    topCap.position.set(bx, bh+tH+0.045, bz);
    group.add(topCap);
    // Antenna
    if (Math.random()>0.4) addAntenna(group, bx, bh+tH, bz, accentCol);
  } else if (bh > 5 && Math.random()>0.55) {
    addAntenna(group, bx, bh, bz, accentCol);
  }

  // Rooftop details
  if (isCore && bh > 4) addRooftopDetails(group, bx, bh + (bh>7?bh*0.28:0), bz, bw, bd);
}

function addBlueprintWindows(group, bx, bh, bz, bw, bd, accentCol) {
  const col = new THREE.Color(accentCol).lerp(new THREE.Color(0xaaddff), 0.5);
  const floors = Math.floor(bh / 1.4);
  for (let f=0; f<floors; f++) {
    const wy = 0.7 + f*1.4;
    const cols = Math.max(1, Math.floor(bw/1.1));
    for (let c=0; c<cols; c++) {
      if (Math.random() > 0.75) continue;
      const wx = bx - bw/2 + (c+0.5)*(bw/cols);
      const wMat = new THREE.MeshBasicMaterial({color:col, transparent:true, opacity:0.25+Math.random()*0.2});
      const wf = new THREE.Mesh(new THREE.PlaneGeometry(0.38,0.45), wMat);
      wf.position.set(wx, wy, bz+bd/2+0.01);
      group.add(wf);
      const wb = wf.clone(); wb.rotation.y=Math.PI;
      wb.position.set(wx, wy, bz-bd/2-0.01);
      group.add(wb);
    }
  }
}

function addRooftopDetails(group, bx, topY, bz, bw, bd) {
  const mat = new THREE.MeshLambertMaterial({color:0x1a3a5c});
  // HVAC boxes
  for (let i=0; i<2; i++) {
    const hx = bx + (Math.random()-0.5)*bw*0.5;
    const hz = bz + (Math.random()-0.5)*bd*0.5;
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.5,0.35,0.4), mat);
    box.position.set(hx, topY+0.175, hz);
    group.add(box);
  }
  // Water tank cylinder
  if (bw > 2) {
    const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.22,0.22,0.5,10), mat);
    tank.position.set(bx+bw*0.3, topY+0.25, bz-bd*0.25);
    group.add(tank);
  }
}

function addAntenna(group, bx, baseY, bz, col) {
  const ant = new THREE.Mesh(
    new THREE.CylinderGeometry(0.025,0.04,2.5,4),
    new THREE.MeshLambertMaterial({color:0x4a6a8a})
  );
  ant.position.set(bx, baseY+1.25, bz);
  group.add(ant);
  const tip = new THREE.Mesh(
    new THREE.SphereGeometry(0.08,6,6),
    new THREE.MeshBasicMaterial({color:col, transparent:true, opacity:0.9})
  );
  tip.position.set(bx, baseY+2.55, bz);
  tip._pulse=true; tip._phase=Math.random()*Math.PI*2;
  group.add(tip);
}

// ── LANDMARK ──────────────────────────────────────────────────────
function buildLandmark(d) {
  const lh = d.height * 3.0;
  const baseMat = new THREE.MeshLambertMaterial({color:0x1a3a5c});
  const shaftMat = new THREE.MeshLambertMaterial({color:0x2a5a8c});
  const accentMat = new THREE.MeshLambertMaterial({color:BP.bldLight});

  // Wide stepped base
  [[5.5,1.2,5.5],[4.2,lh*0.5,4.2]].forEach(([w,h,dep],i)=>{
    const m = new THREE.Mesh(new THREE.BoxGeometry(w,h,dep), i===0?baseMat:shaftMat);
    m.position.y = i===0 ? h/2 : 1.2+h/2;
    m.castShadow=true; m.receiveShadow=true;
    d._group.add(m);
  });

  // Mid setback
  const m2 = new THREE.Mesh(new THREE.BoxGeometry(2.8,lh*0.25,2.8), shaftMat);
  m2.position.y = 1.2+lh*0.5+lh*0.125; m2.castShadow=true;
  d._group.add(m2);

  // Upper shaft
  const m3 = new THREE.Mesh(new THREE.BoxGeometry(1.8,lh*0.18,1.8), shaftMat);
  m3.position.y = 1.2+lh*0.5+lh*0.25+lh*0.09; m3.castShadow=true;
  d._group.add(m3);

  // Spire
  const spire = new THREE.Mesh(new THREE.ConeGeometry(0.7,lh*0.28,8), accentMat);
  spire.position.y = 1.2+lh*0.5+lh*0.25+lh*0.18+lh*0.14; spire.castShadow=true;
  d._group.add(spire);

  // Observation ring
  const ring = new THREE.Mesh(new THREE.CylinderGeometry(2.0,2.0,0.28,24), new THREE.MeshLambertMaterial({color:0x0e2040}));
  ring.position.y = 1.2+lh*0.5+lh*0.25+0.14;
  d._group.add(ring);

  // Floor lines on main shaft
  const lineCount = Math.floor(lh*0.5/2.2);
  for (let i=1; i<=lineCount; i++) {
    const line = new THREE.Mesh(new THREE.BoxGeometry(4.3,0.07,4.3), new THREE.MeshBasicMaterial({color:BP.accent,transparent:true,opacity:0.18}));
    line.position.y = 1.2 + i*(lh*0.5/lineCount);
    d._group.add(line);
  }

  // Top beacon
  const totalH = 1.2+lh*0.5+lh*0.25+lh*0.18+lh*0.28;
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.2,8,8), new THREE.MeshBasicMaterial({color:BP.bldLight}));
  beacon.position.y = totalH;
  beacon._pulse=true; beacon._phase=Math.random()*Math.PI*2;
  d._group.add(beacon);
}

// ── LABELS ────────────────────────────────────────────────────────
function buildLabel(d) {
  const c = document.createElement('canvas');
  c.width=512; c.height=96;
  const ctx = c.getContext('2d');
  ctx.clearRect(0,0,512,96);
  ctx.font='bold 22px Courier New';
  ctx.fillStyle='rgba(74,158,255,0.9)';
  ctx.textAlign='center';
  ctx.fillText(d.icon+' '+d.name, 256, 32);
  ctx.font='16px Courier New';
  ctx.fillStyle='rgba(200,223,247,0.6)';
  ctx.fillText(d.value()+' '+d.unit, 256, 58);
  // Town dots
  if (d.towns.length > 1) {
    let x = 256 - (d.towns.length*16)/2;
    d.towns.forEach(t => {
      ctx.fillStyle = t.palette.hex;
      ctx.fillRect(x, 70, 10, 10);
      x += 16;
    });
  }
  const tex = new THREE.CanvasTexture(c);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({map:tex,transparent:true,depthTest:false}));
  sprite.scale.set(22,4,1);
  sprite.position.y = d.height*3.5 + 8;
  return sprite;
}

function buildTownLabel(name, hexColor, share) {
  const c = document.createElement('canvas');
  c.width=256; c.height=48;
  const ctx = c.getContext('2d');
  ctx.clearRect(0,0,256,48);
  ctx.font='bold 14px Courier New';
  ctx.fillStyle = hexColor;
  ctx.textAlign='center';
  const short = name.length>16 ? name.slice(0,14)+'…' : name;
  ctx.fillText(short, 128, 20);
  ctx.font='11px Courier New';
  ctx.fillStyle='rgba(200,223,247,0.5)';
  ctx.fillText(Math.round(share*100)+'%', 128, 38);
  const tex = new THREE.CanvasTexture(c);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({map:tex,transparent:true,depthTest:false}));
  sprite.scale.set(10,2,1);
  return sprite;
}

// ── GROUND GRID ───────────────────────────────────────────────────
function buildGroundGrid() {
  const gridMat = new THREE.LineBasicMaterial({color:0x0d1e36, transparent:true, opacity:0.8});
  const step=10, size=300;
  for (let i=-size; i<=size; i+=step) {
    const g1=new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-size,0.01,i),new THREE.Vector3(size,0.01,i)]);
    const g2=new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(i,0.01,-size),new THREE.Vector3(i,0.01,size)]);
    scene.add(new THREE.Line(g1,gridMat));
    scene.add(new THREE.Line(g2,gridMat));
  }
}

function buildRoads() {
  const roadMat = new THREE.MeshLambertMaterial({color:0x0d1e36});
  const markMat = new THREE.MeshBasicMaterial({color:0x1a3a5c, transparent:true, opacity:0.6});
  const offsets=[-90,-45,0,45,90];
  offsets.forEach(v=>{
    const rh=new THREE.Mesh(new THREE.PlaneGeometry(300,7), roadMat);
    rh.rotation.x=-Math.PI/2; rh.position.set(0,0.03,v);
    scene.add(rh);
    const rv=new THREE.Mesh(new THREE.PlaneGeometry(7,300), roadMat);
    rv.rotation.x=-Math.PI/2; rv.position.set(v,0.03,0);
    scene.add(rv);
    // Center dashes
    for (let d=-140; d<140; d+=8) {
      const dash=new THREE.Mesh(new THREE.PlaneGeometry(0.3,3), markMat);
      dash.rotation.x=-Math.PI/2; dash.position.set(d,0.04,v);
      scene.add(dash);
      const dashv=new THREE.Mesh(new THREE.PlaneGeometry(3,0.3), markMat);
      dashv.rotation.x=-Math.PI/2; dashv.position.set(v,0.04,d);
      scene.add(dashv);
    }
  });
  // Street lights
  for (let x=-90; x<=90; x+=18) {
    for (let z=-90; z<=90; z+=18) {
      addStreetLight(x,z);
    }
  }
}

function addStreetLight(x,z) {
  const poleMat = new THREE.MeshLambertMaterial({color:0x1a3a5c});
  const pole=new THREE.Mesh(new THREE.CylinderGeometry(0.05,0.07,5,5),poleMat);
  pole.position.set(x,2.5,z); scene.add(pole);
  const arm=new THREE.Mesh(new THREE.CylinderGeometry(0.03,0.03,1.4,4),poleMat);
  arm.rotation.z=Math.PI/2; arm.position.set(x+0.7,5,z); scene.add(arm);
  const head=new THREE.Mesh(new THREE.BoxGeometry(0.35,0.18,0.45),new THREE.MeshLambertMaterial({color:0x0e2040}));
  head.position.set(x+1.4,5,z); scene.add(head);
}

// ── TELEPORT BAR ──────────────────────────────────────────────────
function buildTpButtons() {
  const bar=document.getElementById('tpBar');
  bar.innerHTML='';
  districts.forEach(d=>{
    const btn=document.createElement('button');
    btn.className='tp-btn';
    btn.innerHTML=`${d.icon} ${d.name}`;
    btn.onclick=()=>teleport(d);
    btn.dataset.id=d.id;
    bar.appendChild(btn);
  });
}

function teleport(d) {
  const [dx,,dz]=d.pos;
  player.x=dx+22; player.z=dz+22; player.y=4;
  yaw=Math.atan2(-(dx-player.x),-(dz-player.z));
  document.querySelectorAll('.tp-btn').forEach(b=>b.classList.remove('active'));
  const btn=document.querySelector(`.tp-btn[data-id="${d.id}"]`);
  if(btn)btn.classList.add('active');
  showDistrictInfo(d);
}

function showDistrictInfo(d) {
  document.getElementById('dpName').textContent=d.name;
  document.getElementById('dpStat').textContent=d.value();
  document.getElementById('dpDesc').textContent=d.desc();
}

// ── MOUSE / TOUCH ─────────────────────────────────────────────────
function onMouseMove(e) {
  if(!mouseDown)return;
  yaw -= (e.clientX-lastMouse.x)*0.002;
  pitch -= (e.clientY-lastMouse.y)*0.002;
  pitch=Math.max(-0.6,Math.min(0.6,pitch));
  lastMouse={x:e.clientX,y:e.clientY};
}
function onMouseMoveTouch(t) {
  yaw -= (t.clientX-lastMouse.x)*0.003;
  pitch -= (t.clientY-lastMouse.y)*0.003;
  pitch=Math.max(-0.6,Math.min(0.6,pitch));
  lastMouse={x:t.clientX,y:t.clientY};
}

function onRaycast(e) {
  if(Math.abs(e.movementX||0)>3||Math.abs(e.movementY||0)>3)return;
  const raycaster=new THREE.Raycaster();
  const mouse=new THREE.Vector2((e.clientX/window.innerWidth)*2-1,-(e.clientY/window.innerHeight)*2+1);
  raycaster.setFromCamera(mouse,camera);
  const all3D=districts.map(d=>d._group).flatMap(g=>[...g.children]);
  const hits=raycaster.intersectObjects(all3D,true);
  if(hits.length>0){
    let obj=hits[0].object;
    while(obj.parent&&!obj.parent._district)obj=obj.parent;
    if(obj.parent&&obj.parent._district)openPopup(obj.parent._district);
  }
}

function openPopup(d) {
  const popup=document.getElementById('statsPopup');
  document.getElementById('spTag').textContent='DISTRICT DATA';
  document.getElementById('spIcon').textContent=d.icon;
  document.getElementById('spName').textContent=d.name;
  document.getElementById('spBig').textContent=d.value();
  document.getElementById('spUnit').textContent=d.unit;
  const rows=document.getElementById('spRows');
  rows.innerHTML='';
  d.details().forEach(r=>{
    const row=document.createElement('div'); row.className='sp-row';
    row.innerHTML=`<span class="sp-row-label">${r.label}</span><span class="sp-row-val">${r.val}</span>`;
    rows.appendChild(row);
  });

  // Towns breakdown
  const townsEl=document.getElementById('spTowns');
  townsEl.innerHTML='';
  if(d.towns.length>1){
    const title=document.createElement('div'); title.className='sp-towns-title';
    title.textContent='CHAT BREAKDOWN'; townsEl.appendChild(title);
    const maxVal=Math.max(...d.towns.map(t=>t.value));
    d.towns.forEach(t=>{
      const row=document.createElement('div'); row.className='town-row';
      row.innerHTML=`
        <div class="town-dot" style="background:${t.palette.hex}"></div>
        <div class="town-name">${t.label}</div>
        <div class="town-bar-wrap"><div class="town-bar" style="width:${(t.value/maxVal*100).toFixed(0)}%;background:${t.palette.hex}"></div></div>
        <div class="town-val">${t.value.toLocaleString()}</div>
      `;
      townsEl.appendChild(row);
    });
  }

  popup.style.display='block';
  setTimeout(()=>popup.classList.add('show'),10);
}

function closePopup() {
  const popup=document.getElementById('statsPopup');
  popup.classList.remove('show');
  setTimeout(()=>popup.style.display='none',350);
}

window.addEventListener('keydown', e=>{
  if(e.code==='KeyE'){
    const nearest=districts.reduce((best,d)=>{
      const [dx,,dz]=d.pos;
      const dist=Math.hypot(player.x-dx,player.z-dz);
      return dist<best.dist?{d,dist}:best;
    },{d:null,dist:Infinity});
    if(nearest.d&&nearest.dist<40)openPopup(nearest.d);
  }
  if(e.code==='Escape')closePopup();
});

function onResize(){
  camera.aspect=window.innerWidth/window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth,window.innerHeight);
}

// ── GAME LOOP ─────────────────────────────────────────────────────
let clock={last:0};

function animate(ts=0) {
  requestAnimationFrame(animate);
  const dt=Math.min((ts-clock.last)/1000,0.05);
  clock.last=ts;

  const speed=player.speed;
  const fx=Math.sin(yaw),fz=Math.cos(yaw);
  const rx=Math.cos(yaw),rz=-Math.sin(yaw);
  if(keys['KeyW']||keys['ArrowUp'])   {player.x-=fx*speed;player.z-=fz*speed;}
  if(keys['KeyS']||keys['ArrowDown']) {player.x+=fx*speed;player.z+=fz*speed;}
  if(keys['KeyA']||keys['ArrowLeft']) {player.x-=rx*speed;player.z-=rz*speed;}
  if(keys['KeyD']||keys['ArrowRight']){player.x+=rx*speed;player.z+=rz*speed;}
  if(keys['Space'])      { player.y+=speed; player.y=Math.min(player.y,120); }
  if(keys['ShiftLeft']||keys['ShiftRight']) { player.y-=speed; player.y=Math.max(player.y,1.2); }
  player.x=Math.max(-150,Math.min(150,player.x));
  player.z=Math.max(-150,Math.min(150,player.z));

  camera.position.set(player.x,player.y,player.z);
  camera.rotation.order='YXZ';
  camera.rotation.y=yaw; camera.rotation.x=pitch;

  // Nearest district HUD
  const nearest=districts.reduce((best,d)=>{
    const [dx,,dz]=d.pos;
    const dist=Math.hypot(player.x-dx,player.z-dz);
    return dist<best.dist?{d,dist}:best;
  },{d:null,dist:Infinity});
  if(nearest.d&&nearest.dist<35){
    showDistrictInfo(nearest.d);
    document.querySelectorAll('.tp-btn').forEach(b=>b.classList.remove('active'));
    const btn=document.querySelector(`.tp-btn[data-id="${nearest.d.id}"]`);
    if(btn)btn.classList.add('active');
  }

  // Pulse beacons
  districts.forEach(d=>{
    d._group.children.forEach(child=>{
      if(child._pulse){
        child._phase=(child._phase||0)+dt*1.4;
        child.scale.setScalar(0.88+0.18*Math.abs(Math.sin(child._phase)));
        if(child.material)child.material.opacity=0.6+0.4*Math.abs(Math.sin(child._phase));
      }
    });
  });

  document.getElementById('compassNeedle').style.transform=`rotate(${yaw}rad)`;
  drawMinimap();
  renderer.render(scene,camera);
}

function drawMinimap() {
  const ctx=minimapCtx,W=150,H=150,scale=0.75;
  ctx.clearRect(0,0,W,H);
  ctx.fillStyle='#071020'; ctx.fillRect(0,0,W,H);
  // grid
  ctx.strokeStyle='#0d1e36'; ctx.lineWidth=0.5;
  for(let i=0;i<W;i+=20){ctx.beginPath();ctx.moveTo(i,0);ctx.lineTo(i,H);ctx.stroke();}
  for(let j=0;j<H;j+=20){ctx.beginPath();ctx.moveTo(0,j);ctx.lineTo(W,j);ctx.stroke();}

  districts.forEach(d=>{
    const [dx,,dz]=d.pos;
    const mx=W/2+dx*scale,my=H/2+dz*scale;
    // Base dot
    ctx.beginPath(); ctx.arc(mx,my,d.size*scale*0.35,0,Math.PI*2);
    ctx.fillStyle='rgba(74,158,255,0.08)'; ctx.fill();
    ctx.strokeStyle='rgba(74,158,255,0.4)'; ctx.lineWidth=1; ctx.stroke();
    // Town arcs
    if(d.towns.length>1){
      let sa=0;
      d.towns.forEach(t=>{
        const ea=sa+t.share*Math.PI*2;
        ctx.beginPath(); ctx.moveTo(mx,my);
        ctx.arc(mx,my,d.size*scale*0.3,sa,ea);
        ctx.closePath();
        ctx.fillStyle=t.palette.hex+'66'; ctx.fill();
        sa=ea;
      });
    }
    ctx.font='9px monospace'; ctx.fillStyle='rgba(74,158,255,0.7)';
    ctx.textAlign='center'; ctx.fillText(d.icon,mx,my+3);
  });

  // Player triangle
  const px=W/2+player.x*scale,py=H/2+player.z*scale;
  ctx.save(); ctx.translate(px,py); ctx.rotate(yaw+Math.PI);
  ctx.beginPath(); ctx.moveTo(0,-5); ctx.lineTo(-3,4); ctx.lineTo(3,4); ctx.closePath();
  ctx.fillStyle='#ffffff'; ctx.fill();
  ctx.restore();
}
