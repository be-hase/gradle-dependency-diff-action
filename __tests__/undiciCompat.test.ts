/**
 * The undici override in package.json forces undici 6.x into
 * @actions/github@6 / @actions/http-client@2, which declare undici ^5.
 * These tests exercise the request paths this action actually uses
 * (octokit REST calls via @actions/github, directly and through an HTTP
 * proxy) against real local servers to prove the override works there.
 *
 * Note: @actions/artifact@1 does not use undici at all (it goes through
 * @actions/http-client's classic node http/https agents), so the
 * override cannot affect the artifact upload path.
 */
import * as http from 'node:http'
import * as net from 'node:net'
import * as github from '@actions/github'
import { AddressInfo } from 'node:net'
import { jest } from '@jest/globals'

describe('undici 6 override compatibility', () => {
  let target: http.Server
  let proxy: http.Server
  let targetPort: number
  let proxyPort: number
  let proxyConnects: string[]

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

  afterEach(() => {
    delete process.env['http_proxy']
    delete process.env['https_proxy']
    delete process.env['GITHUB_API_URL']
  })

  it('octokit REST call succeeds without a proxy', async () => {
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
    // @actions/github captures GITHUB_API_URL and the proxy settings at
    // module load, so set the environment first and re-import it.
    // @actions/http-client never proxies loopback addresses, so use a
    // non-loopback hostname. It does not need to resolve: with a CONNECT
    // proxy, name resolution happens at the proxy, and our test proxy
    // pipes every tunnel to the local target server.
    process.env['http_proxy'] = `http://127.0.0.1:${proxyPort}`
    process.env['GITHUB_API_URL'] =
      'http://gradle-dependency-diff-action.invalid'
    jest.resetModules()
    const githubWithProxy: typeof github = await import('@actions/github')

    const octokit = githubWithProxy.getOctokit('token')

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
