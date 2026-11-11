import bcrypt from 'bcryptjs';
import connectPgSimple from 'connect-pg-simple';
import express from 'express';
import { rateLimit } from 'express-rate-limit';
import session from 'express-session';
import helmet from 'helmet';
import pg from 'pg';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const { Pool } = pg;
const directory = path.dirname(fileURLToPath(import.meta.url));
const isProduction = process.env.NODE_ENV === 'production';
const sessionSecret = process.env.SESSION_SECRET;

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL must be configured before starting Kidani.');
}
if (isProduction && (!sessionSecret || sessionSecret.length < 32)) {
  throw new Error('Set SESSION_SECRET to a random value of at least 32 characters.');
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: isProduction ? { rejectUnauthorized: false } : undefined,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
});
pool.on('error', (error) => console.error('Unexpected PostgreSQL connection error.', error));
const app = express();
const PgSessionStore = connectPgSimple(session);
const sessionCookieName = 'kidani.sid';

app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use(helmet());
app.use(express.json({ limit: '6mb', type: 'application/json' }));
app.use((request, response, next) => {
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)) {
    const fetchSite = request.get('sec-fetch-site');
    const origin = request.get('origin');
    let originHost;
    try {
      originHost = origin ? new URL(origin).host : undefined;
    } catch {
      response.status(403).json({ error: 'Request origin was not accepted.' });
      return;
    }
    if (fetchSite === 'cross-site' || (originHost && originHost !== request.get('host'))) {
      response.status(403).json({ error: 'Request origin was not accepted.' });
      return;
    }
  }
  next();
});
app.use(session({
  name: sessionCookieName,
  store: new PgSessionStore({
    pool,
    tableName: 'kidani_sessions',
    createTableIfMissing: true,
  }),
  secret: sessionSecret ?? 'local-development-secret-change-before-deploy',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'strict',
    maxAge: 1000 * 60 * 60 * 24 * 14,
  },
}));

const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Too many sign-in attempts. Try again in 15 minutes.' },
});
const interactionRateLimit = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'You are moving too quickly. Please wait a moment before interacting again.' },
});
const messageRateLimit = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'You are sending messages too quickly. Please wait a moment.' },
});

const accountTypes = new Set(['woman', 'man', 'gay']);

function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function cleanText(value, maxLength) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function validPhone(value) {
  const digits = typeof value === 'string' ? value.replace(/\D/g, '') : '';
  return digits.length >= 9 && digits.length <= 15;
}

function normalizeServices(value) {
  if (!Array.isArray(value) || value.length > 30) {
    throw httpError(400, 'Add up to 30 valid services.');
  }
  return value.map((service) => {
    const name = cleanText(service?.name, 60);
    const amount = Number(service?.amount);
    if (!name || !Number.isSafeInteger(amount) || amount < 0 || amount > 100_000_000) {
      throw httpError(400, 'Each service needs a name and a valid TSH amount.');
    }
    return { id: cleanText(service?.id, 80) || crypto.randomUUID(), name, amount };
  });
}

function imageData(value, fieldName) {
  if (value === null || value === '') return null;
  if (typeof value !== 'string' || value.length > 700_000
    || !/^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(value)) {
    throw httpError(400, `${fieldName} must be a compressed JPEG, PNG, or WebP image smaller than 500 KB.`);
  }
  const data = value.slice(value.indexOf(',') + 1);
  if (Buffer.from(data, 'base64').length > 512 * 1024) {
    throw httpError(400, `${fieldName} must be smaller than 500 KB.`);
  }
  return value;
}

function initials(name) {
  return name.split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? '').join('');
}

function toProfile(row, includePrivate = false, includePhoto = false) {
  const profile = {
    id: row.id,
    name: row.name,
    age: row.age,
    location: row.location,
    gender: row.account_type,
    accountType: row.account_type,
    bio: row.bio,
    hobbies: [],
    compatibility: 0,
    vibe: '',
    avatar: initials(row.name),
    profilePhoto: includePhoto ? row.profile_photo_data : null,
    hasProfilePhoto: Boolean(row.profile_photo_data),
    services: row.services ?? [],
    online: row.online,
  };
  if (includePrivate) {
    profile.mobileNumber = row.call_number;
    profile.whatsappNumber = row.whatsapp_number;
  }
  return profile;
}

