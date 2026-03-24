import type { Express, Response } from 'express'
import { URL } from 'node:url'
import type { AppContext } from '../app-context.ts'
import { getOpenIdConfiguration, client as openIdClient } from '../auth/openid.ts'
import { createPasswordHash, verifyPasswordHash } from '../auth/passwords.ts'
import { clearRateLimit, consumeRateLimit } from '../auth/rate-limit.ts'
import type { AuthenticatedRequest } from '../auth/request.ts'
import { serializeUser } from '../auth/serializers.ts'
import { getAppBaseUrl, resolveSafeReturnTo } from '../auth/url.ts'
import { buildAuthStatus, getRequestAuth, requireAuthenticated } from '../auth/middleware.ts'
import { createRawAuthToken } from '../auth/tokens.ts'
import { normalizeStoredDateTimeToIso } from '../meta/utils.ts'

function buildUserPayload(req: AuthenticatedRequest) {
  const auth = getRequestAuth(req)
  if (auth.kind === 'anonymous' || !auth.user) {
    return null
  }

  return serializeUser({
    ...auth.user,
    permissions: auth.permissions,
    roleIds: auth.roles.map((role) => role.id),
    roles: auth.roles,
  })
}

function createSessionExpiry(context: AppContext) {
  return new Date(Date.now() + context.config.auth.sessionTtlHours * 60 * 60 * 1000).toISOString()
}

async function createSessionResponse(context: AppContext, userId: string, storage: 'local' | 'session', name: string) {
  const token = createRawAuthToken()
  const tokenRecord = await context.metaStore.createAuthToken({
    userId,
    kind: 'session',
    name,
    tokenPrefix: token.prefix,
    tokenHash: token.hash,
    storage,
    expiresAt: createSessionExpiry(context),
  })

  return {
    token: token.raw,
    tokenRecord,
  }
}

function getAuthRateLimitKey(req: AuthenticatedRequest, scope: string, email?: string) {
  const normalizedEmail = email?.trim().toLowerCase() || 'anonymous'
  return `${scope}:${req.ip}:${normalizedEmail}`
}

function applyAuthRateLimit(
  context: AppContext,
  req: AuthenticatedRequest,
  res: Response,
  scope: string,
  email?: string,
) {
  const result = consumeRateLimit(
    getAuthRateLimitKey(req, scope, email),
    context.config.auth.rateLimitWindowMs,
    context.config.auth.rateLimitMaxAttempts,
  )

  if (result.allowed) {
    return true
  }

  const retryAfterSeconds = Math.max(1, Math.ceil((result.resetAt - Date.now()) / 1000))
  res.setHeader('Retry-After', String(retryAfterSeconds))
  res.status(429).json({ error: 'Too many authentication attempts. Please try again later.' })
  return false
}

function clearAuthRateLimit(req: AuthenticatedRequest, scope: string, email?: string) {
  clearRateLimit(getAuthRateLimitKey(req, scope, email))
}

function isOidcStateExpired(context: AppContext, createdAt: string) {
  const createdAtIso = normalizeStoredDateTimeToIso(createdAt)
  const timestamp = createdAtIso ? new Date(createdAtIso).getTime() : Number.NaN
  if (Number.isNaN(timestamp)) {
    return true
  }

  return timestamp + context.config.auth.oidcStateTtlMinutes * 60 * 1000 < Date.now()
}

