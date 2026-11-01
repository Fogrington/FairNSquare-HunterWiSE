// QR-012: deployment configuration comes from the environment, and the server
// refuses to start with a missing or weak signing secret.
describe('QR-012 Fail-fast configuration', () => {
  const original = process.env.JWT_SECRET
  afterEach(() => { process.env.JWT_SECRET = original; jest.resetModules() })

  it('TC-CFG-01 refuses to start without a JWT secret', () => {
    delete process.env.JWT_SECRET
    expect(() => jest.isolateModules(() => require('../src/config'))).toThrow(/JWT_SECRET/)
  })

  it('TC-CFG-02 refuses a secret shorter than 32 characters', () => {
    process.env.JWT_SECRET = 'short'
    expect(() => jest.isolateModules(() => require('../src/config'))).toThrow(/too short/)
  })

  it('TC-CFG-03 accepts a sufficiently long secret and fixes a 12 h token lifetime', () => {
    jest.isolateModules(() => {
      const cfg = require('../src/config')
      expect(cfg.JWT_EXPIRES_IN).toBe('12h')
    })
  })
})
