/* Агрегатный журнал ТОиР — офлайн-приложение.
   Все данные хранятся в памяти телефона (IndexedDB). Передача — файлом. */
"use strict";

/* ========= Чек-листы ========= */
function jawNodes(motorKw){ return [
 {id:"frame", t:"Станина и фундамент", items:[
   ["f1","Станина, сварные швы: без трещин и сколов"],
   ["f2","Фундаментные болты затянуты, гайки законтрены"],
   ["f3","Боковые футеровки (клинья) на месте, износ в норме"]],
  rem:["Трещина станины","Ослаблены фундаментные болты","Износ боковой футеровки","Выпала/сместилась боковая футеровка"]},
 {id:"plates", t:"Дробящие плиты", items:[
   ["p1","Неподвижная плита: износ зубьев в норме, крепление плотное"],
   ["p2","Подвижная плита верхняя: износ в норме, крепление плотное"],
   ["p3","Подвижная плита нижняя: износ в норме, крепление плотное"]],
  rem:["Износ зубьев более 50%","Ослаблено крепление плиты","Трещина дробящей плиты","Требуется разворот плиты","Налипание / забивка камеры"]},
 {id:"jaw", t:"Подвижная щека и ось подвеса", items:[
   ["j1","Нет стука и рывков при работе"],
   ["j2","Опоры оси подвеса: нагрев в норме, смазка поступает"]],
  rem:["Стук в оси подвеса","Перегрев опоры оси подвеса","Износ втулок оси подвеса","Трещина щеки"]},
 {id:"shaft", t:"Эксцентриковый вал и коренные подшипники", items:[
   ["s1","Подшипники без постороннего шума"],
   ["s2","Уплотнения целы, выброса смазки нет"],
   ["s3","Крепление корпусов подшипников плотное"]],
  rem:["Шум / гул подшипника","Перегрев подшипника","Течь смазки через уплотнение","Ослаблено крепление корпуса подшипника"]},
 {id:"rod", t:"Шатун", items:[
   ["r1","Шатун без трещин, нет стука в головке"],
   ["r2","Подшипник шатуна: нагрев в норме"]],
  rem:["Стук в головке шатуна","Трещина шатуна","Перегрев подшипника шатуна"]},
 {id:"toggle", t:"Распорные плиты и сухари", items:[
   ["t1","Передняя распорная плита цела"],
   ["t2","Задняя распорная плита цела"],
   ["t3","Сухари / вкладыши без выработки, сочленения смазаны"]],
  rem:["Износ сухарей","Трещина распорной плиты","Выработка вкладышей","Нет смазки в сочленениях"]},
 {id:"lock", t:"Замыкающее устройство (тяга с пружиной)", items:[
   ["l1","Пружина цела, натяжение в норме"],
   ["l2","Тяга цела, гайки законтрены, нет стука распорных плит"]],
  rem:["Поломка пружины","Ослабло натяжение тяги","Стук распорных плит","Сорвана резьба тяги"]},
 {id:"adjust", t:"Механизм регулировки щели", items:[
   ["a1","Регулировочные клинья / прокладки зафиксированы"]],
  rem:["Смещение регулировочного клина","Не хватает прокладок"]},
 {id:"drive", t:"Маховики и клиноременная передача", items:[
   ["d1","Маховики закреплены на валу, биения нет"],
   ["d2","Ремни натянуты, комплект полный, без расслоения"],
   ["d3","Ограждение передачи установлено"]],
  rem:["Проскальзывание ремней","Износ / обрыв ремня","Биение маховика","Ослаблена шпонка маховика","Нет ограждения"]},
 {id:"motor", t:`Электродвигатель ${motorKw} кВт`, items:[
   ["m1","Нагрев, шум и вибрация в норме"],
   ["m2","Крепление к раме плотное, заземление подключено"]],
  rem:["Перегрев двигателя","Повышенная вибрация","Ослаблено крепление","Нет заземления","Искрение / запах гари"]},
 {id:"lube", t:"Система смазки", items:[
   ["o1","Уровень масла / смазки в норме"],
   ["o2","Давление масла в норме, насос / станция работает"],
   ["o3","Маслопроводы без утечек"]],
  rem:["Низкий уровень масла","Низкое давление масла","Утечка из маслопровода","Загрязнение масла / фильтра"]},
 {id:"safety", t:"Безопасность и рабочая зона", items:[
   ["x1","Ограждения на месте, аварийный стоп исправен"],
   ["x2","Площадки и проходы очищены от просыпи"]],
  rem:["Неисправен аварийный стоп","Просыпь на площадках","Нет ограждения","Нарушено освещение"]}
];}

/* Модели с чек-листами. Новую модель добавляют сюда. */
const MODELS = {
  "СМД-118": {kind:"Дробилка щековая", alias:"ЩДП-12×15", gap:[115,195], tMax:70,
    specs:[["Загрузочное отверстие","1200 × 1500 мм"],["Выходная щель","155 ± 40 мм"],["Производительность","до 310 м³/ч"],["Двигатель","160 кВт"],["Макс. кусок","1000 мм"],["Масса","≈145 т"]],
    nodes: jawNodes(160)},
  "СМД-111": {kind:"Дробилка щековая", alias:"ЩДП-9×12", gap:[95,165], tMax:70,
    specs:[["Загрузочное отверстие","900 × 1200 мм"],["Выходная щель","95–165 мм"],["Производительность","131–228 м³/ч"],["Двигатель","110 кВт"],["Макс. кусок","750 мм"],["Масса","≈61,5 т"]],
    nodes: jawNodes(110)}
};
const VERDICT = {ok:"Исправна", warn:"Работоспособна с замечаниями", bad:"Неисправна, остановить"};
const VPILL = {ok:"p-ok", warn:"p-warn", bad:"p-bad"};

