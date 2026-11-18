import axios, { isAxiosError, type AxiosInstance } from 'axios';
import { ErroIndisponivel } from '../../domain/ports/erros.js';
import type { NotificadorAlertas } from '../../domain/ports/NotificadorAlertas.js';

/**
 * POST do alerta em JSON no webhook do n8n (N8N_WEBHOOK_ALERTAS). Resposta fora de 2xx lança erro.
 * No n8n o segredo fica no caminho (/webhook/<id>): o erro sai sem a URL, para ela nunca ir ao log.
 */
export function criarWebhookAlertas(url: string, http: AxiosInstance = axios.create()): NotificadorAlertas {
  return {
    async enviar(alerta) {
      try {
        await http.post(url, alerta, { timeout: 10_000 });
      } catch (err) {
        const motivo = isAxiosError(err) ? (err.response ? `respondeu ${err.response.status}` : (err.code ?? 'sem resposta')) : 'falhou';
        throw new ErroIndisponivel(`webhook de alertas ${motivo}`);
      }
    },
  };
}
