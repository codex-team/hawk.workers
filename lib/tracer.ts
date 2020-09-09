import { NodeTracerProvider } from '@opentelemetry/node';
import {
  BatchSpanProcessor,
  SimpleSpanProcessor,
  ConsoleSpanExporter,
} from '@opentelemetry/tracing';
import { JaegerExporter } from '@opentelemetry/exporter-jaeger';

let provider: NodeTracerProvider;
let exporter: JaegerExporter;

export const setupTracing = (name: string): void => {
  provider = new NodeTracerProvider();

  if (process.env.TRACING_ENABLED === 'true') {
    exporter = new JaegerExporter({
      serviceName: 'worker',
      tags: [{ key: 'type', value: name }],
      endpoint: process.env.JAEGER_ENDPOINT,
    });

    provider.addSpanProcessor(new SimpleSpanProcessor(exporter));
    console.log('Jaeger set up');
  }

  // Print spans to console if not in prod
  if (process.env.NODE_ENV !== 'PRODUCTION') {
    provider.addSpanProcessor(
      new SimpleSpanProcessor(new ConsoleSpanExporter())
    );
  }

  provider.register();
};

export const stopTracing = (): void => {
  if (exporter) exporter.shutdown();
};