/* ========= Хранилище на телефоне (IndexedDB) ========= */
const DB = (() => {
  let dbp = null;
  function open(){
    if(dbp) return dbp;
    dbp = new Promise((res,rej)=>{
      const r = indexedDB.open("toir", 1);
      r.onupgradeneeded = () => {
        const d = r.result;
        d.createObjectStore("inspections", {keyPath:"id"});
        const ph = d.createObjectStore("photos", {keyPath:"id"}); ph.createIndex("insp","insp");
        d.createObjectStore("equipment", {keyPath:"code"});
        d.createObjectStore("meta");
      };
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    return dbp;
  }
  const tx = async (store, mode, fn) => {
    const d = await open();
    return new Promise((res,rej)=>{
      const t = d.transaction(store, mode); let out;
      Promise.resolve(fn(t)).then(v=>out=v);
      t.oncomplete = () => res(out); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error);
    });
  };
  const req = r => new Promise((res,rej)=>{ r.onsuccess=()=>res(r.result); r.onerror=()=>rej(r.error); });
  return {
    all: s => tx(s,"readonly",t=>req(t.objectStore(s).getAll())),
    get: (s,k) => tx(s,"readonly",t=>req(t.objectStore(s).get(k))),
    put: (s,v,k) => tx(s,"readwrite",t=>{ k===undefined ? t.objectStore(s).put(v) : t.objectStore(s).put(v,k); }),
    putMany: (s,arr) => tx(s,"readwrite",t=>{ const o=t.objectStore(s); arr.forEach(v=>o.put(v)); }),
    del: (s,k) => tx(s,"readwrite",t=>{ t.objectStore(s).delete(k); }),
    photosOf: insp => tx("photos","readonly",t=>req(t.objectStore("photos").index("insp").getAll(insp))),
    keys: s => tx(s,"readonly",t=>req(t.objectStore(s).getAllKeys()))
  };
})();

/* ========= Состояние ========= */
let equipment = [], records = [], meta = {mechanic:"", shift:"1", device:""};
let view = {name:"home"}, form = null;
const photoCache = {};

const $ = s => document.querySelector(s);
const esc = s => String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
function toast(t){const e=$("#toast");e.textContent=t;e.hidden=false;clearTimeout(toast.h);toast.h=setTimeout(()=>e.hidden=true,3000)}
const fmt = ts => {const d=new Date(ts);return d.toLocaleDateString("ru-RU")+" "+d.toLocaleTimeString("ru-RU",{hour:"2-digit",minute:"2-digit"})};
const uidGen = () => Date.now().toString(36)+"-"+Math.random().toString(36).slice(2,8);
const eqBy = c => equipment.find(u=>u.code===c);
const modelOf = u => MODELS[u&&u.model];
const lastOf = code => records.find(r=>r.eq===code);
const totalOf = m => m.nodes.reduce((s,n)=>s+n.items.length,0);
const sites = () => [...new Set(equipment.map(e=>e.site))];
const unsent = () => records.filter(r=>!r.sentAt && r.device===meta.device);

async function loadAll(){
  const local = await DB.all("equipment");
  const base = (window.EQUIPMENT||[]).map(e=>({...e, source:"base"}));
  const codes = new Set(base.map(e=>e.code));
  equipment = [...base, ...local.filter(e=>!codes.has(e.code))]
    .sort((a,b)=>(a.site+a.code).localeCompare(b.site+b.code,"ru"));
  records = (await DB.all("inspections")).sort((a,b)=>b.ts-a.ts);
}
async function saveMeta(){ await DB.put("meta", meta, "meta"); }

function go(v){view=v;render();window.scrollTo(0,0)}

/* ========= Отрисовка ========= */
function render(){
  const v=$("#view"); $("#savebar").hidden = view.name!=="inspect";
  $("#backBtn").hidden = !["card","inspect"].includes(view.name);
  $("#scanBtn").hidden = view.name==="inspect";
  const u = (view.name==="card"||view.name==="inspect") ? eqBy(view.code) : null;
  $("#topTitle").innerHTML = u ? `<small>${esc(u.site)}</small>${esc(u.model)} · <span class="mono">${esc(u.code)}</span>`
    : `<small><span class="statusdot ${navigator.onLine?"":"off"}"></span>${navigator.onLine?"в сети":"без сети — всё сохраняется на телефоне"}</small>Журнал ТОиР`;
  if(view.name==="home") v.innerHTML=homeHTML();
  else if(view.name==="card") v.innerHTML=u?cardHTML(u):missingHTML();
  else if(view.name==="inspect") {v.innerHTML=inspectHTML(); updateProgress();}
  else if(view.name==="remarks") v.innerHTML=remarksHTML();
  else if(view.name==="journal") v.innerHTML=journalHTML();
  else if(view.name==="labels") v.innerHTML=labelsHTML();
  else if(view.name==="sync") v.innerHTML=syncHTML();
  drawQR();
}
function missingHTML(){return `<div class="panel stack" style="margin-top:14px"><h2>Агрегат ${esc(view.code)} не найден</h2><div class="note">Такого кода нет в справочнике на этом телефоне. Проверьте метку или добавьте агрегат на вкладке «Оборудование и QR».</div></div>`}

function tabs(active){
  const n=unsent().length;
  const t=[["home","Сводка"],["remarks","Замечания"],["journal","Журнал"],["sync",`Передача${n?` (${n})`:""}`],["labels","Оборудование и QR"]];
  return `<nav class="tabs">${t.map(([k,l])=>`<button data-go="${k}" aria-pressed="${k===active}">${l}</button>`).join("")}</nav>`;
}
function statusPill(code){
  const r=lastOf(code);
  if(!r) return `<span class="pill p-none">нет осмотров</span>`;
  return `<span class="pill ${VPILL[r.verdict]}">${VERDICT[r.verdict]}</span>`;
}
function openRemarks(){ const out=[]; records.forEach(r=>(r.remarks||[]).forEach((x,i)=>{ if(!x.closed) out.push({r,x,i}); })); return out; }

function homeHTML(){
  const week=Date.now()-7*864e5;
  const insp7=records.filter(r=>r.ts>=week).length;
  const open=openRemarks().length;
  const bad=equipment.filter(e=>{const r=lastOf(e.code);return r&&r.verdict==="bad"}).length;
  const notInsp=equipment.filter(e=>{const r=lastOf(e.code);return !r||r.ts<week}).length;
  const n=unsent().length;
  return tabs("home")+`<div class="stack">
  ${!meta.mechanic?`<div class="panel stack"><div class="lbl">Первый запуск</div><label class="stack" style="gap:4px"><span>Ваше ФИО — будет подставляться в осмотры и файлы передачи</span><input type="text" id="mechFirst" placeholder="Иванов И.И."></label><button class="btn" id="mechFirstSave">Сохранить</button></div>`:""}
  ${n?`<div class="banner"><span>Не передано осмотров: <b>${n}</b></span><button class="btn sm" data-go="sync">Передать</button></div>`:""}
  <div class="kpis">
    <div class="kpi"><span class="lbl">Агрегатов</span><b>${equipment.length}</b></div>
    <div class="kpi"><span class="lbl">Осмотров за 7 дн.</span><b>${insp7}</b></div>
    <div class="kpi ${open?"warn":""}"><span class="lbl">Открытых замечаний</span><b>${open}</b></div>
    <div class="kpi ${bad?"bad":""}"><span class="lbl">Неисправны</span><b>${bad}</b></div>
  </div>
  ${notInsp?`<div class="note">Без осмотра более 7 дней: ${notInsp} из ${equipment.length}</div>`:""}
  <div class="panel stack">
    <div class="lbl">Открыть агрегат</div>
    <button class="btn" id="scanBig">Сканировать QR-метку</button>
    <div class="row"><input type="text" id="codeInput" placeholder="Код с метки" autocomplete="off" style="flex:1 1 180px;text-transform:uppercase"><button class="btn sec sm" id="codeGo">Открыть</button></div>
  </div>
  ${sites().map(s=>{const list=equipment.filter(e=>e.site===s);return `<div class="site-h"><span class="lbl">${esc(s)}</span><span class="note mono">${list.length} ед.</span></div>
   ${list.map(u=>{const r=lastOf(u.code);return `<button class="unit" data-open="${esc(u.code)}">
    <span class="tag">${esc(u.code)}</span>
    <span class="m"><b>${esc(u.model)} · ${esc(u.pos)}</b><span class="note">${r?`Осмотр ${fmt(r.ts)} · ${esc(r.mechanic)}`:"Осмотров ещё не было"}</span><span style="display:block;margin-top:4px">${statusPill(u.code)}</span></span></button>`}).join("")}`}).join("")}
  </div>`;
}

function cardHTML(u){
  const m=modelOf(u); const hist=records.filter(r=>r.eq===u.code);
  return `<div class="stack" style="margin-top:14px">
  <div class="panel">
    <div class="row" style="justify-content:space-between"><h2>${esc(m?m.kind:"")} ${esc(u.model)}</h2>${statusPill(u.code)}</div>
    <div class="note">${esc(u.pos)} · ${esc(u.site)}${m?` · ${m.alias}`:""}${u.inv?` · инв. № ${esc(u.inv)}`:""}</div>
    ${m?`<div class="specs">${m.specs.map(([k,v])=>`<div><span class="lbl">${k}</span><b>${v}</b></div>`).join("")}</div>`:""}
  </div>
  ${m?`<button class="btn" data-inspect="${esc(u.code)}">Начать осмотр · ${totalOf(m)} пунктов</button>`:`<div class="panel note">Для модели ${esc(u.model)} ещё нет чек-листа.</div>`}
  <details class="panel"><summary class="lbl" style="cursor:pointer">QR-метка этого агрегата</summary>
    <div class="qr" style="margin-top:10px;max-width:240px"><img alt="QR ${esc(u.code)}" data-qr="${esc(u.code)}"><div class="c">${esc(u.code)}</div><div class="d">${esc(u.model)} · ${esc(u.site)}</div></div>
    <button class="btn sec sm" data-labels="${esc(u.code)}" style="margin-top:10px">Скачать метку для печати</button>
  </details>
  <div class="lbl" style="margin-top:6px">История осмотров · ${hist.length}</div>
  ${hist.length?hist.map(r=>recHTML(r,false)).join(""):`<div class="panel note">Осмотров ещё нет. Нажмите «Начать осмотр», чтобы внести первый.</div>`}
  </div>`;
}
function recHTML(r,showEq){
  const u=eqBy(r.eq); const rems=r.remarks||[];
  return `<div class="rec">
   <div class="h"><span class="pill ${VPILL[r.verdict]}">${VERDICT[r.verdict]}</span>${showEq?`<span class="tag">${esc(r.eq)}</span>`:""}<span class="mono note">${fmt(r.ts)}</span>${r.device===meta.device&&!r.sentAt?`<span class="pill p-warn">не передан</span>`:""}</div>
   <div class="note">${esc(r.mechanic)}${r.shift?` · смена ${esc(r.shift)}`:""}${showEq?` · ${esc(r.model||(u&&u.model)||"")} · ${esc(r.site||(u&&u.site)||"")}`:""}</div>
   <div class="note mono">Щель ${r.gap??"—"} мм · t подш. Л ${r.tL??"—"} / П ${r.tR??"—"} °C</div>
   ${rems.length?`<ul>${rems.map(x=>`<li><b>${esc(x.node)}:</b> ${esc(x.text)}${x.closed?` <span class="pill p-ok">устранено ${new Date(x.closed.ts).toLocaleDateString("ru-RU")}</span>`:""}</li>`).join("")}</ul>`:`<div class="note">Замечаний нет</div>`}
   ${r.note?`<div>${esc(r.note)}</div>`:""}
   ${r.photos?`<div class="thumbs" id="ph-${esc(r.id)}"><button class="btn sec sm" data-photos="${esc(r.id)}">Показать фото (${r.photos})</button></div>`:""}
  </div>`;
}

/* ========= Осмотр ========= */
function newForm(code){ return {eq:code, res:{}, chips:{}, notes:{}, photos:[], gap:"", tL:"", tR:"", verdict:null, verdictTouched:false, mechanic:meta.mechanic, shift:meta.shift||"1", note:""}; }
const curModel = () => modelOf(eqBy(form.eq));
function inspectHTML(){
  const f=form, m=curModel();
  return `<div class="stack" style="margin-top:14px">
  <div class="panel grid2">
    <label><span class="lbl">Механик (ФИО)</span><input type="text" id="mech" value="${esc(f.mechanic)}" placeholder="Иванов И.И."></label>
    <label><span class="lbl">Смена</span><select id="shift">${["1","2","3"].map(s=>`<option ${f.shift===s?"selected":""}>${s}</option>`).join("")}</select></label>
  </div>
  <div class="panel stack">
    <div class="lbl">Замеры</div>
    <div class="grid2">
      <label><span>Выходная щель, мм</span><input type="number" inputmode="decimal" id="gap" value="${esc(f.gap)}" placeholder="${m.gap[0]}–${m.gap[1]}"><span class="hint" id="gapHint"></span></label>
      <label><span>t подшипника лев., °C</span><input type="number" inputmode="decimal" id="tL" value="${esc(f.tL)}"><span class="hint" id="tLHint"></span></label>
      <label><span>t подшипника прав., °C</span><input type="number" inputmode="decimal" id="tR" value="${esc(f.tR)}"><span class="hint" id="tRHint"></span></label>
    </div>
  </div>
  <div class="row" style="justify-content:space-between"><span class="lbl">Узлы · ${m.nodes.length}</span><button class="chip" id="allOk">Отметить остальное «Норма»</button></div>
  ${m.nodes.map((n,i)=>nodeHTML(n,i)).join("")}
  <div class="panel stack">
    <div class="lbl">Итог осмотра</div>
    <div class="verdict">${Object.entries(VERDICT).map(([k,l])=>`<button data-v="${k}" class="${f.verdict===k?"on":""}">${l}</button>`).join("")}</div>
    <textarea id="note" rows="3" placeholder="Общий комментарий, принятые меры">${esc(f.note)}</textarea>
    ${photoBlock("")}
  </div>
  </div>`;
}
function photoBlock(node){
  const ph=form.photos.map((p,i)=>({p,i})).filter(o=>o.p.node===node);
  return `<div class="row" data-phblock="${node}">
    <label class="photo-btn">📷 Добавить фото<input type="file" accept="image/*" capture="environment" data-addphoto="${node}"></label>
    <div class="thumbs">${ph.map(o=>`<div class="thumb"><img src="${o.p.data}" alt="Фото" data-zoom="1"><button data-delphoto="${o.i}" aria-label="Удалить фото">×</button></div>`).join("")}</div>
  </div>`;
}
function nodeHTML(n,i){
  const f=form; const bad=n.items.some(([id])=>f.res[id]==="bad");
  const done=n.items.filter(([id])=>f.res[id]).length;
  const sel=f.chips[n.id]||[];
  return `<details class="node ${bad?"has-bad":""}" id="node-${n.id}" ${bad||done<n.items.length?"open":""}>
   <summary><span class="n">${String(i+1).padStart(2,"0")}</span><h3>${n.t}</h3><span class="mono note">${done}/${n.items.length}</span></summary>
   <div class="body">
    ${n.items.map(([id,q])=>`<div class="item"><span class="q">${q}</span><span class="seg">
      <button class="ok ${f.res[id]==="ok"?"on":""}" data-res="${id}" data-val="ok">Норма</button>
      <button class="bad ${f.res[id]==="bad"?"on":""}" data-res="${id}" data-val="bad">Замечание</button></span></div>`).join("")}
    ${bad?`<div class="lbl">Типовые замечания</div>
      <div class="chips">${n.rem.map(r=>`<button class="chip" data-chip="${n.id}" data-text="${esc(r)}" aria-pressed="${sel.includes(r)}">${esc(r)}</button>`).join("")}</div>
      <input type="text" data-nnote="${n.id}" value="${esc(f.notes[n.id]||"")}" placeholder="Уточнение по узлу (необязательно)">
      ${photoBlock(n.id)}`:""}
   </div></details>`;
}
function autoVerdict(){
  if(form.verdictTouched) return;
  const anyBad=Object.values(form.res).includes("bad");
  form.verdict = Object.keys(form.res).length? (anyBad?"warn":"ok") : null;
  document.querySelectorAll(".verdict button").forEach(b=>b.classList.toggle("on",b.dataset.v===form.verdict));
}
function updateProgress(){
  const m=curModel();
  $("#prog").textContent=`${Object.keys(form.res).length}/${totalOf(m)}`;
  const g=parseFloat(form.gap), gh=$("#gapHint");
  if(gh){const out=!isNaN(g)&&(g<m.gap[0]||g>m.gap[1]); gh.textContent=out?`Вне диапазона ${m.gap[0]}–${m.gap[1]} мм`:`Диапазон ${m.gap[0]}–${m.gap[1]} мм`; gh.className="hint"+(out?" bad":"")}
  ["tL","tR"].forEach(k=>{const h=$("#"+k+"Hint"); if(!h) return; const t=parseFloat(form[k]); const hot=!isNaN(t)&&t>m.tMax;
    h.textContent=hot?`Выше ${m.tMax} °C — проверьте`:`Ориентир до ${m.tMax} °C`; h.className="hint"+(hot?" bad":"")});
}
function rerenderNode(id){
  const m=curModel(); const i=m.nodes.findIndex(n=>n.id===id); const el=$("#node-"+id);
  const tmp=document.createElement("div"); tmp.innerHTML=nodeHTML(m.nodes[i],i);
  const nw=tmp.firstElementChild; nw.open=true; el.replaceWith(nw);
}
function rerenderPhotos(node){
  const el=document.querySelector(`[data-phblock="${node}"]`); if(!el) return;
  const tmp=document.createElement("div"); tmp.innerHTML=photoBlock(node); el.replaceWith(tmp.firstElementChild);
}
function compress(file){
  return new Promise((res,rej)=>{
    const img=new Image(); const url=URL.createObjectURL(file);
    img.onload=()=>{
      let max=1280, q=0.75, out="";
      for(let k=0;k<5;k++){
        const s=Math.min(1,max/Math.max(img.width,img.height));
        const c=document.createElement("canvas"); c.width=Math.round(img.width*s); c.height=Math.round(img.height*s);
        c.getContext("2d").drawImage(img,0,0,c.width,c.height);
        out=c.toDataURL("image/jpeg",q);
        if(out.length<350000) break; max=Math.round(max*0.8); q=Math.max(0.5,q-0.07);
      }
      URL.revokeObjectURL(url); res(out);
    };
    img.onerror=()=>{URL.revokeObjectURL(url);rej()};
    img.src=url;
  });
}
async function save(){
  const f=form, u=eqBy(f.eq), m=modelOf(u), total=totalOf(m);
  f.mechanic=$("#mech").value.trim();
  if(!f.mechanic){toast("Укажите ФИО механика");$("#mech").focus();return}
  const missing=total-Object.keys(f.res).length;
  if(missing>0){toast(`Не отмечено пунктов: ${missing}`);
    const n=m.nodes.find(n=>n.items.some(([id])=>!f.res[id])); const el=$("#node-"+n.id); el.open=true; el.scrollIntoView({block:"center"}); return}
  if(!f.verdict){toast("Выберите итог осмотра");return}
  const remarks=[];
  m.nodes.forEach(n=>{
    const bads=n.items.filter(([id])=>f.res[id]==="bad"); if(!bads.length) return;
    const txt=[...(f.chips[n.id]||[]), f.notes[n.id]].filter(Boolean);
    remarks.push({node:n.t, text: txt.length?txt.join("; "):bads.map(b=>b[1]).join("; ")});
  });
  const num=v=>{const x=parseFloat(String(v).replace(",","."));return isNaN(x)?null:x};
  const rec={id:uidGen(), eq:f.eq, model:u.model, site:u.site, pos:u.pos, ts:Date.now(), mechanic:f.mechanic, shift:f.shift, verdict:f.verdict,
    gap:num(f.gap), tL:num(f.tL), tR:num(f.tR), results:f.res, remarks, note:f.note.trim(), photos:f.photos.length, device:meta.device, sentAt:null};
  try{
    await DB.put("inspections", rec);
    if(f.photos.length) await DB.putMany("photos", f.photos.map((p,i)=>({id:rec.id+"-"+i, insp:rec.id, eq:rec.eq, node:p.node, data:p.data, ts:rec.ts})));
    meta.mechanic=f.mechanic; meta.shift=f.shift; await saveMeta();
    if(navigator.storage&&navigator.storage.persist) navigator.storage.persist().catch(()=>{});
    records.unshift(rec); form=null;
    toast("Осмотр сохранён на телефоне"); go({name:"card",code:rec.eq});
  }catch(e){ toast("Не удалось сохранить: мало места в памяти телефона?"); }
}
async function showPhotos(id){
  const box=document.getElementById("ph-"+id); if(!box) return;
  const ph = photoCache[id] || (photoCache[id]=await DB.photosOf(id));
  box.innerHTML=ph.length?ph.map(p=>`<div class="thumb"><img src="${p.data}" alt="Фото" data-zoom="1"></div>`).join(""):`<span class="note">Фото на этом устройстве нет</span>`;
}

/* ========= Замечания ========= */
function remarksHTML(){
  const all=!!view.all; const list=[];
  records.forEach(r=>(r.remarks||[]).forEach((x,i)=>{ if(all||!x.closed) list.push({r,x,i}); }));
  return tabs("remarks")+`<div class="stack">
   <div class="row"><button class="chip" data-rshow="open" aria-pressed="${!all}">Открытые</button><button class="chip" data-rshow="all" aria-pressed="${all}">Все</button></div>
   ${list.length?list.map(({r,x,i})=>`<div class="rem ${x.closed?"closed":""}"><div class="m">
      <div class="row"><span class="tag">${esc(r.eq)}</span><span class="note mono">${fmt(r.ts)}</span></div>
      <div style="margin-top:4px"><b>${esc(x.node)}:</b> ${esc(x.text)}</div>
      <div class="note">${esc(r.site||"")} · выявил ${esc(r.mechanic)}${x.closed?` · устранено ${fmt(x.closed.ts)}, ${esc(x.closed.by)}`:""}</div></div>
      ${!x.closed?`<button class="btn sec sm" data-close="${esc(r.id)}" data-idx="${i}">Устранено</button>`:""}
    </div>`).join(""):`<div class="panel note">${all?"Замечаний пока нет.":"Открытых замечаний нет."}</div>`}
  </div>`;
}
async function closeRemark(id,idx){
  const r=records.find(x=>x.id===id); if(!r) return;
  r.remarks=r.remarks.map((x,i)=>i===idx?{...x,closed:{ts:Date.now(),by:meta.mechanic||"—"}}:x);
  r.updatedAt=Date.now(); if(r.device===meta.device) r.sentAt=null;
  await DB.put("inspections", r); toast("Отмечено как устранённое"); render();
}

/* ========= Журнал и Excel ========= */
function journalHTML(){
  const flt=view.flt||"";
  const list=records.filter(r=>!flt||r.eq===flt||r.site===flt);
  return tabs("journal")+`<div class="stack">
   <div class="row"><select id="flt" style="flex:1 1 220px"><option value="">Всё оборудование</option>
     ${sites().map(s=>`<optgroup label="${esc(s)}"><option value="${esc(s)}" ${flt===s?"selected":""}>Весь участок: ${esc(s)}</option>${equipment.filter(e=>e.site===s).map(e=>`<option value="${esc(e.code)}" ${flt===e.code?"selected":""}>${esc(e.code)} · ${esc(e.model)}</option>`).join("")}</optgroup>`).join("")}</select>
   <button class="btn sm" id="exportBtn" ${records.length?"":"disabled"}>Выгрузить в Excel</button></div>
   <div class="note">Записей: ${list.length}</div>
   ${list.length?list.map(r=>recHTML(r,true)).join(""):`<div class="panel note">Журнал пуст. Отсканируйте метку и проведите первый осмотр.</div>`}
  </div>`;
}
async function saveFile(blob, name){
  const file = new File([blob], name, {type: blob.type || "application/octet-stream"});
  if(navigator.canShare && navigator.canShare({files:[file]})){
    try{ await navigator.share({files:[file], title:name}); return "shared"; }
    catch(e){ if(e && e.name==="AbortError") return "cancel"; }
  }
  const a=document.createElement("a"); a.href=URL.createObjectURL(blob); a.download=name; document.body.appendChild(a); a.click();
  setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},2000); return "downloaded";
}
const stamp = () => { const d=new Date(), p=n=>String(n).padStart(2,"0"); return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}`; };
function exportXLSX(){
  const flt=view.name==="journal"?(view.flt||""):""; const list=records.filter(r=>!flt||r.eq===flt||r.site===flt);
  const d=ts=>new Date(ts).toLocaleString("ru-RU");
  const insp=[["Дата","Код","Участок","Модель","Позиция","Механик","Смена","Итог","Щель, мм","t лев, °C","t прав, °C","Замечаний","Открыто","Фото","Комментарий"],
    ...list.map(r=>{const u=eqBy(r.eq)||{};return [d(r.ts),r.eq,r.site||u.site,r.model||u.model,r.pos||u.pos,r.mechanic,r.shift,VERDICT[r.verdict],r.gap,r.tL,r.tR,(r.remarks||[]).length,(r.remarks||[]).filter(x=>!x.closed).length,r.photos||0,r.note]})];
  const rems=[["Дата выявления","Код","Участок","Узел","Замечание","Выявил","Статус","Дата устранения","Устранил"]];
  list.forEach(r=>(r.remarks||[]).forEach(x=>rems.push([d(r.ts),r.eq,r.site,x.node,x.text,r.mechanic,x.closed?"Устранено":"Открыто",x.closed?d(x.closed.ts):"",x.closed?x.closed.by:""])));
  const eqs=[["Код","Участок","Модель","Позиция","Инв. №","Последний осмотр","Состояние"],
    ...equipment.map(e=>{const r=lastOf(e.code);return [e.code,e.site,e.model,e.pos,e.inv||"",r?d(r.ts):"",r?VERDICT[r.verdict]:"нет осмотров"]})];
  const blob=XLSXLite.build([
    {name:"Осмотры",cols:[18,11,22,10,28,20,6,26,9,9,9,10,8,6,40],rows:insp},
    {name:"Замечания",cols:[18,11,22,34,44,20,11,18,20],rows:rems},
    {name:"Оборудование",cols:[11,22,10,30,10,18,26],rows:eqs}]);
  saveFile(blob, `Агрегатный_журнал_${stamp()}.xlsx`);
}

/* ========= Передача данных ========= */
function syncHTML(){
  const n=unsent().length, last=meta.lastSent;
  return tabs("sync")+`<div class="stack">
   <div class="panel stack">
     <h3>Передать осмотры мастеру</h3>
     <div class="note">Файл с осмотрами и фото уходит через мессенджер, почту или сохраняется в «Файлы». Интернет нужен только в момент отправки.</div>
     <div>Новых осмотров: <b class="mono">${n}</b>${last?` · последняя передача ${fmt(last)}`:""}</div>
     <button class="btn" id="sendNew" ${n?"":"disabled"}>Отправить новые (${n})</button>
     <button class="btn sec" id="sendAll" ${records.length?"":"disabled"}>Отправить всё (резервная копия)</button>
   </div>
   <div class="panel stack">
     <h3>Собрать файлы от механиков</h3>
     <div class="note">На компьютере мастера: выберите сразу все полученные файлы .json. Повторы не задваиваются, статусы «устранено» объединяются.</div>
     <label class="photo-btn" style="align-self:flex-start">Выбрать файлы…<input type="file" id="importFiles" accept=".json,application/json" multiple></label>
     <div id="importRes" class="note"></div>
   </div>
   <div class="panel stack">
     <h3>Отчёт в Excel</h3>
     <div class="note">Три листа: осмотры, замечания со статусом, оборудование.</div>
     <button class="btn sec" id="exportAll" ${records.length?"":"disabled"}>Выгрузить всё в Excel</button>
   </div>
   <div class="note">Устройство: <span class="mono">${esc(meta.device)}</span> · осмотров в памяти: ${records.length}</div>
  </div>`;
}
async function sendData(onlyNew){
  const list = onlyNew ? unsent() : records.slice();
  if(!list.length){toast("Нет осмотров для передачи");return}
  const photos=[]; for(const r of list){ if(r.photos) photos.push(...await DB.photosOf(r.id)); }
  const localEq = equipment.filter(e=>e.source!=="base");
  const payload={format:"toir-export", version:1, device:meta.device, mechanic:meta.mechanic, created:Date.now(),
    inspections:list.map(r=>{const {sentAt,...x}=r; return x;}), photos, equipment:localEq};
  const who=(meta.mechanic||"механик").replace(/[^\p{L}\p{N}]+/gu,"_");
  const res=await saveFile(new Blob([JSON.stringify(payload)],{type:"application/json"}), `ТОиР_${who}_${stamp()}.json`);
  if(res==="cancel") return;
  const now=Date.now();
  for(const r of list){ if(r.device===meta.device && !r.sentAt){ r.sentAt=now; await DB.put("inspections", r); } }
  meta.lastSent=now; await saveMeta();
  toast(res==="shared"?"Файл передан":"Файл сохранён — отправьте его мастеру"); render();
}
async function importFiles(files){
  let added=0, updated=0, bad=0, ph=0, eqAdded=0;
  const existing = new Map(records.map(r=>[r.id,r]));
  const photoKeys = new Set(await DB.keys("photos"));
  for(const f of files){
    let data; try{ data=JSON.parse(await f.text()); }catch(e){ bad++; continue; }
    if(!data || data.format!=="toir-export"){ bad++; continue; }
    for(const r of data.inspections||[]){
      const cur=existing.get(r.id);
      if(!cur){ const x={...r, sentAt:r.device===meta.device?Date.now():null}; await DB.put("inspections",x); existing.set(r.id,x); added++; }
      else{
        let changed=false;
        const rem=(cur.remarks||[]).map((x,i)=>{ const o=(r.remarks||[])[i]; if(!x.closed&&o&&o.closed){changed=true;return {...x,closed:o.closed}} return x; });
        if(changed){ cur.remarks=rem; await DB.put("inspections",cur); updated++; }
      }
    }
    const newPh=(data.photos||[]).filter(p=>!photoKeys.has(p.id));
    if(newPh.length){ await DB.putMany("photos",newPh); newPh.forEach(p=>photoKeys.add(p.id)); ph+=newPh.length; }
    for(const e of data.equipment||[]){ if(!eqBy(e.code)){ await DB.put("equipment",{...e,source:"import"}); eqAdded++; } }
  }
  await loadAll();
  render();
  const res=$("#importRes"); if(res) res.textContent=`Новых осмотров: ${added} · обновлено: ${updated} · фото: ${ph}${eqAdded?` · агрегатов: ${eqAdded}`:""}${bad?` · не прочитано файлов: ${bad}`:""}`;
  toast(`Загружено осмотров: ${added}`);
}

/* ========= Оборудование и QR ========= */
const appBase = () => location.href.split("#")[0].replace(/index\.html$/,"");
const linkFor = code => appBase()+"#"+code;
function labelsHTML(){
  const sel=view.sel||{};
  return tabs("labels")+`<div class="stack">
   <details class="panel"><summary class="lbl" style="cursor:pointer">+ Добавить агрегат и создать QR-метку</summary>
   <div class="grid2" style="margin-top:10px">
     <label><span class="lbl">Модель</span><select id="nModel">${Object.keys(MODELS).map(k=>`<option>${k}</option>`).join("")}</select></label>
     <label><span class="lbl">Участок</span><input type="text" id="nSite" list="siteList" placeholder="МДСЗ-8 ПК Гаврилово"><datalist id="siteList">${sites().map(s=>`<option value="${esc(s)}">`).join("")}</datalist></label>
     <label><span class="lbl">Позиция / назначение</span><input type="text" id="nPos" placeholder="Щековая дробилка, 1 стадия"></label>
     <label><span class="lbl">Инв. номер</span><input type="text" id="nInv" placeholder="необязательно"></label>
     <label><span class="lbl">Код метки</span><input type="text" id="nCode" placeholder="G8-SCH-2" style="text-transform:uppercase"><span class="hint">Латиница, цифры и дефис</span></label>
   </div>
   <button class="btn" id="addEq" style="margin-top:12px">Добавить и создать QR</button>
   <div class="note" style="margin-top:8px">Агрегат добавится на этом устройстве и уйдёт другим вместе с файлом передачи. Чтобы он сразу был у всех, скачайте справочник и замените файл equipment.js на GitHub.</div>
   <button class="btn sec sm" id="eqDl" style="margin-top:8px">Скачать справочник (equipment.js)</button>
   </details>
   <div class="row" style="justify-content:space-between"><span class="lbl">QR-метки · отмечено ${Object.keys(sel).length}</span>
     <span class="row"><button class="chip" id="selAll">Выбрать все</button><button class="btn sm" id="labelsDl" ${equipment.length?"":"disabled"}>Лист для печати</button></span></div>
   <div class="note">Если ничего не выбрано, на лист попадут все метки.</div>
   <div class="qrgrid">${equipment.map(u=>`<label class="qr" style="cursor:pointer"><img alt="QR ${esc(u.code)}" data-qr="${esc(u.code)}"><div class="c">${esc(u.code)}</div><div class="d">${esc(u.model)} · ${esc(u.pos)}</div><div class="d">${esc(u.site)}</div>
     <div style="margin-top:6px"><input type="checkbox" data-sel="${esc(u.code)}" ${sel[u.code]?"checked":""}> на печать</div></label>`).join("")}</div>
  </div>`;
}
async function addEquipment(){
  const code=$("#nCode").value.trim().toUpperCase(), site=$("#nSite").value.trim(), pos=$("#nPos").value.trim(), model=$("#nModel").value, inv=$("#nInv").value.trim();
  if(!/^[A-Z0-9][A-Z0-9-]{1,30}$/.test(code)){toast("Код: латинские буквы, цифры и дефис");return}
  if(!site||!pos){toast("Заполните участок и позицию");return}
  if(eqBy(code)){toast("Такой код уже есть");return}
  await DB.put("equipment",{code,site,pos,model,inv,source:"local",added:Date.now()});
  await loadAll(); view.sel={...(view.sel||{}),[code]:true}; toast(`Агрегат ${code} добавлен`); render();
}
function downloadEquipmentJs(){
  const rows=equipment.map(e=>`  { code: ${JSON.stringify(e.code)}, site: ${JSON.stringify(e.site)}, model: ${JSON.stringify(e.model)}, pos: ${JSON.stringify(e.pos)}, inv: ${JSON.stringify(e.inv||"")} }`).join(",\n");
  const js=`/* СПРАВОЧНИК ОБОРУДОВАНИЯ — выгружен из приложения ${new Date().toLocaleString("ru-RU")}.\n   Замените им equipment.js на GitHub и увеличьте VERSION в sw.js. */\nwindow.EQUIPMENT = [\n${rows}\n];\n`;
  saveFile(new Blob([js],{type:"text/javascript"}),"equipment.js");
}
function qrData(code){ const q=qrcode(0,"M"); q.addData(linkFor(code)); q.make(); return q.createDataURL(6,2); }
function drawQR(){ document.querySelectorAll("img[data-qr]").forEach(i=>{ try{ i.src=qrData(i.dataset.qr); }catch(e){} }); }
function downloadLabels(codes){
  const list=equipment.filter(u=>!codes.length||codes.includes(u.code));
  const cells=list.map(u=>`<div class="l"><img src="${qrData(u.code)}"><div class="c">${esc(u.code)}</div><div class="d"><b>${esc(u.model)}</b> · ${esc(u.pos)}</div><div class="d">${esc(u.site)}</div><div class="s">Осмотр: отсканируйте в приложении «Журнал ТОиР»</div></div>`).join("");
  const html=`<!doctype html><html lang="ru"><meta charset="utf-8"><title>QR-метки</title><style>body{font-family:Arial,sans-serif;margin:10mm}.g{display:grid;grid-template-columns:repeat(3,60mm);gap:6mm}.l{border:1px dashed #888;padding:4mm;text-align:center;break-inside:avoid}.l img{width:42mm;height:42mm;image-rendering:pixelated}.c{font:bold 16pt monospace;margin-top:2mm}.d{font-size:9pt}.s{font-size:7pt;color:#555;margin-top:1mm}@media print{p{display:none}}</style><p>Откройте файл в браузере на компьютере и нажмите Ctrl+P. Метки лучше заламинировать.</p><div class="g">${cells}</div></html>`;
  saveFile(new Blob([html],{type:"text/html"}),"QR-метки.html");
}

