// Self-check page for the app in index.html. Loaded only when the page is opened (see loadSelfTest),
// so it costs nothing on a normal start. Uses the app's globals (App, render functions, helpers).

/* ================= SELF-CHECK PAGE (Settings > Self-check, or open the app with #selftest) ================= */
// Runs the app's own math against a throw-away copy of the state filled with sample data - never the
// real log - and writes nothing. Results live only in this variable until the page is closed.
let __selfTestResults = null;
function runSelfTests(){
  const out = [];
  const realState = App.state;
  const snap = () => { try { return JSON.stringify(realState.today) + '|' + localStorage.getItem(LOCAL_STORAGE_KEY); } catch (e){ return 'n/a'; } };
  const before = snap();
  const check = (group, name, fn) => {
    let res;
    try { res = fn(); } catch (e){ res = 'Error: ' + ((e && e.message) || e); }
    out.push({ group, name, ok: res === true, detail: res === true ? '' : String(res) });
  };
  const eq = (got, want) => JSON.stringify(got) === JSON.stringify(want) ? true : 'got ' + JSON.stringify(got) + ', expected ' + JSON.stringify(want);
  // Fixture state: the real state with default targets and sample data swapped in (shallow copy; nothing here mutates the real parts).
  const mk = (meals, history) => Object.assign({}, realState, {
    targets: defaultTargets(), screen:'today', dayHistory: history || [],
    today: Object.assign({}, realState.today, { meals, waterMl:0, weightKg:null, expandedStat:null, macroInfoOpen:false, expandedMeal:null, confirmRemoveKey:null }),
    history: Object.assign({}, realState.history, { view:'day', openIdx:null, confirmDeleteDate:null }),
    addfood: Object.assign({}, realState.addfood, { activeTab:'saved', targetDate:null, returnTo:null }),   // checks must not depend on the last-used Log food tab
  });
  const withFixture = (meals, history, fn) => { App.state = mk(meals, history); try { return fn(App.state); } finally { App.state = realState; } };

  const item = (name, kcal, sugar, extra) => Object.assign({ name, kcal, p:1, c:10, f:1, fib:1, sugar, sodium:10 }, extra || {});
  const meal = (name, items) => ({ id:name.toLowerCase(), name, subtitle:'Sample', items });
  const dish = item('Sample dish, 300g', 250, 30, { sugarCounted:8, components:[
    { name:'Mango', weight:100, unit:'g', kcal:60, p:1, c:15, f:0, fib:2, sugar:22, sodium:0, wholeProduce:true },
    { name:'Yoghurt', weight:200, unit:'g', kcal:190, p:9, c:20, f:8, fib:0, sugar:8, sodium:80, wholeProduce:false } ] });
  // Day A: lots of whole fruit - 75 g true sugar but only 20 g counted, so it must read "in range" (ceiling 50 g).
  const mealsA = [ meal('Breakfast', [item('Banana', 105, 14, { wholeProduce:true }), item('Apple', 95, 19, { wholeProduce:true })]), meal('Lunch', [dish, item('Yoghurt tub', 120, 12)]) ];
  // Day B: the same plus a dessert - 115 g true, 60 g counted, so it must read "over".
  const mealsB = mealsA.concat([meal('Dinner', [item('Dessert', 300, 40)])]);
  const day = (date, sugar, counted) => { const d = { date, calories:1600, protein:140, carbs:170, fat:60, fiber:32, sugar, sodium:2200, waterMl:2500, weightKg:null, meals:[], note:'', tag:null }; if (counted !== undefined) d.sugarCounted = counted; return d; };
  const hist = [day('2026-01-01', 60), day('2026-01-02', 40), day('2026-01-03', 75, 20)];

  // ---- Totals ----
  const T = computeConsumedTotals;
  check('Totals', 'A plain item counts fully toward counted sugar', () => eq(T([meal('Lunch', [item('Biscuit', 100, 10)])]).sugarCounted, 10));
  check('Totals', 'Whole fruit adds to the true total but not the counted sugar', () => { const t = T([meal('Breakfast', [item('Banana', 105, 14, { wholeProduce:true })])]); return eq([t.sugar, t.sugarCounted], [14, 0]); });
  check('Totals', 'A dish row counts only its non-fruit part', () => { const t = T([meal('Lunch', [dish])]); return eq([t.sugar, t.sugarCounted], [30, 8]); });
  check('Totals', 'An old logged item with no counted figure falls back to its sugar', () => eq(T([meal('Lunch', [item('Old', 100, 9)])]).sugarCounted, 9));
  check('Totals', 'Sample day A: 75 g true sugar, 20 g counted', () => { const t = T(mealsA); return eq([t.sugar, t.sugarCounted], [75, 20]); });
  check('Totals', 'Sample day A: calories add up', () => eq(T(mealsA).calories, 570));

  // ---- The one shared rule ----
  check('Shared sugar rule', 'Sugar is judged on the counted figure', () => eq(statusValueFor('sugar', { sugar:75, sugarCounted:20 }), 20));
  check('Shared sugar rule', 'A counted figure of 0 is respected, not treated as missing', () => eq(statusValueFor('sugar', { sugar:14, sugarCounted:0 }), 0));
  check('Shared sugar rule', 'An old stored day with no counted figure uses its sugar', () => eq(statusValueFor('sugar', { sugar:42 }), 42));
  check('Shared sugar rule', 'Other stats are judged on their own value', () => eq(statusValueFor('protein', { protein:140, sugar:5 }), 140));

  // ---- Status rules (default targets) ----
  const st = (id, v) => withFixture([], [], () => statusFor(id, v));
  check('Status rules', 'Calories 1500 and 1700 are both in range', () => eq([st('calories', 1500), st('calories', 1700)], ['good', 'good']));
  check('Status rules', 'Calories 1499 is under and 1701 is over', () => eq([st('calories', 1499), st('calories', 1701)], ['warning', 'critical']));
  check('Status rules', 'Sugar 50 g is fine, 50.1 g is over', () => eq([st('sugar', 50), st('sugar', 50.1)], ['good', 'critical']));
  check('Status rules', 'Fiber 30 g is fine, 29.9 g is under', () => eq([st('fiber', 30), st('fiber', 29.9)], ['good', 'warning']));
  check('Status rules', 'Labels read Under / In range / Over', () => withFixture([], [], () => eq([statusLabelFor('calories', 1000), statusLabelFor('calories', 1600), statusLabelFor('calories', 2000)], ['Under', 'In range', 'Over'])));
  check('Status rules', 'Old sodium ceiling 2300 becomes the 2000-2500 range', () => { const t = { sodium:{ kind:'ceiling', value:2300 } }; migrateSodiumTarget(t); return eq([t.sodium.kind, t.sodium.low, t.sodium.high], ['range', 2000, 2500]); });
  check('Status rules', 'A custom old sodium ceiling stays as the upper bound', () => { const t = { sodium:{ kind:'ceiling', value:2000 } }; migrateSodiumTarget(t); return eq([t.sodium.low, t.sodium.high], [1300, 2000]); });

  // ---- Does every screen show the same sugar verdict? ----
  const doc = html => new DOMParser().parseFromString(html, 'text/html');
  const goodOfLabel = t => /in range/i.test(t);
  const goodOfDot = el => /--good/.test((el && el.getAttribute('style')) || '');
  const gather = (meals, history) => withFixture(meals, history, s => {
    const r = {};
    const safe = (k, f) => { try { r[k] = f(); } catch (e){ r[k] = 'Error: ' + ((e && e.message) || e); } };
    const consumed = computeConsumedTotals(s.today.meals);
    safe('tile', () => { const c = [...doc(renderToday()).querySelectorAll('.card[onclick]')].find(x => x.getAttribute('onclick').indexOf("'sugar'") >= 0); return { good: goodOfLabel(c.querySelector('.pill').textContent), shown: c.querySelector('.num').textContent }; });
    safe('modal', () => goodOfLabel(doc(renderStatDetailModal('sugar', consumed)).querySelector('.pill').textContent));
    return r;
  });
  const A = gather(mealsA, hist), B = gather(mealsB, hist);
  [['A', A, true, 75, 20], ['B', B, false, 115, 60]].forEach(([k, r, good, raw, cnt]) => {
    const g = 'Sugar verdict matches on every screen';
    const tag = 'Day ' + k + ' (' + raw + ' g true, ' + cnt + ' g counted) ';
    const want = good ? 'in range' : 'over';
    check(g, tag + '- Today tile says ' + want, () => r.tile && r.tile.good === good ? true : 'got ' + JSON.stringify(r.tile));
    check(g, tag + '- tile still shows the true total', () => r.tile && r.tile.shown && r.tile.shown.replace(/,/g, '').indexOf(String(raw)) >= 0 ? true : 'got ' + JSON.stringify(r.tile));
    check(g, tag + '- breakdown popup says ' + want, () => r.modal === good ? true : 'got ' + JSON.stringify(r.modal));
  });
  // ---- History day view: the four dots and the four tiles are Carbs, Protein, Fat, Calories (no sugar) ----
  const dayWith = (date, over) => Object.assign(day(date, 10), over);
  const histDays = [dayWith('2026-02-01', { carbs:250 }), dayWith('2026-02-02', { protein:100 }), dayWith('2026-02-03', { fat:120 }), dayWith('2026-02-04', { calories:2600 }), dayWith('2026-02-05', {})];
  const histRun = withFixture([], histDays, s => {
    const days = App.allRealDays();
    const dots = {};
    [...doc(renderHistory()).querySelectorAll('.accordion-head')].forEach((h, i) => { dots[days[i].date] = [...h.querySelectorAll('.dot')].map(goodOfDot); });
    s.history.openIdx = days.findIndex(d => d.date === '2026-02-05');
    const card = [...doc(renderHistory()).querySelectorAll('.accordion-head')][s.history.openIdx].parentElement;
    const tiles = [...card.querySelectorAll('div[style*="grid-template-columns"] > div')].map(x => [x.lastElementChild.textContent.trim(), x.firstElementChild.textContent.trim()]);
    return { dots, tiles, hasSugar: /sugar/i.test(card.textContent) };
  });
  const hg = 'History day view';
  check(hg, 'Carbs off: only the 1st dot is red', () => eq(histRun.dots['2026-02-01'], [false, true, true, true]));
  check(hg, 'Protein off: only the 2nd dot is red', () => eq(histRun.dots['2026-02-02'], [true, false, true, true]));
  check(hg, 'Fat off: only the 3rd dot is red', () => eq(histRun.dots['2026-02-03'], [true, true, false, true]));
  check(hg, 'Calories off: only the 4th dot is red', () => eq(histRun.dots['2026-02-04'], [true, true, true, false]));
  check(hg, 'A day inside every range: all four dots green', () => eq(histRun.dots['2026-02-05'], [true, true, true, true]));
  check(hg, 'Opened day shows Carbs, Protein, Fat, Calories in that order', () => eq(histRun.tiles, [['Carbs', '170g'], ['Protein', '140g'], ['Fat', '60g'], ['Calories', '1600']]));
  check(hg, 'Opened day does not mention sugar', () => histRun.hasSugar === false ? true : 'sugar still shown');
  // ---- Log food: the green "Added" flash must end by patching one button, never by redrawing the screen (a redraw closes the keyboard) ----
  const flashRun = (flashId, endId, targetMeal) => withFixture([], [], s => {
    s.addfood = Object.assign({}, s.addfood, { flashId, targetMeal });
    const btn = document.createElement('button');
    btn.id = 'addbtn-ingredients-x'; btn.textContent = 'Added ✓'; btn.style.background = 'var(--good)';
    document.body.appendChild(btn);
    const realRender = App.render; let renders = 0;
    App.render = () => { renders++; };
    try { App.clearAddFlash('ingredients', endId); return { renders, flashId: s.addfood.flashId, text: btn.textContent, disabled: btn.disabled, bg: btn.style.background }; }
    finally { App.render = realRender; btn.remove(); }
  });
  const fg = 'Log food flash';
  check(fg, 'Ending the flash does not redraw the screen', () => flashRun('x', 'x', 'Lunch').renders === 0 ? true : 'screen was redrawn');
  check(fg, 'The row button goes back to "+ Add to <meal>"', () => { const r = flashRun('x', 'x', 'Lunch'); return eq([r.text, r.disabled, r.bg], ['+ Add to Lunch', false, 'var(--brand)']); });
  check(fg, 'With no meal chosen it reads "+ Select a meal" and is disabled', () => { const r = flashRun('x', 'x', null); return eq([r.text, r.disabled], ['+ Select a meal', true]); });
  check(fg, 'An older timer does not cancel a newer row\'s flash', () => { const r = flashRun('y', 'x', 'Lunch'); return eq([r.flashId, r.renders], ['y', 0]); });
  // ---- Past day (Data tab -> View full day): Today's layout for a saved day; the first change asks, and edits touch that day only ----
  const pastRun = fn => withFixture(mealsA, [day('2026-02-28', 10), Object.assign(day('2026-03-01', 10), { meals: JSON.parse(JSON.stringify(mealsB)), waterMl: 1000 })], s => {
    s.screen = 'exportScreen'; s.memoryImport = null;
    s.exportScreen = Object.assign({}, s.exportScreen, { mode:'day', offset:1, pastDay:null, recentOpen:false });
    s.addfood = Object.assign({}, s.addfood, { targetDate:null, returnTo:null });
    s.library = Object.assign({}, s.library); s.maint = Object.assign({}, s.maint);
    const realRender = App.render, realSave = App.saveLocal;
    App.render = () => {}; App.saveLocal = () => {};
    try { App.openPastDay('2026-03-01'); return fn(s, s.dayHistory[1]); }
    finally { App.render = realRender; App.saveLocal = realSave; }
  });
  const pg = 'Past day view';
  check(pg, 'Shows the "Past day" strip and that day\'s meals, without the live-only parts', () => pastRun(s => { const h = renderExport(); return eq([h.indexOf('Past day') >= 0, h.indexOf('Dinner') >= 0, h.indexOf('Log food to') >= 0, h.indexOf('class="fab"') >= 0], [true, true, true, false]); }));
  check(pg, 'Today itself is unchanged', () => pastRun(s => { const h = renderToday(); return eq([h.indexOf('Past day') >= 0, h.indexOf('class="fab"') >= 0, h.indexOf('Dinner') >= 0], [false, true, false]); }));
  check(pg, 'The first change asks first and changes nothing yet', () => pastRun((s, e) => { App.addWater(250); return eq([s.exportScreen.pastDay.pendingEdit, e.waterMl, s.today.waterMl, renderExport().indexOf('Editing a past day') >= 0], [{ action:'addWater', args:[250] }, 1000, 0, true]); }));
  check(pg, 'After Continue, water and weight go to that day, not today', () => pastRun((s, e) => { s.exportScreen.pastDay.editOk = true; App.addWater(500); App.saveWeight(80.24); return eq([e.waterMl, e.weightKg, s.today.waterMl, s.today.weightKg], [1500, 80.2, 0, null]); }));
  check(pg, 'Removing a food updates that day\'s totals only', () => pastRun((s, e) => { s.exportScreen.pastDay.editOk = true; App.confirmRemoveItem('dinner', 0); return eq([e.calories, e.meals.length, s.today.meals.length], [570, 2, 2]); }));
  check(pg, 'Arrows step between saved days and stop before today', () => pastRun(s => { const seen = []; [-1, -1, 1, 1].forEach(dir => { App.stepPastDay(dir); seen.push(s.exportScreen.pastDay.date + '@' + s.exportScreen.offset); }); return eq(seen, ['2026-02-28@2', '2026-02-28@2', '2026-03-01@1', '2026-03-01@1']); }));
  check(pg, 'Back closes the warning first, then the past day', () => pastRun(s => { const pd = s.exportScreen.pastDay; const d1 = App.overlayDepth(); pd.pendingEdit = { action:'addWater', args:[250] }; const d2 = App.overlayDepth(); App.closeOpenOverlay(); const still = !!s.exportScreen.pastDay; App.closeOpenOverlay(); return eq([d1, d2, still, s.exportScreen.pastDay], [1, 2, true, null]); }));
  check(pg, 'Log food from a past day logs to that day and comes back to it', () => pastRun(s => { s.exportScreen.pastDay.editOk = true; App.logFoodToPastDay(); const r = [s.screen, s.addfood.targetDate, App.overlayDepth()]; App.exitAddFood(); return eq(r.concat([s.screen, s.exportScreen.pastDay && s.exportScreen.pastDay.date]), ['addfood', '2026-03-01', 2, 'exportScreen', '2026-03-01']); }));
  check(pg, 'Data tab offers "View full day" for a past day and "Open Today" for today', () => pastRun(s => { s.exportScreen.pastDay = null; const past = renderExport().indexOf("App.openPastDay('2026-03-01')") >= 0; s.exportScreen.offset = 0; return eq([past, renderExport().indexOf('Open Today') >= 0], [true, true]); }));
  // ---- Water: Today's verdict (above 3 L must read "Over", not "Under") ----
  const waterOn = ml => withFixture(mealsA, hist, s => {
    s.today.waterMl = ml;
    const pillOf = html => { const c = [...doc(html).querySelectorAll('.card.pad')].find(x => x.firstElementChild && /^\s*Water/.test(x.firstElementChild.textContent)); return c && c.querySelector('.pill').textContent.trim(); };
    return { today: pillOf(renderToday()) };
  });
  [[1000, 'Under'], [2500, 'In range'], [3000, 'In range'], [3500, 'Over']].forEach(([ml, want]) => {
    const r = waterOn(ml);
    check('Water verdict', (ml / 1000) + ' L: Today says ' + want, () => eq(r.today, want));
  });

  // ---- Water quick buttons: custom amounts, typed amounts, never below 0, kept in backups ----
  const waterRun = fn => withFixture(mealsA, [], s => {
    s.waterUi = { open:true, editing:false, draft:'', editDraft:null, status:null };
    s.addfood = Object.assign({}, s.addfood, { targetDate:null, returnTo:null });
    s.exportScreen = Object.assign({}, s.exportScreen, { pastDay:null });
    const realRender = App.render, realSave = App.saveLocal;
    App.render = () => {}; App.saveLocal = () => {};
    try { return fn(s); }
    finally { App.render = realRender; App.saveLocal = realSave; }
  });
  const wq = 'Water quick buttons';
  check(wq, 'Default buttons are − 250, + 250 and + 500 ml', () => waterRun(s => { s.waterButtons = undefined; const h = renderToday(); return eq(['App.addWater(-250)', 'App.addWater(250)', 'App.addWater(500)', 'App.toggleWaterOther()'].map(x => h.indexOf(x) >= 0), [true, true, true, true]); }));
  check(wq, 'Custom amounts show on Today and on the Log food backdate chips', () => waterRun(s => { s.waterButtons = [100, 300, 750]; const h = renderToday(); s.addfood.targetDate = '2026-03-01'; const a = renderAddFood(); return eq([h.indexOf('App.addWater(-100)') >= 0, h.indexOf('+ 750 ml') >= 0, a.indexOf('setBackdateWater(300)') >= 0, a.indexOf('setBackdateWater(750)') >= 0], [true, true, true, true]); }));
  check(wq, 'A typed amount adds, Remove never goes below 0, bad input changes nothing', () => waterRun(s => { s.today.waterMl = 300; App.addWaterTyped(1, '450'); const a = s.today.waterMl; App.addWaterTyped(-1, '2000'); const b = s.today.waterMl; App.addWaterTyped(1, '0'); App.addWaterTyped(1, '6000'); App.addWaterTyped(1, '12.5'); return eq([a, b, s.today.waterMl, !!s.waterUi.status], [750, 0, 0, true]); }));
  check(wq, 'Saving checks each amount is 50-2000 ml; Reset restores the defaults', () => waterRun(s => { s.waterButtons = [250, 250, 500]; App.saveWaterButtons(['10', '300', '750']); const bad = s.waterButtons.slice(); App.saveWaterButtons(['100', '300', '750']); const good = s.waterButtons.slice(); App.resetWaterButtons(); return eq([bad, good, s.waterButtons], [[250, 250, 500], [100, 300, 750], [250, 250, 500]]); }));
  check(wq, 'The amounts go into backups, and bad saved values fall back to the defaults', () => waterRun(s => { s.waterButtons = [100, 300, 750]; return eq([App.buildBackupPayload().waterButtons, normalizeWaterButtons([10, 300, 750]), normalizeWaterButtons(undefined), normalizeWaterButtons([100, 300])], [[100, 300, 750], [250, 250, 500], [250, 250, 500], [250, 250, 500]]); }));

  // ---- Label serving size: a label given per serving is stored per 100, and shown as printed when edited ----
  const servingRun = fn => withFixture([], [], s => {
    s.memory = Object.assign({}, realState.memory, { ingredients:[] });
    s.library = Object.assign({}, realState.library, { form:null, composer:null });
    const realRender = App.render, realSave = App.saveLocal;
    App.render = () => {}; App.saveLocal = () => {};
    const box = document.createElement('div'); box.style.display = 'none';
    document.body.appendChild(box);
    const fill = vals => { box.innerHTML = renderMemoryForm(s.library.form); Object.entries(vals).forEach(([id, v]) => { box.querySelector('#' + id).value = v; }); };
    try { return fn(s, fill, box); }
    finally { App.render = realRender; App.saveLocal = realSave; box.remove(); }
  });
  const sv = 'Label serving size';
  check(sv, 'Label numbers per 30 g become per-100 numbers', () => eq(labelToPer100({ kcal:120, p:3, c:15, f:4.5, fib:1.2, sugar:6, sodium:90 }, 30), { kcal:400, p:10, c:50, f:15, fib:4, sugar:20, sodium:300 }));
  check(sv, 'Per 100, or a blank / 0 / negative size, leaves the numbers alone', () => { const v = { kcal:120, p:3, c:15, f:4.5, fib:1.2, sugar:6, sodium:90 }; return eq([100, NaN, 0, -5].map(n => labelToPer100(v, n).kcal), [120, 120, 120, 120]); });
  check(sv, 'Converting back gives the label\'s numbers again', () => { const v = { kcal:95, p:2.7, c:13.3, f:3.1, fib:0.8, sugar:4.4, sodium:65 }; return eq(per100ToLabel(labelToPer100(v, 45), 45), v); });
  check(sv, 'The preview line shows the per-100 calories', () => eq([servingPreviewText(30, 120, 'g').indexOf('400 kcal per 100 g') >= 0, servingPreviewText(250, 100, 'ml').indexOf('40 kcal per 100 ml') >= 0], [true, true]));
  check(sv, 'Saving a "per 30 g" label stores per 100 and remembers the 30', () => servingRun((s, fill) => { App.openAddForm('ingredients'); fill({ 'mf-name':'Protein bar', 'mf-serving':'30', 'mf-kcal':'120', 'mf-p':'3' }); App.saveForm(); const it = s.memory.ingredients[0]; return eq([it.kcal, it.kcalPer100, it.p, it.labelServing], [400, 400, 10, 30]); }));
  check(sv, 'Editing it shows 30 and the label\'s numbers; saving again changes nothing', () => servingRun((s, fill) => { App.openAddForm('ingredients'); fill({ 'mf-name':'Protein bar', 'mf-serving':'30', 'mf-kcal':'120', 'mf-p':'3' }); App.saveForm(); const id = s.memory.ingredients[0].id; App.editMemoryItem('ingredients', id); const f = s.library.form; const shown = [f.labelServing, f.kcal, f.p]; fill({}); App.saveForm(); const it = s.memory.ingredients[0]; return eq(shown.concat([it.kcal, it.p, it.labelServing]), [30, 120, 3, 400, 10, 30]); }));
  check(sv, 'Left at 100, the numbers are saved exactly as typed', () => servingRun((s, fill) => { App.openAddForm('ingredients'); fill({ 'mf-name':'Milk', 'mf-kcal':'45', 'mf-p':'3.1' }); App.saveForm(); const it = s.memory.ingredients[0]; return eq([it.kcal, it.p, it.labelServing], [45, 3.1, null]); }));
  check(sv, 'Saved foods (whole dishes) do not get the box', () => servingRun((s, fill, box) => { App.openAddForm('foods'); fill({}); const a = !!box.querySelector('#mf-serving'); App.openAddForm('ingredients'); fill({}); return eq([a, !!box.querySelector('#mf-serving')], [false, true]); }));

  // ---- Memory sorting ----
  const sortNames = mode => withFixture([], [], s => { s.memorySort = mode; return sortMemoryItems(names0.map(n => ({ name:n }))).map(x => x.name); });
  const names0 = ['banana', 'Apple', 'egg', 'Rice 10', 'Rice 2', '\u00c9clair'];
  check('Memory sorting', 'A-Z ignores capitals and accents, and puts Rice 2 before Rice 10', () => eq(sortNames('az'), ['Apple', 'banana', '\u00c9clair', 'egg', 'Rice 2', 'Rice 10']));
  check('Memory sorting', 'Newest first reverses the saved order', () => eq(sortNames('newest'), names0.slice().reverse()));
  check('Memory sorting', 'Sorting never changes the stored list', () => { const l = names0.map(n => ({ name:n })); withFixture([], [], () => sortMemoryItems(l)); return eq(l.map(x => x.name), names0); });
  const food = (id, name) => ({ id, name, unit:'g', kcal:100, p:1, c:10, f:1, fib:1, sugar:2, sodium:10, desc:'', recipe:'Sample recipe', updated:'Just now' });
  const memoryOrder = (mode, fn, groupSel) => withFixture([], [], s => {
    s.memorySort = mode;
    s.memory = Object.assign({}, realState.memory, { foods:[food('a1', 'Banana bread'), food('a2', 'apple pie'), food('a3', 'Cheese toast')] });
    return [...doc(fn()).querySelectorAll(groupSel + ' [data-name]')].map(r => r.getAttribute('data-name').toLowerCase());
  });
  check('Memory sorting', 'Memory > Saved foods follows A-Z', () => eq(memoryOrder('az', renderLibrary, '#lib-groups [data-kind="foods"]'), ['apple pie', 'banana bread', 'cheese toast']));
  check('Memory sorting', 'Memory > Saved foods follows Newest first', () => eq(memoryOrder('newest', renderLibrary, '#lib-groups [data-kind="foods"]'), ['cheese toast', 'apple pie', 'banana bread']));
  check('Memory sorting', 'The log-food picker follows the same setting', () => eq([memoryOrder('az', renderAddFood, '#addfood-groups [data-kind="saved"]'), memoryOrder('newest', renderAddFood, '#addfood-groups [data-kind="saved"]')], [['apple pie', 'banana bread', 'cheese toast'], ['cheese toast', 'apple pie', 'banana bread']]));
  check('Memory sorting', 'Both screens show the sort control', () => withFixture([], [], () => eq([renderLibrary().indexOf('id="memsort-az"') >= 0, renderAddFood().indexOf('id="memsort-az"') >= 0], [true, true])));

  // ---- Every screen still draws ----
  [['Today', renderToday], ['History', renderHistory], ['Trends', renderTrends], ['Data', renderExport], ['Settings', renderSettings], ['Memory', renderLibrary], ['Add food', renderAddFood]].forEach(([n, fn]) => {
    check('Screens draw', n + ' screen renders', () => withFixture(mealsA, hist, () => { const h = fn(); return typeof h === 'string' && h.length > 200 ? true : 'rendered ' + (typeof h === 'string' ? h.length + ' characters' : typeof h); }));
  });

  // ---- Search ----
  const nm = 'Hazelnut Coffee - Home Made';
  check('Search', 'Words in the saved order: "hazelnut coffee"', () => eq(nameMatches(nm, 'hazelnut coffee'), true));
  check('Search', 'Words in any order: "home made hazelnut"', () => eq(nameMatches(nm, 'home made hazelnut'), true));
  check('Search', 'Words in any order: "home made coffee"', () => eq(nameMatches(nm, 'home made coffee'), true));
  check('Search', 'Part-words work: "haz cof"', () => eq(nameMatches(nm, 'haz cof'), true));
  check('Search', 'Punctuation is ignored: "coffee-home"', () => eq(nameMatches(nm, 'coffee-home'), true));
  check('Search', 'A word that is not there fails: "hazelnut tea"', () => eq(nameMatches(nm, 'hazelnut tea'), false));
  check('Search', 'An empty search shows everything', () => eq(nameMatches(nm, '  '), true));

  // ---- Barcodes ----
  check('Barcodes', 'Leading zeros are ignored when comparing', () => eq(sameBarcode('00012345', '12345'), true));
  check('Barcodes', 'Different codes do not match', () => eq(sameBarcode('12345', '12346'), false));
  check('Barcodes', 'Two empty codes do not match', () => eq(sameBarcode('', ''), false));
  check('Barcodes', 'A 12-digit code is also tried with a leading zero', () => eq(barcodeVariants('123456789012'), ['0123456789012']));
  check('Barcodes', 'A 13-digit code starting with 0 is also tried without it', () => eq(barcodeVariants('0123456789012'), ['123456789012']));
  check('Barcodes', 'Other codes have no second form to try', () => eq([barcodeVariants('6281007012345'), barcodeVariants('12345678')], [[], []]));
  check('Barcodes', 'Spaces and dashes are stripped', () => eq(normalizeBarcode('64 1234-5'), '6412345'));
  check('Barcodes', 'Open Food Facts product is read correctly (name, unit, values)', () => {
    const p = parseOffProduct({ product_name:'Fresh Milk', brands:'Almarai, Other', quantity:'1 L', nutriments:{ 'energy-kcal_100g':60, 'proteins_100g':3.2, 'carbohydrates_100g':4.8, 'fat_100g':3.3, 'sugars_100g':4.8, 'sodium_100g':0.044 } });
    return eq([p.name, p.unit, p.vals.kcal, p.vals.sodium, p.missing], ['Almarai Fresh Milk', 'ml', 60, 44, ['fiber']]);
  });
  check('Barcodes', 'The brand is not repeated when the name already has it', () => eq(parseOffProduct({ product_name:'Almarai Milk', brands:'Almarai', nutriments:{} }).name, 'Almarai Milk'));
  check('Barcodes', 'Calories fall back to kilojoules', () => eq(parseOffProduct({ product_name:'X', nutriments:{ 'energy-kj_100g':418.4 } }).vals.kcal, 100));
  check('Barcodes', 'Sodium falls back to salt', () => eq(parseOffProduct({ product_name:'X', nutriments:{ salt_100g:1 } }).vals.sodium, 400));
  check('Barcodes', 'Missing nutrients are listed, not guessed', () => eq(parseOffProduct({ product_name:'Y' }).missing.length, 7));

  // ---- Backup reminder ----
  const daysAgo = n => new Date(Date.now() - n * 86400000).toISOString();
  const bk = (last, nDays) => withFixture([], Array.from({ length:nDays }, (_, i) => day('2026-01-0' + (i + 1), 10)), s => { s.lastBackupAt = last; return backupStatus(); });
  check('Backup reminder', 'No backup yet with 2 logged days: no nag', () => eq(bk(null, 2).overdue, false));
  check('Backup reminder', 'No backup yet with 3 logged days: nag', () => eq(bk(null, 3).overdue, true));
  check('Backup reminder', 'Backed up 2 days ago: fine, label says so', () => { const b = bk(daysAgo(2), 5); return eq([b.overdue, b.label], [false, 'Last backup: 2 days ago']); });
  check('Backup reminder', 'Backed up 3 days ago: overdue (the reminder comes after 3 days)', () => eq(bk(daysAgo(3), 5).overdue, true));
  check('Backup reminder', 'Backed up 8 days ago: still overdue', () => eq(bk(daysAgo(8), 5).overdue, true));
  check('Backup reminder', 'The Today banner shows when overdue and hides while snoozed', () => withFixture(mealsA, hist, s => { s.lastBackupAt = daysAgo(5); s.backupSnoozeUntil = 0; const shown = renderToday().indexOf('Back up your data') >= 0; s.backupSnoozeUntil = Date.now() + 3600000; const hidden = renderToday().indexOf('Back up your data') < 0; return eq([shown, hidden], [true, true]); }));
  check('Backup reminder', 'Settings: reminder after 3 days, Later hides it for 1 day', () => eq([BACKUP_OVERDUE_DAYS, BACKUP_SNOOZE_DAYS], [3, 1]));
  check('Backup reminder', 'Backed up just now: label says today', () => eq(bk(daysAgo(0), 5).label, 'Last backup: today'));

  // ---- Safety ----
  check('Safety', 'Your real log and saved copy were not touched by these checks', () => App.state === realState && snap() === before ? true : 'the real state changed during the checks');
  return out;
}
function renderSelfTest(){
  const r = __selfTestResults || [];
  const bad = r.filter(x => !x.ok);
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const groups = [];
  r.forEach(x => { let g = groups.find(y => y.name === x.group); if (!g){ g = { name:x.group, rows:[] }; groups.push(g); } g.rows.push(x); });
  const tone = bad.length ? 'var(--critical)' : 'var(--good)';
  return `
    <div class="topbar">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:4px;">
        <button onclick="App.setScreen('settings')" style="background:none;border:none;cursor:pointer;color:var(--ink);padding:0;">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M15 6l-6 6 6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
        <div class="disp" style="font-size:18px;font-weight:800;">Self-check</div>
      </div>
      <div style="font-size:12px;color:var(--ink-2);padding-left:34px;">The app tests its own math on sample data. Nothing of yours is read or changed.</div>
    </div>
    <div class="scroll-area" style="padding:16px 18px 24px 18px;">
      <div class="card pad" style="margin-bottom:14px;border-color:${tone};">
        <div class="disp" style="font-size:20px;font-weight:800;color:${tone};">${bad.length ? bad.length + (bad.length === 1 ? ' check failed' : ' checks failed') : 'All ' + r.length + ' checks passed'}</div>
        <div style="font-size:12px;color:var(--ink-2);margin-top:4px;">${r.length - bad.length} of ${r.length} passed</div>
        <div id="selftest-version" style="font-size:11px;color:var(--muted);margin-top:6px;">&nbsp;</div>
        <button onclick="App.openSelfTest()" style="margin-top:10px;padding:9px 16px;border-radius:10px;background:var(--brand-tint);color:var(--brand-dark);font-size:12.5px;font-weight:700;cursor:pointer;border:none;font-family:inherit;">Run again</button>
      </div>
      ${groups.map(g => `
        <div class="card pad" style="margin-bottom:12px;">
          <div style="font-size:13px;font-weight:700;margin-bottom:6px;">${esc(g.name)}</div>
          ${g.rows.map(x => `
            <div style="display:flex;gap:9px;align-items:flex-start;padding:5px 0;font-size:12px;line-height:1.35;">
              <div class="dot" style="margin-top:4px;flex-shrink:0;background:${x.ok ? 'var(--good)' : 'var(--critical)'};"></div>
              <div style="min-width:0;"><div>${esc(x.name)}</div>${x.ok ? '' : `<div style="color:var(--critical);font-weight:600;margin-top:2px;word-break:break-word;">${esc(x.detail)}</div>`}</div>
            </div>`).join('')}
        </div>`).join('')}
    </div>
  `;
}
// Shows which app version this phone is actually running (the cache name changes with every release).
function fillSelfTestVersion(){
  if (!window.caches) return;
  caches.keys().then(keys => {
    const el = document.getElementById('selftest-version');
    if (el) el.textContent = 'App version on this device: ' + (keys.filter(k => /v[0-9]+$/.test(k)).join(', ') || 'not cached yet');
  }).catch(() => {});
}
