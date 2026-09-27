/**
 * Control over the running backend stack.
 *
 * Only the `@live` rows use this, and only one row genuinely needs it: TC-081
 * stops the sign-in service, drives a failed attempt, starts it again and
 * drives a successful one. Rather than sleep between the two, the helpers here
 * poll the platform itself - `waitForSignInService` retries a real request
 * until the edge answers, so the wait ends exactly when the service is back.
 *
 * Every command runs against the compose files the environment points at. If
 * `docker` is not on the path, or the compose project is not up, the helpers
 * throw with the command and its output, which fails the row honestly instead
 * of letting it pass against a platform that was never there.
 */
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

import { expect, request as playwrightRequest } from '@playwright/test'

import { readEnvConfig } from './env'

const run = promisify(execFile)

export interface CommandResult {
  readonly stdout: string
  readonly stderr: string
}

/** The compose file arguments the stack is brought up with. */
export function composeFileArgs(): readonly string[] {
  return ['-f', 'infrastructure.yml', '-f', 'services.yml']
}

async function compose(args: readonly string[]): Promise<CommandResult> {
  const env = readEnvConfig()
  try {
    const { stdout, stderr } = await run('docker', ['compose', ...composeFileArgs(), ...args], {
      cwd: env.composeDir,
      maxBuffer: 16 * 1024 * 1024,
    })
    return { stdout, stderr }
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    throw new Error(`docker compose ${args.join(' ')} failed in ${env.composeDir}: ${detail}`)
  }
}

/** Stops one service, leaving the rest of the stack running. */
export async function stopService(serviceName: string): Promise<CommandResult> {
  return compose(['stop', serviceName])
}

/** Starts a previously stopped service. */
export async function startService(serviceName: string): Promise<CommandResult> {
  return compose(['start', serviceName])
}

/**
 * A service's recent log output.
 *
 * TC-103 has no other way to observe the message bus: the notification is
 * published inside the platform, so the evidence that it still happens is the
 * publishing service's own log. `--since` keeps the window tight enough that
 * an older run cannot be mistaken for this one.
 */
export async function serviceLogs(serviceName: string, since: string): Promise<string> {
  const { stdout, stderr } = await compose(['logs', '--no-color', '--since', since, serviceName])
  return `${stdout}\n${stderr}`
}

/** The compose project's own view of which services are running. */
export async function runningServices(): Promise<readonly string[]> {
  const { stdout } = await compose(['ps', '--services', '--status', 'running'])
  return stdout
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
}

export interface ProbeResult {
  readonly status: number | null
  readonly body: string
}

/**
 * Issues one sign-in request outside the browser and reports what came back.
 *
 * A transport failure - which is exactly what a stopped service produces -
 * resolves with a null status rather than throwing, so callers can distinguish
 * "the edge answered with a failure" from "nothing answered at all".
 */
export async function probeSignIn(email: string, password: string): Promise<ProbeResult> {
  const env = readEnvConfig()
  const context = await playwrightRequest.newContext({ ignoreHTTPSErrors: env.ignoreHttpsErrors })
  try {
    const response = await context.post(env.signInUrl, {
      data: { email, password },
      failOnStatusCode: false,
      timeout: env.timeouts.signInMs,
    })
    return { status: response.status(), body: await response.text() }
  } catch {
    return { status: null, body: '' }
  } finally {
    await context.dispose()
  }
}

/**
 * Waits until the sign-in route answers at all.
 *
 * `expect.poll` owns the retry interval, so there is no sleep here; the wait
 * ends on the first response and fails the row if the service never returns
 * within the configured sign-in timeout.
 */
export async function waitForSignInService(email: string, password: string): Promise<void> {
  const env = readEnvConfig()
  await expect
    .poll(
      async () => {
        const probe = await probeSignIn(email, password)
        return probe.status !== null
      },
      {
        message: `the sign-in service never answered at ${env.signInUrl}`,
        timeout: env.timeouts.navigationMs,
      },
    )
    .toBe(true)
}

/**
 * Waits until the sign-in route stops answering.
 *
 * The mirror image of the above, for the half of TC-081 that needs the service
 * genuinely down before the browser attempt is made.
 */
export async function waitForSignInServiceDown(email: string, password: string): Promise<void> {
  const env = readEnvConfig()
  await expect
    .poll(
      async () => {
        const probe = await probeSignIn(email, password)
        return probe.status === null || probe.status >= 500
      },
      {
        message: `the sign-in service was still answering at ${env.signInUrl}`,
        timeout: env.timeouts.navigationMs,
      },
    )
    .toBe(true)
}
