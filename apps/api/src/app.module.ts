import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { DatabaseModule } from './infrastructure/database/database.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { RolesModule } from './modules/roles/roles.module';
import { PermissionsModule } from './modules/permissions/permissions.module';
import { ProductsModule } from './modules/products/products.module';
import { CategoriesModule } from './modules/categories/categories.module';
import { CustomersModule } from './modules/customers/customers.module';
import { SuppliersModule } from './modules/suppliers/suppliers.module';
import { PurchasesModule } from './modules/purchases/purchases.module';
import { SalesModule } from './modules/sales/sales.module';
import { RegistersModule } from './modules/registers/registers.module';
import { TerminalsModule } from './modules/terminals/terminals.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { ReportsModule } from './modules/reports/reports.module';
import { ConfigAppModule } from './modules/config/config.module';
import { AuditModule } from './modules/audit/audit.module';
import { HealthModule } from './modules/health/health.module';
import { DiscoveryModule } from './modules/discovery/discovery.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../../.env'],
    }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 200 }]),
    DatabaseModule,
    AuthModule,
    UsersModule,
    RolesModule,
    PermissionsModule,
    ProductsModule,
    CategoriesModule,
    CustomersModule,
    SuppliersModule,
    PurchasesModule,
    SalesModule,
    RegistersModule,
    TerminalsModule,
    InventoryModule,
    ReportsModule,
    ConfigAppModule,
    AuditModule,
    HealthModule,
    DiscoveryModule,
  ],
})
export class AppModule {}
