import { describe, expect, it } from 'vitest';
import {
  categoriaMeta, custo, dataNoFuso, fusoIana, qualidade, soDigitos, tipoPreco,
} from '../../../server/domain/sync/normalizacao.js';

describe('normalização da Meta', () => {
  it('categoria conhecida passa; desconhecida vira OUTRA', () => {
    expect(categoriaMeta('marketing_lite')).toBe('MARKETING_LITE');
    expect(categoriaMeta('REFERRAL_CONVERSION')).toBe('REFERRAL_CONVERSION');
    expect(categoriaMeta('NOVIDADE')).toBe('OUTRA');
    expect(categoriaMeta(undefined)).toBe('OUTRA');
  });

  it('tipo de preço desconhecido vira OUTRO', () => {
    expect(tipoPreco('FREE_ENTRY_POINT')).toBe('FREE_ENTRY_POINT');
    expect(tipoPreco('X')).toBe('OUTRO');
  });

  it('custo ausente é null, nunca 0', () => {
    expect(custo(undefined)).toBeNull();
    expect(custo(null)).toBeNull();
    expect(custo('')).toBeNull();
    expect(custo(0)).toBe('0.000000');
    expect(custo(1.23)).toBe('1.230000');
    expect(custo('abc')).toBeNull();
  });

  it('qualidade NA/ausente → UNKNOWN', () => {
    expect(qualidade('GREEN')).toBe('GREEN');
    expect(qualidade('NA')).toBe('UNKNOWN');
    expect(qualidade(undefined)).toBe('UNKNOWN');
  });

  it('start unix vira dia no fuso da conta', () => {
    // 2025-11-12 02:59 UTC ainda é 11/11 em Fortaleza
    expect(dataNoFuso(Date.UTC(2025, 10, 12, 2, 59) / 1000, 'America/Fortaleza')).toBe('2025-11-11');
    expect(dataNoFuso(Date.UTC(2025, 10, 12, 3, 0) / 1000, 'America/Fortaleza')).toBe('2025-11-12');
  });

  it('fuso: nome IANA válido passa; id numérico ou inválido usa o padrão', () => {
    expect(fusoIana('America/Sao_Paulo')).toBe('America/Sao_Paulo');
    expect(fusoIana('42')).toBe('America/Fortaleza');
    expect(fusoIana('Mars/Base')).toBe('America/Fortaleza');
    expect(fusoIana(null)).toBe('America/Fortaleza');
  });

  it('compara telefones só por dígitos', () => {
    expect(soDigitos('+55 61 3399-3888')).toBe(soDigitos('556133993888'));
  });
});
