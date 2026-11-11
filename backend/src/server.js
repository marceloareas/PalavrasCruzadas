import 'dotenv/config';
import { app } from './app.js';
import { conectarMongo } from './db/mongo.js';
import { criarExemplosSeVazio } from './seedExemplos.js';
import { iniciarReenvioPeriodico } from './services/envioLudica.js';

await conectarMongo();
if (process.env.SEED_EXEMPLOS !== 'false') {
  await criarExemplosSeVazio();
}

// Reenvia ao Ludica as pontuacoes que ficaram pendentes.
iniciarReenvioPeriodico();

const PORT = Number(process.env.PORT || 3000);
app.listen(PORT, () => {
  console.log(`API Cruzadinha Digital em http://localhost:${PORT}/api`);
});
