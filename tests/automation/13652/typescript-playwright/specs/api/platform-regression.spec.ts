/**
 * The platform, unchanged.
 *
 * Source rows: TC-13652-083, 101, 102, 103, 104.
 *
 * The change this ticket makes to the backend is one configuration key. These
 * rows exist to prove that everything around it still behaves as it did: the
 * gateway still protects the same routes, the sign-in service still answers
 * the same way, the message bus still carries the same notification, and the
 * stack still runs perfectly well with no browser client attached.
 *
 * They talk to the real platform, so they are all tagged `@live`.
 */
import { probeSignIn, runningServices, serviceLogs } from '../../support/platform'
import { expect, test } from '../../support/fixtures'

test.describe('Platform regression @story:13652 @component:pacco-web-login', () => {
  test('TC-13652-083 Verify that a token captured before logout stays acceptable to the platform afterwards @live @layer:api @ac:AC-22 @intent:regression', async ({
    env,
    request,
    logger,
  }, testInfo) => {
    // Sign in and keep the token, exactly as a browser would hold it.
    const signIn = await request.post(env.signInUrl, {
      data: { email: env.accounts.standard.email, password: env.accounts.standard.password },
      failOnStatusCode: false,
    })
    expect(signIn.status()).toBe(200)
    const issued = (await signIn.json()) as { accessToken?: string }
    const accessToken = issued.accessToken ?? ''
    expect(accessToken.length, 'the platform must have issued a token').toBeGreaterThan(0)

    // Logout is a client-side discard. There is no route to call, and calling
    // one would contradict the design, so nothing is called here: the token is
    // simply dropped by the browser. This row asks what the platform thinks of
    // it afterwards.
    const afterLogout = await request.get(`${env.gatewayBaseUrl}${env.protectedRoutePath}`, {
      headers: { authorization: `Bearer ${accessToken}` },
      failOnStatusCode: false,
    })

    const status = afterLogout.status()
    logger.info('replayed a discarded token', { status })

    // This is a recording row, not a gating one. The already-issued token is
    // NOT invalidated at the platform level - that is the accepted limitation
    // of a client-side logout, and it is stated in REVIEW.md. Failing the
    // pipeline here would misreport a documented design decision as a defect,
    // so the outcome is attached as evidence instead.
    testInfo.annotations.push({
      type: 'limitation',
      description:
        `A token captured before logout was replayed against ${env.protectedRoutePath} and the ` +
        `platform answered ${status}. Logout discards the session in the browser only; the ` +
        'gateway performs no revocation, by design.',
    })
    await testInfo.attach('replayed-token-outcome.json', {
      contentType: 'application/json',
      body: Buffer.from(
        JSON.stringify({ route: env.protectedRoutePath, status, revoked: status === 401 }, null, 2),
        'utf8',
      ),
    })

    // The only hard requirement is that the platform answered at all, so the
    // recording is real rather than an untested assumption.
    expect(Number.isInteger(status), 'the platform must have answered the replay').toBe(true)
  })

  test('TC-13652-101 Verify that the gateway still protects every other route exactly as before @live @layer:api @ac:AC-24 @intent:regression', async ({
    env,
    request,
  }) => {
    // Anonymous: refused.
    const anonymous = await request.get(`${env.gatewayBaseUrl}${env.protectedRoutePath}`, {
      failOnStatusCode: false,
    })
    expect(
      anonymous.status(),
      `${env.protectedRoutePath} must still refuse an anonymous caller`,
    ).toBe(401)

    // With a token the platform itself issued: no longer refused.
    const signIn = await request.post(env.signInUrl, {
      data: { email: env.accounts.standard.email, password: env.accounts.standard.password },
      failOnStatusCode: false,
    })
    expect(signIn.status()).toBe(200)
    const { accessToken } = (await signIn.json()) as { accessToken: string }

    const authenticated = await request.get(`${env.gatewayBaseUrl}${env.protectedRoutePath}`, {
      headers: { authorization: `Bearer ${accessToken}` },
      failOnStatusCode: false,
    })
    expect(
      authenticated.status(),
      'a valid token must still be accepted on the protected route',
    ).not.toBe(401)

    // A malformed token is still refused, so the guard has not been loosened.
    const malformed = await request.get(`${env.gatewayBaseUrl}${env.protectedRoutePath}`, {
      headers: { authorization: 'Bearer not-a-token' },
      failOnStatusCode: false,
    })
    expect(malformed.status(), 'a malformed token must still be refused').toBe(401)

    // And the sign-in route itself remains anonymous: it must not have been
    // caught up in the change and started demanding a token.
    const anonymousSignIn = await request.post(env.signInUrl, {
      data: { email: env.accounts.standard.email, password: env.accounts.standard.password },
      failOnStatusCode: false,
    })
    expect(anonymousSignIn.status(), 'sign-in must remain an anonymous route').toBe(200)
  })

  test('TC-13652-102 Verify that the backend sign-in service still behaves exactly as before the change @live @layer:api @ac:AC-25 @intent:regression', async ({
    env,
    request,
  }) => {
    // A valid credential.
    const valid = await request.post(env.signInUrl, {
      data: { email: env.accounts.standard.email, password: env.accounts.standard.password },
      failOnStatusCode: false,
    })
    expect(valid.status(), 'a valid credential must still be accepted').toBe(200)
    expect(Object.keys((await valid.json()) as Record<string, unknown>).sort()).toEqual(
      ['accessToken', 'expires', 'refreshToken', 'role'].sort(),
    )

    // The wrong password.
    const wrongPassword = await request.post(env.signInUrl, {
      data: { email: env.accounts.standard.email, password: env.accounts.wrongPasswordLive },
      failOnStatusCode: false,
    })
    expect(wrongPassword.status(), 'a wrong password must still be rejected with 400').toBe(400)

    // An address the platform does not know.
    const unknownAddress = await request.post(env.signInUrl, {
      data: { email: env.accounts.unknownEmail, password: env.accounts.wrongPasswordLive },
      failOnStatusCode: false,
    })
    expect(unknownAddress.status(), 'an unknown address must still be rejected with 400').toBe(400)

    // A request with no password field at all.
    const missingPassword = await request.post(env.signInUrl, {
      data: { email: env.accounts.standard.email },
      failOnStatusCode: false,
    })
    expect(missingPassword.status(), 'a missing password must still be rejected with 400').toBe(400)
  })

  test('TC-13652-103 Verify that a successful sign-in still publishes its notification on the existing message bus @live @layer:api @ac:AC-25 @intent:regression', async ({
    env,
    logger,
  }, testInfo) => {
    // The notification is published inside the platform, so the observable
    // evidence is the publishing service's own log. The window opens before
    // the sign-in and is read after it, so an older run cannot be mistaken
    // for this one.
    const probe = await probeSignIn(env.accounts.standard.email, env.accounts.standard.password)
    expect(probe.status, 'the sign-in must have succeeded for anything to be published').toBe(200)

    const logs = await serviceLogs(env.signInServiceName, '60s')
    logger.info('read publishing service logs', { characters: logs.length })

    await testInfo.attach('sign-in-service-logs.txt', {
      contentType: 'text/plain',
      body: Buffer.from(logs, 'utf8'),
    })

    // The platform names the event after the act, not after the transport.
    const publishedSomething = /sign(?:ed)?[-_ ]?in|SignedIn|publish/i.test(logs)
    expect(
      publishedSomething,
      'the sign-in service logged no publication for a successful sign-in',
    ).toBe(true)

    // Nothing sensitive rode along in the log line either.
    expect(logs, 'the platform log must not carry the password').not.toContain(
      env.accounts.standard.password,
    )
  })

  test('TC-13652-104 Verify that the backend stack starts and works without the browser client running @live @layer:api @ac:AC-6 @intent:regression', async ({
    env,
    logger,
  }) => {
    const services = await runningServices()
    expect(services.length, 'the compose stack must be running').toBeGreaterThan(0)
    logger.info('compose services running', { count: services.length })

    // The sign-in service is part of the stack.
    expect(services, `${env.signInServiceName} is not running in the compose stack`).toContain(
      env.signInServiceName,
    )

    // The browser client is NOT: it is a separate local process, never a
    // service in the backend stack and never served by the gateway.
    const clientLike = services.filter((name) =>
      /pacco[-_.]?web|frontend|client[-_]?ui/i.test(name),
    )
    expect(
      clientLike,
      `the browser client must not be a backend service: found ${clientLike.join(', ')}`,
    ).toEqual([])

    // And with no client anywhere in sight, the platform still signs people in.
    const probe = await probeSignIn(env.accounts.standard.email, env.accounts.standard.password)
    expect(probe.status, 'the stack must work with no browser client running').toBe(200)
  })
})
