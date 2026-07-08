import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService as NestConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import {
  AppConfigDto,
  ConnectionTestResult,
  SetupWizardRequest,
  PosContextDto,
} from '@puntoventa/shared';
import { APP_MODES, DEFAULT_API_HOST, DEFAULT_API_PORT } from '@puntoventa/shared';
import { Prisma } from '@prisma/client';
import { BusinessConfigRepository } from '../infrastructure/business-config.repository';
import { AppSettingRepository } from '../infrastructure/app-setting.repository';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { AuditService } from '../../audit/application/audit.service';
import { UpdateBusinessConfigDto } from './dto/update-business-config.dto';
import { UpdateAppSettingDto } from './dto/update-app-setting.dto';
import { SetupWizardDto } from './dto/setup-wizard.dto';
import { JwtPayload } from '@puntoventa/shared';

const BCRYPT_ROUNDS = 10;

@Injectable()
export class ConfigService {
  constructor(
    private readonly businessConfigRepository: BusinessConfigRepository,
    private readonly appSettingRepository: AppSettingRepository,
    private readonly prisma: PrismaService,
    private readonly nestConfig: NestConfigService,
    private readonly auditService: AuditService,
  ) {}

  async getAppConfig(): Promise<AppConfigDto> {
    const modeSetting = await this.appSettingRepository.findByKey('app.mode');
    const branchSetting = await this.appSettingRepository.findByKey('app.branch_id');
    const registerSetting = await this.appSettingRepository.findByKey('app.register_id');
    const languageSetting = await this.appSettingRepository.findByKey('app.language');
    const themeSetting = await this.appSettingRepository.findByKey('app.theme');
    const configuredSetting = await this.appSettingRepository.findByKey('app.configured');

    const host = this.nestConfig.get<string>('API_HOST', DEFAULT_API_HOST);
    const port = this.nestConfig.get<number>('API_PORT', DEFAULT_API_PORT);

    return {
      mode: (modeSetting?.value as AppConfigDto['mode']) ?? APP_MODES.STANDALONE,
      serverHost: host,
      serverPort: port,
      apiUrl: `http://${host === '0.0.0.0' ? 'localhost' : host}:${port}`,
      isConfigured: configuredSetting?.value === 'true',
      branchId: branchSetting?.value,
      registerId: registerSetting?.value,
      language: languageSetting?.value ?? 'es',
      theme: (themeSetting?.value as AppConfigDto['theme']) ?? 'system',
    };
  }

  async getBusinessConfig(branchId: string) {
    const config = await this.businessConfigRepository.findByBranchId(branchId);
    if (!config) throw new NotFoundException('Configuración de negocio no encontrada');

    return {
      id: config.id,
      branchId: config.branchId,
      businessName: config.businessName,
      taxId: config.taxId ?? undefined,
      address: config.address ?? undefined,
      phone: config.phone ?? undefined,
      email: config.email ?? undefined,
      currency: config.currency,
      currencySymbol: config.currencySymbol,
      taxRate: Number(config.taxRate),
      ticketHeader: config.ticketHeader ?? undefined,
      ticketFooter: config.ticketFooter ?? undefined,
      allowNegativeStock: config.allowNegativeStock,
      defaultCustomerId: config.defaultCustomerId ?? undefined,
    };
  }

  async updateBusinessConfig(branchId: string, dto: UpdateBusinessConfigDto, actor: JwtPayload) {
    const config = await this.businessConfigRepository.upsert(branchId, dto);

    await this.auditService.log({
      userId: actor.sub,
      action: 'CONFIG_CHANGE',
      module: 'config',
      entityType: 'BusinessConfig',
      entityId: config.id,
      newValues: { businessName: dto.businessName } as Prisma.InputJsonValue,
    });

    return this.getBusinessConfig(branchId);
  }

