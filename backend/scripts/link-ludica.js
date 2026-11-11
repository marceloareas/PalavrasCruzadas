// Gera o link de entrada que o Ludica geraria (para testes).
//
//   npm run link-ludica -- <gamertag> <perfil> <email> [base]
//   npm run link-ludica -- aluno.bruno 2 bruno.lima@aluno.cefet-rj.br http://localhost:8080
//
// Usa LUDICA_SEGREDO / LUDICA_HASH / LUDICA_FUSO do ambiente (ou do .env).
import 'dotenv/config';
import { linkDeEntrada } from '../src/services/ludica.js';

const [gamertag, perfil, email, base = 'http://localhost:8080'] = process.argv.slice(2);
if (!gamertag || !perfil || !email) {
  console.error('Uso: npm run link-ludica -- <gamertag> <perfil> <email> [base]');
  process.exit(1);
}
if (!process.env.LUDICA_SEGREDO) {
  console.error('Defina LUDICA_SEGREDO (a mesma palavra configurada na API).');
  process.exit(1);
}
console.log(linkDeEntrada({ gamertag, perfil, email }, base));
