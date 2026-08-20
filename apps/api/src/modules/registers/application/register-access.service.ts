import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { JwtPayload } from '@puntoventa/shared';

/**
 * Centraliza la regla de acceso a cajas: un administrador (permiso `registers.admin`)
 * puede operar/consultar cualquier caja; un usuario normal solo las que tiene
 * asignadas en `UserRegister`. Se usa tanto para abrir/cerrar/consultar sesiones
 * de caja como para restringir qué ventas puede ver o modificar cada usuario.
 */
@Injectable()
export class RegisterAccessService {
  constructor(private readonly prisma: PrismaService) {}

  isAdmin(actor: JwtPayload): boolean {
    return actor.permissions?.includes('registers.admin') ?? false;
  }

  getAssignedRegisterIds(userId: string): Promise<string[]> {
    return this.prisma.userRegister
      .findMany({ where: { userId }, select: { registerId: true } })
      .then((rows) => rows.map((r) => r.registerId));
  }

  /** `null` significa sin restricción (el actor es admin y puede ver todas las cajas). */
  async getAccessibleRegisterIds(actor: JwtPayload): Promise<string[] | null> {
    if (this.isAdmin(actor)) return null;
    return this.getAssignedRegisterIds(actor.sub);
  }

  async assertCanAccessRegister(registerId: string, actor: JwtPayload): Promise<void> {
    if (this.isAdmin(actor)) return;

    const assigned = await this.prisma.userRegister.findFirst({
      where: { userId: actor.sub, registerId },
    });
    if (!assigned) {
      throw new ForbiddenException('No tiene acceso a esta caja');
    }
  }
}
