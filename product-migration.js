'use strict';
window.ZavoMigration = (() => {
  const normalize = value => String(value ?? '').normalize('NFKC').trim().toLowerCase().replace(/[’‘']/g, '').replace(/\s+/g, ' ');
  function detect(storage = localStorage) {
    const keys = new Set(['zavo-products-v1', 'zavo-orders-v1']);
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i);
      if (/zavo/i.test(key) && /product|catalog|order/i.test(key)) keys.add(key);
    }
    const sources = {}, products = [], warnings = [];
    for (const key of keys) {
      const raw = storage.getItem(key);
      if (raw === null) continue;
      sources[key] = raw;
      try {
        const data = JSON.parse(raw);
        const list = Array.isArray(data) ? data : data.products || data.catalog || data.orders || Object.values(data);
        if (!Array.isArray(list)) throw new Error('Ro‘yxat formati noma’lum');
        if (/order/i.test(key)) {
          // Only recover actual embedded products, never invent a catalog from order totals.
          for (const order of list) for (const item of order?.items || []) {
            if (item?.product && typeof item.product === 'object') products.push(item.product);
            else if (item?.category || item?.category_id) products.push(item);
          }
        } else for (const product of list) if (product && typeof product === 'object') products.push(product);
      } catch (error) { warnings.push(`${key}: ${error.message}`); }
    }
    return { sources, products, warnings };
  }
  function convert(old, categories) {
    const categoryValue = old.category_id ?? old.categoryId ?? old.category;
    const candidates = typeof categoryValue === 'object' && categoryValue ? [categoryValue.id, categoryValue.name] : [categoryValue];
    const category = categories.find(c => candidates.some(v => v != null && (normalize(v) === normalize(c.id) || normalize(v) === normalize(c.name))));
    if (!category) throw new Error('Kategoriya topilmadi');
    const number = value => Number(typeof value === 'string' ? value.replace(/[\s,]/g, '') : value);
    const cash = number(old.cash_price ?? old.cashPrice ?? (number(old.oldPrice) > 0 ? old.oldPrice : old.price));
    const discount = number(old.discount_price ?? old.discountPrice ?? (number(old.oldPrice) > number(old.price) ? old.price : 0));
    const p = {name: String(old.name ?? old.title ?? '').trim(), category_id: category.id,
      description: String(old.description ?? (Array.isArray(old.specs) ? old.specs.join('\n') : '') ?? ''),
      cash_price: cash, discount_price: discount || null,
      stock_quantity: number(old.stock_quantity ?? old.stockQuantity ?? old.stock ?? (old.available === false ? 0 : 10)),
      installment_enabled: boolean(old.installment_enabled ?? old.installmentEnabled ?? old.installment, true),
      is_active: boolean(old.is_active ?? old.isActive ?? old.active, true)};
    if (!p.name || p.name.length > 180 || p.description.length > 3000 || !Number.isSafeInteger(cash) || cash < 1 || cash > 1e12 || !Number.isSafeInteger(discount) || discount < 0 || (discount && discount >= cash) || !Number.isInteger(p.stock_quantity) || p.stock_quantity < 0 || p.stock_quantity > 1000000) throw new Error('Nom, narx yoki qoldiq noto‘g‘ri');
    const images = [...new Set([...(Array.isArray(old.images) ? old.images : []), old.image, old.image_url].map(i => typeof i === 'object' && i ? i.url || i.image_url : i).filter(url => {
      try { const parsed = new URL(url); return parsed.protocol === 'https:' && !!parsed.hostname && !parsed.username && !parsed.password; } catch { return false; }
    }))];
    return { product: p, images, identity: `${normalize(p.name)}|${p.category_id}` };
  }
  function boolean(value, fallback) { return value == null ? fallback : ![false, 0, 'false', '0'].includes(value); }
  async function stableId(identity) {
    const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode('zavo-legacy-product:' + identity)));
    // High positive IDs stay compatible with checkout and do not advance identity sequences.
    let n = 0; for (const byte of digest.slice(0, 6)) n = n * 256 + byte;
    return 281474976710656 + n;
  }
  async function rows(table, select = '*') {
    const result = [];
    for (let start = 0;;start += 500) {
      const {data, error} = await ZavoBackend.getClient().from(table).select(select).order('id').range(start, start + 499);
      if (error) throw new Error(error.message);
      result.push(...data); if (data.length < 500) return result;
    }
  }
  async function preview() {
    await ZavoBackend.requireAdmin();
    const snapshot = detect(), categories = await rows('categories'), entries = [], invalid = [];
    for (const old of snapshot.products) try { entries.push(convert(old, categories)); } catch (error) { invalid.push(`${old.name || old.title || 'Mahsulot'}: ${error.message}`); }
    return {...snapshot, entries, invalid};
  }
  async function migrate(plan) {
    await ZavoBackend.requireAdmin();
    const client = ZavoBackend.getClient(), existing = await rows('products'), result = {Imported:0, Skipped:0, Failed:plan.invalid.length, errors:[...plan.invalid], ids:[]};
    const seen = new Set();
    for (const entry of plan.entries) {
      if (seen.has(entry.identity)) { result.Skipped++; continue; } seen.add(entry.identity);
      let created = false;
      try {
        await ZavoBackend.requireAdmin();
        const id = await stableId(entry.identity);
        let match = existing.find(p => `${normalize(p.name)}|${p.category_id}` === entry.identity);
        if (!match) {
          const collision = existing.find(p => Number(p.id) === id);
          if (collision) throw new Error('ID mos kelmadi');
          const inserted = await client.from('products').insert({id, ...entry.product});
          if (inserted.error) {
            // Reconcile concurrent runs and responses lost after a committed insert.
            const check = await client.from('products').select('*').eq('id', id);
            match = check.data?.[0];
            if (check.error || !match || `${normalize(match.name)}|${match.category_id}` !== entry.identity) throw new Error(inserted.error.message);
          } else { match = {id, ...entry.product}; created = true; }
          existing.push(match);
        }
        // Resume images on deterministic migration IDs after partial failures.
        if (Number(match.id) === id) {
          const current = await client.from('product_images').select('*').eq('product_id', match.id);
          if (current.error) throw new Error(current.error.message);
          for (let i = 0; i < entry.images.length; i++) {
            if (current.data.some(image => image.image_url === entry.images[i])) continue;
            if (current.data.some(image => image.sort_order === i)) throw new Error('Rasm tartibi band');
            const image = {product_id:match.id, image_url:entry.images[i], sort_order:i};
            const saved = await client.from('product_images').insert(image);
            if (saved.error) {
              const check = await client.from('product_images').select('*').eq('product_id', match.id).eq('sort_order', i);
              if (check.error || check.data?.[0]?.image_url !== image.image_url) throw new Error(saved.error.message);
            }
            current.data.push(image);
          }
        }
        result[created ? 'Imported' : 'Skipped']++; result.ids.push(match.id);
      } catch (error) { result.Failed++; result.errors.push(`${entry.product.name}: ${error.message}`); }
    }
    return result;
  }
  async function download() {
    await ZavoBackend.requireAdmin();
    const snapshot = detect();
    const url = URL.createObjectURL(new Blob([JSON.stringify({exportedAt:new Date().toISOString(), ...snapshot}, null, 2)], {type:'application/json'}));
    const a = document.createElement('a'); a.href = url; a.download = `zavo-legacy-backup-${Date.now()}.json`; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 60000);
  }
  return {detect, convert, stableId, preview, migrate, download};
})();
