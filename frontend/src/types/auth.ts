export type Role = 'admin' | 'pilot'

export interface LoginResponse {
  token: string
  user_id: string
  name: string
  role: Role
}
