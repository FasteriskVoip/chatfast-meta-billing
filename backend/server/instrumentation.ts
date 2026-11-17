// Carregado via --import antes do app. Só liga com OTEL_EXPORTER_OTLP_ENDPOINT.
import { config } from 'dotenv';

config({ path: 'backend/.env', quiet: true });

if (process.env.OTEL_EXPORTER_OTLP_ENDPOINT) {
  const { NodeSDK } = await import('@opentelemetry/sdk-node');
  const { getNodeAutoInstrumentations } = await import('@opentelemetry/auto-instrumentations-node');
  const sdk = new NodeSDK({
    serviceName: process.env.OTEL_SERVICE_NAME ?? 'consumo-meta',
    instrumentations: [
      getNodeAutoInstrumentations({
        '@opentelemetry/instrumentation-dns': { enabled: false },
        '@opentelemetry/instrumentation-net': { enabled: false },
        '@opentelemetry/instrumentation-fs': { enabled: false },
      }),
    ],
  });
  sdk.start();
  process.on('SIGTERM', () => void sdk.shutdown());
}
