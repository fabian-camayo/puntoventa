export declare const PERMISSION_MODULES: {
    readonly PRODUCTS: "products";
    readonly CATEGORIES: "categories";
    readonly CUSTOMERS: "customers";
    readonly SUPPLIERS: "suppliers";
    readonly PURCHASES: "purchases";
    readonly SALES: "sales";
    readonly INVENTORY: "inventory";
    readonly REGISTERS: "registers";
    readonly REPORTS: "reports";
    readonly USERS: "users";
    readonly ROLES: "roles";
    readonly CONFIG: "config";
    readonly AUDIT: "audit";
    readonly PROMOTIONS: "promotions";
};
export declare const PERMISSION_ACTIONS: {
    readonly VIEW: "view";
    readonly CREATE: "create";
    readonly UPDATE: "update";
    readonly DELETE: "delete";
    readonly VIEW_COSTS: "view_costs";
    readonly MODIFY_PRICES: "modify_prices";
    readonly VOID: "void";
    readonly REFUND: "refund";
    readonly ADJUST: "adjust";
    readonly OPEN: "open";
    readonly CLOSE: "close";
    readonly EXPORT: "export";
    readonly ADMIN: "admin";
};
export type PermissionModule = (typeof PERMISSION_MODULES)[keyof typeof PERMISSION_MODULES];
export type PermissionAction = (typeof PERMISSION_ACTIONS)[keyof typeof PERMISSION_ACTIONS];
export declare function buildPermissionCode(module: string, action: string): string;
export declare const DEFAULT_PERMISSIONS: ReadonlyArray<{
    module: string;
    action: string;
    name: string;
    description: string;
}>;
//# sourceMappingURL=permissions.d.ts.map