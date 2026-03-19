// ── FX Dashboard App ──

const MAJOR_PAIRS = ['EUR', 'GBP', 'JPY', 'CHF', 'AUD', 'CAD', 'NZD', 'CNY', 'HKD', 'SGD'];

// ── Fetch Live FX Rates ──
async function fetchRates() {
  try {
    // Current rates
    const res = await fetch('https://api.frankfurter.dev/v1/latest?base=USD');
    const data = await res.json();

    // Yesterday's rates for change calculation
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    // Skip weekends
    const day = yesterday.getDay();
    if (day === 0) yesterday.setDate(yesterday.getDate() - 2);
    if (day === 6) yesterday.setDate(yesterday.getDate() - 1);
    const yStr = yesterday.toISOString().split('T')[0];

    const prevRes = await fetch(`https://api.frankfurter.dev/v1/${yStr}?base=USD`);
    const prevData = await prevRes.json();

    renderRates(data.rates, prevData.rates);
    document.getElementById('last-updated').textContent =
      `Last updated: ${new Date().toLocaleString()}`;
  } catch (err) {
    console.error('Rate fetch error:', err);
    document.getElementById('rates-grid').innerHTML =
      '<p style="color:var(--text-muted)">Unable to load rates. Please try again later.</p>';
  }
}

function renderRates(current, previous) {
  const grid = document.getElementById('rates-grid');
  grid.innerHTML = '';

  MAJOR_PAIRS.forEach(currency => {
    const rate = current[currency];
    const prevRate = previous[currency];
    if (!rate) return;

    const change = prevRate ? ((rate - prevRate) / prevRate * 100) : 0;
    const direction = change > 0.01 ? 'up' : change < -0.01 ? 'down' : 'flat';
    const arrow = direction === 'up' ? '▲' : direction === 'down' ? '▼' : '─';

    // For USD-based pairs, show how many units of foreign currency per 1 USD
    // For JPY, show 2 decimal places; for others, 4
    const decimals = currency === 'JPY' ? 2 : 4;

    const card = document.createElement('div');
    card.className = 'rate-card';
    card.innerHTML = `
      <div class="rate-pair">USD/${currency}</div>
      <div class="rate-value">${rate.toFixed(decimals)}</div>
      <div class="rate-change ${direction}">${arrow} ${Math.abs(change).toFixed(2)}%</div>
    `;
    grid.appendChild(card);
  });
}

// ── Fetch FX News Headlines ──
async function fetchHeadlines() {
  try {
    // Use a free RSS-to-JSON proxy for FX news from various sources
    const feeds = [
      {
        url: 'https://api.rss2json.com/v1/api.json?rss_url=https%3A%2F%2Fwww.forexlive.com%2Ffeed',
        source: 'ForexLive'
      },
      {
        url: 'https://api.rss2json.com/v1/api.json?rss_url=https%3A%2F%2Fwww.dailyfx.com%2Ffeeds%2Fall',
        source: 'DailyFX'
      }
    ];

    let allHeadlines = [];

    const results = await Promise.allSettled(
      feeds.map(feed =>
        fetch(feed.url)
          .then(r => r.json())
          .then(data => {
            if (data.status === 'ok' && data.items) {
              return data.items.slice(0, 8).map(item => ({
                title: item.title,
                link: item.link,
                pubDate: item.pubDate,
                source: feed.source,
                description: stripHtml(item.description || '').slice(0, 200)
              }));
            }
            return [];
          })
      )
    );

    results.forEach(r => {
      if (r.status === 'fulfilled') allHeadlines.push(...r.value);
    });

    // Sort by date, most recent first
    allHeadlines.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));

    if (allHeadlines.length === 0) {
      // Fallback headlines if feeds are unavailable
      allHeadlines = getFallbackHeadlines();
    }

    renderHeadlines(allHeadlines.slice(0, 10));
  } catch (err) {
    console.error('Headlines fetch error:', err);
    renderHeadlines(getFallbackHeadlines());
  }
}

function stripHtml(html) {
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  return tmp.textContent || tmp.innerText || '';
}

