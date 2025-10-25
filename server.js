const express = require('express');
const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret';

app.use(express.json());

// Demo user store (replace with real DB in production)
const DEMO_USER = {
  id: 1,
  username: 'admin',
  password: 'password123',
};

// Root helper
app.get('/', (req, res) => {
  res.json({ message: 'API is up', endpoints: ['/public', '/login', '/profile', '/demo'] });
});

// Login route issues JWT on valid credentials
app.post('/login', (req, res) => {
  const { username, password } = req.body || {};

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }

  if (username === DEMO_USER.username && password === DEMO_USER.password) {
    const token = jwt.sign(
      { userId: DEMO_USER.id, username: DEMO_USER.username },
      JWT_SECRET,
      { expiresIn: '1h' }
    );
    return res.json({ token });
  }
  return res.status(401).json({ error: 'Invalid credentials' });
});

// JWT verification middleware
function verifyJWT(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader) {
    return res.status(401).json({ error: 'Missing Authorization header' });
  }

  const [scheme, token] = authHeader.split(' ');
  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'Invalid Authorization header format' });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// Unprotected route
app.get('/public', (req, res) => {
  res.json({ message: 'This is a public endpoint' });
});

// Protected route
app.get('/profile', verifyJWT, (req, res) => {
  res.json({ message: 'Protected data', user: req.user });
});

// Demo HTML page to screenshot outputs
app.get('/demo', (req, res) => {
  res.type('html').send(`<!doctype html>
  <html lang="en">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>JWT Demo</title>
      <style>
        body { font-family: system-ui, Arial, sans-serif; margin: 24px; }
        h1 { margin-bottom: 8px; }
        .desc { color: #555; margin-bottom: 16px; }
        .grid { display: grid; grid-template-columns: repeat(2, minmax(320px, 1fr)); gap: 16px; }
        .card { border: 1px solid #ccc; border-radius: 8px; padding: 12px; background: #fafafa; }
        .card h2 { margin: 0 0 8px; font-size: 16px; }
        pre { background: #111; color: #0f0; padding: 8px; border-radius: 6px; overflow: auto; max-height: 240px; }
        .controls { margin: 16px 0; display: flex; gap: 8px; flex-wrap: wrap; }
        input { padding: 6px 8px; }
        button { padding: 6px 12px; cursor: pointer; }
        .ok { color: #0a7; }
        .err { color: #d33; }
      </style>
    </head>
    <body>
      <h1>JWT Protected Routes Demo</h1>
      <div class="desc">Click "Run Demo" to call <code>/public</code>, <code>/login</code>, and <code>/profile</code>. Then take a screenshot.</div>

      <div class="controls">
        <label>Username: <input id="username" value="admin" /></label>
        <label>Password: <input id="password" value="password123" type="password" /></label>
        <button id="runBtn">Run Demo</button>
        <span id="status"></span>
      </div>

      <div class="grid">
        <div class="card">
          <h2>/public</h2>
          <pre id="publicOut">(waiting)</pre>
        </div>
        <div class="card">
          <h2>/login</h2>
          <pre id="loginOut">(waiting)</pre>
        </div>
        <div class="card">
          <h2>Token</h2>
          <pre id="tokenOut">(waiting)</pre>
        </div>
        <div class="card">
          <h2>/profile (protected)</h2>
          <pre id="profileOut">(waiting)</pre>
        </div>
      </div>

      <script>
        const el = (id) => document.getElementById(id);
        const format = (obj) => JSON.stringify(obj, null, 2);

        async function runDemo() {
          el('status').textContent = 'Running...';
          el('status').className = '';
          const username = el('username').value;
          const password = el('password').value;

          try {
            // /public
            const pubRes = await fetch('/public');
            const pubJson = await pubRes.json();
            el('publicOut').textContent = format(pubJson);

            // /login
            const loginRes = await fetch('/login', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ username, password })
            });
            const loginJson = await loginRes.json();
            el('loginOut').textContent = format(loginJson);

            if (!loginRes.ok || !loginJson.token) {
              el('status').textContent = 'Login failed';
              el('status').className = 'err';
              el('tokenOut').textContent = '(no token)';
              el('profileOut').textContent = '(skipped)';
              return;
            }

            // Token
            const token = loginJson.token;
            el('tokenOut').textContent = token;

            // /profile
            const profRes = await fetch('/profile', {
              headers: { 'Authorization': 'Bearer ' + token }
            });
            const profJson = await profRes.json();
            el('profileOut').textContent = format(profJson);

            if (profRes.ok) {
              el('status').textContent = 'Success';
              el('status').className = 'ok';
            } else {
              el('status').textContent = 'Profile request failed';
              el('status').className = 'err';
            }
          } catch (e) {
            el('status').textContent = 'Error: ' + e.message;
            el('status').className = 'err';
          }
        }

        el('runBtn').addEventListener('click', runDemo);
      </script>
    </body>
  </html>`);
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Error handler: return JSON on invalid JSON payloads and other errors
app.use((err, req, res, next) => {
  const isJsonParseError = err && (err.type === 'entity.parse.failed' || err instanceof SyntaxError);
  if (isJsonParseError) {
    return res.status(400).json({ error: 'Invalid JSON payload' });
  }
  console.error(err);
  return res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});