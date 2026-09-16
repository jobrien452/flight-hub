// swagger-ui-dist ships no types, this is the slice of it we call
declare module 'swagger-ui-dist' {
  interface SwaggerUIOptions {
    domNode: HTMLElement | null
    spec?: Record<string, unknown>
    deepLinking?: boolean
    tryItOutEnabled?: boolean
    docExpansion?: 'list' | 'full' | 'none'
    requestInterceptor?: (request: { headers: Record<string, string> }) => unknown
  }

  export function SwaggerUIBundle(options: SwaggerUIOptions): unknown
}
