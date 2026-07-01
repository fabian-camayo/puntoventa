"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.POS_SHORTCUTS = void 0;
exports.POS_SHORTCUTS = [
    { key: 'F1', description: 'Nueva venta', action: 'sale.new' },
    { key: 'F2', description: 'Buscar producto', action: 'product.search' },
    { key: 'F3', description: 'Cambiar cliente', action: 'customer.change' },
    { key: 'F4', description: 'Descuento general', action: 'sale.discount' },
    { key: 'F5', description: 'Suspender venta', action: 'sale.suspend' },
    { key: 'F6', description: 'Recuperar venta suspendida', action: 'sale.recover' },
    { key: 'F8', description: 'Cobrar', action: 'sale.checkout' },
    { key: 'F9', description: 'Imprimir ticket', action: 'sale.print' },
    { key: 'F10', description: 'Cancelar venta', action: 'sale.cancel' },
    { key: 'F12', description: 'Abrir/cerrar caja', action: 'register.toggle' },
    { key: 'Delete', description: 'Eliminar línea', action: 'line.delete' },
    { key: '+', ctrl: true, description: 'Aumentar cantidad', action: 'line.increase' },
    { key: '-', ctrl: true, description: 'Disminuir cantidad', action: 'line.decrease' },
    { key: 'Tab', ctrl: true, description: 'Siguiente pestaña', action: 'tab.next' },
    { key: 'Tab', ctrl: true, shift: true, description: 'Pestaña anterior', action: 'tab.prev' },
];
//# sourceMappingURL=keyboard-shortcuts.js.map