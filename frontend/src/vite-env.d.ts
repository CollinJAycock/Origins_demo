// Only the variables declared below may be read from import.meta.env.
interface ViteTypeOptions {
  strictImportMetaEnv: unknown
}

interface ImportMetaEnv {
  /** Origin of the API when it is not served behind the dev/preview proxy. Defaults to same origin. */
  readonly VITE_API_BASE_URL?: string
}