function toUser(row) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phoneNumber: row.phone_number,
    age: row.age,
    location: row.location,
    bio: row.bio,
    hobbies: [],
    lookingFor: '',
    matchScore: 0,
    avatar: initials(row.name),
    accountType: row.account_type,
    profilePhoto: row.profile_photo_data,
    services: row.services ?? [],
    whatsappNumber: row.whatsapp_number,
    callNumber: row.call_number,
    online: row.online,
  };
}

async function requireUser(request, response, next) {
  if (!request.session.userId) {
    response.status(401).json({ error: 'Sign in to continue.' });
    return;
  }
  try {
    const result = await pool.query('SELECT * FROM kidani_profiles WHERE id = $1', [request.session.userId]);
    if (!result.rows[0]) {
      request.session.destroy(() => {});
      response.status(401).json({ error: 'Your session has expired. Sign in again.' });
      return;
    }
    request.user = result.rows[0];
    next();
  } catch (error) {
    next(error);
  }
}

function compatible(senderType, targetType) {
  if (senderType === 'man') return targetType === 'woman' || targetType === 'gay';
  return targetType === 'man';
}

function requireCompatibleTarget(sender, target) {
  if (!target || target.id === sender.id || !compatible(sender.account_type, target.account_type)) {
    throw httpError(404, 'That profile is not available.');
  }
}

async function saveUserSession(request, userId) {
  await new Promise((resolve, reject) => {
    request.session.regenerate((error) => error ? reject(error) : resolve());
  });
  request.session.userId = userId;
  await new Promise((resolve, reject) => {
    request.session.save((error) => error ? reject(error) : resolve());
  });
}

app.get('/api/health', async (request, response, next) => {
  try {
    await pool.query('SELECT 1');
    response.json({ status: 'ok' });
  } catch (error) {
    next(error);
  }
});

