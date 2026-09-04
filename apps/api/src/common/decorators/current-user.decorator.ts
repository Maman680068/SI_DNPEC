import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthenticatedUser } from '../types/auth-user.type';

/** Injecte request.user (ou l'un de ses champs) dans un handler de contrôleur. */
export const CurrentUser = createParamDecorator(
  (field: keyof AuthenticatedUser | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<{ user: AuthenticatedUser }>();
    return field ? request.user?.[field] : request.user;
  },
);
