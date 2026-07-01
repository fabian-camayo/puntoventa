import { Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { PaginatedResult, PaginationQuery } from '@puntoventa/shared';

export abstract class BaseRepository<TModel, TCreate, TUpdate> {
  constructor(protected readonly prisma: PrismaService) {}

  protected abstract get model(): {
    findUnique: (args: { where: { id: string } }) => Promise<TModel | null>;
    findMany: (args?: unknown) => Promise<TModel[]>;
    create: (args: { data: TCreate }) => Promise<TModel>;
    update: (args: { where: { id: string }; data: TUpdate }) => Promise<TModel>;
    delete: (args: { where: { id: string } }) => Promise<TModel>;
    count: (args?: unknown) => Promise<number>;
  };

  async findById(id: string): Promise<TModel | null> {
    return this.model.findUnique({ where: { id } });
  }

  async findAll(params?: PaginationQuery): Promise<PaginatedResult<TModel>> {
    const page = params?.page ?? 1;
    const limit = params?.limit ?? 20;
    const skip = (page - 1) * limit;

    const where = params?.search
      ? this.buildSearchWhere(params.search)
      : undefined;

    const orderBy = params?.sortBy
      ? { [params.sortBy]: params.sortOrder ?? 'asc' }
      : { createdAt: 'desc' as const };

    const [items, total] = await Promise.all([
      this.model.findMany({
        where,
        skip,
        take: limit,
        orderBy,
      }),
      this.model.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async create(data: TCreate): Promise<TModel> {
    return this.model.create({ data });
  }

  async update(id: string, data: TUpdate): Promise<TModel> {
    return this.model.update({ where: { id }, data });
  }

  async delete(id: string): Promise<TModel> {
    return this.model.delete({ where: { id } });
  }

  protected abstract buildSearchWhere(search: string): Prisma.InputJsonValue;
}
