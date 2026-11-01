/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Call the API directly instead of through the Vite proxy, e.g. http://localhost:4000 */
  readonly VITE_API_URL?: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
