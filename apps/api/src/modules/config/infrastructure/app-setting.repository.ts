import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';

@Injectable()
export class AppSettingRepository {
  constructor(private readonly prisma: PrismaService) {}

  findAll(category?: string) {
    return this.prisma.appSetting.findMany({
      where: category ? { category } : undefined,
      orderBy: { key: 'asc' },
    });
  }

  findByKey(key: string) {
    return this.prisma.appSetting.findUnique({ where: { key } });
  }

  upsert(key: string, value: string, category = 'general', isSecret = false) {
    return this.prisma.appSetting.upsert({
      where: { key },
      create: { key, value, category, isSecret },
      update: { value, category, isSecret },
    });
  }

  delete(key: string) {
    return this.prisma.appSetting.delete({ where: { key } });
  }
}
