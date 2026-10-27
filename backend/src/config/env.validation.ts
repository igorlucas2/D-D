import { plainToInstance } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Min,
  MinLength,
  validateSync,
} from 'class-validator';

/**
 * Valores que já circularam em exemplos/código e nunca devem ser aceitos em
 * runtime: com eles qualquer pessoa forja um JWT válido.
 */
const FORBIDDEN_JWT_SECRETS = [
  'dev-super-secret-change-me',
  'substitua-por-um-segredo-local',
];

class EnvironmentVariables {
  @IsString()
  @MinLength(1, { message: 'DATABASE_URL é obrigatória.' })
  DATABASE_URL!: string;

  @IsString({ message: 'JWT_SECRET é obrigatória.' })
  @MinLength(32, {
    message:
      "JWT_SECRET precisa ter pelo menos 32 caracteres. Gere um com: node -e \"console.log(require('crypto').randomBytes(48).toString('base64url'))\"",
  })
  @Matches(new RegExp(`^(?!(${FORBIDDEN_JWT_SECRETS.join('|')})$).*$`), {
    message:
      'JWT_SECRET ainda é um valor de exemplo. Gere um segredo novo e rotacione as sessões.',
  })
  JWT_SECRET!: string;

  @IsOptional()
  @IsString()
  JWT_EXPIRES_IN?: string;

  @IsOptional()
  @IsInt({ message: 'PORT precisa ser um número inteiro.' })
  @Min(1, { message: 'PORT precisa ser maior que zero.' })
  PORT?: number;

  @IsOptional()
  @IsIn(['development', 'production', 'test'], {
    message: 'NODE_ENV deve ser development, production ou test.',
  })
  NODE_ENV?: string;

  /** Origens extras liberadas (túnel, domínio próprio). Vírgula separa. */
  @IsOptional()
  @IsString()
  ELDORIA_ALLOWED_ORIGINS?: string;

  /** Hosts públicos do túnel, sem esquema. Viram origem http e https. */
  @IsOptional()
  @IsString()
  ELDORIA_PUBLIC_HOSTS?: string;

  /** 1 quando estiver atrás de proxy/túnel confiável. */
  @IsOptional()
  @IsString()
  TRUST_PROXY?: string;

  @IsOptional()
  @IsString()
  ANTHROPIC_API_KEY?: string;

  @IsOptional()
  @IsString()
  GAME_MASTER_MODEL?: string;

  @IsOptional()
  @IsString()
  GAME_MASTER_OLLAMA_URL?: string;

  @IsOptional()
  @IsString()
  GAME_MASTER_TIMEOUT_MS?: string;
}

/**
 * Valida o ambiente no boot e derruba a aplicação com mensagem clara quando
 * falta configuração. Sem isso, o servidor subia com o segredo padrão.
 */
export function validateEnv(
  config: Record<string, unknown>,
): Record<string, unknown> {
  const validated = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });

  const errors = validateSync(validated, { skipMissingProperties: false });

  if (errors.length > 0) {
    const details = errors
      .flatMap((error) => Object.values(error.constraints ?? {}))
      .map((message) => `  - ${message}`)
      .join('\n');
    throw new Error(
      `Configuração de ambiente inválida. Corrija backend/.env:\n${details}\nVeja backend/.env.example.`,
    );
  }

  return { ...config, ...validated };
}
