/* Password-encrypted puzzle pages. No network calls or persistent storage. */
(() => {
  'use strict';

  const VERSION = 1;
  const ITERATIONS = 600000;
  const MAX_BYTES = 20 * 1024 * 1024;
  const ENVELOPE_KEYS = ['version', 'page', 'kdf', 'iterations', 'algorithm', 'salt', 'iv', 'ciphertext'];
  const supported = () => Boolean(window.crypto && window.crypto.subtle && window.TextEncoder && window.TextDecoder);
  const validPage = page => Number.isSafeInteger(page) && page >= 2 && page <= 9999;
  const fail = message => { throw new Error(message); };

  function toBase64(bytes) {
    let binary = '';
    for (let offset = 0; offset < bytes.length; offset += 8192) {
      binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
    }
    return btoa(binary);
  }

  function fromBase64(value, expectedLength) {
    if (typeof value !== 'string' || !value.length || value.length > Math.ceil((MAX_BYTES + 16) / 3) * 4 ||
        value.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(value)) {
      fail('The encrypted page has an invalid format.');
    }
    const binary = atob(value);
    if (btoa(binary) !== value || (expectedLength && binary.length !== expectedLength)) {
      fail('The encrypted page has an invalid format.');
    }
    return Uint8Array.from(binary, character => character.charCodeAt(0));
  }

  function validateEnvelope(envelope) {
    if (!envelope || typeof envelope !== 'object' || Array.isArray(envelope) ||
        Object.keys(envelope).length !== ENVELOPE_KEYS.length ||
        !ENVELOPE_KEYS.every(key => Object.prototype.hasOwnProperty.call(envelope, key)) ||
        envelope.version !== VERSION || !validPage(envelope.page) ||
        envelope.kdf !== 'PBKDF2-SHA256' || envelope.iterations !== ITERATIONS ||
        envelope.algorithm !== 'AES-256-GCM') {
      fail('This encrypted page has an unsupported or invalid format.');
    }
    const salt = fromBase64(envelope.salt, 16);
    const iv = fromBase64(envelope.iv, 12);
    const ciphertext = fromBase64(envelope.ciphertext);
    if (ciphertext.length <= 16 || ciphertext.length > MAX_BYTES + 16) {
      fail('The encrypted page has an invalid size.');
    }
    return { salt, iv, ciphertext };
  }

  function authenticatedData(page) {
    return new TextEncoder().encode(JSON.stringify(['Jinniao Qiu puzzle page', VERSION, page, 'PBKDF2-SHA256', ITERATIONS, 'AES-256-GCM']));
  }

  async function deriveKey(password, salt, usage) {
    const bytes = new TextEncoder().encode(password);
    try {
      const material = await crypto.subtle.importKey('raw', bytes, 'PBKDF2', false, ['deriveKey']);
      return await crypto.subtle.deriveKey(
        { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: ITERATIONS },
        material, { name: 'AES-GCM', length: 256 }, false, [usage]
      );
    } finally {
      bytes.fill(0);
    }
  }

  function prepareHTML(html) {
    if (typeof html !== 'string' || !/<html(?:\s|>)/i.test(html) || !/<body(?:\s|>)/i.test(html)) {
      fail('Choose a complete puzzle HTML page.');
    }
    if (/\bid\s*=\s*["']puzzle-lock-payload["']/i.test(html)) {
      fail('This file is already encrypted. Choose its private HTML draft.');
    }
    // Transform the owner's HTML as text, without parsing draft resources into
    // a document that might load images. Raw-text elements are passed through
    // unchanged, so an example or string containing <base> is not rewritten.
    return html.replace(/<!--[\s\S]*?-->|<(script|style|textarea|title|xmp|iframe|noembed|noframes)\b[^>]*>[\s\S]*?<\/\1\s*>|<base\b(?:"[^"]*"|'[^']*'|[^'">])*>/gi, token => {
      if (/^<base\b/i.test(token)) return '';
      if (/^<!--/.test(token) && /Local review copy:/i.test(token)) return '';
      return token;
    });
  }

  function shell(envelope) {
    const page = envelope.page;
    // These labels are owner-approved public navigation, not private draft data.
    // Keep numeric page identity and authenticated encryption metadata unchanged.
    const label = page === 3 ? 'Page A-Difference' : page === 4 ? 'Page B-Parity' : `Page ${page}`;
    const pages = [{ number: 1, label: 'Page 1', file: 'puzzles.html' },
      { number: 2, label: 'Page 2', file: 'puzzles-2.html' },
      { number: 3, label: 'Page A-Difference', file: 'puzzles-3.html' },
      { number: 4, label: 'Page B-Parity', file: 'puzzles-4.html' }];
    if (!pages.some(item => item.number === page)) {
      pages.push({ number: page, label, file: `puzzles-${page}.html` });
    }
    const navigation = pages.map(item => item.number === page
      ? `<span aria-current="page">${item.label}</span>`
      : `<a href="${item.file}">${item.label}</a>`).join('\n      ');
    // Dynamic values are validated integers, base64, or the fixed labels above.
    // No password, puzzle statement, answer, or draft script appears in this shell.
    return `<!DOCTYPE html>
<html lang="en-CA">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light">
  <meta name="author" content="Jinniao Qiu">
  <meta name="robots" content="noindex, nofollow">
  <meta name="description" content="A password-protected page of Puzzles for Kids.">
  <title>Puzzles for Kids · ${label} · Jinniao Qiu</title>
  <link rel="icon" href="assets/favicon.svg" type="image/svg+xml">
  <link rel="stylesheet" href="assets/styles.css">
</head>
<body data-page="puzzles-locked">
  <a class="skip-link" href="#main-content">Skip to main content</a>
  <header class="site-header">
    <div class="nav-shell">
      <a class="wordmark" href="index.html" aria-label="Jinniao Qiu, home">
        <span class="monogram" aria-hidden="true">JQ</span>
        <span class="wordmark-text">Jinniao Qiu<small>MATHEMATICS · UCALGARY</small></span>
      </a>
      <button class="menu-toggle" type="button" aria-controls="site-nav" aria-expanded="false" hidden>Menu <span aria-hidden="true">+</span></button>
      <nav id="site-nav" class="site-nav" aria-label="Main navigation">
        <a href="index.html">Home</a>
        <a href="publications.html">Research &amp; Teaching</a>
        <a href="group.html" aria-current="location">More</a>
      </nav>
    </div>
  </header>
  <main id="main-content" class="page-shell content" tabindex="-1">
    <header class="page-heading compact-heading">
      <p class="eyebrow">PUZZLES FOR KIDS · ${label}</p>
      <h1>${page === 3 || page === 4 ? label : 'A little more to explore'}</h1>
      <p class="page-subtitle">Enter the password to open this collection of 15 puzzles.</p>
    </header>
    <section class="puzzle-lock-panel" aria-labelledby="puzzle-lock-heading">
      <h2 id="puzzle-lock-heading">Open ${label}</h2>
      <form id="puzzle-lock-form" class="puzzle-lock-form" hidden>
        <label for="puzzle-lock-password">Password</label>
        <input id="puzzle-lock-password" name="password" type="password" autocomplete="off" required aria-describedby="puzzle-lock-status" spellcheck="false" autocapitalize="none">
        <button type="submit">Open puzzles</button>
      </form>
      <p id="puzzle-lock-status" class="puzzle-lock-status" role="status" aria-live="polite" aria-atomic="true"></p>
      <noscript><p class="puzzle-lock-notice">JavaScript is needed to unlock this encrypted page. You can read all 15 puzzles on <a href="puzzles.html">Page 1</a> without JavaScript.</p></noscript>
    </section>
    <nav class="puzzle-jump-links puzzle-pagination" aria-label="Puzzle pages">
      ${navigation}
    </nav>
  </main>
  <footer class="site-footer">
    <div class="footer-shell">
      <p><strong>Jinniao Qiu</strong><br>Department of Mathematics and Statistics · University of Calgary</p>
      <p class="footer-links"><a href="mailto:jinniao.qiu@ucalgary.ca">Contact</a><span aria-hidden="true">/</span><a href="https://profiles.ucalgary.ca/jinniao-qiu">UCalgary profile</a><br><span class="copyright">© 2026 Jinniao Qiu</span></p>
    </div>
  </footer>
  <script id="puzzle-lock-payload" type="application/json">${JSON.stringify(envelope)}</script>
  <script src="assets/site.js" defer></script>
  <script src="assets/puzzle-lock.js" defer></script>
</body>
</html>
`;
  }

  async function encryptHTML(html, password, page) {
    if (!supported()) fail('This browser cannot encrypt pages. Use a current browser with Web Crypto support.');
    if (!validPage(page)) fail('The page number must be an integer from 2 to 9999.');
    if (typeof password !== 'string' || Array.from(password).length < 16 || !password.trim()) {
      fail('Use a long, unique password or passphrase of at least 16 characters.');
    }
    const plaintext = new TextEncoder().encode(prepareHTML(html));
    if (plaintext.length > MAX_BYTES) fail('The HTML page is too large (maximum 20 MB).');
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    try {
      const key = await deriveKey(password, salt, 'encrypt');
      const ciphertext = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv, additionalData: authenticatedData(page), tagLength: 128 }, key, plaintext
      );
      return shell({ version: VERSION, page, kdf: 'PBKDF2-SHA256', iterations: ITERATIONS,
        algorithm: 'AES-256-GCM', salt: toBase64(salt), iv: toBase64(iv), ciphertext: toBase64(new Uint8Array(ciphertext)) });
    } finally {
      plaintext.fill(0);
    }
  }

  async function decryptHTML(envelope, password) {
    if (!supported()) fail('This browser cannot unlock encrypted pages. Use a current browser and the HTTPS website.');
    const { salt, iv, ciphertext } = validateEnvelope(envelope);
    if (typeof password !== 'string') fail('Enter the page password.');
    const key = await deriveKey(password, salt, 'decrypt');
    const plaintext = new Uint8Array(await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv, additionalData: authenticatedData(envelope.page), tagLength: 128 }, key, ciphertext
    ));
    try {
      return new TextDecoder('utf-8', { fatal: true }).decode(plaintext);
    } finally {
      plaintext.fill(0);
    }
  }

  window.PuzzleLock = Object.freeze({ encryptHTML, decryptHTML, supported });

  const payload = document.getElementById('puzzle-lock-payload');
  if (!payload) return;
  const form = document.getElementById('puzzle-lock-form');
  const passwordInput = document.getElementById('puzzle-lock-password');
  const status = document.getElementById('puzzle-lock-status');
  if (!form || !passwordInput || !status) return;
  if (!supported()) {
    status.textContent = 'This browser cannot unlock encrypted pages. Please use a current browser and the HTTPS website. Page 1 remains available below.';
    return;
  }
  let envelope;
  try {
    envelope = JSON.parse(payload.textContent);
    validateEnvelope(envelope);
  } catch (_) {
    status.textContent = 'This encrypted page could not be read. Please reload it or contact Jinniao Qiu.';
    return;
  }
  form.hidden = false;
  status.textContent = '';
  let busy = false;
  passwordInput.addEventListener('input', () => {
    passwordInput.removeAttribute('aria-invalid');
    if (!busy) status.textContent = '';
  });
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (busy) return;
    if (!passwordInput.value) {
      status.textContent = 'Enter the page password.';
      passwordInput.setAttribute('aria-invalid', 'true');
      passwordInput.focus();
      return;
    }
    busy = true;
    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    form.setAttribute('aria-busy', 'true');
    status.textContent = 'Opening the puzzles…';
    try {
      const html = await decryptHTML(envelope, passwordInput.value);
      passwordInput.value = '';
      // The authenticated document is owner-authored HTML. Replacing the whole
      // document runs its trusted inline controls and preserves relative links.
      document.open();
      document.write(html);
      document.close();
    } catch (_) {
      passwordInput.value = '';
      status.textContent = 'The password did not unlock this page. Try again; passwords are case-sensitive. If the password is correct, reload the page and try once more.';
      passwordInput.setAttribute('aria-invalid', 'true');
      passwordInput.focus();
    } finally {
      busy = false;
      button.disabled = false;
      form.removeAttribute('aria-busy');
    }
  });
})();
