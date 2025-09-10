const $ = (s,r=document)=>r.querySelector(s);
const STORAGE = { entries:'tpp:entries', settings:'tpp:settings', pro:'tpp:isPro' };

let isPro = JSON.parse(localStorage.getItem(STORAGE.pro) || 'false');   // toggled after Stripe success
let settings = loadSettings();
let entries  = loadEntries();

const FREE_LIMIT = 10; // free entries per month

function loadSettings(){
  const d = { share:0.35, pump:3.8, disc:0.3, mpg:6.5, fixedPerWeek:1166.78, target:1000 };
  try{ return {...d, ...(JSON.parse(localStorage.getItem(STORAGE.settings))||{})}; }catch{ return d; }
}
function saveSettings(){ localStorage.setItem(STORAGE.settings, JSON.stringify(settings)); render(); }

function loadEntries(){
  try{ const arr = JSON.parse(localStorage.getItem(STORAGE.entries)); return Array.isArray(arr)?arr:[]; }
  catch{ return []; }
}
function saveEntries(){ localStorage.setItem(STORAGE.entries, JSON.stringify(entries)); render(); }

function fmt(n){ return n.toLocaleString(undefined,{style:'currency',currency:'USD'}); }
function num(v){ const n=parseFloat(v); return Number.isFinite(n)?n:0; }
function todayISO(){ const t=new Date(); t.setMinutes(t.getMinutes()-t.getTimezoneOffset()); return t.toISOString().slice(0,10); }

$('#date').value = todayISO();
$('#resetForm').addEventListener('click', ()=> $('#entryForm').reset());

$('#entryForm').addEventListener('submit', e=>{
  e.preventDefault();
  if (!isPro){
    const month = new Date().toISOString().slice(0,7);
    const used = entries.filter(x=>(x.date||'').startsWith(month)).length;
    if (used >= FREE_LIMIT){ alert('Free limit reached. Go Pro for unlimited entries.'); return; }
  }
  const entry = {
    id: crypto.randomUUID(),
    date: $('#date').value || todayISO(),
    order: ($('#order').value||'').trim(),
    origin: ($('#origin').value||'').trim(),
    destination: ($('#destination').value||'').trim(),
    loaded: num($('#loaded').value), empty: num($('#empty').value),
    gross: num($('#gross').value), reimb: num($('#reimb').value), adv: num($('#adv').value),
    def: num($('#def').value), tolls: num($('#tolls').value),
    pump: $('#pump').value? num($('#pump').value): null,
    disc: $('#disc').value? num($('#disc').value): null,
    mpg: $('#mpg').value? num($('#mpg').value): null
  };
  entries.push(entry);
  saveEntries();
  $('#entryForm').reset(); $('#date').value = todayISO();
});

function fuelCost(e){
  const pump = e.pump ?? settings.pump;
  const disc = e.disc ?? settings.disc;
  const mpg  = e.mpg  ?? settings.mpg;
  const miles = e.loaded + e.empty;
  if (mpg<=0) return 0;
  return (miles/mpg) * Math.max(0, pump - disc);
}
function sharePay(e){ return settings.share * e.gross; }
function netTake(e){
  return sharePay(e) + e.reimb - e.adv - (fuelCost(e) + e.def + e.tolls);
}

function renderEntries(){
  const tbody = $('#entriesTable tbody');
  tbody.innerHTML = '';
  const sorted = [...entries].sort((a,b)=>(a.date||'').localeCompare(b.date||''));
  sorted.forEach(e=>{
    const tr = document.createElement('tr');
    const net = netTake(e);
    tr.innerHTML = `
      <td>${e.date||'-'}</td>
      <td>${e.order||'-'}</td>
      <td>${(e.origin||'-')} → ${(e.destination||'-')}</td>
      <td>${(e.loaded||0)}/${(e.empty||0)}</td>
      <td>${fmt(e.gross)}</td>
      <td>${fmt(e.reimb)}</td>
      <td>${fmt(e.adv)}</td>
      <td>${fmt(fuelCost(e))}</td>
      <td><span class="badge" style="background:${net>=0?'#12391e':'#3a1111'};color:${net>=0?'#8de29b':'#ffb4b4'}">${fmt(net)}</span></td>
      <td><button class="ghost" data-id="${e.id}">Delete</button></td>
    `;
    tbody.appendChild(tr);
  });
  tbody.addEventListener('click', ev=>{
    const b = ev.target.closest('button[data-id]'); if(!b) return;
    entries = entries.filter(x=>x.id!==b.dataset.id); saveEntries();
  }, {once:true});
  // free limit banner
  const month = new Date().toISOString().slice(0,7);
  const used = entries.filter(x=>(x.date||'').startsWith(month)).length;
  $('#limitNote').textContent = isPro ? 'Unlimited entries (Pro)' : `Free: ${used}/${FREE_LIMIT} this month`;
}

