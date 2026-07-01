import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { Prisma } from '@prisma/client';
import { PaginationQuery } from '@puntoventa/shared';
import { UserRepository } from '../infrastructure/user.repository';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { AuditService } from '../../audit/application/audit.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { JwtPayload } from '@puntoventa/shared';

const BCRYPT_ROUNDS = 10;

@Injectable()
export class UsersService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async findAll(companyId: string, params?: PaginationQuery) {
    const result = await this.userRepository.findByCompany(companyId, params);
    return {
      ...result,
      items: result.items.map((user) => this.mapUserToDto(user)),
    };
  }

  async findById(id: string) {
    const user = await this.userRepository.findByIdWithRoles(id);
    if (!user) throw new NotFoundException('Usuario no encontrado');
    return this.mapUserToDto(user);
  }

  async create(dto: CreateUserDto, actor: JwtPayload) {
    const existing = await this.userRepository.findByUsername(dto.username);
    if (existing) {
      throw new ConflictException('El nombre de usuario ya existe');
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    const pinHash = dto.pin ? await bcrypt.hash(dto.pin, BCRYPT_ROUNDS) : undefined;

    const user = await this.prisma.executeInTransaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          companyId: dto.companyId,
          username: dto.username,
          passwordHash,
          firstName: dto.firstName,
          lastName: dto.lastName,
          email: dto.email,
          pin: pinHash,
          isActive: dto.isActive ?? true,
        },
      });

      if (dto.roleIds?.length) {
        await tx.userRole.createMany({
          data: dto.roleIds.map((roleId) => ({
            userId: created.id,
            roleId,
          })),
        });
      }

      return tx.user.findUnique({
        where: { id: created.id },
        include: { userRoles: { include: { role: true } } },
      });
    });

    await this.auditService.log({
      userId: actor.sub,
      action: 'CREATE',
      module: 'users',
      entityType: 'User',
      entityId: user!.id,
      newValues: { username: dto.username } as Prisma.InputJsonValue,
    });

    return this.mapUserToDto(user!);
  }

  async update(id: string, dto: UpdateUserDto, actor: JwtPayload) {
    const existing = await this.userRepository.findByIdWithRoles(id);
    if (!existing) throw new NotFoundException('Usuario no encontrado');

    const data: Prisma.UserUpdateInput = {
      firstName: dto.firstName,
      lastName: dto.lastName,
      email: dto.email,
      isActive: dto.isActive,
    };

    if (dto.password) {
      data.passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    }
    if (dto.pin) {
      data.pin = await bcrypt.hash(dto.pin, BCRYPT_ROUNDS);
    }

    const user = await this.prisma.executeInTransaction(async (tx) => {
      await tx.user.update({ where: { id }, data });

      if (dto.roleIds !== undefined) {
        await tx.userRole.deleteMany({ where: { userId: id } });
        if (dto.roleIds.length) {
          await tx.userRole.createMany({
            data: dto.roleIds.map((roleId) => ({ userId: id, roleId })),
          });
        }
      }

      return tx.user.findUnique({
        where: { id },
        include: { userRoles: { include: { role: true } } },
      });
    });

    await this.auditService.log({
      userId: actor.sub,
      action: 'UPDATE',
      module: 'users',
      entityType: 'User',
      entityId: id,
    });

    return this.mapUserToDto(user!);
  }

  async remove(id: string, actor: JwtPayload) {
    const existing = await this.userRepository.findById(id);
    if (!existing) throw new NotFoundException('Usuario no encontrado');

    await this.userRepository.update(id, { isActive: false });

    await this.auditService.log({
      userId: actor.sub,
      action: 'DELETE',
      module: 'users',
      entityType: 'User',
      entityId: id,
    });

    return { success: true };
  }

  private mapUserToDto(user: {
    id: string;
    username: string;
    email: string | null;
    firstName: string;
    lastName: string;
    companyId: string;
    isActive: boolean;
    lastLoginAt: Date | null;
    createdAt: Date;
    userRoles?: Array<{ role: { id: string; code: string; name: string } }>;
  }) {
    return {
      id: user.id,
      username: user.username,
      email: user.email ?? undefined,
      firstName: user.firstName,
      lastName: user.lastName,
      companyId: user.companyId,
      isActive: user.isActive,
      lastLoginAt: user.lastLoginAt?.toISOString(),
      createdAt: user.createdAt.toISOString(),
      roles: user.userRoles?.map((ur) => ({
        id: ur.role.id,
        code: ur.role.code,
        name: ur.role.name,
      })),
    };
  }
}
