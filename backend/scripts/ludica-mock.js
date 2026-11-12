// Servidor que se passa pela API de resultados do Ludica (so desenvolvimento).
// Confere os campos e o hash JOGOU como o Ludica confere, e loga o que chegou.
//
//   npm run ludica-mock                 -> http://localhost:4000/integracao/resultados
//   MOCK_FALHAR=true npm run ludica-mock -> responde 503 (testa o reenvio)
import 'dotenv/config';
import express from 'express';
import { dataDoDia, hashLudica, configLudica } from '../src/services/ludica.js';

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

let proximoId = 1;

app.post('/integracao/resultados', (req, res) => {
  const { jogo, gamertag, data, hash } = req.body ?? {};
  const pontos = Number(req.body?.pontos);
  const tempo = Number(req.body?.tempo_segundos);
  const responder = (status, corpo) => {
    console.log(
      `[ludica-mock] ${status} - ${gamertag ?? '?'} em ${jogo ?? '?'}: ${req.body?.pontos ?? '?'} pts, ` +
      `${req.body?.tempo_segundos ?? '?'}s, data ${data ?? '?'}` + (corpo.error ? ` -> ${corpo.error}` : '')
    );
    res.status(status).json(corpo);
  };

  if (process.env.MOCK_FALHAR === 'true') return responder(503, { error: 'fora do ar (simulado)' });
  if (!jogo || !gamertag || !data || !hash || req.body.pontos === undefined || req.body.tempo_segundos === undefined) {
    return responder(400, { error: 'Campos obrigatórios: jogo, gamertag, data, pontos, tempo_segundos e hash' });
  }
  if (!Number.isInteger(pontos) || pontos < 0 || !Number.isInteger(tempo) || tempo < 0) {
    return responder(400, { error: 'pontos e tempo_segundos devem ser inteiros maiores ou iguais a zero' });
  }
  if (hash !== hashLudica('JOGOU', gamertag, data, jogo)) return responder(401, { error: 'Hash inválido' });
  if (data !== dataDoDia()) return responder(401, { error: 'Hash expirado' });
  if (jogo !== configLudica().nomeJogo) return responder(404, { error: 'Jogo não encontrado' });

  responder(201, {
    mensagem: 'Resultado registrado',
    jogo,
    gamertag,
    partida: { id_historico: proximoId++, pontos_obtidos: pontos, tempo_segundos: tempo, data_partida: new Date() }
  });
});

const porta = Number(process.env.MOCK_PORTA || 4000);
app.listen(porta, () => console.log(`[ludica-mock] ouvindo em http://localhost:${porta}/integracao/resultados`));
