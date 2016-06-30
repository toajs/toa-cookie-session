'use strict'
// **Github:** https://github.com/toajs/toa-cookie-session
//
// **License:** MIT

var toa = require('toa')
var tman = require('tman')
var assert = require('assert')
var request = require('supertest')
var cookieSession = require('..')

function getApp (options) {
  var app = toa()
  app.keys = ['abc', 'efg']
  app.use(cookieSession(options))
  return app
}

function FindCookie (name, shouldNot) {
  return function (res) {
    var haveCookie = res.headers['set-cookie']
    haveCookie = haveCookie && haveCookie.some(function (cookie) {
      return cookie.split('=')[0] === name
    })
    if (shouldNot !== false) {
      assert.ok(haveCookie, 'should have cookie "' + name + '"')
    } else {
      assert.ok(!haveCookie, 'should not have cookie "' + name + '"')
    }
  }
}

function shouldNotSetCookies () {
  return function (res) {
    assert.strictEqual(res.headers['set-cookie'], undefined, 'should not set cookies')
  }
}

tman.suite('toa-cookie-session', function () {
  tman.it('with options.name', function () {
    var app = getApp({name: 'hi.session'})
    app.use(function (next) {
      this.session.message = 'hi'
      this.body = 'toa'
      next()
    })

    return request(app.listen())
      .get('/')
      .expect(FindCookie('hi.session'))
      .expect(200)
  })

  tman.it('default options.signed === true', function () {
    var app = getApp()
    app.use(function (next) {
      this.session.message = 'hi'
      this.body = 'toa'
      next()
    })

    return request(app.listen())
      .get('/')
      .expect(FindCookie('toa:sess.sig'))
      .expect(200)
  })

  tman.it('when options.signed = false', function () {
    var app = getApp({name: 'hi.session', signed: false})
    app.use(function (next) {
      this.session.message = 'hi'
      this.body = 'toa'
      next()
    })

    return request(app.listen())
      .get('/')
      .expect(FindCookie('hi.session'))
      .expect(FindCookie('hi.session.sig', false))
      .expect(200)
  })

  tman.it('when options.secure = true and app is not secured', function () {
    var app = getApp({secure: true})
    app.use(function (next) {
      this.session.message = 'hi'
      this.body = 'toa'
      next()
    })

    return request(app.listen())
      .get('/')
      .expect(shouldNotSetCookies())
      .expect(500)
  })

  tman.it('when the session contains a ";"', function (done) {
    var app = getApp({name: 'hi.session'})
    app.use(function (next) {
      if (this.method === 'POST') {
        this.session.string = ';'
        this.status = 204
      } else {
        this.body = this.session.string
      }
      next()
    })

    var server = app.listen()
    request(server)
      .post('/')
      .expect(FindCookie('hi.session'))
      .expect(204, function (err, res) {
        if (err) return done(err)
        var cookie = res.headers['set-cookie']
        request(server)
          .get('/')
          .set('Cookie', cookie.join(';'))
          .expect(';', done)
      })
  })

  tman.it('when the session is invalid', function () {
    var app = getApp({name: 'hi.session', signed: false})
    app.use(function (next) {
      assert.strictEqual(this.session.isNew, true)
      this.body = ''
      next()
    })

    return request(app.listen())
      .get('/')
      .set('Cookie', 'hi.session=invalid_string')
      .expect(200)
  })

  tman.suite('new session', function () {
    var cookie = ''

    tman.it('should not Set-Cookie when not accessed', function () {
      var app = getApp()
      app.use(function (next) {
        this.body = 'toa'
        next()
      })

      return request(app.listen())
        .get('/')
        .expect(shouldNotSetCookies())
        .expect(200)
    })

    tman.it('should not Set-Cookie when accessed and not change', function () {
      var app = getApp()
      app.use(function (next) {
        assert.strictEqual(this.session.isNew, true)
        this.body = 'toa'
        next()
      })

      return request(app.listen())
        .get('/')
        .expect(shouldNotSetCookies())
        .expect(200)
    })

    tman.it('should Set-Cookie when populated', function (done) {
      var app = getApp()
      app.use(function (next) {
        assert.strictEqual(this.session.isNew, true)
        this.session.message = 'hello'
        this.body = 'toa'
        next()
      })

      request(app.listen())
        .get('/')
        .expect(FindCookie('toa:sess.sig'))
        .expect(200, function (err, res) {
          if (err) return done(err)
          cookie = res.header['set-cookie'].join(';')
          done()
        })
    })

    tman.it('should be the same and not Set-Cookie when accessed and not changed', function () {
      var app = getApp()
      app.use(function (next) {
        assert.strictEqual(this.session.message, 'hello')
        this.body = 'toa'
        next()
      })

      return request(app.listen())
        .get('/')
        .set('Cookie', cookie)
        .expect(shouldNotSetCookies())
        .expect(200)
    })

    tman.it('should Set-Cookie when accessed and changed', function (done) {
      var app = getApp()
      app.use(function (next) {
        assert.strictEqual(this.session.message, 'hello')
        this.session.message = 'Hello'
        this.body = 'toa'
        next()
      })

      return request(app.listen())
        .get('/')
        .set('Cookie', cookie)
        .expect(FindCookie('toa:sess'))
        .expect(200, function (err, res) {
          if (err) return done(err)
          cookie = res.header['set-cookie'].join(';')
          done()
        })
    })

    tman.it('should Set-Cookie when set new', function (done) {
      var app = getApp()
      app.use(function (next) {
        assert.strictEqual(this.session.message, 'Hello')
        this.session = {name: 'toa'}
        this.body = 'toa'
        next()
      })

      return request(app.listen())
        .get('/')
        .set('Cookie', cookie)
        .expect(FindCookie('toa:sess'))
        .expect(200, function (err, res) {
          if (err) return done(err)
          cookie = res.header['set-cookie'].join(';')
          done()
        })
    })

    tman.it('should expire the session when set null', function (done) {
      var app = getApp()
      app.use(function (next) {
        assert.strictEqual(this.session.message, undefined)
        assert.strictEqual(this.session.name, 'toa')
        this.session = null
        this.body = JSON.stringify(this.session)
        next()
      })

      return request(app.listen())
        .get('/')
        .set('Cookie', cookie)
        .expect(FindCookie('toa:sess'))
        .expect(200, 'null', done)
    })

    tman.it('should not Set-Cookie when set {}', function () {
      var app = getApp()
      app.use(function (next) {
        assert.deepEqual(this.session, {})
        this.session = {}
        this.body = 'toa'
        next()
      })

      return request(app.listen())
        .get('/')
        .expect(shouldNotSetCookies())
        .expect(200)
    })

    tman.it('should create a session when set {name: toa}', function () {
      var app = getApp()
      app.use(function (next) {
        assert.deepEqual(this.session, {})
        this.session = {name: 'toa'}
        this.body = 'toa'
        next()
      })

      return request(app.listen())
        .get('/')
        .expect(FindCookie('toa:sess'))
        .expect(200)
    })

    tman.it('should throw error when set invalid session', function () {
      var app = getApp()
      app.use(function (next) {
        this.session = 'invalid'
        this.body = 'toa'
        next()
      })

      return request(app.listen())
        .get('/')
        .expect(shouldNotSetCookies())
        .expect(500)
    })
  })

  tman.it('should alter the cookie setting', function (done) {
    var app = getApp({maxAge: 3600000, name: 'my.session'})
    app.use(function (next) {
      if (this.url === '/max') {
        this.sessionOptions.maxAge = 6500000
      }

      this.session.message = 'hello!'
      this.body = 'toa'
      next()
    })

    var server = app.listen()
    request(server)
      .get('/')
      .expect(function (res) {
        var date = new Date(res.headers.date)
        var expires = new Date(res.headers['set-cookie'][0].match(/expires=([^;]+)/)[1])
        assert.ok(expires - date <= 3600000)
      })
      .expect(200, function (err) {
        if (err) return done(err)
        request(server)
          .get('/max')
          .expect(function (res) {
            var date = new Date(res.headers.date)
            var expires = new Date(res.headers['set-cookie'][0].match(/expires=([^;]+)/)[1])
            assert.ok(expires - date > 5000000)
          })
          .expect(200, done)
      })
  })
})
