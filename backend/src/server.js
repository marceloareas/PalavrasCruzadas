import express from 'express';
import session from 'express-session';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

import { carregarUsuario } from './middleware/auth.js';
import authRoutes from './routes/auth.js';
import cruzadasRoutes from './routes/cruzadas.js';
import { pool } from './db.js';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

// Views (EJS) e arquivos estaticos.
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, '..', 'public')));

// Corpo de formularios / JSON.
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Sessao (guarda apenas o id do usuario logado).
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'dev-secret-troque-em-producao',
    resave: false,
    saveUninitialized: false
  })
);

// Injeta o usuario logado em todas as views.
app.use(carregarUsuario);

// Home.
app.get('/', (req, res) => {
  if (!req.usuario) return res.redirect('/login');
  res.render('home');
});

// Healthcheck (usado pelo docker-compose).
app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok' });
  } catch {
    res.status(500).json({ status: 'db_indisponivel' });
  }
});

app.use(authRoutes);
app.use(cruzadasRoutes);

// Handler de erros.
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).render('erro', {
    titulo: 'Erro interno',
    mensagem: process.env.NODE_ENV === 'production' ? 'Ocorreu um erro.' : String(err.message || err)
  });
});

const PORT = Number(process.env.PORT || 3000);
app.listen(PORT, () => {
  console.log(`Palavras Cruzadas rodando em http://localhost:${PORT}`);
});
