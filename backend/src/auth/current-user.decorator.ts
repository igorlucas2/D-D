import { createParamDecorator, ExecutionContext } from '@nestjs/common';

interface AuthenticatedRequest {
  user: { userId: string; email: string };
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    return request.user;
  },
);
