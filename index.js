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

  var sessionKey = options.name || 'toa:sess'
  var setCookie = options.setCookie !== false

  return function cookieSession (done) {
    var session = false
    this.sessionOptions = Object.create(options)

    Object.defineProperty(this, 'session', {
      enumerable: true,
      configurable: false,
      get: function () {
        if (session === false) {
          var val = this.cookies.get(sessionKey, this.sessionOptions)
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
          var ctx = session ? session._ctx : new SessionContext(true)
          session = new Session(ctx, val)
        } else throw new Error('session can only be set as null or an object.')
      }
    })

    this.onPreEnd = function (cb) {
      if (!setCookie || session === false) return cb()
      var sessionString = session === null ? '' : session.serialize()
      if (sessionString === '' || (sessionString && session._ctx.val !== sessionString)) {
        this.cookies.set(sessionKey, sessionString, this.sessionOptions)
      }
      cb()
    }
    done()
  }
}

function SessionContext (isNew, val) {
  this.new = isNew
  this.val = val
}

function Session (ctx, obj) {
  Object.defineProperty(this, '_ctx', {value: ctx})

  if (obj) {
    var keys = Object.keys(obj).sort()
    for (var i = 0; i < keys.length; i++) {
      this[keys[i]] = obj[keys[i]]
    }
  }
}

Session.prototype.serialize = function () {
  var keys = Object.keys(this).sort()
  if (!keys.length) return

  var obj = {}
  for (var i = 0; i < keys.length; i++) {
    obj[keys[i]] = this[keys[i]]
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
    return JSON.parse(new Buffer(string, 'base64').toString('utf8'))
  } catch (e) {}
}

function encode (body) {
  return new Buffer(JSON.stringify(body)).toString('base64')
}
