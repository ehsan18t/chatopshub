import { type CanActivate, type ExecutionContext, Injectable } from "@nestjs/common";
import type { Reflector } from "@nestjs/core";
import type { CurrentUserPayload } from "../decorators/current-user.decorator";
import { ROLES_KEY, type Role } from "../decorators/roles.decorator";

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user as CurrentUserPayload | undefined;

    if (!user) {
      return false;
    }

    return requiredRoles.includes(user.role);
  }
}
