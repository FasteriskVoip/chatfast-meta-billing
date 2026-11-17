import { describe, expect, it } from 'vitest';
import { tempoRelativo } from './formatos';

describe('tempoRelativo', () => {
  const agora = Date.parse('2026-11-17T15:00:00Z');
  it('escolhe a unidade pela distância', () => {
    expect(tempoRelativo(null, agora)).toBe('—');
    expect(tempoRelativo('2026-11-17T14:59:30Z', agora)).toBe('agora mesmo');
    expect(tempoRelativo('2026-11-17T14:55:00Z', agora)).toBe('há 5 minutos');
    expect(tempoRelativo('2026-11-17T12:00:00Z', agora)).toBe('há 3 horas');
    expect(tempoRelativo('2026-11-16T15:00:00Z', agora)).toBe('ontem');
  });
});
