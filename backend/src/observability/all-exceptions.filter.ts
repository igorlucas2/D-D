import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Request, Response } from 'express';

interface ErrorBody {
  statusCode: number;
  error: string;
  message: string | string[];
  requestId: string | null;
  timestamp: string;
  path: string;
}

interface DescribedError {
  status: number;
  error: string;
  message: string | string[];
}

/**
 * Formato único de erro para a API. Erros do Prisma ganham código HTTP
 * adequado e erros inesperados nunca vazam stack trace para o cliente.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const http = host.switchToHttp();
    const response = http.getResponse<Response>();
    const request = http.getRequest<Request & { id?: string }>();
    const described = this.describe(exception);

    if (described.status >= 500) {
      const stack = exception instanceof Error ? exception.stack : undefined;
      this.logger.error(
        `${request.method} ${request.url} -> ${described.status}`,
        stack,
      );
    }

    if (response.headersSent) return;

    const body: ErrorBody = {
      statusCode: described.status,
      error: described.error,
      message: described.message,
      requestId: request.id ?? null,
      timestamp: new Date().toISOString(),
      path: request.url,
    };

    response.status(described.status).json(body);
  }

  private describe(exception: unknown): DescribedError {
    if (exception instanceof HttpException) {
      return this.describeHttp(exception);
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      return this.describePrisma(exception.code);
    }

    if (exception instanceof Prisma.PrismaClientValidationError) {
      return {
        status: HttpStatus.BAD_REQUEST,
        error: 'Bad Request',
        message: 'Dados inválidos para esta operação.',
      };
    }

    // Erros do body-parser (JSON malformado) chegam com status 4xx.
    const candidate = exception as {
      status?: number;
      statusCode?: number;
      type?: string;
      message?: string;
    };
    const status = candidate.status ?? candidate.statusCode;
    if (typeof status === 'number' && status >= 400 && status < 500) {
      return {
        status,
        error: status === 400 ? 'Bad Request' : 'Request Error',
        message:
          status === 400 && candidate.type === 'entity.parse.failed'
            ? 'JSON inválido no corpo da requisição.'
            : (candidate.message ?? 'Requisição inválida.'),
      };
    }

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      error: 'Internal Server Error',
      message: 'Erro interno. Tente novamente.',
    };
  }

  private describeHttp(exception: HttpException): DescribedError {
    const status = exception.getStatus();
    const payload = exception.getResponse();

    if (typeof payload === 'string') {
      return { status, error: exception.name, message: payload };
    }

    const record = payload as { message?: unknown; error?: unknown };
    const message = Array.isArray(record.message)
      ? record.message.map(String)
      : typeof record.message === 'string'
        ? record.message
        : exception.message;

    return {
      status,
      error: typeof record.error === 'string' ? record.error : exception.name,
      message,
    };
  }

  private describePrisma(code: string): DescribedError {
    switch (code) {
      case 'P2002':
        return {
          status: HttpStatus.CONFLICT,
          error: 'Conflict',
          message: 'Já existe um registro com estes valores.',
        };
      case 'P2025':
        return {
          status: HttpStatus.NOT_FOUND,
          error: 'Not Found',
          message: 'Registro não encontrado.',
        };
      case 'P2003':
        return {
          status: HttpStatus.CONFLICT,
          error: 'Conflict',
          message: 'Operação bloqueada por vínculos existentes.',
        };
      case 'P2034':
        return {
          status: HttpStatus.CONFLICT,
          error: 'Conflict',
          message: 'Conflito ao salvar. Tente novamente.',
        };
      default:
        return {
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          error: 'Internal Server Error',
          message: 'Erro de banco de dados.',
        };
    }
  }
}
