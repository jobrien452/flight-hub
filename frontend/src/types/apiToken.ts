export interface ApiToken {
  id: string
  name: string
  prefix: string
  created_at: string
  last_used_at: string | null
}

// the secret only ever comes back on the response that created it
export interface ApiTokenCreated extends ApiToken {
  token: string
}
