// Products Catalog for Demo Store
const PRODUCTS = [
  {
    id: 'PROD-01',
    name: 'AuraPods Pro Gen 2',
    category: 'Audio',
    icon: '🎧',
    desc: 'Spatial audio with active noise cancellation and 36-hr battery.',
    price: 1.00 // ₹1 for easy testing
  },
  {
    id: 'PROD-02',
    name: 'Lumio Mech Keychron',
    category: 'Peripherals',
    icon: '⌨️',
    desc: 'Hot-swappable tactile RGB wireless keyboard with coiled cable.',
    price: 2.00 // ₹2 for testing
  },
  {
    id: 'PROD-03',
    name: 'Nova Smart Watch Ultra',
    category: 'Wearables',
    icon: '⌚',
    desc: 'Titanium chassis, AMOLED sapphire glass, heart rate & SpO2.',
    price: 5.00 // ₹5 for testing
  },
  {
    id: 'PROD-04',
    name: 'DeskBeam Ambient Light',
    category: 'Lighting',
    icon: '💡',
    desc: 'Screen-mounted dual color-sync bar with wireless remote.',
    price: 10.00
  }
];

let selectedAmount = 1.00;
let selectedTitle = 'Quick Test Order';
let orderCounter = 1001;

// Log to UI inspector
function logEvent(type, message, data = null) {
  const logBox = document.getElementById('liveLogBox');
  if (!logBox) return;

  const time = new Date().toLocaleTimeString();
  const entry = document.createElement('div');
  entry.className = 'log-entry';

  let typeClass = 'log-type-info';
  if (type === 'SUCCESS') typeClass = 'log-type-success';
  if (type === 'WARN' || type === 'FAILED') typeClass = 'log-type-warn';

  let dataStr = data ? ` → ${JSON.stringify(data)}` : '';
  entry.innerHTML = `
    <span class="log-time">[${time}]</span>
    <span class="${typeClass}">[${type}]</span>
    <span>${message}${dataStr}</span>
  `;

  logBox.prepend(entry);
}

// Render Products Grid
function renderProducts() {
  const grid = document.getElementById('productsGrid');
  if (!grid) return;

  grid.innerHTML = PRODUCTS.map(prod => `
    <div class="product-card">
      <div class="card-top">
        <div class="product-icon-wrap">${prod.icon}</div>
        <span class="product-category">${prod.category}</span>
      </div>
      <h3 class="product-name">${prod.name}</h3>
      <p class="product-desc">${prod.desc}</p>
      <div class="product-footer">
        <span class="product-price">₹${prod.price.toFixed(2)}</span>
        <button 
          class="btn-buy-card"
          data-youpi-pay
          data-order-id="AURA-${prod.id}-${Date.now().toString().slice(-4)}"
          data-amount="${prod.price.toFixed(2)}"
          data-name="${prod.name}"
          data-currency="INR"
          onclick="buyProduct('${prod.id}')"
        >
          ⚡ Pay ₹${prod.price.toFixed(2)}
        </button>
      </div>
    </div>
  `).join('');
}

// Set custom amount from chips
function setQuickAmount(amount, chipElement) {
  selectedAmount = Number(amount);
  document.getElementById('quickPriceDisplay').textContent = `₹${selectedAmount.toFixed(2)}`;

  document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
  if (chipElement) chipElement.classList.add('active');

  logEvent('INFO', `Selected test amount: ₹${selectedAmount.toFixed(2)}`);
}

// Buy a specific product via programmatic API
function buyProduct(prodId) {
  const prod = PRODUCTS.find(p => p.id === prodId);
  if (!prod) return;

  launchPayment({
    orderId: `AURA-${prod.id}-${Date.now().toString().slice(-4)}`,
    amount: prod.price,
    name: prod.name,
    desc: prod.desc
  });
}

// Buy quick test box
function buyQuickBox() {
  launchPayment({
    orderId: `AURA-QUICK-${Date.now().toString().slice(-4)}`,
    amount: selectedAmount,
    name: 'Aura Store Quick Checkout',
    desc: 'Instant UPI Test Purchase'
  });
}

