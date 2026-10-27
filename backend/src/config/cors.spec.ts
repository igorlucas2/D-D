import { allowedOrigins, isOriginAllowed } from './cors';

const ORIGINAL_ALLOWED = process.env.ELDORIA_ALLOWED_ORIGINS;
const ORIGINAL_HOSTS = process.env.ELDORIA_PUBLIC_HOSTS;

function restore(
  key: 'ELDORIA_ALLOWED_ORIGINS' | 'ELDORIA_PUBLIC_HOSTS',
  value: string | undefined,
) {
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
}

describe('CORS', () => {
  beforeEach(() => {
    delete process.env.ELDORIA_ALLOWED_ORIGINS;
    delete process.env.ELDORIA_PUBLIC_HOSTS;
  });

  afterAll(() => {
    restore('ELDORIA_ALLOWED_ORIGINS', ORIGINAL_ALLOWED);
    restore('ELDORIA_PUBLIC_HOSTS', ORIGINAL_HOSTS);
  });

  it('libera localhost em qualquer porta (desenvolvimento)', () => {
    expect(isOriginAllowed('http://localhost:3000')).toBe(true);
    expect(isOriginAllowed('http://127.0.0.1:3100')).toBe(true);
    expect(isOriginAllowed('http://[::1]:3000')).toBe(true);
  });

  it('recusa origem desconhecida', () => {
    expect(isOriginAllowed('http://evil.example')).toBe(false);
    expect(isOriginAllowed('https://evil.example')).toBe(false);
  });

  it('aceita chamadas sem Origin (proxy, health check, CLI)', () => {
    expect(isOriginAllowed(undefined)).toBe(true);
    expect(isOriginAllowed(null)).toBe(true);
  });

  it('respeita ELDORIA_ALLOWED_ORIGINS e normaliza barra final', () => {
    process.env.ELDORIA_ALLOWED_ORIGINS =
      'https://mesa.example.com/, https://outra.example.com';
    expect(isOriginAllowed('https://mesa.example.com')).toBe(true);
    expect(isOriginAllowed('https://outra.example.com')).toBe(true);
    expect(isOriginAllowed('https://evil.example')).toBe(false);
    expect(allowedOrigins()).toContain('https://mesa.example.com');
  });

  it('aceita host de túnel por hostname, em http e https', () => {
    process.env.ELDORIA_PUBLIC_HOSTS = 'eldoria.example.com';
    expect(isOriginAllowed('https://eldoria.example.com')).toBe(true);
    expect(isOriginAllowed('http://eldoria.example.com')).toBe(true);
    expect(isOriginAllowed('https://evil.example')).toBe(false);
  });

  it('não usa curinga: nenhuma origem arbitrária entra por padrão', () => {
    expect(allowedOrigins()).not.toContain('*');
    expect(isOriginAllowed('http://localhost.evil.example')).toBe(false);
  });
});
