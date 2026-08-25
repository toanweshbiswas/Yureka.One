import { resolveSiteRole } from '@shared/hosts'

/** Auth paths: root on wanderworld host, /ww/* on localhost combined SPA. */
export function wwLoginPath() {
  return resolveSiteRole() === 'wanderworld' ? '/login' : '/ww/login'
}

export function wwSignupPath() {
  return resolveSiteRole() === 'wanderworld' ? '/signup' : '/ww/signup'
}

export function wwResetPath() {
  return resolveSiteRole() === 'wanderworld' ? '/reset-password' : '/ww/reset-password'
}

export function wwHomePath() {
  return resolveSiteRole() === 'wanderworld' ? '/' : '/ww'
}
