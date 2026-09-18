import type { Role } from './auth'

export interface User {
  id: string
  name: string
  email: string
  role: Role
  has_password: boolean
}

export interface UserCreateInput {
  name: string
  email: string
  role: Role
  // left off, the account gets an invite link to pick its own
  password?: string
}

export interface UserUpdateInput {
  name?: string
  email?: string
}