/* ========= Сканер QR ========= */
let scanStream=null, scanTimer=null;
async function openScanner(){
  const ov=$("#scanner"), msg=$("#scanMsg"), video=$("#scanVideo");
  ov.hidden=false; msg.textContent="Наведите камеру на QR-метку агрегата";
  if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia){ msg.textContent="Камера недоступна. Введите код с метки вручную."; return; }
  try{
    scanStream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:"environment"},width:{ideal:1280}},audio:false});
    video.srcObject=scanStream; await video.play();
    const cv=$("#scanCanvas"), ctx=cv.getContext("2d",{willReadFrequently:true});
    const tick=()=>{
      if(!scanStream) return;
      if(video.readyState>=2){
        const w=640, h=Math.round(video.videoHeight*(w/video.videoWidth))||480;
        cv.width=w; cv.height=h; ctx.drawImage(video,0,0,w,h);
        const res=jsQR(ctx.getImageData(0,0,w,h).data,w,h,{inversionAttempts:"attemptBoth"});
        if(res&&res.data){ return onScan(res.data); }
      }
      scanTimer=setTimeout(tick,180);
    };
    tick();
  }catch(e){ msg.textContent="Нет доступа к камере. Разрешите камеру для приложения в настройках телефона."; }
}
function closeScanner(){
  clearTimeout(scanTimer); if(scanStream){ scanStream.getTracks().forEach(t=>t.stop()); scanStream=null; }
  $("#scanner").hidden=true;
}
function onScan(text){
  let code=text.trim(); const i=code.lastIndexOf("#"); if(i>=0) code=code.slice(i+1);
  code=decodeURIComponent(code).toUpperCase();
  if(navigator.vibrate) navigator.vibrate(80);
  closeScanner();
  if(eqBy(code)) go({name:"card",code}); else toast(`Код ${code} не найден в справочнике`);
}