function getFallbackHeadlines() {
  return [
    { title: 'Fed Policy Outlook Remains Key Driver for USD', source: 'Market Analysis', pubDate: new Date().toISOString(), link: '#', description: 'Markets continue to watch Federal Reserve communications for clues on the path of interest rates.' },
    { title: 'EUR/USD Consolidates Near Key Support Levels', source: 'Technical Analysis', pubDate: new Date().toISOString(), link: '#', description: 'The euro holds steady against the dollar as traders await upcoming economic data releases.' },
    { title: 'GBP Strengthens on Positive UK Economic Data', source: 'Market Analysis', pubDate: new Date().toISOString(), link: '#', description: 'Sterling gains after better-than-expected GDP and employment figures from the UK.' },
    { title: 'JPY Weakens as BOJ Maintains Ultra-Loose Policy', source: 'Central Banks', pubDate: new Date().toISOString(), link: '#', description: 'The yen continues to face pressure as the Bank of Japan diverges from global tightening.' },
    { title: 'AUD/USD Eyes Commodity Price Swings', source: 'Market Analysis', pubDate: new Date().toISOString(), link: '#', description: 'The Australian dollar remains sensitive to iron ore and copper price movements.' },
    { title: 'Emerging Market Currencies Face Headwinds', source: 'Global FX', pubDate: new Date().toISOString(), link: '#', description: 'EM currencies struggle as risk appetite wanes amid global growth concerns.' },
    { title: 'CHF Sees Safe-Haven Demand Amid Geopolitical Tensions', source: 'Market Analysis', pubDate: new Date().toISOString(), link: '#', description: 'The Swiss franc benefits from flight-to-safety flows as geopolitical risks rise.' },
    { title: 'CAD Tracks Oil Prices Lower', source: 'Commodities FX', pubDate: new Date().toISOString(), link: '#', description: 'The Canadian dollar weakens in tandem with declining crude oil prices.' },
  ];
}

function renderHeadlines(headlines) {
  const list = document.getElementById('headlines-list');
  list.innerHTML = '';

  headlines.forEach(h => {
    const a = document.createElement('a');
    a.className = 'headline-card';
    a.href = h.link;
    a.target = '_blank';
    a.rel = 'noopener';

    const timeAgo = getTimeAgo(new Date(h.pubDate));

    a.innerHTML = `
      <div class="headline-source">${h.source}</div>
      <div class="headline-title">${h.title}</div>
      ${h.description ? `<div class="headline-desc">${h.description}</div>` : ''}
      <div class="headline-time">${timeAgo}</div>
    `;
    list.appendChild(a);
  });
}

function getTimeAgo(date) {
  const seconds = Math.floor((new Date() - date) / 1000);
  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

// ── Trading Sessions ──
function renderSessions() {
  const now = new Date();
  const utcHour = now.getUTCHours();

  const sessions = [
    { name: 'Sydney', open: 21, close: 6, city: 'Sydney, Australia' },
    { name: 'Tokyo', open: 0, close: 9, city: 'Tokyo, Japan' },
    { name: 'London', open: 7, close: 16, city: 'London, UK' },
    { name: 'New York', open: 12, close: 21, city: 'New York, USA' },
  ];

  const grid = document.getElementById('sessions-grid');
  grid.innerHTML = '';

  sessions.forEach(s => {
    let isOpen;
    if (s.open < s.close) {
      isOpen = utcHour >= s.open && utcHour < s.close;
    } else {
      isOpen = utcHour >= s.open || utcHour < s.close;
    }

    // Don't show as open on weekends
    const dayOfWeek = now.getUTCDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) isOpen = false;

    const card = document.createElement('div');
    card.className = 'session-card';
    card.innerHTML = `
      <div class="session-indicator ${isOpen ? 'open' : 'closed'}"></div>
      <div>
        <div class="session-name">${s.name}</div>
        <div class="session-hours">${formatHour(s.open)} – ${formatHour(s.close)} UTC</div>
      </div>
      <div class="session-status ${isOpen ? 'open' : 'closed'}">${isOpen ? 'Open' : 'Closed'}</div>
    `;
    grid.appendChild(card);
  });
}

function formatHour(h) {
  return `${h.toString().padStart(2, '0')}:00`;
}

// ── Initialize ──
function init() {
  fetchRates();
  fetchHeadlines();
  renderSessions();

  // Refresh rates every 60 seconds
  setInterval(fetchRates, 60000);
  // Refresh headlines every 5 minutes
  setInterval(fetchHeadlines, 300000);
  // Refresh sessions every minute
  setInterval(renderSessions, 60000);
}

init();
