// Conexao com o MongoDB e criacao da colecao `conteudo_versao`
// (modelo documentado em db/mongo/modelo.md).
import { MongoClient } from 'mongodb';
import { MIN_PALAVRAS, MAX_PALAVRAS } from '../regras.js';

const url = process.env.MONGO_URL || 'mongodb://localhost:27017';
const nomeBanco = process.env.MONGO_DB || 'palavras_cruzadas';

const client = new MongoClient(url);
let db = null;

const schemaConteudoVersao = {
  bsonType: 'object',
  required: ['id_versao', 'id_cruzada', 'grade', 'palavras', 'criado_em'],
  properties: {
    id_versao: { bsonType: 'int' },
    id_cruzada: { bsonType: 'int' },
    grade: {
      bsonType: 'object',
      required: ['linhas', 'colunas'],
      properties: {
        linhas: { bsonType: 'int', minimum: 1 },
        colunas: { bsonType: 'int', minimum: 1 }
      }
    },
    palavras: {
      bsonType: 'array',
      minItems: MIN_PALAVRAS,
      maxItems: MAX_PALAVRAS,
      items: {
        bsonType: 'object',
        required: ['indice', 'numero', 'resposta', 'dica', 'linha', 'coluna', 'direcao'],
        properties: {
          indice: { bsonType: 'int', minimum: 1 },
          numero: { bsonType: 'int', minimum: 1 },
          resposta: { bsonType: 'string' },
          dica: { bsonType: 'string' },
          linha: { bsonType: 'int', minimum: 1 },
          coluna: { bsonType: 'int', minimum: 1 },
          direcao: { enum: ['horizontal', 'vertical'] }
        }
      }
    },
    criado_em: { bsonType: 'date' }
  }
};

export async function conectarMongo() {
  if (db) return db;
  await client.connect();
  db = client.db(nomeBanco);

  const existentes = await db.listCollections({ name: 'conteudo_versao' }).toArray();
  if (existentes.length === 0) {
    await db.createCollection('conteudo_versao', { validator: { $jsonSchema: schemaConteudoVersao } });
  }
  const colecao = db.collection('conteudo_versao');
  await colecao.createIndex({ id_versao: 1 }, { unique: true });
  await colecao.createIndex({ id_cruzada: 1 });
  return db;
}

export function conteudoVersao() {
  if (!db) throw new Error('MongoDB nao conectado.');
  return db.collection('conteudo_versao');
}

export async function pingMongo() {
  await db.command({ ping: 1 });
}
