import { api, hasConfiguredApi } from './api'
import { demoUser } from '../lib/mockData'
import { sleep } from '../lib/utils'
import { firebaseAuth } from '../lib/firebase'
import { GoogleAuthProvider, signInWithEmailAndPassword, signInWithPopup, signOut } from 'firebase/auth'
import type { User } from '../types'

interface AuthResponse {
  token: string
  user: User
}

const googleProvider = new GoogleAuthProvider()
googleProvider.setCustomParameters({ prompt: 'select_account' })

export async function loginUser(values: { email: string; password: string }): Promise<AuthResponse> {
  try {
    const credentials = await signInWithEmailAndPassword(firebaseAuth, values.email, values.password)
    const token = await credentials.user.getIdToken()
    return {
      token,
      user: {
        id: credentials.user.uid,
        name: credentials.user.displayName ?? deriveNameFromEmail(credentials.user.email ?? values.email),
        email: credentials.user.email ?? values.email,
        avatarUrl: credentials.user.photoURL ?? undefined,
      },
    }
  } catch (firebaseError) {
    if (!hasConfiguredApi()) {
      throw firebaseError
    }
  }

  if (hasConfiguredApi()) {
    const { data } = await api.post<AuthResponse>('/api/auth/login', values)
    return data
  }

  await sleep(450)
  return {
    token: 'demo.jwt.token',
    user: { ...demoUser, email: values.email },
  }
}

export async function registerUser(values: { name: string; email: string; password: string }): Promise<AuthResponse> {
  if (hasConfiguredApi()) {
    const { data } = await api.post<AuthResponse>('/api/auth/register', values)
    return data
  }

  await sleep(550)
  return {
    token: 'demo.jwt.token',
    user: { ...demoUser, name: values.name, email: values.email },
  }
}

export async function requestPasswordReset(email: string) {
  if (hasConfiguredApi()) {
    await api.post('/api/auth/forgot-password', { email })
    return
  }
  await sleep(500)
}

export async function resetPassword(values: { token: string; password: string }) {
  if (hasConfiguredApi()) {
    await api.post('/api/auth/reset-password', values)
    return
  }
  await sleep(500)
}

export async function logoutUser() {
  await signOut(firebaseAuth)
}

export async function loginWithGoogle(): Promise<AuthResponse> {
  const credentials = await signInWithPopup(firebaseAuth, googleProvider)
  const token = await credentials.user.getIdToken()

  return {
    token,
    user: {
      id: credentials.user.uid,
      name: credentials.user.displayName ?? deriveNameFromEmail(credentials.user.email ?? ''),
      email: credentials.user.email ?? '',
      avatarUrl: credentials.user.photoURL ?? undefined,
    },
  }
}

function deriveNameFromEmail(email: string) {
  const [local] = email.split('@')
  if (!local) return 'Developer'
  return local
    .split(/[._-]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}
