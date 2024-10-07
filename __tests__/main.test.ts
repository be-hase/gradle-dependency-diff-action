import { getGitUrl } from '../src/main'
import { expect } from '@jest/globals'

describe('main.ts', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('getGitUrl', () => {
    beforeEach(() => {
      process.env.GITHUB_REPOSITORY = 'owner/repo'
    })
    it('personal token', () => {
      const actual = getGitUrl('ghp_token')
      expect(actual).toEqual('https://ghp_token@github.com/owner/repo')
    })
    it('not personal token', () => {
      const actual = getGitUrl('token')
      expect(actual).toEqual(
        'https://x-access-token:token@github.com/owner/repo'
      )
    })
  })
})