export function registerAuthRoutes(app: Express, context: AppContext) {
  app.get('/api/auth/status', async (req, res) => {
    const authReq = req as AuthenticatedRequest
    const status = await buildAuthStatus(context)
    res.json({
      ...status,
      currentUser: buildUserPayload(authReq),
    })
  })

  app.get('/api/auth/me', async (req, res) => {
    const authReq = req as AuthenticatedRequest
    if (!requireAuthenticated(authReq, res)) return

    res.json({ user: buildUserPayload(authReq) })
  })

  app.post('/api/auth/onboard', async (req, res) => {
    if (!context.config.auth.enabled) {
      res.status(400).json({ error: 'Onboarding is not required on local servers' })
      return
    }

    if ((await context.metaStore.countUsers()) > 0) {
      res.status(409).json({ error: 'Onboarding has already been completed' })
      return
    }

    const { email, name, password, storage } = req.body as {
      email?: string
      name?: string
      password?: string
      storage?: 'local' | 'session'
    }

    if (!email?.trim() || !name?.trim() || !password || password.length < 8) {
      res.status(400).json({ error: 'email, name, and a password with at least 8 characters are required' })
      return
    }

    const authReq = req as AuthenticatedRequest
    if (!applyAuthRateLimit(context, authReq, res, 'onboard', email)) {
      return
    }

    const { hash, salt } = createPasswordHash(password)
    const user = await context.metaStore.createUser({
      email,
      name,
      passwordHash: hash,
      passwordSalt: salt,
      permissions: [],
    })

    const adminRole = await context.metaStore.getRoleBySlug('admin')
    if (adminRole) {
      await context.metaStore.setUserRoleIds(user.id, [adminRole.id])
    }

    clearAuthRateLimit(authReq, 'onboard', email)

    const nextStorage = storage === 'session' ? 'session' : 'local'
    const session = await createSessionResponse(context, user.id, nextStorage, 'Initial admin session')
    res.status(201).json({
      token: session.token,
      storage: nextStorage,
      user: serializeUser({
        ...user,
        permissions: ['*'],
        roleIds: adminRole ? [adminRole.id] : [],
        roles: adminRole ? [adminRole] : [],
      }),
    })
  })

  app.post('/api/auth/login', async (req, res) => {
    if (!context.config.auth.enabled) {
      res.status(400).json({ error: 'Login is not required on local servers' })
      return
    }

    const { email, password, storage } = req.body as {
      email?: string
      password?: string
      storage?: 'local' | 'session'
    }

    const authReq = req as AuthenticatedRequest
    if (!applyAuthRateLimit(context, authReq, res, 'login', email)) {
      return
    }

    const user = email?.trim() ? await context.metaStore.getUserByEmail(email.trim().toLowerCase()) : null
    if (!user || !user.passwordHash || !user.passwordSalt || user.disabled) {
      res.status(401).json({ error: 'Invalid credentials' })
      return
    }

    if (!password || !verifyPasswordHash(password, user.passwordSalt, user.passwordHash)) {
      res.status(401).json({ error: 'Invalid credentials' })
      return
    }

    clearAuthRateLimit(authReq, 'login', email)

    const nextStorage = storage === 'session' ? 'session' : 'local'
    const session = await createSessionResponse(context, user.id, nextStorage, 'Web session')
    const authUser = await context.metaStore.getUserWithRoles(user.id)

    res.json({
      token: session.token,
      storage: nextStorage,
      user: authUser
        ? serializeUser({
            ...authUser,
            permissions: Array.from(
              new Set([...authUser.permissions, ...authUser.roles.flatMap((role) => role.permissions)]),
            ),
          })
        : null,
    })
  })

  app.post('/api/auth/logout', async (req, res) => {
    const authReq = req as AuthenticatedRequest
    const auth = getRequestAuth(authReq)
    if (auth.kind === 'session' && auth.token) {
      await context.metaStore.deleteAuthToken(auth.token.id)
    }

    res.json({ ok: true })
  })

  app.get('/api/auth/openid/start', async (req, res) => {
    if (!context.config.auth.enabled || !context.config.auth.openId) {
      res.status(404).json({ error: 'OpenID login is not configured' })
      return
    }

    const config = await getOpenIdConfiguration(context.config)
    if (!config) {
      res.status(404).json({ error: 'OpenID login is not configured' })
      return
    }

    const authReq = req as AuthenticatedRequest
    const storage = req.query.storage === 'session' ? 'session' : 'local'
    let returnTo: string
    try {
      returnTo = resolveSafeReturnTo(
        context.config,
        authReq,
        typeof req.query.returnTo === 'string' ? req.query.returnTo : undefined,
      )
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : 'Invalid returnTo parameter' })
      return
    }

    const callbackUrl = new URL('/api/auth/openid/callback', getAppBaseUrl(context.config, authReq))
    const state = openIdClient.randomState()
    const nonce = openIdClient.randomNonce()
    const codeVerifier = openIdClient.randomPKCECodeVerifier()
    const codeChallenge = await openIdClient.calculatePKCECodeChallenge(codeVerifier)

    await context.metaStore.createOidcState({
      state,
      nonce,
      codeVerifier,
      returnTo,
      storage,
    })

    const authorizationUrl = openIdClient.buildAuthorizationUrl(config, {
      redirect_uri: callbackUrl.href,
      scope: context.config.auth.openId.scopes,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
      state,
      nonce,
    })

    res.redirect(302, authorizationUrl.href)
  })

  app.get('/api/auth/openid/callback', async (req, res) => {
    if (!context.config.auth.enabled || !context.config.auth.openId) {
      res.status(404).json({ error: 'OpenID login is not configured' })
      return
    }

    const authReq = req as AuthenticatedRequest
    const callbackUrl = new URL(authReq.originalUrl, getAppBaseUrl(context.config, authReq))
    const callbackState = callbackUrl.searchParams.get('state')
    if (!callbackState) {
      res.status(400).send('Missing OpenID state')
      return
    }

    const oidcState = await context.metaStore.getOidcState(callbackState)
    if (!oidcState) {
      res.status(400).send('Invalid or expired OpenID state')
      return
    }

    if (isOidcStateExpired(context, oidcState.createdAt)) {
      await context.metaStore.deleteOidcState(oidcState.state)
      res.status(400).send('Invalid or expired OpenID state')
      return
    }

    const config = await getOpenIdConfiguration(context.config)
    if (!config) {
      res.status(404).send('OpenID login is not configured')
      return
    }

    const tokens = await openIdClient.authorizationCodeGrant(
      config,
      callbackUrl,
      {
        pkceCodeVerifier: oidcState.codeVerifier,
        expectedNonce: oidcState.nonce,
        expectedState: oidcState.state,
      },
    )

    await context.metaStore.deleteOidcState(oidcState.state)

    const claims = tokens.claims()
    const email = typeof claims?.email === 'string' ? claims.email : null
    const subject = typeof claims?.sub === 'string' ? claims.sub : null
    const name =
      typeof claims?.name === 'string'
        ? claims.name
        : typeof claims?.preferred_username === 'string'
          ? claims.preferred_username
          : email ?? 'OpenID User'

    if (!email || !subject) {
      res.status(400).send('OpenID response is missing email or subject')
      return
    }

    let user = await context.metaStore.getUserByExternalSubject('openid', subject)
    if (!user) {
      user = await context.metaStore.getUserByEmail(email)
    }

    if (!user) {
      user = await context.metaStore.createUser({
        email,
        name,
        authProvider: 'openid',
        externalSubject: subject,
        permissions: [],
      })
    } else if (!user.externalSubject || user.authProvider !== 'openid') {
      user = await context.metaStore.updateUser(user.id, {
        authProvider: 'openid',
        externalSubject: subject,
        name,
      })
    }

    if (user.disabled) {
      res.status(403).send('This account is disabled')
      return
    }

    const session = await createSessionResponse(context, user.id, oidcState.storage, 'OpenID session')
    const redirectUrl = new URL(oidcState.returnTo)
    redirectUrl.hash = `authToken=${encodeURIComponent(session.token)}&storage=${encodeURIComponent(oidcState.storage)}`
    res.redirect(302, redirectUrl.toString())
  })
}