app.post('/api/auth/signup', authRateLimit, async (request, response, next) => {
  try {
    const name = cleanText(request.body?.name, 80);
    const email = cleanText(request.body?.email, 254).toLowerCase();
    const password = request.body?.password;
    const age = Number(request.body?.age);
    const location = cleanText(request.body?.location, 100);
    const phoneNumber = cleanText(request.body?.phoneNumber, 32);
    const accountType = request.body?.accountType;
    if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
      || typeof password !== 'string' || password.length < 8 || Buffer.byteLength(password, 'utf8') > 72
      || !Number.isInteger(age) || age < 18 || age > 120 || !location
      || !validPhone(phoneNumber) || !accountTypes.has(accountType)) {
      throw httpError(400, 'Enter valid account details. Kidani is for adults aged 18 or older.');
    }
    const passwordHash = await bcrypt.hash(password, 12);
    const result = await pool.query(
      `INSERT INTO kidani_profiles
        (name, email, password_hash, age, location, phone_number, account_type)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [name, email, passwordHash, age, location, phoneNumber, accountType],
    );
    await saveUserSession(request, result.rows[0].id);
    response.status(201).json({ profile: toUser(result.rows[0]) });
  } catch (error) {
    if (error.code === '23505') {
      next(httpError(409, 'An account with that email already exists.'));
      return;
    }
    next(error);
  }
});

app.post('/api/auth/login', authRateLimit, async (request, response, next) => {
  try {
    const email = cleanText(request.body?.email, 254).toLowerCase();
    const password = request.body?.password;
    if (!email || typeof password !== 'string' || Buffer.byteLength(password, 'utf8') > 72) {
      throw httpError(400, 'Enter your email and password.');
    }
    const result = await pool.query('SELECT * FROM kidani_profiles WHERE email = $1', [email]);
    const user = result.rows[0];
    const valid = user ? await bcrypt.compare(password, user.password_hash) : false;
    if (!valid) {
      throw httpError(401, 'No account matched those details. Please check them and try again.');
    }
    await saveUserSession(request, user.id);
    response.json({ profile: toUser(user) });
  } catch (error) {
    next(error);
  }
});

app.post('/api/auth/logout', (request, response, next) => {
  request.session.destroy((error) => {
    if (error) {
      next(error);
      return;
    }
    response.clearCookie(sessionCookieName, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'strict',
      path: '/',
    });
    response.status(204).end();
  });
});

app.get('/api/auth/me', async (request, response, next) => {
  if (!request.session.userId) {
    response.json({ profile: null });
    return;
  }
  try {
    const result = await pool.query('SELECT * FROM kidani_profiles WHERE id = $1', [request.session.userId]);
    if (!result.rows[0]) {
      request.session.destroy(() => {});
      response.json({ profile: null });
      return;
    }
    response.json({ profile: toUser(result.rows[0]) });
  } catch (error) {
    next(error);
  }
});

app.use('/api', requireUser);

app.get('/api/profiles', async (request, response, next) => {
  try {
    const user = request.user;
    const types = user.account_type === 'man' ? ['woman', 'gay'] : ['man'];
    const result = await pool.query(
      `SELECT * FROM kidani_profiles
       WHERE id <> $1 AND account_type = ANY($2::text[]) AND online = TRUE
       ORDER BY created_at DESC LIMIT 100`,
      [user.id, types],
    );
    response.json({ profiles: result.rows.map((row) => toProfile(row)) });
  } catch (error) {
    next(error);
  }
});

app.post('/api/interactions/:targetId', interactionRateLimit, async (request, response, next) => {
  try {
    const targetResult = await pool.query('SELECT * FROM kidani_profiles WHERE id = $1', [request.params.targetId]);
    const target = targetResult.rows[0];
    requireCompatibleTarget(request.user, target);
    await pool.query(
      `INSERT INTO kidani_interactions (sender_id, target_id)
       VALUES ($1, $2) ON CONFLICT (sender_id, target_id) DO NOTHING`,
      [request.user.id, target.id],
    );
    response.json({ profile: toProfile(target, true, true) });
  } catch (error) {
    next(error);
  }
});

app.get('/api/conversations', async (request, response, next) => {
  try {
    const result = await pool.query(
      `SELECT p.*,
        (SELECT m.body FROM kidani_messages m
         WHERE (m.sender_id = $1 AND m.recipient_id = p.id)
            OR (m.sender_id = p.id AND m.recipient_id = $1)
         ORDER BY m.sent_at DESC LIMIT 1) AS last_message,
        (SELECT m.sent_at FROM kidani_messages m
         WHERE (m.sender_id = $1 AND m.recipient_id = p.id)
            OR (m.sender_id = p.id AND m.recipient_id = $1)
         ORDER BY m.sent_at DESC LIMIT 1) AS last_message_at
       FROM kidani_profiles p
       WHERE p.id <> $1
         AND (
           EXISTS (SELECT 1 FROM kidani_interactions i WHERE i.sender_id = $1 AND i.target_id = p.id)
           OR EXISTS (SELECT 1 FROM kidani_interactions i WHERE i.sender_id = p.id AND i.target_id = $1)
           OR EXISTS (SELECT 1 FROM kidani_messages m WHERE m.sender_id = $1 AND m.recipient_id = p.id)
           OR EXISTS (SELECT 1 FROM kidani_messages m WHERE m.sender_id = p.id AND m.recipient_id = $1)
         )
       ORDER BY last_message_at DESC NULLS LAST, p.created_at DESC LIMIT 100`,
      [request.user.id],
    );
    response.json({
      profiles: result.rows.map((row) => ({
        ...toProfile(row),
        lastMessage: row.last_message,
        lastMessageAt: row.last_message_at ? new Date(row.last_message_at).getTime() : null,
      })),
    });
  } catch (error) {
    next(error);
  }
});

app.get('/api/profiles/:profileId/photo', async (request, response, next) => {
  try {
    const result = await pool.query(
      'SELECT id, account_type, profile_photo_data FROM kidani_profiles WHERE id = $1',
      [request.params.profileId],
    );
    const target = result.rows[0];
    requireCompatibleTarget(request.user, target);
    if (!target.profile_photo_data) throw httpError(404, 'No profile photo is available.');
    const match = /^data:(image\/(?:jpeg|png|webp));base64,(.+)$/.exec(target.profile_photo_data);
    if (!match) throw httpError(500, 'The saved profile photo is invalid.');
    response
      .set('Content-Type', match[1])
      .set('Cache-Control', 'private, no-store')
      .send(Buffer.from(match[2], 'base64'));
  } catch (error) {
    next(error);
  }
});

app.get('/api/messages/:profileId', async (request, response, next) => {
  try {
    const targetResult = await pool.query('SELECT * FROM kidani_profiles WHERE id = $1', [request.params.profileId]);
    const target = targetResult.rows[0];
    requireCompatibleTarget(request.user, target);
    const interaction = await pool.query(
      `SELECT 1 FROM kidani_interactions
       WHERE (sender_id = $1 AND target_id = $2) OR (sender_id = $2 AND target_id = $1)
       UNION SELECT 1 FROM kidani_messages
       WHERE (sender_id = $1 AND recipient_id = $2) OR (sender_id = $2 AND recipient_id = $1)
       LIMIT 1`,
      [request.user.id, target.id],
    );
    if (!interaction.rowCount) throw httpError(403, 'Interact with this profile before opening a conversation.');
    const result = await pool.query(
      `SELECT id, sender_id, body, sent_at FROM kidani_messages
       WHERE (sender_id = $1 AND recipient_id = $2) OR (sender_id = $2 AND recipient_id = $1)
       ORDER BY sent_at ASC LIMIT 500`,
      [request.user.id, target.id],
    );
    response.json({
      messages: result.rows.map((message) => ({
        id: message.id,
        matchId: target.id,
        sender: message.sender_id === request.user.id ? 'me' : 'match',
        text: message.body,
        sentAt: new Date(message.sent_at).getTime(),
      })),
    });
  } catch (error) {
    next(error);
  }
});

app.post('/api/messages/:profileId', messageRateLimit, async (request, response, next) => {
  try {
    const text = cleanText(request.body?.text, 2000);
    if (!text) throw httpError(400, 'Write a message before sending.');
    const targetResult = await pool.query('SELECT * FROM kidani_profiles WHERE id = $1', [request.params.profileId]);
    const target = targetResult.rows[0];
    requireCompatibleTarget(request.user, target);
    const interaction = await pool.query(
      `SELECT 1 FROM kidani_interactions
       WHERE (sender_id = $1 AND target_id = $2) OR (sender_id = $2 AND target_id = $1)
       LIMIT 1`,
      [request.user.id, target.id],
    );
    if (!interaction.rowCount) throw httpError(403, 'Interact with this profile before sending a message.');
    const result = await pool.query(
      `INSERT INTO kidani_messages (sender_id, recipient_id, body)
       VALUES ($1, $2, $3) RETURNING id, sent_at`,
      [request.user.id, target.id, text],
    );
    response.status(201).json({
      message: {
        id: result.rows[0].id,
        matchId: target.id,
        sender: 'me',
        text,
        sentAt: new Date(result.rows[0].sent_at).getTime(),
      },
    });
  } catch (error) {
    next(error);
  }
});

app.put('/api/profile', async (request, response, next) => {
  try {
    const name = cleanText(request.body?.name, 80);
    const age = Number(request.body?.age);
    const location = cleanText(request.body?.location, 100);
    const bio = cleanText(request.body?.bio, 500);
    const phoneNumber = cleanText(request.body?.phoneNumber, 32);
    const whatsappNumber = cleanText(request.body?.whatsappNumber, 32);
    const callNumber = cleanText(request.body?.callNumber, 32);
    const services = normalizeServices(request.body?.services ?? []);
    const profilePhoto = imageData(request.body?.profilePhoto, 'Profile photo');
    const online = request.body?.online === true;
    if (!name || !Number.isInteger(age) || age < 18 || age > 120 || !location
      || !validPhone(phoneNumber) || (whatsappNumber && !validPhone(whatsappNumber))
      || (callNumber && !validPhone(callNumber))) {
      throw httpError(400, 'Enter a name, valid age, location, and valid phone numbers.');
    }
    const result = await pool.query(
      `UPDATE kidani_profiles SET name = $2, age = $3, location = $4, bio = $5,
        phone_number = $6, whatsapp_number = $7, call_number = $8, services = $9,
        profile_photo_data = $10, online = $11, updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [request.user.id, name, age, location, bio, phoneNumber, whatsappNumber || null,
        callNumber || null, JSON.stringify(services), profilePhoto, online],
    );
    response.json({ profile: toUser(result.rows[0]) });
  } catch (error) {
    next(error);
  }
});