  async getPosContext(deviceId?: string, ipAddress?: string): Promise<PosContextDto> {
    const branchSetting = await this.appSettingRepository.findByKey('app.branch_id');
    const registerSetting = await this.appSettingRepository.findByKey('app.register_id');

    let branch = branchSetting?.value
      ? await this.prisma.branch.findUnique({ where: { id: branchSetting.value } })
      : null;

    if (!branch) {
      branch =
        (await this.prisma.branch.findFirst({ where: { isMain: true, isActive: true } })) ??
        (await this.prisma.branch.findFirst({
          where: { isActive: true },
          orderBy: { createdAt: 'asc' },
        }));
    }

    if (!branch) {
      throw new NotFoundException('No hay sucursal configurada');
    }

    const terminal = await this.resolveTerminal(branch.id, deviceId, ipAddress);

    let register = terminal?.registerId
      ? await this.prisma.register.findFirst({
          where: { id: terminal.registerId, branchId: branch.id, isActive: true },
        })
      : null;

    const registerBoundToTerminal = !!register;

    if (!register) {
      register = registerSetting?.value
        ? await this.prisma.register.findFirst({
            where: { id: registerSetting.value, branchId: branch.id, isActive: true },
          })
        : null;
    }

    if (!register) {
      register = await this.prisma.register.findFirst({
        where: { branchId: branch.id, isActive: true },
        orderBy: { code: 'asc' },
      });
    }

    if (!register) {
      throw new NotFoundException('No hay caja registradora configurada');
    }

    if (branchSetting?.value !== branch.id) {
      await this.appSettingRepository.upsert('app.branch_id', branch.id, 'app');
    }

    const businessConfig = await this.businessConfigRepository.findByBranchId(branch.id);

    return {
      branchId: branch.id,
      branchName: branch.name,
      registerId: register.id,
      registerName: register.name,
      registerCode: register.code,
      registerBoundToTerminal,
      businessName: businessConfig?.businessName ?? branch.name,
      ticketHeader: businessConfig?.ticketHeader ?? undefined,
      ticketFooter: businessConfig?.ticketFooter ?? undefined,
    };
  }

  private async resolveTerminal(
    branchId: string,
    deviceId?: string,
    ipAddress?: string,
  ): Promise<{ registerId: string | null } | null> {
    const cleanIp = this.normalizeIp(ipAddress);

    if (deviceId) {
      const existing = await this.prisma.terminal.findUnique({ where: { deviceId } });
      if (existing) {
        if (existing.isActive) {
          await this.prisma.terminal.update({
            where: { deviceId },
            data: { lastSeenAt: new Date(), ipAddress: cleanIp ?? existing.ipAddress },
          });
        }
        return existing.isActive ? { registerId: existing.registerId } : null;
      }

      const created = await this.prisma.terminal.create({
        data: {
          branchId,
          deviceId,
          name: cleanIp ? `Equipo ${cleanIp}` : 'Equipo nuevo',
          ipAddress: cleanIp,
          lastSeenAt: new Date(),
        },
      });
      return { registerId: created.registerId };
    }

    if (cleanIp) {
      const byIp = await this.prisma.terminal.findFirst({
        where: { branchId, ipAddress: cleanIp, isActive: true },
      });
      if (byIp) {
        await this.prisma.terminal.update({
          where: { id: byIp.id },
          data: { lastSeenAt: new Date() },
        });
        return { registerId: byIp.registerId };
      }
    }

    return null;
  }

  private normalizeIp(ip?: string): string | undefined {
    if (!ip) return undefined;
    let value = ip.trim();
    if (value.startsWith('::ffff:')) value = value.slice(7);
    if (value === '::1') value = '127.0.0.1';
    return value || undefined;
  }

  async getAppSettings(category?: string) {
    const settings = await this.appSettingRepository.findAll(category);
    return settings.map((s) => ({
      key: s.key,
      value: s.isSecret ? '********' : s.value,
      category: s.category,
      isSecret: s.isSecret,
    }));
  }