function renderTotals(){
  const miles = entries.reduce((s,e)=> s+e.loaded+e.empty, 0);
  const gross = entries.reduce((s,e)=> s+e.gross, 0);
  const reimb = entries.reduce((s,e)=> s+e.reimb, 0);
  const adv   = entries.reduce((s,e)=> s+e.adv, 0);
  const fuel  = entries.reduce((s,e)=> s+fuelCost(e), 0);
  const share = settings.share * gross;

  let fixed = 0;
  if (entries.length){
    const dates = entries.map(e=>e.date).filter(Boolean).sort();
    const start = new Date(dates[0]); const end = new Date(dates.at(-1));
    const days = Math.max(1, (end - start)/(1000*3600*24) + 1);
    const weeks = Math.ceil(days/7);
    fixed = weeks * settings.fixedPerWeek;
  }
  const net = share + reimb - adv - (fuel + fixed);

  $('#tMiles').textContent = miles.toLocaleString();
  $('#tGross').textContent = fmt(gross);
  $('#tShare').textContent = fmt(share);
  $('#tFuel').textContent  = fmt(fuel);
  $('#tFixed').textContent = fmt(fixed);
  $('#tNet').textContent   = fmt(net);
}

function render(){ renderEntries(); renderTotals(); }
render();

// Settings dialog
const dlg = $('#settingsDialog');
$('#openSettings').addEventListener('click', ()=>{
  $('#sShare').value = settings.share;
  $('#sPump').value  = settings.pump;
  $('#sDisc').value  = settings.disc;
  $('#sMpg').value   = settings.mpg;
  $('#sFixed').value = settings.fixedPerWeek;
  $('#sTarget').value= settings.target;
  dlg.showModal();
});
$('#saveSettings').addEventListener('click', (e)=>{
  e.preventDefault();
  settings.share = num($('#sShare').value);
  settings.pump  = num($('#sPump').value);
  settings.disc  = num($('#sDisc').value);
  settings.mpg   = num($('#sMpg').value);
  settings.fixedPerWeek = num($('#sFixed').value);
  settings.target = num($('#sTarget').value);
  saveSettings(); dlg.close();
});

// Export/backup/restore/clear
$('#exportCsv').addEventListener('click', ()=>{
  const headers = ['date','order','origin','destination','loaded','empty','gross','reimb','adv','def','tolls','pump','disc','mpg'];
  const rows = [headers.join(',')];
  entries.forEach(e=>{
    rows.push(headers.map(k=>`"${String(e[k]??'').replace(/"/g,'""')}"`).join(','));
  });
  const blob = new Blob([rows.join('\n')],{type:'text/csv'});
  const a = Object.assign(document.createElement('a'), {href:URL.createObjectURL(blob), download:'trucker-profit-entries.csv'});
  a.click(); setTimeout(()=>URL.revokeObjectURL(a.href), 500);
});

$('#backup').addEventListener('click', ()=>{
  const blob = new Blob([JSON.stringify({settings, entries, isPro}, null, 2)], {type:'application/json'});
  const a = Object.assign(document.createElement('a'), {href:URL.createObjectURL(blob), download:'trucker-profit-backup.json'});
  a.click(); setTimeout(()=>URL.revokeObjectURL(a.href), 500);
});

$('#restore').addEventListener('change', (ev)=>{
  const f = ev.target.files?.[0]; if(!f) return;
  const reader = new FileReader();
  reader.onload = ()=>{
    try{
      const obj = JSON.parse(reader.result);
      if (obj.settings) settings = {...settings, ...obj.settings};
      if (Array.isArray(obj.entries)) entries = obj.entries;
      if (typeof obj.isPro==='boolean') isPro = obj.isPro;
      saveSettings(); saveEntries(); alert('Restore complete.');
    }catch{ alert('Invalid file.'); }
  };
  reader.readAsText(f);
});

$('#clearAll').addEventListener('click', ()=>{
  if (!confirm('Delete all data?')) return;
  entries = []; saveEntries();
});

// Stripe “Go Pro” (front-end redirect to Checkout)
$('#openPro').addEventListener('click', ()=>{
  // Replace with your Stripe Checkout URL (from your Stripe Dashboard → Payment Links)
  // Example placeholder:
  const checkoutUrl = 'https://buy.stripe.com/test_XXXXXXXXXXXXXX';
  location.href = checkoutUrl;
});

// If you use a Stripe success URL like ?pro=1, unlock Pro:
if (new URLSearchParams(location.search).get('pro') === '1'){
  isPro = true; localStorage.setItem(STORAGE.pro, 'true'); alert('Pro unlocked. Thank you!');
}
