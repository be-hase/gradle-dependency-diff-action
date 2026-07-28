/**
 * The undici override in package.json forces undici 6.x into
 * @actions/github@6 / @actions/http-client@2, which declare undici ^5.
 * These tests exercise the request paths this action actually uses
 * (octokit REST calls via @actions/github, directly and through an HTTP
 * proxy) against real local servers to prove the override works there.
 *
 * @actions/github captures GITHUB_API_URL and the proxy environment at
 * module load, so there is deliberately NO runtime static import of it:
 * each test prepares the environment first, then does a fresh dynamic
 * import after jest.resetModules(). The proxy-related environment is
 * snapshotted per test and fully restored afterwards, so the tests pass
 * regardless of any proxy configuration in the surrounding shell.
 *
 * Note: the artifact upload path (@actions/artifact@1) does not go
 * through undici's fetch/dispatcher path — it uses @actions/http-client's
 * classic node http/https agent path. undici is still loaded at module
 * load as a dependency of @actions/http-client, but the override cannot
 * affect artifact upload requests.
 */
import * as http from 'node:http'
import * as net from 'node:net'
import { AddressInfo } from 'node:net'
import { jest } from '@jest/globals'

type GithubModule = typeof import('@actions/github')

const ENV_KEYS = [
  'http_proxy',
  'HTTP_PROXY',
  'https_proxy',
  'HTTPS_PROXY',
  'no_proxy',
  'NO_PROXY',
  'GITHUB_API_URL'
] as const

describe('undici 6 override compatibility', () => {
  let target: http.Server
  let proxy: http.Server
  let targetPort: number
  let proxyPort: number
  let proxyConnects: string[]
  const savedEnv: Record<string, string | undefined> = {}

  async function importGithub(): Promise<GithubModule> {
    jest.resetModules()
    return await import('@actions/github')
  }

  beforeAll(async () => {
    // Minimal fake GitHub API: every GET returns an empty JSON array.
    target = http.createServer((req, res) => {
      res.setHeader('content-type', 'application/json')
      res.end('[]')
    })
    await new Promise<void>((resolve) => target.listen(0, '127.0.0.1', resolve))
    targetPort = (target.address() as AddressInfo).port

    // Minimal forward proxy: answers CONNECT and pipes every tunnel to the
    // local target server, whatever hostname was requested.
    proxyConnects = []
    proxy = http.createServer()
    proxy.on('connect', (req, clientSocket, head) => {
      proxyConnects.push(req.url ?? '')
      const serverSocket = net.connect(targetPort, '127.0.0.1', () => {
        clientSocket.write('HTTP/1.1 200 Connection Established\r\n\r\n')
        serverSocket.write(head)
        clientSocket.pipe(serverSocket)
        serverSocket.pipe(clientSocket)
      })
    })
    await new Promise<void>((resolve) => proxy.listen(0, '127.0.0.1', resolve))
    proxyPort = (proxy.address() as AddressInfo).port
  })

  afterAll(async () => {
    await new Promise((resolve) => target.close(resolve))
    await new Promise((resolve) => proxy.close(resolve))
  })

  beforeEach(() => {
    // Snapshot and clear every proxy-related variable so the surrounding
    // shell's proxy configuration cannot leak into the module under test.
    for (const key of ENV_KEYS) {
      savedEnv[key] = process.env[key]
      delete process.env[key]
    }
  })

  afterEach(() => {
    for (const key of ENV_KEYS) {
      if (savedEnv[key] === undefined) {
        delete process.env[key]
      } else {
        process.env[key] = savedEnv[key]
      }
    }
  })

  it('octokit REST call succeeds without a proxy', async () => {
    const github = await importGithub()
    const octokit = github.getOctokit('token', {
      baseUrl: `http://127.0.0.1:${targetPort}`
    })

    const res = await octokit.rest.issues.listComments({
      owner: 'owner',
      repo: 'repo',
      issue_number: 1
    })

    expect(res.status).toBe(200)
    expect(res.data).toEqual([])
  })

  it('octokit REST call goes through the proxy via undici ProxyAgent', async () => {
    // @actions/http-client never proxies loopback addresses, so use a
    // non-loopback hostname. It does not need to resolve: with a CONNECT
    // proxy, name resolution happens at the proxy, and our test proxy
    // pipes every tunnel to the local target server.
    process.env['http_proxy'] = `http://127.0.0.1:${proxyPort}`
    process.env['GITHUB_API_URL'] =
      'http://gradle-dependency-diff-action.invalid'
    const github = await importGithub()

    const octokit = github.getOctokit('token')

    const res = await octokit.rest.issues.listComments({
      owner: 'owner',
      repo: 'repo',
      issue_number: 1
    })

    expect(res.status).toBe(200)
    expect(res.data).toEqual([])
    expect(proxyConnects).toContain('gradle-dependency-diff-action.invalid:80')
  })
})
