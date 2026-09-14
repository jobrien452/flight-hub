import type { LoginResponse } from '../types/auth'

// stub, test in auth.test.ts defines the contract
export async function login(_name: string): Promise<LoginResponse> {
  throw new Error('not implemented')
}
