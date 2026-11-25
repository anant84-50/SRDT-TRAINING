/* FoodieHub interactive demo — vanilla JavaScript, no libraries required. */
(() => {
  'use strict';

  const CART_KEY = 'foodiehub_cart_v1';
  const WISH_KEY = 'foodiehub_wishlist_v1';
  const PROMO_KEY = 'foodiehub_promo_v1';
  const FREE_DELIVERY_AT = 499;
  const DELIVERY_FEE = 39;
  const TAX_RATE = 0.05;

  const money = value => `₹${Math.round(value).toLocaleString('en-IN')}`;
  const clean = value => String(value || '').replace(/\s+/g, ' ').trim();
  const priceFrom = value => Number(String(value || '').replace(/[^0-9.]/g, '')) || 0;
  const safeParse = (value, fallback) => { try { return JSON.parse(value) ?? fallback; } catch { return fallback; } };

  const readCart = () => {
    const value = safeParse(localStorage.getItem(CART_KEY), []);
    return Array.isArray(value) ? value.filter(x => x && x.id && x.name && Number(x.price) > 0).map(x => ({
      id: String(x.id), name: String(x.name), price: Number(x.price), qty: Math.max(1, Math.min(99, Number(x.qty) || 1)),
      image: String(x.image || ''), type: String(x.type || 'FOODIEHUB PICK'), description: String(x.description || '')
    })) : [];
  };
  const saveCart = cart => localStorage.setItem(CART_KEY, JSON.stringify(cart));
  const readWishlist = () => {
    const value = safeParse(localStorage.getItem(WISH_KEY), []);
    return Array.isArray(value) ? value.map(String) : [];
  };
  const saveWishlist = list => localStorage.setItem(WISH_KEY, JSON.stringify([...new Set(list)]));

  function toast(message) {
    let node = document.querySelector('.fh-toast');
    if (!node) {
      node = document.createElement('div');
      node.className = 'fh-toast';
      Object.assign(node.style, { position: 'fixed', left: '50%', bottom: '26px', transform: 'translate(-50%, 20px)', zIndex: '99999', background: '#171b17', color: '#fff', border: '1px solid #b5ed62', borderRadius: '999px', padding: '13px 20px', font: '600 14px DM Sans, sans-serif', boxShadow: '0 12px 35px #0006', opacity: '0', transition: 'all .22s ease', maxWidth: 'calc(100vw - 32px)', textAlign: 'center' });
      document.body.appendChild(node);
    }
    node.textContent = message;
    node.style.opacity = '1'; node.style.transform = 'translate(-50%, 0)';
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => { node.style.opacity = '0'; node.style.transform = 'translate(-50%, 20px)'; }, 2600);
  }

  function getProduct(card) {
    const name = clean(card.querySelector('.food-info h3')?.textContent);
    const price = priceFrom(card.querySelector('.food-info strong')?.textContent);
    if (!name || !price) return null;
    const image = card.querySelector('.food-image img');
    return {
      id: name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
      name, price, image: image?.getAttribute('src') || '',
      type: clean(card.querySelector('.food-type')?.textContent) || 'FOODIEHUB PICK',
      description: clean(card.querySelector('.food-desc')?.textContent)
    };
  }

  function updateHeader() {
    const count = readCart().reduce((sum, item) => sum + item.qty, 0);
    document.querySelectorAll('.cart-link span').forEach(node => { node.textContent = String(count).padStart(2, '0'); });
    document.querySelectorAll('.cart-link').forEach(link => link.setAttribute('aria-label', `Shopping bag, ${count} items`));
  }

  function addToCart(product) {
    if (!product) return;
    const cart = readCart();
    const existing = cart.find(item => item.id === product.id);
    if (existing) existing.qty = Math.min(99, existing.qty + 1);
    else cart.push({ ...product, qty: 1 });
    saveCart(cart); updateHeader(); toast(`${product.name} added to your bag`);
  }

  function setupFoodCards() {
    document.querySelectorAll('.food-card').forEach(card => {
      const product = getProduct(card);
      if (!product) return;
      const quickAdd = card.querySelector('.quick-add');
      if (quickAdd) {
        quickAdd.setAttribute('role', 'button'); quickAdd.setAttribute('tabindex', '0');
        quickAdd.setAttribute('aria-label', `Add ${product.name} to bag`);
        quickAdd.addEventListener('click', event => { event.preventDefault(); event.stopPropagation(); addToCart(product); });
        quickAdd.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); addToCart(product); } });
      }
      const imageWrap = card.querySelector('.food-image');
      if (imageWrap && !imageWrap.querySelector('.fh-wishlist')) {
        if (getComputedStyle(imageWrap).position === 'static') imageWrap.style.position = 'relative';
        const wish = document.createElement('button');
        wish.type = 'button'; wish.className = 'fh-wishlist'; wish.textContent = readWishlist().includes(product.id) ? '♥' : '♡';
        wish.setAttribute('aria-label', `Save ${product.name} to wishlist`);
        Object.assign(wish.style, { position: 'absolute', top: '12px', right: '12px', zIndex: '4', width: '38px', height: '38px', border: '1px solid #ffffff80', borderRadius: '50%', background: '#111a', color: '#fff', fontSize: '21px', cursor: 'pointer' });
        wish.addEventListener('click', event => {
          event.preventDefault(); event.stopPropagation();
          const list = readWishlist();
          const exists = list.includes(product.id);
          saveWishlist(exists ? list.filter(id => id !== product.id) : [...list, product.id]);
          wish.textContent = exists ? '♡' : '♥';
          toast(exists ? 'Removed from your wishlist' : 'Saved to your wishlist');
        });
        imageWrap.appendChild(wish);
      }
    });
  }

  function cartTotals(cart) {
    const subtotal = cart.reduce((sum, item) => sum + item.price * item.qty, 0);
    const promo = localStorage.getItem(PROMO_KEY) || '';
    const discount = promo === 'FIRSTBITE' && subtotal >= 399 ? Math.round(subtotal * 0.20) : 0;
    const delivery = subtotal === 0 || subtotal >= FREE_DELIVERY_AT ? 0 : DELIVERY_FEE;
    const taxable = Math.max(0, subtotal - discount);
    const tax = Math.round(taxable * TAX_RATE);
    return { subtotal, discount, delivery, tax, total: taxable + delivery + tax };
  }

  function renderCart() {
    const container = document.querySelector('.cart-items');
    if (!container) return;
    const cart = readCart();
    const totals = cartTotals(cart);
    const titleCount = container.querySelector('.cart-title-row h2 span');
    if (titleCount) titleCount.textContent = `(${cart.reduce((n, item) => n + item.qty, 0).toString().padStart(2, '0')})`;

    container.querySelectorAll('.cart-item, .fh-empty-cart').forEach(node => node.remove());
    const note = container.querySelector('.cart-note');
    const promoBox = container.querySelector('.promo-code');
    cart.forEach(item => {
      const article = document.createElement('article'); article.className = 'cart-item';
      const img = document.createElement('img'); img.src = item.image; img.alt = item.name; img.loading = 'lazy';
      const info = document.createElement('div'); info.className = 'cart-item-info';
      const type = document.createElement('small'); type.textContent = item.type;
      const heading = document.createElement('h3'); heading.textContent = item.name;
      const desc = document.createElement('p'); desc.textContent = item.description || 'Made fresh for you';
      const remove = document.createElement('button'); remove.type = 'button'; remove.textContent = 'Remove';
      Object.assign(remove.style, { border: '0', background: 'transparent', color: 'inherit', textDecoration: 'underline', cursor: 'pointer', padding: '5px 0', font: 'inherit' });
      remove.addEventListener('click', () => changeQuantity(item.id, 0, true));
      info.append(type, heading, desc, remove);
      const quantity = document.createElement('div'); quantity.className = 'quantity-static';
      const minus = document.createElement('button'); minus.type = 'button'; minus.textContent = '−'; minus.setAttribute('aria-label', `Decrease ${item.name}`);
      const number = document.createElement('b'); number.textContent = String(item.qty);
      const plus = document.createElement('button'); plus.type = 'button'; plus.textContent = '+'; plus.setAttribute('aria-label', `Increase ${item.name}`);
      [minus, plus].forEach(button => Object.assign(button.style, { cursor: 'pointer', border: '0', background: 'transparent', color: 'inherit', font: 'inherit', padding: '4px 9px' }));
      minus.addEventListener('click', () => changeQuantity(item.id, -1)); plus.addEventListener('click', () => changeQuantity(item.id, 1));
      quantity.append(minus, number, plus);
      const linePrice = document.createElement('strong'); linePrice.textContent = money(item.price * item.qty);
      article.append(img, info, quantity, linePrice);
      if (note) container.insertBefore(article, note); else container.appendChild(article);
    });

    if (!cart.length) {
      const empty = document.createElement('div'); empty.className = 'fh-empty-cart';
      Object.assign(empty.style, { padding: '35px 20px', textAlign: 'center', border: '1px dashed #7778', borderRadius: '16px', margin: '18px 0' });
      empty.innerHTML = '<div style="font-size:42px">🛍️</div><h3>Your bag is taking a little break.</h3><p>Add something delicious from the menu.</p><a class="button button-primary" href="menu.html">Explore menu ↗</a>';
      if (note) container.insertBefore(empty, note); else container.appendChild(empty);
    }

    const promoInput = container.querySelector('#promo');
    if (promoInput && !promoInput.dataset.bound) {
      promoInput.dataset.bound = '1'; promoInput.value = localStorage.getItem(PROMO_KEY) || '';
      const applyButton = promoInput.parentElement.querySelector('button');
      applyButton?.addEventListener('click', () => {
        const code = clean(promoInput.value).toUpperCase();
        if (!code) { localStorage.removeItem(PROMO_KEY); toast('Promo code cleared'); renderCart(); return; }
        if (code !== 'FIRSTBITE') { toast('Invalid code. Try FIRSTBITE'); return; }
        if (cartTotals(readCart()).subtotal < 399) { toast('FIRSTBITE applies on orders above ₹399'); return; }
        localStorage.setItem(PROMO_KEY, code); toast('FIRSTBITE applied — 20% off'); renderCart();
      });
    } else if (promoInput) promoInput.value = localStorage.getItem(PROMO_KEY) || '';

    const summary = document.querySelector('.order-summary');
    if (summary) {
      const lines = summary.querySelectorAll('.summary-line strong');
      if (lines[0]) lines[0].textContent = money(totals.subtotal);
      if (lines[1]) lines[1].textContent = money(totals.delivery);
      if (lines[2]) lines[2].textContent = `−${money(totals.discount)}`;
      if (lines[3]) lines[3].textContent = money(totals.tax);
      const total = summary.querySelector('.summary-total strong'); if (total) total.textContent = money(totals.total);
      const checkout = summary.querySelector('.checkout-button');
      if (checkout) { checkout.setAttribute('aria-disabled', cart.length ? 'false' : 'true'); checkout.style.opacity = cart.length ? '1' : '.55'; }
    }
    if (note) {
      const p = note.querySelector('p');
      if (p) p.textContent = totals.subtotal >= FREE_DELIVERY_AT ? 'You unlocked free delivery. Enjoy!' : `Add ${money(FREE_DELIVERY_AT - totals.subtotal)} more to unlock free delivery.`;
    }
    updateHeader();
  }

  function changeQuantity(id, delta, removeAll = false) {
    let cart = readCart();
    const item = cart.find(entry => entry.id === id);
    if (!item) return;
    if (removeAll || item.qty + delta <= 0) cart = cart.filter(entry => entry.id !== id);
    else item.qty = Math.min(99, item.qty + delta);
    saveCart(cart); renderCart();
  }

  function setupSearch() {
    document.querySelectorAll('.icon-link[aria-label*="Search"], .icon-link[aria-label*="search"]').forEach(link => {
      link.addEventListener('click', event => {
        event.preventDefault();
        const query = window.prompt('Search FoodieHub menu:');
        if (query === null) return;
        const term = clean(query).toLowerCase();
        if (!term) return;
        const cards = [...document.querySelectorAll('.food-card')];
        if (cards.length) {
          let shown = 0;
          cards.forEach(card => { const match = card.textContent.toLowerCase().includes(term); card.hidden = !match; if (match) shown++; });
          document.querySelectorAll('.menu-category').forEach(section => { section.hidden = !section.querySelector('.food-card:not([hidden])'); });
          toast(shown ? `${shown} matching food item${shown === 1 ? '' : 's'} found` : 'No food items found. Try another search.');
          document.querySelector('#menu-grid')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } else {
          window.location.href = `menu.html?search=${encodeURIComponent(term)}`;
        }
      });
    });
    const params = new URLSearchParams(window.location.search);
    const initial = params.get('search');
    if (initial && document.querySelectorAll('.food-card').length) {
      const term = initial.toLowerCase(); let shown = 0;
      document.querySelectorAll('.food-card').forEach(card => { const match = card.textContent.toLowerCase().includes(term); card.hidden = !match; if (match) shown++; });
      document.querySelectorAll('.menu-category').forEach(section => { section.hidden = !section.querySelector('.food-card:not([hidden])'); });
      toast(shown ? `${shown} matching food item${shown === 1 ? '' : 's'} found` : 'No food items found.');
    }
  }

  function setupForms() {
    document.querySelector('.contact-form')?.addEventListener('submit', event => {
      event.preventDefault();
      const form = event.currentTarget;
      if (!form.reportValidity()) return;
      const name = clean(form.elements.name.value);
      toast(`Thanks, ${name}! Your demo message is ready.`);
      form.reset();
    });
    document.querySelector('.newsletter-form')?.addEventListener('submit', event => {
      event.preventDefault();
      const form = event.currentTarget;
      if (!form.reportValidity()) return;
      const email = form.querySelector('input[type="email"]');
      if (!email || !email.checkValidity()) { email?.reportValidity(); return; }
      toast('You are on the FoodieHub update list (demo)!'); form.reset();
    });
  }

  function setupCheckout() {
    const checkout = document.querySelector('.checkout-button');
    if (!checkout) return;
    checkout.addEventListener('click', event => {
      event.preventDefault();
      const cart = readCart();
      if (!cart.length) { toast('Your bag is empty. Add food first.'); return; }
      const name = window.prompt('Demo checkout — enter your name:');
      if (name === null) return;
      if (!clean(name)) { toast('Please enter your name to continue.'); return; }
      const address = window.prompt('Enter your delivery address:');
      if (address === null) return;
      if (!clean(address)) { toast('Please enter a delivery address.'); return; }
      const phone = window.prompt('Enter your 10-digit mobile number:');
      if (phone === null) return;
      if (!/^\d{10}$/.test(clean(phone))) { toast('Please enter a valid 10-digit mobile number.'); return; }
      const total = cartTotals(cart).total;
      alert(`Thank you, ${clean(name)}!\n\nYour demo order has been placed.\nTotal: ${money(total)}\nDelivery address: ${clean(address)}\n\nThis is a student project demo. No payment or real delivery will take place.`);
      saveCart([]); localStorage.removeItem(PROMO_KEY); renderCart();
    });
  }

  function setupPromoCopy() {
    document.querySelectorAll('.coupon').forEach(coupon => {
      const code = clean(coupon.querySelector('span')?.textContent);
      if (!code || !/^[A-Z0-9-]+$/.test(code)) return;
      coupon.style.cursor = 'pointer'; coupon.title = 'Click to copy';
      coupon.addEventListener('click', async () => {
        try { await navigator.clipboard.writeText(code); toast(`${code} copied`); }
        catch { toast(`Use promo code: ${code}`); }
      });
    });
  }

  function ensureInitialCart() {
    if (localStorage.getItem(CART_KEY) !== null) return;
    // Keep the two sample items already shown in the supplied cart.html on first visit.
    saveCart([
      { id: 'double-trouble-smash', name: 'Double Trouble Smash', price: 289, qty: 1, image: 'https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&w=400&q=85', type: 'SIGNATURE BURGER', description: 'Regular · House sauce' },
      { id: 'choco-lava-mood', name: 'Choco Lava Mood', price: 149, qty: 1, image: 'https://images.unsplash.com/photo-1563805042-7684c019e1cb?auto=format&fit=crop&w=400&q=85', type: 'DESSERT', description: 'Single serve' }
    ]);
  }

  function init() {
    ensureInitialCart();
    setupFoodCards(); setupSearch(); setupForms(); setupPromoCopy();
    updateHeader(); renderCart(); setupCheckout();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
