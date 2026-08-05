import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { BankAccountsService } from '../application/bank-accounts.service';
import { CreateBankAccountDto } from '../application/dto/create-bank-account.dto';
import { UpdateBankAccountDto } from '../application/dto/update-bank-account.dto';
import { JwtAuthGuard } from '../../../presentation/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../presentation/guards/permissions.guard';
import { RequirePermissions } from '../../../presentation/decorators/permissions.decorator';
import { CurrentUser } from '../../../presentation/decorators/current-user.decorator';
import { JwtPayload } from '@puntoventa/shared';

@ApiTags('Cuentas bancarias')
@Controller('bank-accounts')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth()
export class BankAccountsController {
  constructor(private readonly bankAccountsService: BankAccountsService) {}

  @Get('active')
  @RequirePermissions('bank_accounts.view', 'purchases.create', 'purchases.update')
  @ApiOperation({ summary: 'Listar cuentas bancarias activas' })
  findActive(@Query('branchId') branchId: string) {
    return this.bankAccountsService.findActive(branchId);
  }

  @Get()
  @RequirePermissions('bank_accounts.view')
  @ApiOperation({ summary: 'Listar cuentas bancarias' })
  findAll(
    @Query('branchId') branchId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('search') search?: string,
    @Query('activeOnly') activeOnly?: string,
  ) {
    return this.bankAccountsService.findAll(branchId, {
      page,
      limit,
      search,
      activeOnly: activeOnly === 'true',
    });
  }

  @Get(':id')
  @RequirePermissions('bank_accounts.view')
  @ApiOperation({ summary: 'Obtener cuenta bancaria por ID' })
  findOne(@Param('id') id: string) {
    return this.bankAccountsService.findById(id);
  }

  @Post()
  @RequirePermissions('bank_accounts.create')
  @ApiOperation({ summary: 'Crear cuenta bancaria' })
  create(@Body() dto: CreateBankAccountDto, @CurrentUser() user: JwtPayload) {
    return this.bankAccountsService.create(dto, user);
  }

  @Put(':id')
  @RequirePermissions('bank_accounts.update')
  @ApiOperation({ summary: 'Actualizar cuenta bancaria' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateBankAccountDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.bankAccountsService.update(id, dto, user);
  }

  @Delete(':id')
  @RequirePermissions('bank_accounts.delete')
  @ApiOperation({ summary: 'Desactivar cuenta bancaria' })
  remove(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.bankAccountsService.remove(id, user);
  }
}
