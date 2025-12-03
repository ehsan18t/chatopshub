import { createParamDecorator, type ExecutionContext } from "@nestjs/common";

export interface CurrentUserPayload {
  id: string;
  email: string;
  organizationId: string;
  role: "ADMIN" | "AGENT";
}

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      user?: CurrentUserPayload;
    }
  }
}

export const CurrentUser = createParamDecorator(
  (
    data: keyof CurrentUserPayload | undefined,
    ctx: ExecutionContext,
  ): CurrentUserPayload | string | undefined => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user as CurrentUserPayload | undefined;

    if (!user) {
      return undefined;
    }

    return data ? user[data] : user;
  },
);
