// Servidor que se passa pela API de pontuacao do Ludica (so desenvolvimento).
// Confere o token e loga o que chegou.
//
//   npm run ludica-mock                 -> http://localhost:4000/pontuacao
//   MOCK_FALHAR=true npm run ludica-mock -> responde 503 (testa o reenvio)
import 'dotenv/config';
import express from 'express';
import { configLudica, dataDoDia, tokenLudica } from '../src/services/ludica.js';

const app = express();
app.use(express.json());

app.post('/pontuacao', (req, res) => {
  const { email, gamertag, pontuacao, token } = req.body ?? {};
  const esperado = tokenLudica(gamertag, dataDoDia(), configLudica().segredoEnvio);
  const ok = token === esperado;
  console.log(`[ludica-mock] ${new Date().toISOString()} ${gamertag} <${email}> ${pontuacao} pts - token ${ok ? 'ok' : 'INVÁLIDO'}`);
  if (process.env.MOCK_FALHAR === 'true') return res.status(503).json({ erro: 'fora do ar (simulado)' });
  if (!ok) return res.status(401).json({ erro: 'token inválido' });
  res.status(201).json({ recebido: true });
});

const porta = Number(process.env.MOCK_PORTA || 4000);
app.listen(porta, () => console.log(`[ludica-mock] ouvindo em http://localhost:${porta}/pontuacao`));
