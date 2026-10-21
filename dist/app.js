/* Works directly from index.html and on any static host. No API or build runtime required. */
(() => {
  'use strict';
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];
  const storageKey = 'irving-xpress-saved-v2';
  let saved = new Set();
  let storageWorks = true;
  try { const value = JSON.parse(localStorage.getItem(storageKey) || '[]'); if (Array.isArray(value)) saved = new Set(value.filter(v => typeof v === 'string')); } catch { storageWorks = false; }
  let toastTimer;
  function toast(message) { const box = $('#toast'); if (!box) return; box.textContent = message; box.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => box.hidden = true, 3500); }
  function updateSaved() {
    $$('.saved-count').forEach(el => el.textContent = saved.size);
    $$('[data-save]').forEach(el => { const on = saved.has(el.dataset.save); el.setAttribute('aria-pressed', String(on)); el.textContent = on ? '✓ Saved' : '+ Save'; el.setAttribute('aria-label', `${on ? 'Remove' : 'Save'} ${el.dataset.name || 'scholarship'}${on ? ' from shortlist' : ''}`); });
  }
  $$('[data-save]').forEach(button => button.addEventListener('click', () => {
    const id = button.dataset.save; const removing = saved.has(id); removing ? saved.delete(id) : saved.add(id);
    try { localStorage.setItem(storageKey, JSON.stringify([...saved])); } catch { storageWorks = false; }
    updateSaved(); document.dispatchEvent(new Event('savedchange'));
    toast(storageWorks ? (removing ? 'Removed from your shortlist.' : 'Saved to your shortlist on this browser.') : 'Updated for this page. Browser storage is unavailable; export before leaving.');
  }));
  updateSaved();
  const menu = $('.menu-toggle');
  menu?.addEventListener('click', () => { const expanded = menu.getAttribute('aria-expanded') !== 'true'; menu.setAttribute('aria-expanded', String(expanded)); $('#main-nav').classList.toggle('open', expanded); menu.textContent = expanded ? 'Close ✕' : 'Menu ☰'; });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && menu?.getAttribute('aria-expanded') === 'true') menu.click(); });

  $$('[data-directory]').forEach(directory => {
    const items = $$('[data-item]', directory), form = $('form', directory), search = $('[name=q]', form), category = $('[name=category]', form), campus = $('[name=campus]', form), status = $('[name=status]', form), sort = $('[name=sort]', form), onlySaved = $('[name=saved]', form);
    const params = new URLSearchParams(location.search);
    [search,category,campus,status,sort].filter(Boolean).forEach(input => { const value = params.get(input.name); if (value !== null && (input.tagName !== 'SELECT' || [...input.options].some(o => o.value === value))) input.value = value; });
    if (onlySaved && params.get('saved') === '1') onlySaved.checked = true;
    function render() {
      const terms = (search?.value || '').trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
      let count = 0;
      items.forEach(item => {
        const text = item.dataset.search.toLocaleLowerCase();
        const matches = terms.every(t => text.includes(t)) && (!category?.value || item.dataset.category === category.value) && (!campus?.value || item.dataset.campuses.split('|').includes(campus.value)) && (!status?.value || item.dataset.status === status.value) && (!onlySaved?.checked || saved.has(item.dataset.id));
        item.hidden = !matches; if (matches) count++;
      });
      if (sort) {
        const ordered = [...items].sort((a,b) => sort.value === 'amount' ? Number(b.dataset.amount) - Number(a.dataset.amount) || a.dataset.name.localeCompare(b.dataset.name) : a.dataset.name.localeCompare(b.dataset.name));
        ordered.forEach(item => item.parentElement.appendChild(item));
      }
      $('[data-count]', directory).textContent = `${count} of ${items.length} ${directory.dataset.label || 'results'}`;
      $('[data-empty]', directory).hidden = count > 0;
    }
    form.addEventListener('submit', e => e.preventDefault());
    form.addEventListener('input', render); form.addEventListener('change', render);
    $('[data-reset]', form)?.addEventListener('click', () => { form.reset(); if (search) search.value=''; if (onlySaved) onlySaved.checked=false; render(); });
    document.addEventListener('savedchange', render); render();
    $('[data-export]', directory)?.addEventListener('click', () => {
      const selected = items.filter(item => saved.has(item.dataset.id));
      if (!selected.length) { toast('Save a scholarship first, then export your shortlist.'); return; }
      const rows = [['Scholarship','Amount','Status','Deadline','Official source'], ...selected.map(item => [item.dataset.name,item.dataset.amountLabel,item.dataset.status,item.dataset.deadline,item.dataset.source])];
      const csv = '\ufeff' + rows.map(row => row.map(value => '"'+String(value).replaceAll('"','""')+'"').join(',')).join('\r\n');
      const url = URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8;'}));
      const anchor = document.createElement('a'); anchor.href=url; anchor.download='Irving-Xpress-Scholarship-Shortlist.csv'; document.body.append(anchor); anchor.click(); anchor.remove(); setTimeout(()=>URL.revokeObjectURL(url),1000); toast('Your shortlist has been exported.');
    });
  });
  $$('[data-check]').forEach(input => {
    const key = 'irving-xpress-check-' + input.dataset.check;
    try { input.checked = localStorage.getItem(key) === 'true'; } catch {}
    input.addEventListener('change', () => { try { localStorage.setItem(key, String(input.checked)); } catch { toast('Checklist updates last for this page only; browser storage is unavailable.'); } });
  });
  $$('[data-print]').forEach(button => button.addEventListener('click', () => window.print()));
})();
