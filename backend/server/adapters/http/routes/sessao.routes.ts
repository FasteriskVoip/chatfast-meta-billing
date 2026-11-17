import type { FastifyPluginAsync } from 'fastify';
import type { Deps } from '../app.js';
import { emitirSessao } from '../sessao.js';

type Corpo = Record<string, string | undefined>;

/** O Chatfast varia o nome dos parâmetros; aceitamos as variantes conhecidas. */
const primeiro = (c: Corpo, chaves: string[]) => chaves.map((k) => c[k]).find((v) => typeof v === 'string' && v.trim())?.trim();

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CID_DEV = '00000000-0000-0000-0000-000000000000';

export const rotasSessao =
  (d: Deps): FastifyPluginAsync =>
  async (app) => {
    app.post('/sessao', async (req) => {
      const c = (req.body ?? {}) as Corpo;
      const companyid = primeiro(c, ['companyid', 'company_id', 'companyId']);
      const userId = primeiro(c, ['user_id', 'userId', 'userid', 'user']);
      if (!d.cfg.exigirSessao) {
        // Só desenvolvimento (EXIGIR_SESSAO desligado): sessão de admin sem Helena para testar localmente.
        const cid = companyid && UUID.test(companyid) ? companyid.toLowerCase() : CID_DEV;
        const { token, exp } = emitirSessao({ cid, uid: userId ?? 'dev', nome: 'Desenvolvimento', admin: true }, d.cfg.segredoSessao);
        return { token, expiraEm: new Date(exp).toISOString(), nome: 'Desenvolvimento', admin: true, empresa: { nome: 'Desenvolvimento' } };
      }
      return d.sessao.abrir(companyid, userId);
    });
  };
