'use strict'
// **Github:** https://github.com/toajs/toa-cookie-session
//
// **License:** MIT

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
          let ctx = session ? session._ctx : new SessionContext(true)
          session = new Session(ctx, val)
        } else throw new Error('session can only be set as null or an object.')
      }
    })

    function saveCookie () {
      if (!setCookie || session === false) return
      let sessionString = session === null ? '' : session.serialize()
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
  Object.defineProperty(this, '_ctx', {value: ctx})
  if (obj) {
    for (let key of Object.keys(obj).sort()) {
      this[key] = obj[key]
    }
  }
}

Session.prototype.serialize = function () {
  let keys = Object.keys(this).sort()
  if (!keys.length) return

  let obj = {}
  for (let key of keys) {
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