/* ========= События ========= */
document.addEventListener("click",e=>{
  const img=e.target.closest("img[data-zoom]"); if(img){$("#lbImg").src=img.src;$("#lightbox").hidden=false;return}
  if(e.target.closest("#lightbox")){$("#lightbox").hidden=true;return}
  const t=e.target.closest("button"); if(!t) return;
  if(t.id==="backBtn"){ if(view.name==="inspect") go({name:"card",code:view.code}); else go({name:"home"}); return;}
  if(t.id==="scanBtn"||t.id==="scanBig") return openScanner();
  if(t.id==="scanClose") return closeScanner();
  if(t.id==="updBtn"){ if(window.__waitingSW) window.__waitingSW.postMessage("skipWaiting"); return; }
  if(t.dataset.go) return go({name:t.dataset.go});
  if(t.dataset.open) return go({name:"card",code:t.dataset.open});
  if(t.dataset.inspect){ form=newForm(t.dataset.inspect); return go({name:"inspect",code:t.dataset.inspect}); }
  if(t.id==="codeGo"){ const c=$("#codeInput").value.trim().toUpperCase(); if(eqBy(c)) go({name:"card",code:c}); else toast("Код не найден. Проверьте метку."); return;}
  if(t.id==="mechFirstSave"){ const v=$("#mechFirst").value.trim(); if(!v){toast("Введите ФИО");return} meta.mechanic=v; saveMeta().then(render); return; }
  if(t.dataset.res){ const id=t.dataset.res; form.res[id]=t.dataset.val; const n=curModel().nodes.find(n=>n.items.some(x=>x[0]===id)); rerenderNode(n.id); autoVerdict(); updateProgress(); return;}
  if(t.dataset.chip){ const a=form.chips[t.dataset.chip]||(form.chips[t.dataset.chip]=[]); const x=t.dataset.text; const k=a.indexOf(x); k<0?a.push(x):a.splice(k,1); t.setAttribute("aria-pressed",k<0); return;}
  if(t.id==="allOk"){ curModel().nodes.forEach(n=>n.items.forEach(([id])=>{ if(!form.res[id]) form.res[id]="ok"; })); render(); autoVerdict(); return;}
  if(t.dataset.v && view.name==="inspect"){ form.verdict=t.dataset.v; form.verdictTouched=true; document.querySelectorAll(".verdict button").forEach(b=>b.classList.toggle("on",b===t)); return;}
  if(t.dataset.delphoto){ const p=form.photos.splice(+t.dataset.delphoto,1)[0]; rerenderPhotos(p.node); return;}
  if(t.id==="saveBtn") return save();
  if(t.dataset.photos) return showPhotos(t.dataset.photos);
  if(t.dataset.rshow){ view.all=t.dataset.rshow==="all"; return render(); }
  if(t.dataset.close) return closeRemark(t.dataset.close,+t.dataset.idx);
  if(t.id==="exportBtn"||t.id==="exportAll") return exportXLSX();
  if(t.id==="sendNew") return sendData(true);
  if(t.id==="sendAll") return sendData(false);
  if(t.id==="addEq") return addEquipment();
  if(t.id==="eqDl") return downloadEquipmentJs();
  if(t.id==="selAll"){ view.sel={}; equipment.forEach(u=>view.sel[u.code]=true); return render(); }
  if(t.id==="labelsDl") return downloadLabels(Object.keys(view.sel||{}));
  if(t.dataset.labels) return downloadLabels([t.dataset.labels]);
});
document.addEventListener("input",e=>{
  if(!form||view.name!=="inspect") return; const el=e.target;
  if(["gap","tL","tR"].includes(el.id)){form[el.id]=el.value;updateProgress()}
  else if(el.id==="note") form.note=el.value;
  else if(el.id==="mech") form.mechanic=el.value;
  else if(el.dataset.nnote) form.notes[el.dataset.nnote]=el.value;
});
document.addEventListener("change",async e=>{
  const el=e.target;
  if(el.id==="shift"&&form) form.shift=el.value;
  if(el.id==="flt"){ view.flt=el.value; render(); }
  if(el.id==="importFiles"&&el.files&&el.files.length) return importFiles([...el.files]);
  if(el.dataset.sel!==undefined){ view.sel=view.sel||{}; if(el.checked) view.sel[el.dataset.sel]=true; else delete view.sel[el.dataset.sel]; }
  if(el.dataset.addphoto!==undefined && el.files && el.files[0]){
    const node=el.dataset.addphoto;
    if(form.photos.length>=8){toast("Не более 8 фото на осмотр");return}
    try{ const data=await compress(el.files[0]); form.photos.push({node,data}); rerenderPhotos(node); }
    catch(err){ toast("Не удалось прочитать фото"); }
    el.value="";
  }
});
document.addEventListener("keydown",e=>{ if(e.key==="Enter"&&e.target.id==="codeInput") $("#codeGo").click(); });
window.addEventListener("online",()=>{ if(view.name!=="inspect") render(); });
window.addEventListener("offline",()=>{ if(view.name!=="inspect") render(); });
window.addEventListener("beforeunload",e=>{ if(form&&Object.keys(form.res).length){ e.preventDefault(); e.returnValue=""; } });