// Unified Payment Launcher using window.Youpi.pay()
async function launchPayment({ orderId, amount, name, desc }) {
  logEvent('INFO', `Initiating payment for ${orderId} (₹${amount.toFixed(2)})...`);

  let checkoutUrl = '';
  try {
    const res = await fetch('/api/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId, amount, name, desc })
    });
    if (res.ok) {
      const data = await res.json();
      checkoutUrl = data.checkoutUrl;
      logEvent('INFO', `Session active: ${data.paymentId || 'ok'}`);
    }
  } catch (e) {
    console.warn('Direct backend checkout error, fallback to SDK auto-create:', e);
  }

  try {
    window.Youpi.pay({
      checkoutUrl: checkoutUrl || undefined,
      portalUrl: 'http://localhost:7000',
      apiUrl: 'http://localhost:7000',
      order_id: orderId,
      amount: amount,
      currency: 'INR',
      name: name || 'Aura Store',
      description: desc || 'Direct UPI Order',
      customer: {
        name: 'Demo Buyer',
        email: 'buyer@example.com',
        phone: '9876543210'
      },
      metadata: {
        store: 'AuraGear Store',
        environment: 'Local Testing'
      },
      handler: function(response) {
        logEvent('SUCCESS', `Payment Verified by Banking Observer! UTR: ${response.utr || 'Auto-matched'}`);
        showSuccessModal(orderId, amount, response.utr || 'UTR-849204910291');
      },
      onClose: function() {
        logEvent('INFO', 'Customer closed the checkout modal');
      }
    });
  } catch (err) {
    logEvent('FAILED', `Payment error: ${err.message}`);
  }
}

// Listen for official normalized browser CustomEvents
window.addEventListener('youpi:payment:success', (e) => {
  logEvent('SUCCESS', 'Received youpi:payment:success event', e.detail);
  const detail = e.detail || {};
  showSuccessModal(detail.order_id || 'ORDER-LIVE', detail.amount_received || selectedAmount, detail.utr || 'UTR-VERIFIED');
});

window.addEventListener('youpi:payment:failed', (e) => {
  logEvent('FAILED', 'Received youpi:payment:failed event', e.detail);
});

window.addEventListener('youpi:payment:cancelled', (e) => {
  logEvent('WARN', 'Received youpi:payment:cancelled event', e.detail);
});

window.addEventListener('youpi:payment:expired', (e) => {
  logEvent('WARN', 'Received youpi:payment:expired event', e.detail);
});

// Modal handlers
function showSuccessModal(orderId, amount, utr) {
  document.getElementById('modalOrderId').textContent = orderId;
  document.getElementById('modalAmount').textContent = `₹${Number(amount).toFixed(2)}`;
  document.getElementById('modalUtr').textContent = utr;
  document.getElementById('successModal').classList.add('active');
}

function closeModal() {
  document.getElementById('successModal').classList.remove('active');
}

// Tab switcher in inspector
function switchTab(tabId, btn) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');

  const codeBox = document.getElementById('codeBox');
  if (tabId === 'button') {
    codeBox.textContent = `<!-- 1. Include Script in <head> -->
<script src="http://localhost:7000/youpi.js" data-youpi-key="YOUR_KEY"></script>

<!-- 2. Zero-JS Button -->
<button
  data-youpi-pay
  data-order-id="ORD-1001"
  data-amount="499.00"
  data-currency="INR"
  data-name="Aura Store">
  ⚡ Buy Now
</button>`;
  } else if (tabId === 'js') {
    codeBox.textContent = `// Programmatic JavaScript / React Trigger
window.Youpi.pay({
  order_id: "ORD-1001",
  amount: 499.00,
  currency: "INR",
  customer: {
    name: "Mohit",
    phone: "9876543210"
  },
  handler: function(response) {
    console.log("Payment Confirmed! UTR:", response.utr);
  }
});`;
  } else if (tabId === 'webhook') {
    codeBox.textContent = `// Express Webhook Verification (HMAC-SHA256)
app.post('/api/webhook', express.raw({ type: 'application/json' }), (req, res) => {
  const signature = req.headers['x-gateway-signature'];
  const expected = 'sha256=' + crypto.createHmac('sha256', secret).update(req.body).digest('hex');
  
  if (signature === expected) {
    const payload = JSON.parse(req.body.toString());
    if (payload.event === 'SUCCESS') {
      db.orders.markPaid(payload.orderId, payload.utr);
    }
  }
  res.json({ received: true });
});`;
  }
}

// Initialise
document.addEventListener('DOMContentLoaded', () => {
  renderProducts();
  logEvent('INFO', 'AuraGear Store initialized & connected to YouPI Gateway.');
});
