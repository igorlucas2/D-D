import 'reflect-metadata';
import { validateEnv } from './env.validation';

const VALID_DATABASE_URL = 'mysql://usuario:senha@localhost:3306/rpg';
const VALID_SECRET = 'a'.repeat(64);

describe('validateEnv', () => {
  it('aceita configuração válida e converte PORT para número', () => {
    const env = validateEnv({
      DATABASE_URL: VALID_DATABASE_URL,
      JWT_SECRET: VALID_SECRET,
      PORT: '3001',
    });

    expect(env.PORT).toBe(3001);
  });

  it('recusa o segredo padrão que existia no código', () => {
    expect(() =>
      validateEnv({
        DATABASE_URL: VALID_DATABASE_URL,
        JWT_SECRET: 'dev-super-secret-change-me',
      }),
    ).toThrow(/valor de exemplo/);
  });

  it('recusa o segredo de exemplo do .env.example', () => {
    expect(() =>
      validateEnv({
        DATABASE_URL: VALID_DATABASE_URL,
        JWT_SECRET: 'substitua-por-um-segredo-local',
      }),
    ).toThrow(/valor de exemplo/);
  });

  it('recusa segredo curto', () => {
    expect(() =>
      validateEnv({
        DATABASE_URL: VALID_DATABASE_URL,
        JWT_SECRET: 'curto-demais',
      }),
    ).toThrow(/32 caracteres/);
  });

  it('recusa DATABASE_URL ausente', () => {
    expect(() => validateEnv({ JWT_SECRET: VALID_SECRET })).toThrow(
      /DATABASE_URL/,
    );
  });

  it('recusa PORT inválida', () => {
    expect(() =>
      validateEnv({
        DATABASE_URL: VALID_DATABASE_URL,
        JWT_SECRET: VALID_SECRET,
        PORT: 'abc',
      }),
    ).toThrow(/PORT/);
  });
});
