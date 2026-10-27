import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { LoginAttemptTracker } from './login-attempts';

const INVALID_CREDENTIALS = 'Credenciais inválidas.';
const TOO_MANY_ATTEMPTS =
  'Muitas tentativas de entrada. Aguarde alguns minutos e tente de novo.';

@Injectable()
export class AuthService {
  private readonly attempts = new LoginAttemptTracker();

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    const email = this.normalizeEmail(dto.email);
    const displayName = dto.displayName.trim();
    if (displayName.length < 2) {
      throw new BadRequestException('Informe um nome de exibição.');
    }

    const existing = await this.prisma.user.findUnique({
      where: { email },
    });
    if (existing) {
      throw new ConflictException('Já existe uma conta com este e-mail.');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);

    try {
      const user = await this.prisma.user.create({
        data: {
          email,
          passwordHash,
          displayName,
        },
      });

      return this.buildAuthResponse(
        user.id,
        user.email,
        user.displayName,
        user.avatarUrl,
        user.accountLevel,
        user.accountXp,
      );
    } catch (error) {
      // Duas pessoas cadastrando o mesmo e-mail ao mesmo tempo: a constraint
      // única vence a corrida e o cliente recebe 409, não 500.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Já existe uma conta com este e-mail.');
      }
      throw error;
    }
  }

  async login(dto: LoginDto) {
    const email = this.normalizeEmail(dto.email);

    if (this.attempts.isBlocked(email)) {
      throw new HttpException(TOO_MANY_ATTEMPTS, HttpStatus.TOO_MANY_REQUESTS);
    }

    const user = await this.prisma.user.findUnique({
      where: { email },
    });
    if (!user) {
      this.attempts.registerFailure(email);
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }

    const passwordMatches = await bcrypt.compare(
      dto.password,
      user.passwordHash,
    );
    if (!passwordMatches) {
      this.attempts.registerFailure(email);
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }

    this.attempts.reset(email);

    return this.buildAuthResponse(
      user.id,
      user.email,
      user.displayName,
      user.avatarUrl,
      user.accountLevel,
      user.accountXp,
    );
  }

  private normalizeEmail(email: string) {
    return email.trim().toLowerCase();
  }

  private buildAuthResponse(
    id: string,
    email: string,
    displayName: string,
    avatarUrl: string | null,
    accountLevel: number,
    accountXp: number,
  ) {
    const accessToken = this.jwtService.sign({ sub: id, email });

    return {
      accessToken,
      user: { id, email, displayName, avatarUrl, accountLevel, accountXp },
    };
  }
}
