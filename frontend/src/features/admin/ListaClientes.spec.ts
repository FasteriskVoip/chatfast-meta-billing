import { describe, expect, it } from 'vitest';
import { comparadorNulosNoFim } from './ListaClientes';

type C = { nome: string; custo: number | null };
const lista: C[] = [
  { nome: 'Clínica', custo: 731.5 },
  { nome: 'Sem custo', custo: null },
  { nome: 'Rádio Táxi', custo: 2412.38 },
  { nome: 'Ótica', custo: 0 },
];
const ordem = (desc: boolean, porNome = false) =>
  [...lista].sort(comparadorNulosNoFim<C>((c) => (porNome ? c.nome : c.custo), desc)).map((c) => c.nome);

describe('ordenação da lista de clientes', () => {
  it('custo do maior para o menor, e o inverso; sem custo sempre no fim', () => {
    expect(ordem(true)).toEqual(['Rádio Táxi', 'Clínica', 'Ótica', 'Sem custo']);
    expect(ordem(false)).toEqual(['Ótica', 'Clínica', 'Rádio Táxi', 'Sem custo']);
  });

  it('nome em ordem alfabética do português (acento não vai para o fim)', () => {
    expect(ordem(false, true)).toEqual(['Clínica', 'Ótica', 'Rádio Táxi', 'Sem custo']);
  });
});
