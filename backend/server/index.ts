import { resolve } from 'node:path';
import axios from 'axios';
import cron from 'node-cron';
import { criarCifraAesGcm } from './adapters/cripto/aesGcm.js';
import { criarHelenaGateway } from './adapters/helena/helenaGateway.js';
import { criarApp } from './adapters/http/app.js';
import { emitirSessao } from './adapters/http/sessao.js';
import { criarMetaGateway } from './adapters/meta/metaGraphGateway.js';
import { prisma } from './adapters/persistence/prisma/client.js';
import { criarConsumoRepository } from './adapters/persistence/prisma/consumoRepository.js';
import { criarContaRepository } from './adapters/persistence/prisma/contaRepository.js';
import { env } from './config/env.js';
import { logger, serializarErro, urlSemQuery } from './logger.js';
import { criarClientesService } from './services/clientes.service.js';
import { criarContasService } from './services/contas.service.js';
import { criarCotacoesService } from './services/cotacoes.service.js';
import { criarDashboardService } from './services/dashboard.service.js';
import { criarExportacaoService } from './services/exportacao.service.js';
import { criarSessaoService } from './services/sessao.service.js';
import { criarSyncService } from './services/sync.service.js';

if (env.segredoGerado) logger.warn('SEGREDO_SESSAO ausente: usando segredo aleatório (sessões caem a cada restart)');

const repo = criarContaRepository(prisma);
const consumo = criarConsumoRepository(prisma);
const cifra = criarCifraAesGcm(env.CHAVE_CRIPTOGRAFIA);
const meta = criarMetaGateway({ versao: env.META_GRAPH_VERSION });
const helena = criarHelenaGateway(env.HELENA_API_URL);

const emSegundoPlano = (p: () => Promise<unknown>) =>
  void p().catch((err) => logger.error({ err: serializarErro(err) }, 'tarefa em segundo plano falhou'));

const heartbeat = async (falhou: boolean) => {
  if (!env.HEARTBEAT_URL) return;
  const url = falhou ? `${env.HEARTBEAT_URL.replace(/\/$/, '')}/fail` : env.HEARTBEAT_URL;
  await axios.get(url, { timeout: 5000 }).catch((err) =>
    logger.warn({ url: urlSemQuery(url), err: serializarErro(err) }, 'heartbeat falhou'),
  );
};

const sync = criarSyncService({
  repo, consumo, meta, cifra, log: logger, serializarErro, heartbeat,
  cfg: { diasBackfill: env.SYNC_DIAS_BACKFILL, diasReprocesso: env.SYNC_DIAS_REPROCESSO },
});
const dashboard = criarDashboardService({ repo, consumo, sync, emSegundoPlano });

const app = await criarApp({
  cfg: {
    exigirEmbed: env.EXIGIR_EMBED,
    exigirSessao: env.EXIGIR_SESSAO,
    origensEmbed: env.ORIGENS_EMBED,
    segredoSessao: env.SEGREDO_SESSAO,
    pastaCliente: resolve('dist/client'),
  },
  repo,
  sessao: criarSessaoService({
    repo, helena, cifra, adminCompanyids: env.ADMIN_COMPANYIDS,
    emitir: (dados) => emitirSessao(dados, env.SEGREDO_SESSAO),
  }),
  dashboard,
  exportacao: criarExportacaoService({ dashboard, repo }),
  clientes: criarClientesService({ repo, helena, cifra, sync, emSegundoPlano }),
  contas: criarContasService({ repo, meta, cifra, sync, emSegundoPlano }),
  cotacoes: criarCotacoesService({ repo }),
  saude: async () => {
    await prisma.$queryRaw`SELECT 1`;
  },
  logger: { level: env.producao ? 'info' : 'warn', redact: ['req.headers.authorization'] },
});

// Um tick por vez: se o anterior ainda roda, o novo é pulado.
let tickRodando = false;
cron.schedule(
  env.SYNC_CRON,
  async () => {
    if (tickRodando) return logger.warn('tick anterior ainda em execução; pulando');
    tickRodando = true;
    try {
      await sync.executarTick();
    } finally {
      tickRodando = false;
    }
  },
  { timezone: 'America/Fortaleza' },
);
cron.schedule('0 6 * * *', () => void sync.verificarExpiracoes(), { timezone: 'America/Fortaleza' });

await app.listen({ port: env.PORT, host: '0.0.0.0' });
logger.info({ porta: env.PORT }, 'consumo-meta no ar');
