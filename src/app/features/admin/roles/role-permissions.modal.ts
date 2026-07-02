import { Component, Input, OnInit, inject, signal, computed } from '@angular/core';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonButton,
  IonContent,
  IonIcon,
  IonSpinner,
  IonCheckbox,
  ModalController,
  ToastController,
} from '@ionic/angular/standalone';
import { TranslateModule } from '@ngx-translate/core';
import { addIcons } from 'ionicons';
import { closeOutline, checkmarkOutline, keyOutline } from 'ionicons/icons';
import { firstValueFrom } from 'rxjs';
import {
  PermissionDto,
  PermissionGroupDto,
  RoleDto,
  RoleService,
} from '@core/services/role.service';

addIcons({ closeOutline, checkmarkOutline, keyOutline });

/** Acciones CRUD estándar mostradas como columnas fijas */
export const STANDARD_ACTIONS = ['view', 'create', 'update', 'delete'] as const;
export type StandardAction = (typeof STANDARD_ACTIONS)[number];

/** Orden lógico de módulos en la matriz */
const MODULE_ORDER = [
  'products',
  'categories',
  'customers',
  'suppliers',
  'purchases',
  'sales',
  'inventory',
  'registers',
  'reports',
  'users',
  'roles',
  'config',
  'promotions',
  'audit',
] as const;

@Component({
  selector: 'app-role-permissions-modal',
  templateUrl: './role-permissions.modal.html',
  styleUrls: ['./role-permissions.modal.scss'],
  imports: [
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonButton,
    IonContent,
    IonIcon,
    IonSpinner,
    IonCheckbox,
    TranslateModule,
  ],
})
export class RolePermissionsModal implements OnInit {
  private readonly roleService = inject(RoleService);
  private readonly modalCtrl = inject(ModalController);
  private readonly toast = inject(ToastController);

  @Input() role!: RoleDto;
  @Input() readOnly = false;

  readonly standardActions = STANDARD_ACTIONS;

  saving = signal(false);
  loading = signal(true);
  groups = signal<PermissionGroupDto[]>([]);
  selectedIds = signal<Set<string>>(new Set());

  sortedGroups = computed(() => {
    const items = [...this.groups()];
    return items.sort((a, b) => {
      const ai = MODULE_ORDER.indexOf(a.module as (typeof MODULE_ORDER)[number]);
      const bi = MODULE_ORDER.indexOf(b.module as (typeof MODULE_ORDER)[number]);
      const orderA = ai === -1 ? 999 : ai;
      const orderB = bi === -1 ? 999 : bi;
      if (orderA !== orderB) return orderA - orderB;
      return a.module.localeCompare(b.module);
    });
  });

  ngOnInit(): void {
    void this.loadData();
  }

  dismiss(saved = false): void {
    void this.modalCtrl.dismiss(null, saved ? 'saved' : 'cancel');
  }

  getPermission(group: PermissionGroupDto, action: string): PermissionDto | undefined {
    return group.permissions.find((p) => p.action === action);
  }

  getExtraPermissions(group: PermissionGroupDto): PermissionDto[] {
    const standard = new Set<string>(STANDARD_ACTIONS);
    return group.permissions
      .filter((p) => !standard.has(p.action))
      .sort((a, b) => a.action.localeCompare(b.action));
  }

  isSelected(permission: PermissionDto): boolean {
    return this.selectedIds().has(permission.id);
  }

  isActionSelected(group: PermissionGroupDto, action: string): boolean {
    const permission = this.getPermission(group, action);
    return permission ? this.isSelected(permission) : false;
  }

  togglePermission(permission: PermissionDto, checked: boolean): void {
    if (this.readOnly) return;
    const next = new Set(this.selectedIds());
    if (checked) {
      next.add(permission.id);
    } else {
      next.delete(permission.id);
    }
    this.selectedIds.set(next);
  }

  toggleAction(group: PermissionGroupDto, action: string, checked: boolean): void {
    const permission = this.getPermission(group, action);
    if (permission) this.togglePermission(permission, checked);
  }

  toggleModule(group: PermissionGroupDto, checked: boolean): void {
    const next = new Set(this.selectedIds());
    for (const permission of group.permissions) {
      if (checked) {
        next.add(permission.id);
      } else {
        next.delete(permission.id);
      }
    }
    this.selectedIds.set(next);
  }

  toggleActionColumn(action: string, checked: boolean): void {
    const next = new Set(this.selectedIds());
    for (const group of this.groups()) {
      const permission = this.getPermission(group, action);
      if (!permission) continue;
      if (checked) {
        next.add(permission.id);
      } else {
        next.delete(permission.id);
      }
    }
    this.selectedIds.set(next);
  }

  isModuleFullySelected(group: PermissionGroupDto): boolean {
    return group.permissions.every((p) => this.selectedIds().has(p.id));
  }

  isActionColumnFullySelected(action: string): boolean {
    return this.groups().every((group) => {
      const permission = this.getPermission(group, action);
      return !permission || this.selectedIds().has(permission.id);
    });
  }

  isActionColumnPartiallySelected(action: string): boolean {
    let hasAny = false;
    let hasAll = true;
    for (const group of this.groups()) {
      const permission = this.getPermission(group, action);
      if (!permission) continue;
      if (this.selectedIds().has(permission.id)) {
        hasAny = true;
      } else {
        hasAll = false;
      }
    }
    return hasAny && !hasAll;
  }

  moduleSelectedCount(group: PermissionGroupDto): number {
    return group.permissions.filter((p) => this.selectedIds().has(p.id)).length;
  }

  selectedCount(): number {
    return this.selectedIds().size;
  }

  async save(): Promise<void> {
    this.saving.set(true);

    try {
      const permissions = Array.from(this.selectedIds()).map((permissionId) => ({
        permissionId,
        granted: true,
      }));

      await firstValueFrom(
        this.roleService.assignPermissions(this.role.id, { permissions }),
      );

      this.dismiss(true);
    } catch (err: unknown) {
      const message =
        (err as { error?: { message?: string } })?.error?.message ??
        'No se pudieron guardar los permisos';
      const t = await this.toast.create({ message, duration: 3500, color: 'danger' });
      await t.present();
    } finally {
      this.saving.set(false);
    }
  }

  private async loadData(): Promise<void> {
    this.loading.set(true);

    try {
      const [groups, roleDetail] = await Promise.all([
        firstValueFrom(this.roleService.getPermissionsGrouped()),
        firstValueFrom(this.roleService.getById(this.role.id)),
      ]);

      this.groups.set(groups);

      const granted = new Set(
        (roleDetail.permissions ?? [])
          .filter((p) => p.granted !== false)
          .map((p) => p.id),
      );
      this.selectedIds.set(granted);
    } catch {
      this.groups.set([]);
      const t = await this.toast.create({
        message: 'Error al cargar permisos',
        duration: 3000,
        color: 'danger',
      });
      await t.present();
    } finally {
      this.loading.set(false);
    }
  }
}
