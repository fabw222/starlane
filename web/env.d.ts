/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUI_NETWORK: string;
  readonly VITE_STARLANE_PACKAGE_ID: string;
  readonly VITE_WORLD_PACKAGE_ID: string;
  readonly VITE_TOLL_REGISTRY_ID: string;
  readonly VITE_EVE_WORLD_PACKAGE_ID: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
