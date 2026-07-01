export declare const APP_MODES: {
    readonly STANDALONE: "STANDALONE";
    readonly SERVER: "SERVER";
    readonly CLIENT: "CLIENT";
};
export type AppMode = (typeof APP_MODES)[keyof typeof APP_MODES];
export declare const DEFAULT_API_PORT = 3000;
export declare const DEFAULT_API_HOST = "0.0.0.0";
export declare const MDNS_SERVICE_TYPE = "_puntoventa._tcp";
//# sourceMappingURL=app-modes.d.ts.map