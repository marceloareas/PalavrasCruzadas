// API REST (JSON) consumida pelo front em React.
import express from 'express';
import session from 'express-session';
import swaggerUi from 'swagger-ui-express';

import { carregarUsuario } from './middleware/auth.js';
import authRoutes from './routes/auth.js';
import disciplinaRoutes from './routes/disciplinas.js';
import cruzadaRoutes from './routes/cruzadas.js';
import { pool } from './db/postgres.js';
import { pingMongo } from './db/mongo.js';
import { ErroNegocio } from './services/erros.js';
import * as regras from './regras.js';
import { openapi } from './openapi.js';
import { configLudica } from './services/ludica.js';

export const app = express();

app.set('trust proxy', 1);
app.use(express.json());
// A entrada do Ludica chega como formulario (application/x-www-form-urlencoded).
app.use(express.urlencoded({ extended: false }));
app.use(
  session({
    name: 'cruzadinha.sid',
    secret: process.env.SESSION_SECRET || 'dev-secret-troque-em-producao',
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, sameSite: 'lax' }
  })
);
app.use(carregarUsuario);

const api = express.Router();

api.get('/health', async (req, res) => {
  try {
    await Promise.all([pool.query('SELECT 1'), pingMongo()]);
    res.json({ status: 'ok' });
  } catch {
    res.status(503).json({ status: 'banco_indisponivel' });
  }
});

// Status para o Ludica: ele chama antes de cada partida e espera 200 em ate
// 3 s. Se os bancos estiverem fora, o jogo nao funciona: responde 503.
api.get('/status', async (req, res) => {
  try {
    await Promise.all([pool.query('SELECT 1'), pingMongo()]);
    res.json({ status: 'online', jogo: configLudica().nomeJogo });
  } catch {
    res.status(503).json({ status: 'offline' });
  }
});

// Limites (5-15 palavras etc.) para o front validar com os mesmos numeros.
api.get('/regras', (req, res) => {
  res.json({
    minPalavras: regras.MIN_PALAVRAS,
    maxPalavras: regras.MAX_PALAVRAS,
    minLetras: regras.MIN_LETRAS,
    maxLetras: regras.MAX_LETRAS,
    maxDica: regras.MAX_DICA,
    maxDicasPorPartida: regras.DICAS.maxPorPartida,
    descontoPorLetra: regras.DICAS.descontoPorLetra
  });
});

// Documentacao interativa (Swagger UI) e a spec crua.
api.get('/openapi.json', (req, res) => res.json(openapi));
api.use('/docs', swaggerUi.serve, swaggerUi.setup(openapi, { customSiteTitle: 'Cruzadinha - API' }));

api.use('/auth', authRoutes);
api.use(disciplinaRoutes);
api.use(cruzadaRoutes);
api.use((req, res) => res.status(404).json({ erro: 'Rota não encontrada.' }));

app.use('/api', api);

// Erros de negocio -> status proprio; resto -> 500.
app.use((err, req, res, next) => {
  if (err instanceof ErroNegocio) {
    return res.status(err.status).json({ erro: err.message, erros: err.erros });
  }
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ erro: 'JSON inválido.' });
  }
  console.error(err);
  res.status(500).json({
    erro: process.env.NODE_ENV === 'production' ? 'Erro interno.' : String(err.message || err)
  });
});
