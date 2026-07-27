import { removePrefix } from '../src/utils.js'

describe('utils.ts', () => {
  describe('removePrefix', () => {
    it('test', async () => {
      expect(removePrefix('hoge', 'ho')).toEqual('ge')
    })
  })
})