app.get('/api', (request, response) => {
  response.status(404).json({ error: 'API route not found.' });
});

app.use(express.static(path.join(directory, 'dist'), { index: false, maxAge: isProduction ? '1h' : 0 }));
app.get('*path', (request, response, next) => {
  response.sendFile(path.join(directory, 'dist', 'index.html'), (error) => {
    if (error) next(error);
  });
});

app.use((error, request, response, next) => {
  if (response.headersSent) {
    next(error);
    return;
  }
  if (error.code === '23505') {
    response.status(409).json({ error: 'This account already exists.' });
    return;
  }
  if (error.type === 'entity.too.large') {
    response.status(413).json({ error: 'The uploaded image is too large.' });
    return;
  }
  const status = Number.isInteger(error.status) ? error.status : 500;
  if (status >= 500) console.error('Kidani request failed.', error);
  response.status(status).json({ error: status >= 500 ? 'A server error occurred. Please try again.' : error.message });
});

async function initializeDatabase() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS kidani_profiles (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(80) NOT NULL,
      email VARCHAR(254) NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      age SMALLINT NOT NULL CHECK (age >= 18 AND age <= 120),
      location VARCHAR(100) NOT NULL,
      phone_number VARCHAR(32) NOT NULL,
      account_type VARCHAR(8) NOT NULL CHECK (account_type IN ('woman', 'man', 'gay')),
      bio VARCHAR(500) NOT NULL DEFAULT '',
      whatsapp_number VARCHAR(32),
      call_number VARCHAR(32),
      services JSONB NOT NULL DEFAULT '[]'::jsonb,
      profile_photo_data TEXT,
      online BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS kidani_profiles_discovery_idx
      ON kidani_profiles (account_type, online, created_at DESC);
    CREATE TABLE IF NOT EXISTS kidani_interactions (
      sender_id UUID NOT NULL REFERENCES kidani_profiles(id) ON DELETE CASCADE,
      target_id UUID NOT NULL REFERENCES kidani_profiles(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (sender_id, target_id),
      CHECK (sender_id <> target_id)
    );
    CREATE INDEX IF NOT EXISTS kidani_interactions_target_idx
      ON kidani_interactions (target_id, sender_id);
    CREATE TABLE IF NOT EXISTS kidani_messages (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      sender_id UUID NOT NULL REFERENCES kidani_profiles(id) ON DELETE CASCADE,
      recipient_id UUID NOT NULL REFERENCES kidani_profiles(id) ON DELETE CASCADE,
      body VARCHAR(2000) NOT NULL,
      sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CHECK (sender_id <> recipient_id)
    );
    CREATE INDEX IF NOT EXISTS kidani_messages_conversation_idx
      ON kidani_messages (sender_id, recipient_id, sent_at);
    CREATE INDEX IF NOT EXISTS kidani_messages_inbox_idx
      ON kidani_messages (recipient_id, sender_id, sent_at);
  `);
}

const port = Number(process.env.PORT ?? 10000);
await initializeDatabase();
const server = app.listen(port, '0.0.0.0', () => {
  console.log(`Kidani is listening on port ${port}.`);
});

async function shutdown(signal) {
  console.log(`Received ${signal}; shutting down Kidani.`);
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