  async updateAppSetting(dto: UpdateAppSettingDto, actor: JwtPayload) {
    const setting = await this.appSettingRepository.upsert(
      dto.key,
      dto.value,
      dto.category,
      dto.isSecret,
    );

    await this.auditService.log({
      userId: actor.sub,
      action: 'CONFIG_CHANGE',
      module: 'config',
      entityType: 'AppSetting',
      entityId: setting.id,
      newValues: { key: dto.key } as Prisma.InputJsonValue,
    });

    return {
      key: setting.key,
      value: setting.isSecret ? '********' : setting.value,
      category: setting.category,
      isSecret: setting.isSecret,
    };
  }

  async runSetupWizard(dto: SetupWizardDto): Promise<ConnectionTestResult> {
    const configured = await this.appSettingRepository.findByKey('app.configured');
    if (configured?.value === 'true') {
      throw new BadRequestException('La aplicación ya está configurada');
    }

    await this.prisma.executeInTransaction(async (tx) => {
      await tx.appSetting.upsert({
        where: { key: 'app.mode' },
        create: { key: 'app.mode', value: dto.mode, category: 'app' },
        update: { value: dto.mode },
      });

      if (dto.serverHost) {
        await tx.appSetting.upsert({
          where: { key: 'app.server_host' },
          create: { key: 'app.server_host', value: dto.serverHost, category: 'app' },
          update: { value: dto.serverHost },
        });
      }

      if (dto.serverPort) {
        await tx.appSetting.upsert({
          where: { key: 'app.server_port' },
          create: { key: 'app.server_port', value: String(dto.serverPort), category: 'app' },
          update: { value: String(dto.serverPort) },
        });
      }

      if (dto.mode === APP_MODES.STANDALONE && dto.businessName && dto.adminUsername && dto.adminPassword) {
        const company = await tx.company.create({
          data: {
            code: 'MAIN',
            name: dto.businessName,
          },
        });

        const branch = await tx.branch.create({
          data: {
            companyId: company.id,
            code: 'MAIN',
            name: dto.businessName,
            isMain: true,
          },
        });

        await tx.businessConfig.create({
          data: {
            branchId: branch.id,
            businessName: dto.businessName,
          },
        });

        const passwordHash = await bcrypt.hash(dto.adminPassword, BCRYPT_ROUNDS);

        const adminRole = await tx.role.findFirst({ where: { code: 'ADMIN' } });

        const user = await tx.user.create({
          data: {
            companyId: company.id,
            username: dto.adminUsername,
            passwordHash,
            firstName: dto.adminFirstName ?? 'Administrador',
            lastName: dto.adminLastName ?? 'Sistema',
          },
        });

        if (adminRole) {
          await tx.userRole.create({
            data: { userId: user.id, roleId: adminRole.id },
          });
        }

        await tx.appSetting.upsert({
          where: { key: 'app.branch_id' },
          create: { key: 'app.branch_id', value: branch.id, category: 'app' },
          update: { value: branch.id },
        });
      }

      await tx.appSetting.upsert({
        where: { key: 'app.configured' },
        create: { key: 'app.configured', value: 'true', category: 'app' },
        update: { value: 'true' },
      });
    });

    return {
      success: true,
      message: 'Configuración inicial completada',
      serverVersion: '1.0.0',
    };
  }

  async testConnection(request: SetupWizardRequest): Promise<ConnectionTestResult> {
    if (request.mode === APP_MODES.STANDALONE) {
      return {
        success: true,
        message: 'Modo standalone: no requiere conexión a servidor remoto',
        serverVersion: '1.0.0',
      };
    }

    const host = request.serverHost ?? 'localhost';
    const port = request.serverPort ?? DEFAULT_API_PORT;

    return {
      success: true,
      message: `Conexión simulada a ${host}:${port}`,
      serverVersion: '1.0.0',
    };
  }
}
