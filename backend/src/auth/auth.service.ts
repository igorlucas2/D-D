import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) {
      throw new ConflictException('Já existe uma conta com este e-mail.');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        displayName: dto.displayName,
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
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (!user) {
      throw new UnauthorizedException('Credenciais inválidas.');
    }

    const passwordMatches = await bcrypt.compare(
      dto.password,
      user.passwordHash,
    );
    if (!passwordMatches) {
      throw new UnauthorizedException('Credenciais inválidas.');
    }

    return this.buildAuthResponse(
      user.id,
      user.email,
      user.displayName,
      user.avatarUrl,
      user.accountLevel,
      user.accountXp,
    );
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
