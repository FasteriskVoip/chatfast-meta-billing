import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Filtros } from './Filtros';
import type { FiltroAplicado, Filtros as Opcoes } from './tipos';

const opcoes: Opcoes = {
  contas: [{ id: 'c1', nome: 'WABA 1', wabaId: '1' }],
  numeros: [{ id: 'n1', contaId: 'c1', display: '+55 61 3399-3888', nomeVerificado: null }],
  categorias: ['MARKETING', 'UTILITY', 'AUTHENTICATION', 'SERVICE'],
  historicoDesde: '2026-01-01',
  fuso: 'America/Fortaleza',
};
const valor: FiltroAplicado = { de: '2026-11-01', ate: '2026-11-17', contaId: '', numeroId: '', categoria: '' };
const agora = () => new Date('2026-11-17T15:00:00Z');

describe('Filtros', () => {
  it('atalho preenche as datas no fuso e Aplicar faz uma chamada', () => {
    const onAplicar = vi.fn();
    render(<Filtros opcoes={opcoes} valor={valor} onAplicar={onAplicar} agora={agora} />);
    fireEvent.click(screen.getByText('Hoje'));
    expect(screen.getByLabelText('Início')).toHaveValue('2026-11-17');
    expect(screen.getByLabelText('Fim')).toHaveValue('2026-11-17');
    fireEvent.click(screen.getByText('7d'));
    expect(screen.getByLabelText('Início')).toHaveValue('2026-11-11');
    fireEvent.click(screen.getByText('Mês anterior'));
    expect(screen.getByLabelText('Início')).toHaveValue('2026-10-01');
    expect(screen.getByLabelText('Fim')).toHaveValue('2026-10-31');
    expect(onAplicar).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText('Aplicar'));
    expect(onAplicar).toHaveBeenCalledTimes(1);
    expect(onAplicar).toHaveBeenCalledWith({ ...valor, de: '2026-10-01', ate: '2026-10-31' });
  });

  it('início depois do fim mostra erro e não chama a API', () => {
    const onAplicar = vi.fn();
    render(<Filtros opcoes={opcoes} valor={valor} onAplicar={onAplicar} agora={agora} />);
    fireEvent.change(screen.getByLabelText('Início'), { target: { value: '2026-11-20' } });
    fireEvent.click(screen.getByText('Aplicar'));
    expect(screen.getByRole('alert')).toHaveTextContent('anterior ou igual');
    expect(onAplicar).not.toHaveBeenCalled();
  });
});
