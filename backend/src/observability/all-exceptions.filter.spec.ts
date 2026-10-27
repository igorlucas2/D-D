import 'reflect-metadata';
import {
  BadRequestException,
  ConflictException,
  type ArgumentsHost,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AllExceptionsFilter } from './all-exceptions.filter';

type JsonMock = jest.Mock<void, [unknown]>;

function hostWith(request: Record<string, unknown> = {}) {
  const response: {
    headersSent: boolean;
    status: jest.Mock;
    json: JsonMock;
  } = {
    headersSent: false,
    status: jest.fn().mockReturnThis(),
    json: jest.fn<void, [unknown]>(),
  };
  const requestObject = {
    method: 'POST',
    url: '/api/campaigns',
    id: 'req-123',
    ...request,
  };
  const host = {
    switchToHttp: () => ({
      getResponse: () => response,
      getRequest: () => requestObject,
    }),
  } as unknown as ArgumentsHost;

  return { host, response };
}

describe('AllExceptionsFilter', () => {
  it('preserva a lista de erros de validação e inclui requestId', () => {
    const { host, response } = hostWith();
    const filter = new AllExceptionsFilter();

    filter.catch(
      new BadRequestException({
        message: ['email must be an email'],
        error: 'Bad Request',
        statusCode: 400,
      }),
      host,
    );

    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 400,
        error: 'Bad Request',
        message: ['email must be an email'],
        requestId: 'req-123',
        path: '/api/campaigns',
      }),
    );
  });

  it('traduz P2002 para 409 sem detalhes do banco', () => {
    const { host, response } = hostWith();
    const filter = new AllExceptionsFilter();
    const error = new Prisma.PrismaClientKnownRequestError(
      'Unique constraint failed on the fields: (`email`)',
      { code: 'P2002', clientVersion: 'test' },
    );

    filter.catch(error, host);

    expect(response.status).toHaveBeenCalledWith(409);
    const body = response.json.mock.calls[0][0] as { message: string };
    expect(body.message).not.toContain('Unique constraint');
  });

  it('traduz P2025 para 404', () => {
    const { host, response } = hostWith();
    const filter = new AllExceptionsFilter();
    const error = new Prisma.PrismaClientKnownRequestError('not found', {
      code: 'P2025',
      clientVersion: 'test',
    });

    filter.catch(error, host);

    expect(response.status).toHaveBeenCalledWith(404);
  });

  it('não vaza stack nem mensagem de erro desconhecido', () => {
    const { host, response } = hostWith();
    const filter = new AllExceptionsFilter();

    filter.catch(new Error('segredo interno do banco'), host);

    expect(response.status).toHaveBeenCalledWith(500);
    const serialized = JSON.stringify(response.json.mock.calls[0][0]);
    expect(serialized).not.toContain('segredo interno');
    expect(serialized).toContain('Erro interno');
  });

  it('traduz JSON malformado do body-parser para 400', () => {
    const { host, response } = hostWith();
    const filter = new AllExceptionsFilter();
    const parseError = Object.assign(new SyntaxError('Unexpected token'), {
      status: 400,
      type: 'entity.parse.failed',
    });

    filter.catch(parseError, host);

    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'JSON inválido no corpo da requisição.',
      }),
    );
  });

  it('mantém respostas de HttpException de domínio', () => {
    const { host, response } = hostWith();
    const filter = new AllExceptionsFilter();

    filter.catch(
      new ConflictException('O mapa foi alterado por outra pessoa.'),
      host,
    );

    expect(response.status).toHaveBeenCalledWith(409);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 409,
        message: 'O mapa foi alterado por outra pessoa.',
      }),
    );
  });
});
