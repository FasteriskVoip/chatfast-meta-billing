import { describe, expect, it } from 'vitest';
import type { Agente } from '../../server/domain/ports/HelenaGateway.js';
import { ehAdmin } from '../../server/services/sessao.service.js';
import { CID_A, CID_FASTERISK } from '../fakes.js';

const base: Agente = { id: 'a', userId: 'u', nome: 'X', isOwner: false, profile: 'AGENT' };
const admins = [CID_FASTERISK];

describe('ehAdmin', () => {
  it('empresa fora de ADMIN_COMPANYIDS nunca é admin, nem o dono', () => {
    expect(ehAdmin(CID_A, { ...base, isOwner: true, profile: 'ADMIN' }, admins)).toBe(false);
  });
  it('dono da conta da Fasterisk é admin', () => {
    expect(ehAdmin(CID_FASTERISK, { ...base, isOwner: true }, admins)).toBe(true);
  });
  it('profile de admin (case-insensitive) é admin', () => {
    expect(ehAdmin(CID_FASTERISK, { ...base, profile: 'admin' }, admins)).toBe(true);
  });
  it.each(['ADMIN', 'SUPER_ADMIN', 'super_admin', 'SuperAdmin'])('profile %s na Fasterisk é admin', (profile) => {
    expect(ehAdmin(CID_FASTERISK, { ...base, profile }, admins)).toBe(true);
  });
  it('SUPER_ADMIN em empresa cliente não vira admin', () => {
    expect(ehAdmin(CID_A, { ...base, profile: 'SUPER_ADMIN' }, admins)).toBe(false);
  });
  it('agente comum da Fasterisk não é admin', () => {
    expect(ehAdmin(CID_FASTERISK, base, admins)).toBe(false);
  });
});
