'use strict'
// **Github:** https://github.com/toajs/toa-cookie-session
//
// **License:** MIT

const _isSameSiteNoneCompatible = require('should-send-same-site-none').isSameSiteNoneCompatible

module.exports = toaCookieSession

function toaCookieSession (options) {
  options = options || {}
  options.overwrite = options.overwrite !== false
  options.httpOnly = options.httpOnly !== false
  options.signed = options.signed !== false

  const sessionKey = options.name || 'toa:sess'
  const setCookie = options.setCookie !== false

  return function cookieSession () {
    let session = false
    this.sessionOptions = Object.create(options)

    if (options.sameSite && typeof options.sameSite === 'string' && options.sameSite.toLowerCase() === 'none') {
      const userAgent = this.get('user-agent')
      // Non-secure context or Incompatible clients, don't send SameSite=None property
      if (!options.secure || (userAgent && !isSameSiteNoneCompatible(userAgent))) {
        this.sessionOptions.sameSite = false
      }
    }

    Object.defineProperty(this, 'session', {
      enumerable: true,
      configurable: false,
      get: function () {
        if (session === false) {
          let val = this.cookies.get(sessionKey, this.sessionOptions)
          val = val && decode(val)
          session = new Session(new SessionContext(!val), val)
          if (val) session._ctx.val = session.serialize()
        }
        return session
      },
      set: function (val) {
        if (val == null) session = null
        else if (typeof val === 'object') {
          session = this.session
          const ctx = session ? session._ctx : new SessionContext(true)
          session = new Session(ctx, val)
        } else throw new Error('session can only be set as null or an object.')
      }
    })

    function saveCookie () {
      if (!setCookie || session === false) return
      const sessionString = session === null ? '' : session.serialize()
      if (sessionString === '' || (sessionString && session._ctx.val !== sessionString)) {
        this.cookies.set(sessionKey, sessionString, this.sessionOptions)
      }
    }

    if (this.after) this.after(saveCookie) // toa >=v2.1
    else this.onPreEnd = saveCookie
  }
}

function SessionContext (isNew, val) {
  this.new = isNew
  this.val = val
}

function Session (ctx, obj) {
  Object.defineProperty(this, '_ctx', { value: ctx })
  if (obj) {
    for (const key of Object.keys(obj).sort()) {
      this[key] = obj[key]
    }
  }
}

Session.prototype.serialize = function () {
  const keys = Object.keys(this).sort()
  if (!keys.length) return

  const obj = {}
  for (const key of keys) {
    obj[key] = this[key]
  }
  return encode(obj)
}

Object.defineProperty(Session.prototype, 'isNew', {
  get: function () {
    return this._ctx.new
  }
})

function decode (string) {
  try {
    return JSON.parse(Buffer.from(string, 'base64').toString('utf8'))
  } catch (e) {}
  return null
}

function encode (body) {
  return Buffer.from(JSON.stringify(body)).toString('base64')
}

function isSameSiteNoneCompatible (userAgent) {
  // Chrome >= 80.0.0.0
  const result = parseChromiumAndMajorVersion(userAgent)
  if (result.chromium) return result.majorVersion >= 80
  return _isSameSiteNoneCompatible(userAgent)
}
function parseChromiumAndMajorVersion (userAgent) {
  const m = /Chrom[^ \\/]+\/(\d+)[\\.\d]* /.exec(userAgent)
  if (!m) return { chromium: false, version: null }
  return { chromium: true, majorVersion: parseInt(m[1]) }
}
