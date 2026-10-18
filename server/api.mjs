import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { mkdir, readFile, readdir, rename, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';

const dataRoot = path.resolve(process.env.AXIS_DATA_DIR || '.axis-data');
const accountsPath = path.join(dataRoot, 'accounts.json');
const sessionsPath = path.join(dataRoot, 'sessions.json');
const designsPath = path.join(dataRoot, 'designs');
const sharesPath = path.join(dataRoot, 'shares');
const sessions = new Map();
const attempts = new Map();
let initialized;
let writes = Promise.resolve();

const safeEqual = (a, b) => {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
};
const digest = (value) => createHash('sha256').update(value).digest('hex');
const enqueue = (action) => {
  const next = writes.then(action, action);
  writes = next.catch(() => {});
  return next;
};
async function jsonFile(file, fallback) {
  try {
    return JSON.parse(await readFile(file, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return fallback;
    throw error;
  }
}
async function atomicJson(file, value) {
  const temp = `${file}.${randomBytes(6).toString('hex')}.tmp`;
  await writeFile(temp, JSON.stringify(value), { mode: 0o600 });
  await rename(temp, file);
}
function initialize() {
  if (!initialized)
    initialized = (async () => {
      await Promise.all([mkdir(designsPath, { recursive: true }), mkdir(sharesPath, { recursive: true })]);
      const stored = await jsonFile(sessionsPath, []);
      for (const session of stored)
        if (session.expiresAt > Date.now()) sessions.set(session.hash, session);
      await persistSessions();
    })();
  return initialized;
}
async function persistSessions() {
  await atomicJson(sessionsPath, [...sessions.values()]);
}
function respond(res, status, value, headers = {}) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  for (const [key, val] of Object.entries(headers)) res.setHeader(key, val);
  res.end(JSON.stringify(value));
}
function cookie(req, token, clear = false) {
  const secure = req.socket?.encrypted || req.headers['x-forwarded-proto'] === 'https';
  return `axis_session=${clear ? '' : token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${clear ? 0 : 60 * 60 * 24 * 30}${secure ? '; Secure' : ''}`;
}
function cookieToken(req) {
  const raw = req.headers.cookie ?? '';
  const pair = raw.split(';').map((part) => part.trim()).find((part) => part.startsWith('axis_session='));
  return pair ? decodeURIComponent(pair.slice('axis_session='.length)) : '';
}
async function body(req, maxBytes = 100 * 1024 * 1024) {
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > maxBytes) throw Object.assign(new Error('O conteúdo excede o limite de 100 MB.'), { status: 413 });
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw Object.assign(new Error('Envie um JSON válido.'), { status: 400 });
  }
}
const userView = ({ id, username, email, createdAt }) => ({ id, username, email, createdAt });
async function currentUser(req) {
  const token = cookieToken(req);
  if (!token) return null;
  const hash = digest(token);
  const session = sessions.get(hash);
  if (!session) return null;
  if (session.expiresAt <= Date.now()) {
    sessions.delete(hash);
    await persistSessions();
    return null;
  }
  const users = await jsonFile(accountsPath, []);
  return users.find((user) => user.id === session.userId) ?? null;
}
async function createSession(req, res, user) {
  const token = randomBytes(32).toString('base64url');
  const session = { hash: digest(token), userId: user.id, expiresAt: Date.now() + 30 * 86400_000 };
  sessions.set(session.hash, session);
  await persistSessions();
  res.setHeader('Set-Cookie', cookie(req, token));
}
function checkRateLimit(req, key) {
  const ip = req.socket?.remoteAddress ?? 'unknown';
  const id = `${key}:${ip}`;
  const now = Date.now();
  const entry = attempts.get(id) ?? { count: 0, resetAt: now + 60_000 };
  if (entry.resetAt <= now) {
    entry.count = 0;
    entry.resetAt = now + 60_000;
  }
  entry.count++;
  attempts.set(id, entry);
  return entry.count <= 12;
}
const designFile = (id) => path.join(designsPath, `${id}.json`);
const shareFile = (id) => path.join(sharesPath, `${id}.json`);
const validId = (id) => /^[0-9a-f-]{36}$/i.test(id);
async function ownedDesign(id, user) {
  if (!validId(id)) return null;
  const doc = await jsonFile(designFile(id), null);
  return doc?.ownerId === user.id ? doc : null;
}
async function saveDesign(doc) {
  await atomicJson(designFile(doc.id), doc);
}
async function getShare(token) {
  if (!/^[a-zA-Z0-9_-]{32}$/.test(token)) return null;
  const ref = await jsonFile(shareFile(token), null);
  if (!ref || !validId(ref.designId)) return null;
  const doc = await jsonFile(designFile(ref.designId), null);
  return doc?.visibility === 'link' && doc?.shareId === token ? doc : null;
}
async function removeOldShare(doc) {
  if (!doc.shareId) return;
  await unlink(shareFile(doc.shareId)).catch(() => {});
}
async function handle(req, res, next) {
  if (!req.url?.startsWith('/api/')) return next();
  const url = new URL(req.url, 'http://axis.local');
  const method = req.method ?? 'GET';
  try {
    await initialize();
    if (method === 'GET' && url.pathname === '/api/auth/session') {
      const user = await currentUser(req);
      return respond(res, 200, { user: user ? userView(user) : null });
    }
    if (method === 'POST' && url.pathname === '/api/auth/register') {
      if (!checkRateLimit(req, 'register')) return respond(res, 429, { error: 'Muitas tentativas. Aguarde um minuto e tente novamente.' });
      const input = await body(req, 32_000);
      const username = typeof input.username === 'string' ? input.username.trim() : '';
      const email = typeof input.email === 'string' ? input.email.trim().toLowerCase() : '';
      const password = typeof input.password === 'string' ? input.password : '';
      if (!/^[\p{L}\p{N}_-]{3,24}$/u.test(username))
        return respond(res, 400, { error: 'Use um nome de usuário de 3 a 24 caracteres: letras, números, _ ou -.' });
      if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
        return respond(res, 400, { error: 'Informe um e-mail válido.' });
      if (password.length < 10 || password.length > 128)
        return respond(res, 400, { error: 'A senha deve ter entre 10 e 128 caracteres.' });
      const user = await enqueue(async () => {
        const users = await jsonFile(accountsPath, []);
        if (users.some((entry) => entry.email === email))
          throw Object.assign(new Error('Este e-mail já tem uma conta. Entre ou use outro e-mail.'), { status: 409 });
        if (users.some((entry) => entry.username.toLowerCase() === username.toLowerCase()))
          throw Object.assign(new Error('Este nome de usuário já está em uso.'), { status: 409 });
        const salt = randomBytes(16).toString('hex');
        const passwordHash = scryptSync(password, salt, 64).toString('hex');
        const created = { id: randomBytes(16).toString('hex'), username, email, salt, passwordHash, createdAt: Date.now() };
        await atomicJson(accountsPath, [...users, created]);
        return created;
      });
      await createSession(req, res, user);
      return respond(res, 201, { user: userView(user) });
    }
    if (method === 'POST' && url.pathname === '/api/auth/login') {
      if (!checkRateLimit(req, 'login')) return respond(res, 429, { error: 'Muitas tentativas. Aguarde um minuto e tente novamente.' });
      const input = await body(req, 32_000);
      const email = typeof input.email === 'string' ? input.email.trim().toLowerCase() : '';
      const password = typeof input.password === 'string' ? input.password : '';
      const users = await jsonFile(accountsPath, []);
      const user = users.find((entry) => entry.email === email);
      const calculated = scryptSync(password.slice(0, 128), user?.salt ?? 'axis-invalid-salt', 64).toString('hex');
      if (!user || !safeEqual(calculated, user.passwordHash))
        return respond(res, 401, { error: 'E-mail ou senha incorretos.' });
      await createSession(req, res, user);
      return respond(res, 200, { user: userView(user) });
    }
    if (method === 'DELETE' && url.pathname === '/api/auth/session') {
      const token = cookieToken(req);
      if (token) sessions.delete(digest(token));
      await persistSessions();
      res.setHeader('Set-Cookie', cookie(req, '', true));
      return respond(res, 200, { ok: true });
    }
    const user = await currentUser(req);
    if (method === 'GET' && url.pathname.startsWith('/api/shared/')) {
      const doc = await getShare(url.pathname.slice('/api/shared/'.length));
      return doc ? respond(res, 200, { document: doc }) : respond(res, 404, { error: 'Este link não está disponível.' });
    }
    if (method === 'GET' && url.pathname.startsWith('/api/public/')) {
      const id = url.pathname.slice('/api/public/'.length);
      const doc = validId(id) ? await jsonFile(designFile(id), null) : null;
      return doc?.visibility === 'public'
        ? respond(res, 200, { document: doc })
        : respond(res, 404, { error: 'Este design público não está disponível.' });
    }
    if (!user) return respond(res, 401, { error: 'Entre na sua conta para continuar.' });
    if (method === 'GET' && url.pathname === '/api/designs') {
      const names = await readdir(designsPath);
      const docs = await Promise.all(names.filter((name) => name.endsWith('.json')).map((name) => jsonFile(path.join(designsPath, name), null)));
      return respond(res, 200, { designs: docs.filter((doc) => doc?.ownerId === user.id) });
    }
    const match = url.pathname.match(/^\/api\/designs\/([0-9a-f-]{36})(?:\/(share))?$/i);
    if (match && method === 'PUT' && !match[2]) {
      const previous = await ownedDesign(match[1], user);
      const input = await body(req);
      const doc = input?.document;
      if (!doc || doc.id !== match[1] || typeof doc.title !== 'string' || !Array.isArray(doc.pages) || doc.pages.length < 1 || doc.pages.length > 100)
        return respond(res, 400, { error: 'O projeto enviado não é válido.' });
      if (doc.pages.some((page) => !Array.isArray(page?.elements) || page.elements.length > 2000))
        return respond(res, 400, { error: 'Uma página tem mais de 2.000 elementos. Divida o documento e tente novamente.' });
      const stored = {
        ...doc,
        title: doc.title.slice(0, 200),
        ownerId: user.id,
        visibility: previous?.visibility ?? 'private',
        shareId: previous?.shareId,
        createdAt: previous?.createdAt ?? doc.createdAt ?? Date.now(),
        updatedAt: Math.max(Date.now(), Number(doc.updatedAt) || 0),
      };
      await saveDesign(stored);
      return respond(res, 200, { document: stored });
    }
    if (match && method === 'PUT' && match[2]) {
      const doc = await ownedDesign(match[1], user);
      if (!doc) return respond(res, 404, { error: 'Design não encontrado.' });
      const input = await body(req, 16_000);
      if (!['private', 'link', 'public'].includes(input.visibility))
        return respond(res, 400, { error: 'Escolha uma opção de acesso válida.' });
      const updated = { ...doc, visibility: input.visibility, updatedAt: Date.now() };
      await removeOldShare(doc);
      if (updated.visibility === 'link') {
        updated.shareId = randomBytes(24).toString('base64url');
        await atomicJson(shareFile(updated.shareId), { designId: updated.id });
      } else delete updated.shareId;
      await saveDesign(updated);
      return respond(res, 200, { document: updated });
    }
    if (match && method === 'DELETE' && !match[2]) {
      const doc = await ownedDesign(match[1], user);
      if (!doc) return respond(res, 404, { error: 'Design não encontrado.' });
      await removeOldShare(doc);
      await unlink(designFile(doc.id)).catch(() => {});
      return respond(res, 200, { ok: true });
    }
    return respond(res, 404, { error: 'Rota não encontrada.' });
  } catch (error) {
    return respond(res, error.status ?? 500, { error: error.status ? error.message : 'Não foi possível concluir a solicitação.' });
  }
}

export function axisApi() {
  return {
    name: 'axis-account-api',
    configureServer(server) {
      server.middlewares.use((req, res, next) => void handle(req, res, next));
    },
    configurePreviewServer(server) {
      server.middlewares.use((req, res, next) => void handle(req, res, next));
    },
  };
}
