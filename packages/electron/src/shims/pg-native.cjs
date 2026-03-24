module.exports = class PgNativeUnavailable {
  constructor() {
    throw new Error('pg-native is not available in this Electron build')
  }
}
