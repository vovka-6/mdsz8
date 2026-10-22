/* МДСЗ-8 · электронные обходы. Офлайн-PWA, данные хранятся на телефоне смены. */
(function () {
  "use strict";
  const D = window.D8, KEY = "mdsz8-v1", APPV = "демо 1.6.3";
  const DEF = { routes: JSON.parse(JSON.stringify(D.ROUTES)), meas: JSON.parse(JSON.stringify(D.MEAS)) };
  const ADMIN_ROLE = "Администратор", ADMIN_BTN = ["settings", "map", "shift", "defects", "meas", "archive"];
  const KT = Object.fromEntries(D.KT.map(k => [k.code, k]));
  const $ = s => document.querySelector(s);
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const p2 = n => String(n).padStart(2, "0"), p3 = n => String(n).padStart(3, "0");
  const ymd = t => { const d = new Date(t); return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`; };
  const dmy = t => { const d = new Date(t); return `${p2(d.getDate())}.${p2(d.getMonth() + 1)}.${d.getFullYear()}`; };
  const hm = t => { const d = new Date(t); return `${p2(d.getHours())}:${p2(d.getMinutes())}`; };
  const dmyhm = t => dmy(t) + " " + hm(t);
  const ymdToMs = s => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d).getTime(); };
  const addDays = (t, n) => { const d = new Date(t); d.setDate(d.getDate() + n); return ymd(d); };
  const short = fio => String(fio || "").replace(/\s*\(пример\)/, "");
  const ktLabel = c => `${KT[c].n}. ${KT[c].name}`;
  const typeName = c => D.TYPES[KT[c].type][0];

  /* ---------- состояние ---------- */
  let S = load();
  function fresh() {
    return { cfg: { email: D.EMAIL, staff: D.STAFF.map((s, i) => ({ ...s, id: "u" + i })), plan: JSON.parse(JSON.stringify(D.PLAN)) },
      session: null, shift: null, defects: [], cD: 0, rounds: [], meas: [], mhist: {}, archive: [] };
  }
  function load() { try { const s = JSON.parse(localStorage.getItem(KEY)); if (s && s.cfg) return s; } catch (e) { } return fresh(); }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { toast("Память телефона заполнена: отправьте и закройте смену"); } }

  /* ---------- ПИН: храним только хэш ---------- */
  async function pinHash(id, pin) {
    const txt = `mdsz8|${id}|${pin}`;
    if (window.crypto && crypto.subtle) { const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(txt)); return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, "0")).join(""); }
    let h = 0x811c9dc5; for (const c of txt) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; } return "f" + h.toString(16);
  }
  async function migrate() {
    let ch = false;
    for (const s of S.cfg.staff) if (s.pin != null) { if (s.pin) s.ph = await pinHash(s.id, s.pin); delete s.pin; ch = true; }
    if (!S.cfg.rolesV2) { S.cfg.staff.forEach(s => { s.admin = s.role === "Заместитель начальника ПК"; }); S.cfg.rolesV2 = true; ch = true; }
    if (!S.cfg.admin) { S.cfg.admin = { fio: "Администратор", ph: await pinHash("admin", "0000"), mustChange: true }; ch = true; }
    if (!S.cfg.norms) { S.cfg.norms = {}; S.cfg.tnorm = {}; S.cfg.sessionH = 13; ch = true; }
    applyCfg();
    if (ch) save();
  }
  /* нормативы и нормы температур из настроек администратора */
  function applyCfg() {
    for (const k in D.ROUTES) { const d = DEF.routes[k], v = S.cfg.norms && S.cfg.norms[k]; if (d.norm != null) D.ROUTES[k].norm = v || d.norm; if (d.normPer != null) D.ROUTES[k].normPer = v || d.normPer; }
    for (const t in D.MEAS) D.MEAS[t] = DEF.meas[t].map(([pl, n]) => [pl, (S.cfg.tnorm && S.cfg.tnorm[t + "|" + pl]) || n]);
  }
  const isSuper = () => !!(S.session && S.session.id === "admin");
  const isResp = () => !!(me() && me().admin && !isSuper());
  const isAdmin = () => isSuper() || isResp();
  const emails = () => String(S.cfg.email || "").split(/[,;\s]+/).filter(Boolean);

  /* ---------- фото: IndexedDB ---------- */
  const IDB = (() => {
    let p; const db = () => p || (p = new Promise((res, rej) => { const r = indexedDB.open("mdsz8", 1); r.onupgradeneeded = () => r.result.createObjectStore("photos"); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }));
    const tx = (mode, fn) => db().then(d => new Promise((res, rej) => { const t = d.transaction("photos", mode); const r = fn(t.objectStore("photos")); t.oncomplete = () => res(r && r.result); t.onerror = () => rej(t.error); }));
    return { put: (k, v) => tx("readwrite", s => s.put(v, k)), get: k => tx("readonly", s => s.get(k)) };
  })();
  /* ---------- схема и карты маршрутов: только на телефоне (IndexedDB), на сайте их нет ---------- */
  const MAPS = {}, MAP_KEYS = { scheme: "Технологическая схема (светофор)", P: "Карта маршрута П", C: "Карта маршрута С", R: "Карта маршрута Р" };
  async function loadMaps() { for (const k in MAP_KEYS) { try { const b = await IDB.get("map:" + k); if (MAPS[k]) URL.revokeObjectURL(MAPS[k]); MAPS[k] = b ? URL.createObjectURL(b) : null; } catch (e) { MAPS[k] = null; } } }
  const noMap = what => `<div class="note warn">${what} не загружена на этот телефон. Администратор: Настройки → «Схема и карты маршрутов».</div>`;
  const blobToData = b => new Promise(res => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(b); });
  const dataToBlob = d => fetch(d).then(r => r.blob());
  function shrinkTo(file, max) {
    return new Promise((res, rej) => {
      const img = new Image(), url = URL.createObjectURL(file);
      img.onload = () => { const k = Math.min(1, max / Math.max(img.width, img.height)); const c = document.createElement("canvas"); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k); c.getContext("2d").drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url); c.toBlob(b => res(b), "image/jpeg", 0.85); };
      img.onerror = () => { URL.revokeObjectURL(url); rej(new Error("Не удалось открыть картинку")); };
      img.src = url;
    });
  }
  async function importMaps(maps) { let n = 0; for (const k in MAP_KEYS) if (maps && typeof maps[k] === "string" && maps[k].startsWith("data:image/")) { await IDB.put("map:" + k, await dataToBlob(maps[k])); n++; } await loadMaps(); return n; }
  function shrink(file) {
    return new Promise((res, rej) => {
      const img = new Image(), url = URL.createObjectURL(file);
      img.onload = () => { const k = Math.min(1, 1600 / Math.max(img.width, img.height)); const c = document.createElement("canvas"); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k); c.getContext("2d").drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url); c.toBlob(b => res(b), "image/jpeg", 0.8); };
      img.onerror = () => { URL.revokeObjectURL(url); rej(new Error("Не удалось открыть фото")); };
      img.src = url;
    });
  }

  /* ---------- пользователь, смена ---------- */
  const me = () => !S.session ? null : S.session.id === "admin" ? { id: "admin", fio: S.cfg.admin.fio, role: ADMIN_ROLE, ph: S.cfg.admin.ph } : S.cfg.staff.find(s => s.id === S.session.id);
  const role = () => (me() || {}).role;
  const isView = () => role() === ADMIN_ROLE || !!(D.ROLES[role()] || {}).view;
  const canEdit = () => ["Мастер смены", "Механик", ADMIN_ROLE].includes(role());
  const shiftPrefix = () => `G8-${S.shift.date.replace(/-/g, "")}-${S.shift.no}`;
  const kindShort = k => k === "Ремонтная" ? "Рем" : "Техн";
  const isOpen = d => d.status === "Открыт" || d.status === "В работе";
  const activeRound = () => S.rounds.find(r => !r.end && r.uid === S.session.id);
  const done = r => Object.values(r.pts).filter(p => p.res !== "skip").length;

  /* ---------- навигация ---------- */
  let cur = { v: "login", p: null }, stack = [], ui = { tmp: {} };
  function go(v, p, replace) { closeModal(); if (!replace) stack.push(cur); cur = { v, p }; history.pushState({}, ""); render(); window.scrollTo(0, 0); }
  function back() { cur = stack.pop() || { v: S.session ? "home" : "login" }; render(); }
  window.addEventListener("popstate", () => { if ($(".modal")) { closeModal(); history.pushState({}, ""); return; } if (cur.v === "home" || cur.v === "login") return; if (cur.v === "point") A.openRound(cur.p.rid); else back(); history.pushState({}, ""); });
  function home() { stack = []; cur = { v: S.session ? "home" : "login" }; render(); window.scrollTo(0, 0); }

  function render() {
    if (S.session && Date.now() - S.session.ts > (S.cfg.sessionH || 13) * 3600e3) S.session = null;
    if (!S.session && cur.v !== "login") cur = { v: "login" };
    const f = V[cur.v] || V.home;
    $("#app").innerHTML = f(cur.p) || "";
    const t = $("#hdrTitle"); if (t) t.textContent = TITLES[cur.v] || "МДСЗ-8 · Обходы";
    $("#hdrBack").hidden = cur.v === "home" || cur.v === "login";
    $("#hdrUser").textContent = me() ? short(me().fio) : "";
    $("#hdrOut").hidden = !S.session;
    if (AFTER[cur.v]) AFTER[cur.v](cur.p);
  }
  const TITLES = { home: "МДСЗ-8 · Обходы", start: "Начало обхода", round: "Обход", point: "Осмотр КТ", defect: "Замечание", crit: "⛔ КРИТ",
    map: "Светофор МДСЗ-8", kt: "Карточка КТ", defects: "Дефекты", dedit: "Дефект", shift: "Смена: план / факт", meas: "Замеры", close: "Закрыть смену",
    send: "Отправка отчёта", archive: "Архив отчётов", settings: "Настройки", pick: "Выбор КТ", openShift: "Открыть смену" };

  function toast(msg) { const t = $("#toast"); t.textContent = msg; t.hidden = false; clearTimeout(t._h); t._h = setTimeout(() => t.hidden = true, 3500); }
  function modal(html) { closeModal(); const m = document.createElement("div"); m.className = "modal"; m.innerHTML = `<div class="sheet">${html}</div>`; document.body.appendChild(m); m.addEventListener("click", e => { if (e.target === m) closeModal(); }); }
  function closeModal() { const m = $(".modal"); if (m) m.remove(); }

  /* ---------- экраны ---------- */
  const V = {}, AFTER = {};

  V.login = () => {
    const groups = {};
    S.cfg.staff.forEach(s => (groups[s.role] = groups[s.role] || []).push(s));
    const sh = S.shift ? `<div class="note ok">Открыта смена: ${dmy(ymdToMs(S.shift.date))}, смена ${S.shift.no} · ${S.shift.kind}</div>` : `<div class="note">Смена не открыта — откроется после входа.</div>`;
    return `<h2>Кто вы?</h2>${sh}` + Object.keys(D.ROLES).filter(r => groups[r]).map(r => `<div class="grp">${r}</div>` +
      groups[r].map(s => `<button class="who" data-a="pickUser" data-v="${s.id}">${esc(short(s.fio))}</button>`).join("")).join("") +
      `<button class="btn adminbtn" data-a="pickUser" data-v="admin">⚙ Вход администратора</button><p class="muted center">Версия: ${APPV}. Данные хранятся на этом телефоне.</p>`;
  };

  V.home = () => {
    const u = me(), R = isSuper() ? { btn: ADMIN_BTN } : D.ROLES[u.role], ar = isSuper() ? null : activeRound();
    let h = (isSuper() && S.cfg.admin.mustChange ? `<div class="note bad">Смените стартовый ПИН администратора (0000): кнопка «🔑 Сменить свой ПИН» внизу.</div>` : "") +
      (isSuper() && !emails().length ? `<div class="note bad">Не задана почта для отчётов: Настройки → «Почта для отчётов» (рабочий адрес).</div>` : "") +
      (isSuper() && !MAPS.scheme ? `<div class="note warn">Не загружены схема и карты маршрутов: Настройки → «Схема и карты маршрутов».</div>` : "") + shiftBar();
    if (ar) h += `<button class="big go" data-a="openRound" data-v="${ar.id}">▶ Продолжить: ${esc(ar.route)}<small>${done(ar) + Object.values(ar.pts).filter(p => p.res === "skip").length} из ${ar.list.length} КТ · идёт ${mins(ar.start)} мин</small></button>`;
    const crit = S.defects.filter(d => isOpen(d) && d.cat === "Критический").length;
    if (crit) h += `<div class="note bad">⛔ Открытых критических дефектов: ${crit}</div>`;
    const L = {
      P: ["П — перед пуском", `${D.ORDER_P.length} КТ · ≈${D.ROUTES.P.norm} мин`],
      PE: ["П — электрика", `${D.ORDER_P.length} КТ · ≈${D.ROUTES.PE.norm} мин`],
      C: [u.role === "Мастер смены" ? "С — полный обход мастера" : "С — сменный обход", `${D.ORDER_C.length} КТ · ≈${D.ROUTES.C.norm} мин · с замерами`],
      CE: ["С — электрика", `${D.ORDER_C.length} КТ · ≈${D.ROUTES.CE.norm} мин`],
      R: ["Р — полный осмотр", `${D.ORDER_C.length} КТ · ≈${D.ROUTES.R.norm} мин`],
      RA: ["Р — приёмка после ремонта", "только отремонтированные КТ"],
      V: ["В — внеплановый осмотр", "выбрать КТ"],
      report: ["⚠ Сообщить о дефекте", "вне обхода"],
      map: ["🚦 Светофор", "состояние КТ на схеме"],
      shift: ["📋 Смена", "план / факт, кто у пульта"],
      defects: [u.role === "Механик" ? "🛠 Дефекты в работу" : "🛠 Дефекты", u.role === "Заместитель начальника ПК" ? "просмотр" : "ответственный, срок, закрытие"],
      meas: ["🌡 Замеры", "температуры, вне нормы"],
      close: ["📨 Закрыть смену и отправить", emails().join(", ") || "почта не задана"],
      settings: isSuper() ? ["⚙ Все настройки", "персонал, почта, нормы, план"] : ["👥 Персонал", "ФИО, должности, ПИН"],
      archive: ["🗂 Архив отчётов", "сформированные отчёты смен"],
    };
    h += `<div class="tiles">` + R.btn.concat(isResp() ? ["settings"] : []).map(b => {
      const isRoute = !!D.ROUTES[b]; const pf = isRoute ? planFact(b, u.role) : "";
      const dis = (isRoute || b === "report") && (!S.shift || ar) ? " disabled" : "";
      return `<button class="tile ${isRoute ? "route" : ""} ${b === "report" ? "warn" : ""} ${b === "close" ? "send" : ""}" data-a="homeBtn" data-v="${b}"${dis}><b>${L[b][0]}</b><small>${esc(L[b][1])}${pf}</small></button>`;
    }).join("") + `</div>`;
    if (!S.shift && !isView()) h += `<button class="big" data-a="openShiftForm">Открыть смену</button>`;
    h += `<button class="big scanb" data-a="scan">📷 Сканировать QR-метку</button><button class="btn" data-a="myPin">🔑 Сменить свой ПИН</button>`;
    return h;
  };
  function shiftBar() {
    if (!S.shift) return `<div class="note">Смена не открыта</div>`;
    const p = S.shift.pultLog.length ? short(S.shift.pultLog[S.shift.pultLog.length - 1].fio) : "—";
    return `<div class="shiftbar"><b>${dmy(ymdToMs(S.shift.date))} · смена ${S.shift.no} · ${S.shift.kind}</b><span>У пульта: ${esc(p)}</span></div>`;
  }
  function planFact(rkey, roleName) {
    if (!S.shift) return "";
    const pl = (S.cfg.plan[S.shift.kind] || []).find(x => x[0] === rkey && x[1] === roleName);
    const f = S.rounds.filter(r => r.end && r.rkey === rkey && r.role === roleName).length;
    return pl ? ` · сделано ${f} из ${pl[2]}` : (f ? ` · сделано ${f}` : "");
  }
  const mins = t => Math.max(0, Math.round((Date.now() - t) / 60000));

  /* --- открытие смены --- */
  V.openShift = () => {
    const now = new Date(), h = now.getHours();
    let date = ymd(now), no = "1";
    if (h < 8) { date = addDays(now, -1); no = "2"; } else if (h >= 20) no = "2";
    const kind = role() === "Механик" ? "Ремонтная" : "Технологическая";
    return `<p>Проверьте данные смены. Они попадут в имя файла отчёта и в ID записей.</p>
      <label>Дата начала смены<input type="date" id="shDate" value="${date}"></label>
      <label>Смена №<select id="shNo"><option ${no === "1" ? "selected" : ""}>1</option><option ${no === "2" ? "selected" : ""}>2</option></select></label>
      <div class="hint">1 — дневная 08:00–20:00, 2 — ночная 20:00–08:00</div>
      <label>Вид смены<select id="shKind"><option ${kind === "Технологическая" ? "selected" : ""}>Технологическая</option><option ${kind === "Ремонтная" ? "selected" : ""}>Ремонтная</option></select></label>
      <button class="big go" data-a="openShift">Открыть смену</button>`;
  };

  /* --- начало обхода --- */
  V.start = p => {
    const R = D.ROUTES[p.rkey], u = me();
    let h = `<h2>${R.title}</h2>`;
    if (p.rkey === "P") {
      h += `<div class="grp">Объём</div>` + [["ALL", `Весь маршрут П — ${D.ORDER_P.length} КТ, ≈${R.norm} мин`], ["P1", `П-1 — КТ 1–6 (до маслостанции КСД), если дробильщиков двое`], ["P2", `П-2 — КТ 7–11 (КМД, ГИС-73 №2, ПЭВ-150, ПСУ)`]]
        .map(([k, t]) => `<label class="radio"><input type="radio" name="part" value="${k}" ${k === "ALL" ? "checked" : ""}> ${t}</label>`).join("");
    }
    if (R.pult) {
      const cand = S.cfg.staff.filter(s => s.id !== u.id && ["Дробильщик", "Мастер смены", "Электрослесарь"].includes(s.role));
      const last = S.shift.pultLog.length ? S.shift.pultLog[S.shift.pultLog.length - 1].fio : "";
      h += `<div class="grp">Кто остаётся у пульта?</div>` + cand.map(s => `<label class="radio"><input type="radio" name="pult" value="${esc(s.fio)}" ${s.fio === last ? "checked" : ""}> ${esc(short(s.fio))} <small>— ${s.role}</small></label>`).join("") +
        `<label class="radio"><input type="radio" name="pult" value="__other"> Другой: <input id="pultOther" placeholder="ФИО"></label>`;
    }
    if (p.rkey === "RA" || p.rkey === "V") {
      const pre = p.rkey === "RA" ? new Set(S.defects.filter(d => d.status === "В работе" || (d.status === "Устранён" && d.changed >= S.shift.opened)).map(d => d.kt)) : new Set();
      h += `<div class="grp">${p.rkey === "RA" ? "Отремонтированные КТ (отмечены по реестру дефектов)" : "Какие КТ осмотреть"}</div>` +
        D.ORDER_C.map(c => `<label class="chk"><input type="checkbox" name="kts" value="${c}" ${pre.has(c) ? "checked" : ""}> ${esc(ktLabel(c))}</label>`).join("");
    }
    if (R.map) h += `<div class="grp">Карта маршрута</div>` + (MAPS[R.map] ? `<img class="map" src="${MAPS[R.map]}" alt="Карта маршрута" data-a="zoom" data-v="${MAPS[R.map]}"><div class="hint">Нажмите на карту, чтобы увеличить</div>` : noMap("Карта маршрута"));
    else if (p.rkey !== "V") h += "";
    h += `<button class="big go" data-a="startRound" data-v="${p.rkey}">▶ Начать обход</button>`;
    return h;
  };

  /* --- обход: список точек --- */
  V.round = id => {
    const r = S.rounds.find(x => x.id === id); if (!r) return home();
    const nSkip = Object.values(r.pts).filter(p => p.res === "skip").length, el = mins(r.start);
    let h = `<div class="rhead"><b>${esc(r.route)}</b><span class="${el > r.norm ? "red" : ""}">${el} / ${r.norm} мин</span><div class="bar"><i style="width:${Math.round(100 * Object.keys(r.pts).length / r.list.length)}%"></i></div><small>Осмотрено ${done(r)} · пропущено ${nSkip} · всего ${r.list.length}${r.pult ? " · у пульта " + esc(short(r.pult)) : ""}</small></div>`;
    const next = r.list.find(c => !r.pts[c]);
    if (next) h += `<button class="big go" data-a="openPoint" data-v="${next}">Следующая: ${esc(ktLabel(next))} →</button>`;
    h += `<button class="big scanb" data-a="scan">📷 Сканировать QR-метку</button>`;
    h += `<ol class="pts">` + r.list.map((c, i) => {
      const p = r.pts[c]; const st = !p ? "" : p.res === "ok" ? "ok" : p.res === "skip" ? "skip" : "def";
      const ico = !p ? "○" : p.res === "ok" ? "✓" : p.res === "skip" ? "—" : "✎";
      return `<li class="${st}" data-a="openPoint" data-v="${c}"><span class="ico">${ico}</span><span><b>${i + 1}. ${esc(KT[c].name)}</b><small>${c}${(r.qr || {})[c] ? " · 📷 метка" : ""}${p ? " · " + hm(p.t) + (p.reason ? " · " + esc(p.reason) : "") : ""}</small></span></li>`;
    }).join("") + `</ol>`;
    if (MAPS[D.ROUTES[r.rkey].map]) h += `<button class="btn" data-a="zoom" data-v="${MAPS[D.ROUTES[r.rkey].map]}">🗺 Карта маршрута</button>`;
    h += `<button class="big ${next ? "" : "go"}" data-a="finishRound" data-v="${r.id}">■ Завершить обход</button>`;
    return h;
  };

  /* --- контрольная точка --- */
  V.point = ({ rid, kt }) => {
    const r = S.rounds.find(x => x.id === rid), k = KT[kt], R = D.ROUTES[r.rkey], p = r.pts[kt];
    const idx = r.list.indexOf(kt);
    let h = `<div class="kthead"><small>${idx + 1} из ${r.list.length} · ${kt} · ${esc(typeName(kt))}</small><h2>${esc(k.name)}</h2></div>`;
    const open = S.defects.filter(d => d.kt === kt && isOpen(d));
    if (open.length) h += `<div class="note warn"><b>Известные открытые дефекты:</b>` + open.map(d => `<div>• ${esc(d.node)}: ${esc(d.desc)} <small>(${d.cat}, ${d.status})</small></div>`).join("") + `<small>Повторно не заводите — только если стало хуже.</small></div>`;
    h += `<div class="grp">Осмотреть</div><ul class="cl">` + checklist(R.cl, k.type).map(t => `<li>${esc(t)}</li>`).join("") + `</ul>`;
    const M = R.meas && D.MEAS[k.type];
    if (M) {
      h += `<div class="grp">Замеры пирометром</div>` + M.map(([pl, n], i) => {
        const prev = lastMeas(kt, pl), v = (ui.tmp[kt] || {})[pl];
        return `<div class="meas"><label>${esc(pl)} <small>норма ≤ ${n} °C${prev ? ` · прошлый ${prev.v} °C в ${hm(prev.ts)} ${dmy(prev.ts) !== dmy(Date.now()) ? dmy(prev.ts) : ""}` : ""}</small></label>
          <div class="mrow"><input inputmode="decimal" id="m${i}" data-pl="${esc(pl)}" data-n="${n}" value="${v != null ? v : ""}" placeholder="°C"><span class="mst" id="ms${i}"></span></div></div>`;
      }).join("");
    }
    if (p && p.defs && p.defs.length) h += `<div class="grp">Замечания в этой точке</div>` + p.defs.map(id => { const d = S.defects.find(x => x.id === id); return d ? `<div class="dcard c${catN(d.cat)}"><b>${esc(d.node)}</b> — ${esc(d.desc)}<small>${d.cat} · ${d.status}${d.photos.length ? " · 📷" + d.photos.length : ""}</small></div>` : ""; }).join("");
    if (p && p.res === "skip") h += `<div class="note">Пропущено: ${esc(p.reason)}</div>`;
    if (p && p.res === "ok") h += `<div class="note ok">✓ Отмечено в норме в ${hm(p.t)}</div>`;
    const qrT = (r.qr || {})[kt];
    h += qrT ? `<div class="note ok">📷 Метка отсканирована в ${hm(qrT)}</div>` : `<button class="${S.cfg.requireQR ? "big scanb" : "btn"}" data-a="scan">📷 Отсканировать метку${S.cfg.requireQR ? " (обязательно)" : ""}</button>`;
    h += `<div class="pbtns">`;
    if (!p || p.res === "skip") h += `<button class="big go" data-a="pointOk">✓ Всё в норме</button>`;
    h += `<button class="big warnb" data-a="pointDefect">✎ Есть замечание</button>`;
    if (p && p.res === "def") h += `<button class="big go" data-a="pointNext">Далее →</button>`;
    if (!p) h += `<button class="btn" data-a="pointSkip">Пропустить (указать причину)</button>`;
    h += `<button class="btn" data-a="openRound" data-v="${rid}">☰ Список точек</button></div>`;
    return h;
  };
  AFTER.point = () => { ui.okNoMeas = ui.okHot = false; document.querySelectorAll(".meas input").forEach(inp => { inp.addEventListener("input", () => measCheck(inp, false)); inp.addEventListener("change", () => measCheck(inp, true)); measCheck(inp, false); }); };
  function checklist(cl, type) {
    if (cl === "E") return type === "CABIN" || type === "PSU" ? D.CL.E[type] : [...D.CL.E.ALL, ...(D.CL.E[type] || [])];
    if (cl === "R") return D.CL.R[type] || [...(D.CL.P[type] || []), ...(D.CL.C[type] || [])];
    return D.CL[cl][type] || D.CL.C[type] || [];
  }
  const catN = c => c === "Критический" ? 1 : c === "Значительный" ? 2 : 3;
  function lastMeas(kt, pl) { const a = S.mhist[kt + "|" + pl]; return a && a.length ? a[a.length - 1] : null; }
  const num = s => { const v = parseFloat(String(s).replace(",", ".")); return isFinite(v) ? v : null; };
  function measCheck(inp, final) {
    const v = num(inp.value), n = +inp.dataset.n, pl = inp.dataset.pl, st = inp.parentNode.querySelector(".mst"), kt = cur.p.kt;
    (ui.tmp[kt] = ui.tmp[kt] || {})[pl] = inp.value === "" ? null : inp.value;
    inp.classList.remove("hi", "rise"); st.textContent = "";
    if (v == null) return;
    const prev = lastMeas(kt, pl);
    if (v > n) { inp.classList.add("hi"); st.textContent = `выше нормы на ${Math.round((v - n) * 10) / 10}`; }
    else if (prev && v - prev.v >= 15) { inp.classList.add("rise"); st.textContent = `рост +${Math.round((v - prev.v) * 10) / 10} °C`; }
    if (final && v > n) {
      modal(`<h3>🌡 ${esc(pl)}: ${v} °C</h3><p>Норма ≤ ${n} °C. Создать замечание?</p><button class="big warnb" data-a="hotDefect" data-v="${esc(pl)}">Да, создать замечание</button><button class="btn" data-a="closeModal">Нет</button>`);
    } else if (final && prev && v - prev.v >= 15) toast(`Внимание: рост на ${Math.round((v - prev.v) * 10) / 10} °C к прошлому замеру (${prev.v} °C). Сообщите мастеру.`);
  }

  /* --- форма замечания --- */
  V.defect = c => {
    const k = KT[c.kt], T = D.TYPES[k.type], f = ui.form;
    return `<div class="kthead"><small>${c.kt} · ${esc(T[0])} · ${esc(c.route)}</small><h2>${esc(k.name)}</h2></div>
      <label>Узел<select id="fNode"><option value="">— выберите —</option>${T[1].map(n => `<option ${f.node === n ? "selected" : ""}>${esc(n)}</option>`).join("")}</select></label>
      <label>Типовой дефект<select id="fDef"><option value="">— выберите —</option>${T[2].map(n => `<option ${f.def === n ? "selected" : ""}>${esc(n)}</option>`).join("")}</select></label>
      <label>Уточнение (необязательно)<textarea id="fTxt" rows="2" placeholder="где именно, размер, значение">${esc(f.txt || "")}</textarea></label>
      <div class="grp">Категория</div><div class="cats">${D.CATS.map(([n]) => `<button class="cat c${catN(n)} ${f.cat === n ? "on" : ""}" data-a="setCat" data-v="${n}">${n}</button>`).join("")}</div>
      <div class="hint">Критический — угроза жизни, аварии, разрушению: остановить и доложить. Значительный — устранить в течение суток. Незначительный — при плановом ТО.</div>
      <div class="grp">Фото</div><div class="thumbs">${f.photos.map((p, i) => `<span class="th"><img src="${p.url}"><b data-a="delPhoto" data-v="${i}">×</b></span>`).join("")}
      <label class="addph">📷<input type="file" accept="image/*" capture="environment" id="fPh"></label></div>
      <label class="chk"><input type="checkbox" id="fFix" ${f.fix ? "checked" : ""}> Устранено на месте</label>
      <button class="big go" data-a="saveDefect">Сохранить замечание</button>`;
  };
  AFTER.defect = () => {
    const keep = () => { ui.form.node = $("#fNode").value; ui.form.def = $("#fDef").value; ui.form.txt = $("#fTxt").value; ui.form.fix = $("#fFix").checked; };
    ["#fNode", "#fDef", "#fTxt", "#fFix"].forEach(s => $(s).addEventListener("change", keep));
    $("#fPh").addEventListener("change", async e => {
      keep(); const fl = e.target.files[0]; if (!fl) return;
      try { const b = await shrink(fl); ui.form.photos.push({ blob: b, url: URL.createObjectURL(b) }); } catch (er) { toast(er.message); }
      render();
    });
  };

  V.crit = id => {
    const d = S.defects.find(x => x.id === id);
    return `<div class="critbox"><div class="big-ico">⛔</div><h2>ОСТАНОВИТЬ<br>${esc(KT[d.kt].name)}</h2><p>Доложить мастеру смены немедленно.</p><p class="cd">${esc(d.node)}: ${esc(d.desc)}</p></div>
      <button class="big crit" data-a="critMail" data-v="${id}">✉ Письмо КРИТ на ${esc(emails()[0])}${emails().length > 1 ? " и др." : ""}</button>
      ${d.photos.length && navigator.canShare ? `<button class="btn" data-a="critPhoto" data-v="${id}">📷 Отправить фото (Поделиться)</button>` : ""}
      <button class="big" data-a="critDone">Доложено — продолжить</button>`;
  };

  /* --- выбор КТ для «Сообщить о дефекте» и «+ Замер» --- */
  V.pick = p => `<p>${p.why}</p>` + D.ORDER_C.map(c => `<button class="row" data-a="${p.act}" data-v="${c}"><span class="dot ${ktColor(c)}"></span>${esc(ktLabel(c))}</button>`).join("");

  /* --- светофор --- */
  function ktColor(c) {
    const od = S.defects.filter(d => d.kt === c && isOpen(d));
    if (od.some(d => d.cat === "Критический")) return "red";
    const hot = (D.MEAS[KT[c].type] || []).some(([pl, n]) => { const l = lastMeas(c, pl); return l && l.v > n; });
    if (od.length || hot) return "yel";
    if (S.shift && S.rounds.some(r => r.pts[c] && r.pts[c].res !== "skip")) return "grn";
    return "gry";
  }
  V.map = () => {
    const cnt = { red: 0, yel: 0, grn: 0, gry: 0 }; D.KT.forEach(k => cnt[ktColor(k.code)]++);
    return `<div class="legend"><span><i class="dot red"></i>Критич. ${cnt.red}</span><span><i class="dot yel"></i>Замечания ${cnt.yel}</span><span><i class="dot grn"></i>В норме ${cnt.grn}</span><span><i class="dot gry"></i>Не осмотрено ${cnt.gry}</span></div>
      ${MAPS.scheme ? "" : noMap("Технологическая схема")}<div class="scheme">${MAPS.scheme ? `<img src="${MAPS.scheme}" alt="Технологическая схема МДСЗ-8">` : `<div class="noscheme"></div>`}${D.KT.map(k => `<b class="pin ${ktColor(k.code)}" style="left:${k.xy[0]}%;top:${k.xy[1]}%" data-a="openKt" data-v="${k.code}">${k.n}</b>`).join("")}</div>
      <div class="hint">Нажмите на номер — карточка КТ. «Не осмотрено» — за текущую смену.</div>` +
      ["red", "yel"].map(col => D.KT.filter(k => ktColor(k.code) === col).map(k => `<button class="row" data-a="openKt" data-v="${k.code}"><span class="dot ${col}"></span>${esc(ktLabel(k.code))}</button>`).join("")).join("");
  };
  V.kt = c => {
    const k = KT[c], ds = S.defects.filter(d => d.kt === c).sort((a, b) => (isOpen(b) - isOpen(a)) || b.date - a.date).slice(0, 15);
    let h = `<div class="kthead"><small>${c} · ${esc(typeName(c))} · КТ ${k.n}</small><h2>${esc(k.name)}</h2></div>`;
    const ins = S.rounds.filter(r => r.pts[c]).map(r => `${hm(r.pts[c].t)} ${D.ROUTES[r.rkey].short} — ${short(r.fio)} (${r.pts[c].res === "ok" ? "норма" : r.pts[c].res === "skip" ? "пропуск" : "замечание"})`);
    h += `<div class="grp">Осмотры в эту смену</div>` + (ins.length ? ins.map(t => `<div>${esc(t)}</div>`).join("") : `<div class="muted">нет</div>`);
    const M = D.MEAS[k.type];
    if (M) h += `<div class="grp">Последние замеры</div>` + M.map(([pl, n]) => { const a = S.mhist[c + "|" + pl] || []; return `<div>${esc(pl)}: ${a.length ? a.slice(-4).map(x => `<span class="${x.v > n ? "red" : ""}">${x.v}</span>`).join(" → ") + ` °C <small>(норма ≤ ${n})</small>` : "—"}</div>`; }).join("");
    h += `<div class="grp">Дефекты</div>` + (ds.length ? ds.map(dcard).join("") : `<div class="muted">нет</div>`);
    if (S.shift && !isView()) h += `<button class="big warnb" data-a="reportAt" data-v="${c}">⚠ Сообщить о дефекте</button>`;
    return h;
  };

  /* --- дефекты --- */
  function dcard(d) {
    const over = isOpen(d) && d.due && d.due < ymd(Date.now());
    return `<div class="dcard c${catN(d.cat)}" data-a="openDef" data-v="${d.id}"><b>${esc(KT[d.kt].name)}</b> · ${esc(d.node)}<div>${esc(d.desc)}</div>
      <small>${d.id} · ${d.cat} · <b>${d.status}</b>${d.resp ? " · отв. " + esc(short(d.resp)) : ""}${d.due ? ` · <span class="${over ? "red" : ""}">срок ${dmy(ymdToMs(d.due))}</span>` : ""}${d.photos.length ? " · 📷" + d.photos.length : ""}</small></div>`;
  }
  V.defects = () => {
    const f = ui.dfilter || "open";
    const list = S.defects.filter(d => f === "open" ? isOpen(d) : f === "crit" ? isOpen(d) && d.cat === "Критический" : f === "shift" ? S.shift && d.date >= S.shift.opened : true)
      .sort((a, b) => catN(a.cat) - catN(b.cat) || a.date - b.date);
    return `<div class="tabs">${[["open", "Открытые"], ["crit", "Критич."], ["shift", "За смену"], ["all", "Все"]].map(([k, t]) => `<button class="${f === k ? "on" : ""}" data-a="dfilter" data-v="${k}">${t}</button>`).join("")}</div>` +
      (list.length ? list.map(dcard).join("") : `<p class="muted center">Нет дефектов</p>`);
  };
  V.dedit = id => {
    const d = S.defects.find(x => x.id === id), ro = !canEdit();
    let h = `<div class="kthead"><small>${d.id} · ${d.kt}</small><h2>${esc(KT[d.kt].name)}</h2></div>
      <div class="dcard c${catN(d.cat)}"><b>${esc(d.node)}</b><div>${esc(d.desc)}</div><small>${d.cat} · выявил ${esc(short(d.who))} (${d.post}) ${dmyhm(d.date)} · ${esc(d.route)}</small></div>
      <div class="thumbs" id="dPh"></div>`;
    if (ro) return h + `<div class="grp">Статус</div><div>${d.status}${d.resp ? ", ответственный " + esc(short(d.resp)) : ""}${d.due ? ", срок " + dmy(ymdToMs(d.due)) : ""}</div>${d.note ? `<div>Примечание: ${esc(d.note)}</div>` : ""}`;
    const staff = S.cfg.staff.filter(s => s.role !== "Заместитель начальника ПК");
    const inList = !d.resp || staff.some(s => s.fio === d.resp);
    h += (d.status === "Открыт" ? `<button class="big go" data-a="takeDef" data-v="${id}">Взять в работу (ответственный — я)</button>` : "") + `
      <label>Ответственный<select id="eResp"><option value="">— не назначен —</option>${staff.map(s => `<option value="${esc(s.fio)}" ${d.resp === s.fio ? "selected" : ""}>${esc(short(s.fio))} — ${s.role}</option>`).join("")}${inList ? "" : `<option selected>${esc(d.resp)}</option>`}</select></label>
      <label>Срок устранения<input type="date" id="eDue" value="${d.due || ""}"></label>
      <label>Статус<select id="eSt">${D.STATUSES.map(s => `<option ${d.status === s ? "selected" : ""}>${s}</option>`).join("")}</select></label>
      <label>Категория<select id="eCat">${D.CATS.map(([s]) => `<option ${d.cat === s ? "selected" : ""}>${s}</option>`).join("")}</select></label>
      <label>Примечание<textarea id="eNote" rows="2">${esc(d.note || "")}</textarea></label>
      <div class="hint">При статусе «Устранён» устранившим запишется ${esc(short(me().fio))}, дата — сегодня.</div>
      <button class="big go" data-a="saveDef" data-v="${id}">Сохранить</button>`;
    return h;
  };
  AFTER.dedit = async id => {
    const d = S.defects.find(x => x.id === id), box = $("#dPh");
    for (const n of d.photos) { const b = await IDB.get(n).catch(() => null); if (b && box) box.insertAdjacentHTML("beforeend", `<span class="th"><img src="${URL.createObjectURL(b)}"></span>`); }
  };

  /* --- смена: план / факт --- */
  V.shift = () => {
    if (!S.shift) return `<p class="muted">Смена не открыта.</p>`;
    const pl = S.cfg.plan[S.shift.kind] || [];
    let h = shiftBar() + `<table class="tbl"><tr><th>Маршрут</th><th>Кто</th><th>План</th><th>Факт</th></tr>` + pl.map(([rk, rl, n]) => {
      const f = S.rounds.filter(r => r.end && r.rkey === rk && r.role === rl).length;
      return `<tr class="${f >= n ? "okr" : "badr"}"><td>${D.ROUTES[rk].label}</td><td>${rl}</td><td>${n}</td><td>${f}</td></tr>`;
    }).join("") + `</table>`;
    h += `<div class="grp">Обходы смены</div>` + (S.rounds.length ? S.rounds.map(r => `<div class="rrow ${r.end ? "" : "run"}"><b>${hm(r.start)}${r.end ? "–" + hm(r.end) : " (идёт)"} ${esc(r.route)}</b><small>${esc(short(r.fio))} · ${r.role} · ${r.end ? Math.round((r.end - r.start) / 60000) + " / " + r.norm + " мин" : mins(r.start) + " мин"} · ${done(r)}/${r.list.length} КТ${Object.values(r.pts).filter(p => p.res === "skip").length ? " · пропуск " + Object.values(r.pts).filter(p => p.res === "skip").length : ""}${r.pult ? " · у пульта " + esc(short(r.pult)) : ""}</small></div>`).join("") : `<div class="muted">пока нет</div>`);
    h += `<div class="grp">Кто у пульта</div>` + (S.shift.pultLog.length ? S.shift.pultLog.map(x => `<div>${hm(x.ts)} — ${esc(short(x.fio))}</div>`).join("") : `<div class="muted">не указано</div>`);
    if (!isView()) h += `<button class="btn" data-a="pultForm">Сменить у пульта</button>`;
    return h;
  };

  /* --- замеры --- */
  V.meas = () => {
    let h = role() === "Механик" || role() === "Мастер смены" ? `<button class="big" data-a="measAdd">+ Внести замер</button>` : "";
    const rows = [];
    D.KT.forEach(k => (D.MEAS[k.type] || []).forEach(([pl, n]) => { const a = S.mhist[k.code + "|" + pl] || []; if (a.length) rows.push({ k, pl, n, a }); }));
    rows.sort((x, y) => (y.a[y.a.length - 1].v - y.n) - (x.a[x.a.length - 1].v - x.n));
    h += rows.length ? `<table class="tbl"><tr><th>КТ / место</th><th>Посл.</th><th>Норма</th><th>Тренд</th></tr>` + rows.map(({ k, pl, n, a }) => { const l = a[a.length - 1]; return `<tr class="${l.v > n ? "badr" : ""}"><td>${k.n}. ${esc(k.name)}<small>${esc(pl)} · ${dmyhm(l.ts)}</small></td><td><b>${l.v}</b></td><td>≤${n}</td><td>${a.slice(-4).map(x => x.v).join("→")}</td></tr>`; }).join("") + `</table>` : `<p class="muted center">Замеров пока нет</p>`;
    return h;
  };

  /* --- закрытие смены --- */
  V.close = () => {
    if (!S.shift) return `<p class="muted">Смена не открыта.</p><button class="btn" data-a="go" data-v="archive">Архив отправленных отчётов</button>`;
    const pl = S.cfg.plan[S.shift.kind] || [], run = S.rounds.filter(r => !r.end);
    const nd = S.defects.filter(d => d.date >= S.shift.opened), crit = nd.filter(d => d.cat === "Критический").length;
    const miss = pl.filter(([rk, rl, n]) => S.rounds.filter(r => r.end && r.rkey === rk && r.role === rl).length < n);
    const hot = S.meas.filter(m => m.v > m.n).length;
    let h = shiftBar() + `<div class="sum"><div><b>${S.rounds.filter(r => r.end).length}</b>обходов</div><div><b>${nd.length}</b>новых дефектов</div><div class="${crit ? "red" : ""}"><b>${crit}</b>КРИТ</div><div><b>${S.meas.length}</b>замеров${hot ? `, вне нормы ${hot}` : ""}</div></div>`;
    if (run.length) h += `<div class="note warn">Не завершены обходы: ${run.map(r => esc(r.route) + " (" + esc(short(r.fio)) + ")").join(", ")}. Они будут завершены автоматически, неосмотренные КТ — «пропуск: смена закрыта».</div>`;
    if (miss.length) h += `<div class="note warn">Не выполнен план: ${miss.map(([rk, rl, n]) => `${D.ROUTES[rk].label} (${rl}) — ${S.rounds.filter(r => r.end && r.rkey === rk && r.role === rl).length} из ${n}`).join("; ")}</div>`;
    h += `<p>Будет сформирован файл <b>${fileName()}</b> (листы «Дефекты», «Обходы», «Замеры») и фото дефектов. Смена закроется, отчёт останется в архиве.</p>
      <button class="big send" data-a="closeShift">Сформировать отчёт и закрыть смену</button>
      <button class="btn" data-a="go" data-v="archive">Архив отправленных отчётов</button>`;
    return h;
  };
  const fileName = (sh = S.shift) => `МДСЗ8_${sh.date}_С${sh.no}_${kindShort(sh.kind)}.xlsx`;

  V.send = i => {
    const a = S.archive[i];
    return `<div class="note ${a.sent ? "ok" : ""}">${a.sent ? "✓ Отмечено как отправленное " + dmyhm(a.sent) : "Отчёт сформирован. Осталось отправить письмо."}</div>
      <div class="step"><b>1</b><div>Скачайте файлы на телефон.<small>${esc(a.file)}${a.photos.length ? " и фото: " + a.photos.length + " шт." : ""} Если телефон спросит «Разрешить скачивание нескольких файлов» — разрешите.</small><button class="big" data-a="download" data-v="${i}">⬇ Скачать отчёт${a.photos.length ? " и фото" : ""}</button></div></div>
      <div class="step"><b>2</b><div>Откройте письмо — адрес, тема и текст подставятся сами.<small>Кому: ${esc(emails().join(", "))}</small><button class="big" data-a="mail" data-v="${i}">✉ Открыть письмо</button></div></div>
      <div class="step"><b>3</b><div>В письме нажмите 📎 «Прикрепить» → «Загрузки» и выберите файл <b>${esc(a.file)}</b>${a.photos.length ? " и фото" : ""}. Нажмите «Отправить».</div></div>
      <div class="step"><b>4</b><div><button class="big go" data-a="markSent" data-v="${i}">✓ Письмо отправлено</button></div></div>
      <details><summary>Если письмо не открылось</summary><p>Скопируйте и вставьте вручную:</p>
        <button class="btn" data-a="copy" data-v="${esc(emails().join(", "))}">Копировать адрес</button><button class="btn" data-a="copy" data-v="${esc(a.subject)}">Копировать тему</button><button class="btn" data-a="copyBody" data-v="${i}">Копировать текст письма</button></details>
      <div class="grp">Тема письма</div><div class="mono">${esc(a.subject)}</div><div class="grp">Текст</div><pre class="mono">${esc(a.body)}</pre>`;
  };
  V.archive = () => S.archive.length ? S.archive.map((a, i) => ({ a, i })).reverse().map(({ a, i }) => `<button class="row" data-a="go" data-v="send" data-i="${i}">${a.sent ? "✓" : "⏳"} ${esc(a.file)}<small>${a.sent ? "отправлен " + dmyhm(a.sent) : "не отправлен"}</small></button>`).join("") : `<p class="muted center">Отчётов пока нет</p>`;

  /* --- настройки --- */
  function staffList() {
    return `<div class="grp">Персонал</div>
    <div class="hint">Нажмите на работника, чтобы изменить ФИО, должность или задать новый ПИН. ПИН нигде не показывается — его можно только заменить.</div>
    ${Object.keys(D.ROLES).map(r => S.cfg.staff.filter(s => s.role === r).map(s => `<button class="row" data-a="staffEdit" data-v="${s.id}"><span style="flex:1">${esc(s.fio)}${s.admin ? " 🛡" : ""}</span><small>${r} · ${s.ph ? "ПИН задан" : "<b class=red>ПИН не задан</b>"}</small></button>`).join("")).join("")}
    <button class="btn" data-a="staffEdit" data-v="">+ Добавить работника</button>
    <div class="hint">🛡 — ответственный: ведёт персонал и ПИН. Назначает ответственных только администратор.</div>`;
  }
  V.settings = () => {
    if (isResp()) return staffList();
    if (!isSuper()) return `<p class="muted">Нет доступа.</p>`;
    const rn = ["P", "PE", "C", "CE", "R"].map(k => [k, D.ROUTES[k].label + ", мин на маршрут", D.ROUTES[k].norm]).concat(["RA", "V"].map(k => [k, D.ROUTES[k].label + ", мин на 1 КТ", D.ROUTES[k].normPer]));
    return staffList() + `
    <div class="grp">Почта для отчётов</div><input id="cfgMail" value="${esc(emails().join(", "))}" placeholder="адрес@почта.ru"><div class="hint">Можно несколько адресов через запятую.</div>
    <div class="grp">План обходов на смену</div>
    ${["Технологическая", "Ремонтная"].map(k => `<div class="muted">${k}</div>` + (S.cfg.plan[k] || []).map(([rk, rl, n], j) => `<div class="planrow">${D.ROUTES[rk].label} · ${rl}<input class="pn" data-k="${k}" data-j="${j}" value="${n}" inputmode="numeric"></div>`).join("")).join("")}
    <div class="grp">Нормативы времени обхода</div>
    ${rn.map(([k, t, v]) => `<div class="planrow">${t}<input class="rn" data-k="${k}" value="${v}" inputmode="numeric"></div>`).join("")}
    <div class="grp">Нормы температур (пирометр), °C не более</div>
    ${Object.keys(D.MEAS).map(t => D.MEAS[t].map(([pl, n]) => `<div class="planrow">${esc(D.TYPES[t][0])}: ${esc(pl)}<input class="tn" data-k="${t}|${esc(pl)}" value="${n}" inputmode="numeric"></div>`).join("")).join("")}
    <div class="grp">QR-метки</div><label class="chk"><input type="checkbox" id="cfgQR" ${S.cfg.requireQR ? "checked" : ""}> Отмечать точку обхода только после сканирования QR-метки</label>
    <div class="grp">Автовыход</div><div class="planrow">Выходить из учётной записи через, часов<input id="cfgSess" value="${S.cfg.sessionH || 13}" inputmode="numeric"></div>
    <button class="big go" data-a="saveSettings">Сохранить настройки</button>
    <div class="grp">Схема и карты маршрутов</div>
    <div class="hint">Хранятся только на этом телефоне, на сайт не выкладываются. Список ниже только показывает, что загружено. Чтобы загрузить: перенесите файл «МДСЗ8_схемы.json» в память телефона (папка «Загрузки») и нажмите кнопку под списком.</div>
    ${Object.entries(MAP_KEYS).map(([k, t]) => `<div class="planrow">${t}<b class="${MAPS[k] ? "" : "red"}">${MAPS[k] ? "✓ есть" : "— нет"}</b></div>`).join("")}
    <label class="btn center" style="font-weight:400">⬆ Загрузить файл схем (.json)<input type="file" id="mapsImport" hidden></label>
    <div class="grp">Перенос настроек на другой телефон</div>
    <div class="hint">Файл содержит персонал (ПИН — в зашифрованном виде), почту, план, нормы, схему и карты маршрутов. Обходы и дефекты не переносятся. Это внутренний файл — не выкладывайте его в интернет.</div>
    <button class="btn" data-a="cfgExport">⬇ Сохранить настройки в файл</button>
    <label class="btn center" style="font-weight:400">⬆ Загрузить настройки из файла<input type="file" id="cfgImport" hidden></label>
    <div class="grp">Администратор</div>
    <button class="btn" data-a="myPin">🔑 Сменить ПИН администратора</button>
    <button class="btn" data-a="resetAll">Стереть все данные на телефоне</button>
    <p class="muted">Версия ${APPV}. Если ПИН администратора забыт, восстановить его нельзя — только сбросить данные сайта в Chrome (сотрёт всё). Храните файл настроек.</p>`;
  };
  AFTER.settings = () => {
    const mi = $("#mapsImport");
    if (mi) mi.addEventListener("change", async e => {
      const file = e.target.files[0]; if (!file) return;
      try { const j = JSON.parse(await file.text()); if (j.type !== "mdsz8-maps" && j.type !== "mdsz8-settings") throw new Error();
        const n = await importMaps(j.maps); toast(n ? `Загружено картинок: ${n}` : "В файле нет схем"); render(); } catch (er) { toast("Это не файл схем МДСЗ-8"); }
    });
    const f = $("#cfgImport"); if (!f) return;
    f.addEventListener("change", async e => {
      const file = e.target.files[0]; if (!file) return;
      try {
        const j = JSON.parse(await file.text());
        if (j.type !== "mdsz8-settings" || !j.cfg || !Array.isArray(j.cfg.staff) || !j.cfg.admin) throw new Error();
        if (!confirm(`Загрузить настройки из файла (${j.cfg.staff.length} работников)? Текущий персонал, почта и нормы будут заменены, ПИН администратора — из файла.`)) return;
        S.cfg = j.cfg; applyCfg(); save(); await importMaps(j.maps); toast("Настройки загружены"); A.logout();
      } catch (er) { toast("Это не файл настроек МДСЗ-8"); }
    });
  };

  /* ---------- действия ---------- */
  const A = {};
  document.addEventListener("click", e => {
    const el = e.target.closest("[data-a]"); if (!el || el.disabled) return;
    const f = A[el.dataset.a]; if (f) { e.preventDefault(); f(el.dataset.v, el); }
  });
  A.go = (v, el) => go(v, el.dataset.i != null ? +el.dataset.i : null);
  A.closeModal = closeModal;
  A.zoom = src => modal(`<div class="zoom"><img src="${src}"></div><button class="btn" data-a="closeModal">Закрыть</button>`);

  A.pickUser = id => {
    const s = id === "admin" ? { id: "admin", fio: "Администратор", role: ADMIN_ROLE, ph: S.cfg.admin.ph } : S.cfg.staff.find(x => x.id === id); let pin = "", busy = false;
    const lockLeft = () => Math.ceil(((S.lock || {})[id] || 0) - Date.now()) / 1000;
    const draw = (msg) => modal(`<h3>${esc(short(s.fio))}</h3><div class="pinv">${"●".repeat(pin.length) || (msg || "Введите ПИН")}</div><div class="kp">${[1, 2, 3, 4, 5, 6, 7, 8, 9, "⌫", 0, "OK"].map(k => `<button data-a="kp" data-v="${k}">${k}</button>`).join("")}</div>`);
    const enter = () => { closeModal(); (S.fails || {})[id] = 0; S.session = { id, ts: Date.now() }; save(); if (!S.shift && D.ROLES[s.role] && !D.ROLES[s.role].view) { stack = []; cur = { v: "home" }; go("openShift"); } else { home(); if (ui.pendingKt) { const k = ui.pendingKt; ui.pendingKt = null; handleKt(k); } } };
    A.kp = async k => {
      if (busy) return;
      if (lockLeft() > 0) { pin = ""; return draw(`Вход заблокирован на ${Math.ceil(lockLeft())} с`); }
      if (k === "⌫") pin = pin.slice(0, -1);
      else if (k === "OK") {
        busy = true; const ok = s.ph && (await pinHash(id, pin)) === s.ph; busy = false;
        if (ok) return enter();
        S.fails = S.fails || {}; S.fails[id] = (S.fails[id] || 0) + 1; pin = "";
        if (S.fails[id] >= 5) { S.lock = S.lock || {}; S.lock[id] = Date.now() + 60000; S.fails[id] = 0; save(); return draw("5 ошибок — пауза 1 мин"); }
        save(); toast(`Неверный ПИН (попытка ${S.fails[id]} из 5)`);
      } else if (pin.length < 6) pin += k;
      draw();
      if (pin.length >= 4 && s.ph) { busy = true; const ok = (await pinHash(id, pin)) === s.ph; busy = false; if (ok) enter(); }
    };
    draw(s.ph ? "" : "ПИН не задан — обратитесь к ответственному");
  };
  A.logout = () => { S.session = null; save(); home(); };
  A.openShiftForm = () => go("openShift");
  A.openShift = () => {
    const date = $("#shDate").value, no = $("#shNo").value, kind = $("#shKind").value;
    if (!date) return toast("Укажите дату");
    const sh = { date, no, kind };
    if (S.archive.some(a => a.file === fileName(sh))) { if (!confirm(`Отчёт ${fileName(sh)} уже был сформирован. Открыть смену с этими данными ещё раз? Новый файл заменит старый в сводном журнале.`)) return; }
    S.shift = { ...sh, opened: Date.now(), by: me().fio, cO: 0, cT: 0, pultLog: [] }; S.rounds = []; S.meas = [];
    save(); toast("Смена открыта"); home();
  };

  A.homeBtn = b => {
    if (D.ROUTES[b]) return go("start", { rkey: b });
    if (b === "report") return go("pick", { act: "reportAt", why: "Выберите оборудование, на котором замечание:" });
    if (b === "close") return go("close");
    go(b);
  };

  A.startRound = rkey => {
    const R = D.ROUTES[rkey], u = me();
    let list = R.list ? R.list.slice() : null, label = R.label, norm = R.norm;
    if (rkey === "P") { const part = (document.querySelector("input[name=part]:checked") || {}).value || "ALL"; if (part !== "ALL") { list = D.P_PARTS[part].slice(); norm = Math.round(R.norm * list.length / D.ORDER_P.length); } }
    if (!list) { list = [...document.querySelectorAll("input[name=kts]:checked")].map(x => x.value); if (!list.length) return toast("Отметьте хотя бы одну КТ"); norm = list.length * R.normPer; }
    let pult = "";
    if (R.pult) {
      const sel = document.querySelector("input[name=pult]:checked");
      pult = sel ? (sel.value === "__other" ? $("#pultOther").value.trim() : sel.value) : "";
      if (!pult) return toast("Укажите, кто остаётся у пульта");
      const last = S.shift.pultLog[S.shift.pultLog.length - 1];
      if (!last || last.fio !== pult) S.shift.pultLog.push({ ts: Date.now(), fio: pult, by: u.fio });
    }
    const r = { id: `${shiftPrefix()}-O${p2(++S.shift.cO)}`, rkey, route: label, uid: u.id, fio: u.fio, role: u.role, start: Date.now(), end: null, norm, list, pts: {}, pult };
    S.rounds.push(r); save(); ui.tmp = {};
    stack = []; cur = { v: "home" }; go("round", r.id);
  };
  A.openRound = id => { if (cur.v === "point") { if (stack.length && stack[stack.length - 1].v === "round") stack.pop(); cur = { v: "round", p: id }; render(); window.scrollTo(0, 0); } else go("round", id); };
  A.openPoint = kt => { const r = activeRoundFromCur(); if (!r) return; go("point", { rid: r.id, kt }); };
  function activeRoundFromCur() { const id = cur.v === "round" ? cur.p : cur.p && cur.p.rid; return S.rounds.find(r => r.id === id); }

  function collectMeas(rid, kt) {
    const r = S.rounds.find(x => x.id === rid), out = [];
    document.querySelectorAll(".meas input").forEach(inp => { const v = num(inp.value); if (v != null) out.push({ pl: inp.dataset.pl, n: +inp.dataset.n, v }); });
    out.forEach(m => {
      const ex = S.meas.find(x => x.rid === rid && x.kt === kt && x.pl === m.pl);
      if (ex) { ex.v = m.v; ex.ts = Date.now(); const h = S.mhist[kt + "|" + m.pl]; if (h && h.length) h[h.length - 1] = { v: m.v, ts: ex.ts }; return; }
      const rec = { id: `${shiftPrefix()}-T${p2(++S.shift.cT)}`, ts: Date.now(), kt, pl: m.pl, v: m.v, n: m.n, fio: r.fio, rid };
      S.meas.push(rec); const k = kt + "|" + m.pl; (S.mhist[k] = S.mhist[k] || []).push({ v: m.v, ts: rec.ts }); if (S.mhist[k].length > 20) S.mhist[k].shift();
    });
    return out;
  }
  const needQR = (r, kt) => { if (S.cfg.requireQR && !(r.qr || {})[kt]) { toast("Сначала отсканируйте QR-метку на оборудовании"); return true; } return false; };
  A.pointOk = () => {
    const { rid, kt } = cur.p, r = S.rounds.find(x => x.id === rid);
    if (needQR(r, kt)) return;
    const inputs = [...document.querySelectorAll(".meas input")];
    if (inputs.some(i => num(i.value) == null) && !ui.okNoMeas) {
      ui.okNoMeas = true; return toast("Не все замеры введены. Нажмите «Всё в норме» ещё раз, чтобы продолжить без них.");
    }
    ui.okNoMeas = false;
    const hi = inputs.filter(i => num(i.value) != null && num(i.value) > +i.dataset.n);
    if (hi.length && !ui.okHot) { ui.okHot = true; return toast("Есть температура выше нормы — оформите замечание или нажмите «Всё в норме» ещё раз."); }
    ui.okHot = false;
    collectMeas(rid, kt);
    r.pts[kt] = { t: Date.now(), res: "ok" }; save(); nextPoint(r, kt);
  };
  function nextPoint(r, kt) {
    const nx = r.list.find(c => !r.pts[c]);
    delete ui.tmp[kt];
    if (nx) { cur = { v: "point", p: { rid: r.id, kt: nx } }; render(); window.scrollTo(0, 0); }
    else { cur = { v: "round", p: r.id }; render(); toast("Все точки пройдены — завершите обход"); }
  }
  A.pointNext = () => { const { rid, kt } = cur.p; nextPoint(S.rounds.find(x => x.id === rid), kt); };
  A.pointSkip = () => modal(`<h3>Причина пропуска</h3>${D.SKIP.map(s => `<button class="row" data-a="doSkip" data-v="${s}">${s}</button>`).join("")}<input id="skipOther" placeholder="или впишите свою причину"><button class="btn" data-a="doSkip" data-v="__other">Пропустить</button>`);
  A.doSkip = v => {
    const reason = v === "__other" || v === "Другое" ? ($("#skipOther").value.trim()) : v;
    if (!reason) return toast("Впишите причину");
    const { rid, kt } = cur.p, r = S.rounds.find(x => x.id === rid);
    closeModal(); r.pts[kt] = { t: Date.now(), res: "skip", reason }; save(); nextPoint(r, kt);
  };
  A.pointDefect = (v, el, pre) => {
    const { rid, kt } = cur.p, r = S.rounds.find(x => x.id === rid);
    if (needQR(r, kt)) return;
    collectMeas(rid, kt); save();
    ui.form = { node: "", def: "", txt: "", cat: "", fix: false, photos: [], ...(pre || {}) };
    go("defect", { kt, rid, route: r.route });
  };
  A.hotDefect = pl => {
    closeModal();
    const inp = [...document.querySelectorAll(".meas input")].find(i => i.dataset.pl === pl), kt = cur.p.kt, t = KT[kt].type;
    const hk = D.HOT[t + ":" + pl] || D.HOT[t] || ["Прочее", "Другое (описать)"];
    A.pointDefect(null, null, { node: hk[0], def: hk[1], txt: `${pl}: t = ${num(inp.value)} °C при норме ≤ ${inp.dataset.n} °C`, cat: "Значительный" });
  };
  A.reportAt = kt => {
    if (!S.shift) return toast("Смена не открыта");
    ui.form = { node: "", def: "", txt: "", cat: "", fix: false, photos: [] };
    go("defect", { kt, rid: null, route: D.ROUTES.V.label });
  };
  A.setCat = c => { ui.form.cat = c; document.querySelectorAll(".cat").forEach(b => b.classList.toggle("on", b.dataset.v === c)); };
  A.delPhoto = i => { ui.form.photos.splice(+i, 1); render(); };
  A.saveDefect = async () => {
    const f = ui.form, c = cur.p, u = me();
    f.node = $("#fNode").value; f.def = $("#fDef").value; f.txt = $("#fTxt").value.trim(); f.fix = $("#fFix").checked;
    if (!f.node) return toast("Выберите узел");
    if (!f.def) return toast("Выберите типовой дефект");
    if (/Другое/.test(f.def) && !f.txt) return toast("Опишите дефект в поле «Уточнение»");
    if (!f.cat) return toast("Выберите категорию");
    const now = Date.now(), num3 = p3(++S.cD), id = `${shiftPrefix()}-D${num3}`;
    const d0 = new Date(now), stamp = `${ymd(now).replace(/-/g, "")}_${p2(d0.getHours())}${p2(d0.getMinutes())}`;
    const photos = [];
    for (let i = 0; i < f.photos.length; i++) { const n = `${c.kt}_${stamp}_D${num3}${i ? "_" + (i + 1) : ""}.jpg`; await IDB.put(n, f.photos[i].blob); photos.push(n); }
    const cat = D.CATS.find(x => x[0] === f.cat);
    const d = { id, date: now, shiftNo: S.shift.no, kind: S.shift.kind, route: c.route, kt: c.kt, node: f.node, desc: f.def + (f.txt ? ": " + f.txt : ""), cat: f.cat, photos,
      who: u.fio, post: u.role, resp: f.fix ? u.fio : "", due: addDays(now, cat[1]), status: f.fix ? "Устранён" : "Открыт", fixed: f.fix ? now : null, fixer: f.fix ? u.fio : "", note: f.fix ? "Устранено на месте" : "", changed: now, rid: c.rid };
    S.defects.push(d);
    if (c.rid) { const r = S.rounds.find(x => x.id === c.rid); const p = r.pts[c.kt] && r.pts[c.kt].res === "def" ? r.pts[c.kt] : (r.pts[c.kt] = { t: now, res: "def", defs: [] }); p.defs.push(id); }
    save(); f.photos.forEach(p => URL.revokeObjectURL(p.url)); ui.form = null;
    if (d.cat === "Критический" && !f.fix) { cur = { v: "crit", p: id }; render(); window.scrollTo(0, 0); return; }
    toast("Замечание сохранено: " + id);
    afterDefect(c);
  };
  function afterDefect(c) { if (c.rid) { stack.pop(); cur = { v: "point", p: { rid: c.rid, kt: c.kt } }; render(); window.scrollTo(0, 0); } else home(); }
  A.critMail = id => {
    const d = S.defects.find(x => x.id === id);
    const subj = `[МДСЗ-8][КРИТ][${KT[d.kt].name}][${dmyhm(d.date)}]`;
    const body = [`КРИТИЧЕСКИЙ ДЕФЕКТ — МДСЗ-8`, `Оборудование: ${KT[d.kt].name} (${d.kt})`, `Узел: ${d.node}`, `Дефект: ${d.desc}`, `Выявил: ${short(d.who)}, ${d.post}`, `Время: ${dmyhm(d.date)}, смена ${d.shiftNo} (${d.kind})`, `ID: ${d.id}`, d.photos.length ? `Фото: ${d.photos.join(", ")}` : "", ``, `Оборудование остановлено, мастер смены извещён.`].filter(x => x !== "").join("\r\n");
    location.href = `mailto:${emails().join(",")}?subject=${encodeURIComponent(subj)}&body=${encodeURIComponent(body)}`;
  };
  A.critPhoto = async id => {
    const d = S.defects.find(x => x.id === id), files = [];
    for (const n of d.photos) { const b = await IDB.get(n); if (b) files.push(new File([b], n, { type: "image/jpeg" })); }
    try { await navigator.share({ files, title: `КРИТ ${KT[d.kt].name}`, text: `${d.id}: ${d.desc}` }); } catch (e) { }
  };
  A.critDone = () => { const d = S.defects.find(x => x.id === cur.p); afterDefect({ rid: d.rid, kt: d.kt }); };

  A.finishRound = id => {
    const r = S.rounds.find(x => x.id === id), left = r.list.filter(c => !r.pts[c]);
    if (left.length) return modal(`<h3>Не осмотрено КТ: ${left.length}</h3><p>Завершить обход можно только с причиной пропуска.</p>${D.SKIP.map(s => `<button class="row" data-a="finishSkip" data-v="${s}">${s}</button>`).join("")}<input id="skipOther" placeholder="или впишите свою причину"><button class="btn" data-a="finishSkip" data-v="__other">Завершить</button><button class="btn" data-a="closeModal">Вернуться к обходу</button>`);
    endRound(r);
  };
  A.finishSkip = v => {
    const reason = v === "__other" || v === "Другое" ? $("#skipOther").value.trim() : v; if (!reason) return toast("Впишите причину");
    const r = activeRoundFromCur(); closeModal();
    r.list.forEach(c => { if (!r.pts[c]) r.pts[c] = { t: Date.now(), res: "skip", reason }; }); endRound(r);
  };
  function endRound(r) {
    r.end = Date.now(); save();
    const m = Math.round((r.end - r.start) / 60000), nd = S.defects.filter(d => d.rid === r.id).length;
    home(); toast(`Обход завершён: ${m} мин (норматив ${r.norm}), замечаний ${nd}`);
  }

  A.openKt = c => go("kt", c);
  A.openDef = id => go("dedit", id);
  A.dfilter = f => { ui.dfilter = f; render(); };
  A.takeDef = id => { const d = S.defects.find(x => x.id === id); d.status = "В работе"; d.resp = me().fio; d.changed = Date.now(); save(); toast("Взято в работу"); back(); };
  A.saveDef = id => {
    const d = S.defects.find(x => x.id === id), st = $("#eSt").value;
    d.resp = $("#eResp").value; d.due = $("#eDue").value; d.cat = $("#eCat").value; d.note = $("#eNote").value.trim();
    if (st === "Устранён" && d.status !== "Устранён") { d.fixed = Date.now(); d.fixer = me().fio; }
    if (st !== "Устранён") { d.fixed = null; d.fixer = ""; }
    d.status = st; d.changed = Date.now(); save(); toast("Сохранено"); back();
  };
  A.pultForm = () => {
    const cand = S.cfg.staff.filter(s => ["Дробильщик", "Мастер смены", "Электрослесарь"].includes(s.role));
    modal(`<h3>Кто сейчас у пульта?</h3>${cand.map(s => `<button class="row" data-a="setPult" data-v="${esc(s.fio)}">${esc(short(s.fio))} <small>${s.role}</small></button>`).join("")}`);
  };
  A.setPult = fio => { S.shift.pultLog.push({ ts: Date.now(), fio, by: me().fio }); save(); closeModal(); render(); };
  A.measAdd = () => go("pick", { act: "measAt", why: "Где выполнен замер?" });
  A.measAt = kt => {
    const M = D.MEAS[KT[kt].type]; if (!M) return toast("Для этой КТ замеры не предусмотрены");
    modal(`<h3>${esc(KT[kt].name)}</h3>${M.map(([pl, n], i) => `<label>${esc(pl)} <small>≤ ${n} °C</small><input inputmode="decimal" class="ma" data-pl="${esc(pl)}" data-n="${n}"></label>`).join("")}<button class="big go" data-a="measSave" data-v="${kt}">Сохранить</button>`);
  };
  A.measSave = kt => {
    if (!S.shift) return toast("Смена не открыта");
    document.querySelectorAll(".ma").forEach(inp => {
      const v = num(inp.value); if (v == null) return;
      const rec = { id: `${shiftPrefix()}-T${p2(++S.shift.cT)}`, ts: Date.now(), kt, pl: inp.dataset.pl, v, n: +inp.dataset.n, fio: me().fio, rid: null };
      S.meas.push(rec); const k = kt + "|" + rec.pl; (S.mhist[k] = S.mhist[k] || []).push({ v, ts: rec.ts });
      if (v > rec.n) toast(`${rec.pl}: ${v} °C выше нормы — заведите замечание через «Сообщить о дефекте»`);
    });
    save(); closeModal(); stack.pop(); cur = { v: "meas" }; render();
  };

  /* --- отчёт смены --- */
  const DT = (ms, f) => ms ? { d: ms, f } : "";
  A.closeShift = () => {
    if (!confirm("Сформировать отчёт и закрыть смену? После этого записи смены изменить будет нельзя.")) return;
    const sh = S.shift, u = me(), now = Date.now(), shMs = ymdToMs(sh.date);
    S.rounds.filter(r => !r.end).forEach(r => { r.list.forEach(c => { if (!r.pts[c]) r.pts[c] = { t: now, res: "skip", reason: "Смена закрыта" }; }); r.end = now; });
    const defs = S.defects.filter(d => isOpen(d) || d.changed >= sh.opened || d.date >= sh.opened);
    const DEF = [["ID дефекта", "Дата выявления", "Смена", "Вид смены", "Маршрут", "Код КТ", "Оборудование", "Тип оборудования", "Узел", "Описание дефекта", "Категория", "Фото", "Выявил", "Должность", "Ответственный", "Срок устранения", "Статус", "Дата устранения", "Устранил", "Примечание", "Дата изменения"]]
      .concat(defs.map(d => [d.id, DT(d.date, "d"), d.shiftNo, d.kind, d.route, d.kt, KT[d.kt].name, typeName(d.kt), d.node, d.desc, d.cat, d.photos.join("; "), d.who, d.post, d.resp, d.due ? DT(ymdToMs(d.due), "d") : "", d.status, DT(d.fixed, "d"), d.fixer, d.note, DT(d.changed, "dt")]));
    const OBH = [["ID обхода", "Дата", "Смена", "Вид смены", "Маршрут", "ФИО", "Роль", "Начало", "Окончание", "Минут", "Норматив, мин", "Точек план", "Точек факт", "Пропущено", "У пульта"]]
      .concat(S.rounds.map(r => { const sk = Object.values(r.pts).filter(p => p.res === "skip").length; return [r.id, DT(shMs, "d"), sh.no, sh.kind, r.route, r.fio, r.role, DT(r.start, "dt"), DT(r.end, "dt"), Math.round((r.end - r.start) / 60000), r.norm, r.list.length, r.list.length - sk, sk, r.pult]; }));
    const ZAM = [["ID замера", "Дата и время", "Код КТ", "Оборудование", "Место замера", "t, °C", "Норма, °C", "Вне нормы", "ФИО"]]
      .concat(S.meas.map(m => [m.id, DT(m.ts, "dt"), m.kt, KT[m.kt].name, m.pl, m.v, m.n, m.v > m.n ? "Да" : "Нет", m.fio]));
    const PTS = [["ID обхода", "Маршрут", "ФИО", "№", "Код КТ", "Оборудование", "Время", "Результат", "Причина пропуска", "ID дефектов", "Метка QR"]];
    S.rounds.forEach(r => r.list.forEach((c, i) => { const p = r.pts[c] || {}; PTS.push([r.id, r.route, r.fio, i + 1, c, KT[c].name, DT(p.t, "dt"), p.res === "ok" ? "Норма" : p.res === "def" ? "Замечание" : "Пропуск", p.reason || "", (p.defs || []).join("; "), (r.qr || {})[c] ? "Да" : "Нет"]); }));
    const sheets = [
      { name: "Дефекты", cols: [22, 12, 7, 15, 16, 11, 30, 18, 24, 34, 14, 30, 20, 16, 20, 12, 14, 12, 20, 26, 16], rows: DEF },
      { name: "Обходы", cols: [22, 12, 7, 15, 16, 20, 16, 16, 16, 8, 10, 9, 9, 10, 20], rows: OBH },
      { name: "Замеры", cols: [22, 16, 11, 30, 26, 8, 9, 9, 20], rows: ZAM },
      { name: "Точки обхода", cols: [22, 16, 20, 5, 11, 30, 16, 11, 26, 24, 10], rows: PTS },
    ];
    const nd = S.defects.filter(d => d.date >= sh.opened), crit = nd.filter(d => d.cat === "Критический").length;
    const openAll = S.defects.filter(isOpen), openCrit = openAll.filter(d => d.cat === "Критический").length;
    const subject = `[МДСЗ-8][${dmy(shMs)}][Смена ${sh.no} · ${kindShort(sh.kind)}][Деф: ${nd.length} · КРИТ: ${crit}]`;
    const pl = S.cfg.plan[sh.kind] || [];
    const photos = [...new Set(defs.filter(d => d.date >= sh.opened || d.changed >= sh.opened).flatMap(d => d.photos))];
    const body = [`МДСЗ-8 — отчёт смены`, `Дата: ${dmy(shMs)}, смена ${sh.no} (${sh.kind})`, `Закрыл: ${short(u.fio)}, ${u.role}, ${dmyhm(now)}`, ``,
      `Обходы (факт / план):`, ...pl.map(([rk, rl, n]) => `  ${D.ROUTES[rk].label} (${rl}): ${S.rounds.filter(r => r.rkey === rk && r.role === rl).length} / ${n}`),
      `  всего обходов: ${S.rounds.length}, пропущено КТ: ${S.rounds.reduce((s, r) => s + Object.values(r.pts).filter(p => p.res === "skip").length, 0)}`, ``,
      `Новых дефектов: ${nd.length}, из них критических: ${crit}`, `Открытых дефектов всего: ${openAll.length} (критических: ${openCrit})`,
      `Замеров: ${S.meas.length}, вне нормы: ${S.meas.filter(m => m.v > m.n).length}`,
      ...(nd.length ? [``, `Новые дефекты:`, ...nd.slice(0, 15).map(d => `  • ${KT[d.kt].name}: ${d.desc} — ${d.cat}, ${d.status}`)] : []),
      ``, `Вложения: ${fileName(sh)}${photos.length ? ` + фото ${photos.length} шт.` : ""}`, `Сохраните вложения в папку «МДСЗ-8 Отчёты» и обновите Сводный журнал.`].join("\r\n");
    S.archive.push({ file: fileName(sh), subject, body, sheets, photos, created: now, sent: null, by: u.fio });
    if (S.archive.length > 40) S.archive.shift();
    S.shift = null; S.rounds = []; S.meas = [];
    save(); stack = []; cur = { v: "home" }; go("send", S.archive.length - 1);
  };
  function dl(blob, name) { const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000); }
  A.download = async i => {
    const a = S.archive[+i];
    dl(XLSXLite.build(a.sheets), a.file);
    let miss = 0;
    for (const n of a.photos) { await new Promise(r => setTimeout(r, 700)); const b = await IDB.get(n).catch(() => null); if (b) dl(b, n); else miss++; }
    toast(`Скачано: ${a.file}${a.photos.length ? ` и фото ${a.photos.length - miss}` : ""}. Файлы — в папке «Загрузки».`);
  };
  A.mail = i => { const a = S.archive[+i]; location.href = `mailto:${emails().join(",")}?subject=${encodeURIComponent(a.subject)}&body=${encodeURIComponent(a.body)}`; };
  A.markSent = i => { S.archive[+i].sent = Date.now(); save(); toast("Отчёт отмечен как отправленный"); A.logout(); };
  A.copy = async v => { try { await navigator.clipboard.writeText(v); toast("Скопировано"); } catch (e) { prompt("Скопируйте:", v); } };
  A.copyBody = i => A.copy(S.archive[+i].body);

  A.staffEdit = id => {
    if (!isAdmin()) return;
    const s = S.cfg.staff.find(x => x.id === id) || { id: "", fio: "", role: "Дробильщик", admin: false };
    modal(`<h3>${s.id ? "Изменить работника" : "Новый работник"}</h3>
      <label>ФИО<input id="stFio" value="${esc(s.fio)}" placeholder="Фамилия И.О."></label>
      <label>Должность<select id="stRole">${Object.keys(D.ROLES).map(r => `<option ${s.role === r ? "selected" : ""}>${r}</option>`).join("")}</select></label>
      ${isSuper() ? `<label class="chk"><input type="checkbox" id="stAdm" ${s.admin ? "checked" : ""}> 🛡 Ответственный — ведёт персонал и ПИН</label>` : (s.admin ? `<div class="hint">🛡 Ответственный (назначает администратор)</div>` : "")}
      <label>${s.id ? "Новый ПИН (оставьте пустым, чтобы не менять)" : "ПИН (4–6 цифр)"}<input id="stPin" type="password" inputmode="numeric" autocomplete="new-password" maxlength="6"></label>
      <label>Повторите ПИН<input id="stPin2" type="password" inputmode="numeric" autocomplete="new-password" maxlength="6"></label>
      <button class="big go" data-a="staffSave" data-v="${s.id}">Сохранить</button>
      ${s.id && s.id !== S.session.id && (isSuper() || !s.admin) ? `<button class="btn" data-a="staffDel" data-v="${s.id}">Удалить работника</button>` : ""}
      <button class="btn" data-a="closeModal">Отмена</button>`);
  };
  A.staffSave = async id => {
    if (!isAdmin()) return;
    const fio = $("#stFio").value.trim(), role = $("#stRole").value, p1 = $("#stPin").value.trim(), p2 = $("#stPin2").value.trim();
    if (!fio) return toast("Укажите ФИО");
    if (S.cfg.staff.some(x => x.id !== id && x.fio.toLowerCase() === fio.toLowerCase())) return toast("Работник с таким ФИО уже есть");
    if (!id && !p1) return toast("Задайте ПИН");
    if (p1 && !/^\d{4,6}$/.test(p1)) return toast("ПИН — от 4 до 6 цифр");
    if (p1 !== p2) return toast("ПИН и повтор не совпадают");
    let s = S.cfg.staff.find(x => x.id === id);
    if (s && s.admin && !isSuper() && s.id !== S.session.id) return toast("Данные ответственного меняет администратор");
    const adm = isSuper() ? $("#stAdm").checked : !!(s && s.admin);
    if (!s) { s = { id: "u" + Date.now() }; S.cfg.staff.push(s); }
    s.fio = fio; s.role = role; s.admin = adm;
    if (p1) { s.ph = await pinHash(s.id, p1); if (S.fails) S.fails[s.id] = 0; if (S.lock) S.lock[s.id] = 0; }
    save(); closeModal(); render(); toast(p1 ? "Сохранено, ПИН задан" : "Сохранено");
  };
  A.staffDel = id => {
    const s = S.cfg.staff.find(x => x.id === id);
    if (!s || !confirm(`Удалить ${short(s.fio)}? Записи с его ФИО в дефектах и отчётах сохранятся.`)) return;
    if (s.admin && !isSuper()) return toast("Удалить ответственного может только администратор");
    S.cfg.staff = S.cfg.staff.filter(x => x.id !== id); save(); closeModal(); render();
  };
  A.myPin = () => modal(`<h3>Сменить свой ПИН</h3>
    <label>Текущий ПИН<input id="mp0" type="password" inputmode="numeric" autocomplete="current-password" maxlength="6"></label>
    <label>Новый ПИН (4–6 цифр)<input id="mp1" type="password" inputmode="numeric" autocomplete="new-password" maxlength="6"></label>
    <label>Повторите новый ПИН<input id="mp2" type="password" inputmode="numeric" autocomplete="new-password" maxlength="6"></label>
    <button class="big go" data-a="myPinSave">Сохранить</button><button class="btn" data-a="closeModal">Отмена</button>`);
  A.myPinSave = async () => {
    const u = me(), p0 = $("#mp0").value.trim(), p1 = $("#mp1").value.trim(), p2 = $("#mp2").value.trim();
    if ((await pinHash(u.id, p0)) !== (u.id === "admin" ? S.cfg.admin.ph : u.ph)) return toast("Текущий ПИН неверный");
    if (!/^\d{4,6}$/.test(p1)) return toast("Новый ПИН — от 4 до 6 цифр");
    if (p1 !== p2) return toast("ПИН и повтор не совпадают");
    if (u.id === "admin") { S.cfg.admin.ph = await pinHash("admin", p1); S.cfg.admin.mustChange = false; } else u.ph = await pinHash(u.id, p1);
    save(); closeModal(); render(); toast("ПИН изменён");
  };
  A.saveSettings = () => {
    if (!isSuper()) return;
    const em = $("#cfgMail").value.split(/[,;\s]+/).filter(Boolean);
    if (!em.length || em.some(x => !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(x))) return toast("Проверьте адреса почты");
    S.cfg.email = em.join(",");
    document.querySelectorAll(".pn").forEach(i => { const v = parseInt(i.value, 10); if (v >= 0) S.cfg.plan[i.dataset.k][+i.dataset.j][2] = v; });
    document.querySelectorAll(".rn").forEach(i => { const v = parseInt(i.value, 10); if (v > 0) S.cfg.norms[i.dataset.k] = v; });
    document.querySelectorAll(".tn").forEach(i => { const v = parseFloat(i.value.replace(",", ".")); if (v > 0) S.cfg.tnorm[i.dataset.k] = v; });
    S.cfg.requireQR = $("#cfgQR").checked;
    const h = parseInt($("#cfgSess").value, 10); if (h >= 1 && h <= 24) S.cfg.sessionH = h;
    applyCfg(); save(); toast("Настройки сохранены"); back();
  };
  A.cfgExport = async () => {
    if (!isSuper()) return;
    const maps = {}; for (const k in MAP_KEYS) { const b = await IDB.get("map:" + k).catch(() => null); if (b) maps[k] = await blobToData(b); }
    const blob = new Blob([JSON.stringify({ type: "mdsz8-settings", v: 2, saved: new Date().toISOString(), cfg: S.cfg, maps }, null, 1)], { type: "application/json" });
    dl(blob, `МДСЗ8_настройки_${ymd(Date.now())}.json`); toast("Файл настроек — в папке «Загрузки»");
  };
  A.resetAll = () => { if (!isSuper() || !confirm("Стереть все обходы, дефекты, отчёты и настройки на этом телефоне? Персонал вернётся к демо-списку.")) return; localStorage.removeItem(KEY); indexedDB.deleteDatabase("mdsz8"); S = fresh(); migrate().then(home); };

  $("#hdrBack").addEventListener("click", () => { closeModal(); if (cur.v === "point") return A.openRound(cur.p.rid); back(); });
  $("#hdrOut").addEventListener("click", () => { if (confirm("Выйти? Начатый обход сохранится.")) A.logout(); });
  /* ---------- QR-сканер (офлайн, jsQR) ---------- */
  let scanStream = null, scanTimer = null;
  function parseKt(text) { const m = String(text).match(/kt=([A-Za-z0-9-]+)/i); const c = (m ? m[1] : String(text).trim()).toUpperCase(); return KT[c] ? c : null; }
  function handleKt(code) {
    if (!S.session) { ui.pendingKt = code; toast(`Метка: ${KT[code].name}. Войдите в приложение.`); return; }
    const ar = activeRound();
    if (ar && ar.list.includes(code)) {
      ar.qr = ar.qr || {}; ar.qr[code] = Date.now(); save();
      stack = [{ v: "home" }, { v: "round", p: ar.id }]; cur = { v: "point", p: { rid: ar.id, kt: code } }; render(); window.scrollTo(0, 0);
      toast(`📷 Метка подтверждена: ${KT[code].name}`);
    } else {
      if (ar) toast(`«${KT[code].name}» нет в текущем маршруте`);
      go("kt", code);
    }
  }
  A.scan = async () => {
    let ov = $("#scanner");
    if (!ov) { ov = document.createElement("div"); ov.id = "scanner"; ov.innerHTML = `<video playsinline muted></video><div class="frame"></div><p id="scanMsg"></p><button class="big" id="scanClose">Закрыть</button><canvas hidden></canvas>`; document.body.appendChild(ov); ov.querySelector("#scanClose").onclick = closeScanner; }
    ov.hidden = false; const msg = $("#scanMsg"), video = ov.querySelector("video");
    msg.textContent = "Наведите камеру на QR-метку оборудования";
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || !window.jsQR) { msg.textContent = "Камера недоступна на этом телефоне."; return; }
    try {
      scanStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 } }, audio: false });
      video.srcObject = scanStream; await video.play();
      const cv = ov.querySelector("canvas"), ctx = cv.getContext("2d", { willReadFrequently: true });
      const tick = () => {
        if (!scanStream) return;
        if (video.readyState >= 2 && video.videoWidth) {
          const w = 640, h = Math.round(video.videoHeight * (w / video.videoWidth)) || 480;
          cv.width = w; cv.height = h; ctx.drawImage(video, 0, 0, w, h);
          const res = jsQR(ctx.getImageData(0, 0, w, h).data, w, h, { inversionAttempts: "attemptBoth" });
          if (res && res.data) { const c = parseKt(res.data); if (c) { if (navigator.vibrate) navigator.vibrate(80); closeScanner(); return handleKt(c); } msg.textContent = "Это не метка МДСЗ-8"; }
        }
        scanTimer = setTimeout(tick, 180);
      };
      tick();
    } catch (e) { msg.textContent = "Нет доступа к камере. Разрешите камеру для приложения в настройках телефона."; }
  };
  function closeScanner() { clearTimeout(scanTimer); if (scanStream) { scanStream.getTracks().forEach(t => t.stop()); scanStream = null; } const ov = $("#scanner"); if (ov) ov.hidden = true; }
  function fromHash() { const c = parseKt(location.hash); if (c) { history.replaceState(null, "", location.pathname); handleKt(c); } }
  window.addEventListener("hashchange", fromHash);
  window.MDSZ8 = { state: () => S, A, parseKt, handleKt };
  migrate().then(loadMaps, () => { }).then(render, render).then(fromHash);

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").then(reg => {
      reg.addEventListener("updatefound", () => { const w = reg.installing; w.addEventListener("statechange", () => { if (w.state === "installed" && navigator.serviceWorker.controller) { const b = $("#upd"); b.hidden = false; b.onclick = () => { w.postMessage("skipWaiting"); }; } }); });
    }).catch(() => { });
    let rl = false; navigator.serviceWorker.addEventListener("controllerchange", () => { if (!rl) { rl = true; location.reload(); } });
  }
})();
