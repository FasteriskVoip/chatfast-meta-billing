import type { AlertaConsumo } from '../consumo/alertas.js';

/** Para onde vão os alertas de consumo (hoje: webhook do n8n). Lança erro se não entregou. */
export interface NotificadorAlertas {
  enviar(alerta: AlertaConsumo): Promise<void>;
}
