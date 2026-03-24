import type { Express } from 'express'
import { URL } from 'node:url'
import type { AppContext } from '../app-context.ts'
import { getOpenIdConfiguration, client as openIdClient } from '../auth/openid.ts'
import { createPasswordHash, verifyPasswordHash } from '../auth/passwords.ts'
import type { AuthenticatedRequest } from '../auth/request.ts'
import { serializeUser } from '../auth/serializers.ts'
import { buildAuthStatus, getRequestAuth, requireAuthenticated } from '../auth/middleware.ts'
import { createRawAuthToken } from '../auth/tokens.ts'

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

function getRequestBaseUrl(req: AuthenticatedRequest) {
  const protocol = String(req.headers['x-forwarded-proto'] ?? req.protocol ?? 'http')
  const host = String(req.headers['x-forwarded-host'] ?? req.headers.host)
  return `${protocol}://${host}`
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

    const user = email?.trim() ? await context.metaStore.getUserByEmail(email.trim().toLowerCase()) : null
    if (!user || !user.passwordHash || !user.passwordSalt || user.disabled) {
      res.status(401).json({ error: 'Invalid credentials' })
      return
    }

    if (!password || !verifyPasswordHash(password, user.passwordSalt, user.passwordHash)) {
      res.status(401).json({ error: 'Invalid credentials' })
      return
    }

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
    const returnTo =
      typeof req.query.returnTo === 'string' && req.query.returnTo.trim()
        ? req.query.returnTo
        : `${getRequestBaseUrl(authReq)}/`
    const callbackUrl = new URL('/api/auth/openid/callback', getRequestBaseUrl(authReq))
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
    const callbackUrl = new URL(authReq.originalUrl, getRequestBaseUrl(authReq))
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

    const session = await createSessionResponse(context, user.id, oidcState.storage, 'OpenID session')
    const redirectUrl = new URL(oidcState.returnTo)
    redirectUrl.hash = `authToken=${encodeURIComponent(session.token)}&storage=${encodeURIComponent(oidcState.storage)}`
    res.redirect(302, redirectUrl.toString())
  })
}
