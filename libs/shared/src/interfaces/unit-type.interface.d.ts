export interface UnitTypeDto {
    id: string;
    code: string;
    name: string;
    description?: string;
    isActive: boolean;
    sortOrder: number;
}
export interface CreateUnitTypeRequest {
    code: string;
    name: string;
    description?: string;
    isActive?: boolean;
    sortOrder?: number;
}
export interface UpdateUnitTypeRequest {
    name?: string;
    description?: string;
    isActive?: boolean;
    sortOrder?: number;
}
export interface ProductUnitDto {
    id?: string;
    unitTypeId: string;
    unitTypeCode?: string;
    unitTypeName?: string;
    /** Unidades de inventario que representa 1 de esta unidad de venta/compra. */
    stockFactor: number;
    isBase: boolean;
    isActive: boolean;
}
export interface ProductUnitInput {
    unitTypeId: string;
    stockFactor: number;
    isBase: boolean;
    isActive?: boolean;
}
//# sourceMappingURL=unit-type.interface.d.ts.map