function fromHash(){ const h=decodeURIComponent(location.hash.slice(1)).toUpperCase(); if(h&&eqBy(h)){ go({name:"card",code:h}); history.replaceState(null,"",location.pathname); } }
window.addEventListener("hashchange",fromHash);

/* ========= Запуск ========= */
(async()=>{
  try{
    const m = await DB.get("meta","meta");
    if(m) meta={...meta,...m};
    if(!meta.device){ meta.device="dev-"+Math.random().toString(36).slice(2,8); await saveMeta(); }
    await loadAll();
  }catch(e){ document.getElementById("view").innerHTML=`<div class="panel" style="margin-top:14px">Не удалось открыть память телефона. Откройте приложение не в режиме «инкогнито».</div>`; return; }
  render(); fromHash();
  if(!window.EQUIPMENT) toast("Не найден файл equipment.js — загрузите его на GitHub");
})();

if("serviceWorker" in navigator){
  window.addEventListener("load",()=>{
    navigator.serviceWorker.register("sw.js").then(reg=>{
      const show=w=>{ window.__waitingSW=w; $("#updBanner").hidden=false; };
      if(reg.waiting && navigator.serviceWorker.controller) show(reg.waiting);
      reg.addEventListener("updatefound",()=>{ const w=reg.installing; w.addEventListener("statechange",()=>{ if(w.state==="installed"&&navigator.serviceWorker.controller) show(w); }); });
      if(navigator.onLine) reg.update().catch(()=>{});
    }).catch(()=>{});
    let reloading=false;
    navigator.serviceWorker.addEventListener("controllerchange",()=>{ if(reloading) return; reloading=true; location.reload(); });
  });
}
