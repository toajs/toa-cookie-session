'use strict'
// **Github:** https://github.com/toajs/toa-cookie-session
//
// **License:** MIT

const Toa = require('toa')
const tman = require('tman')
const assert = require('assert')
const request = require('supertest')
const cookieSession = require('..')

function getApp (options) {
  const app = new Toa()
  app.keys = ['abc', 'efg']
  app.use(cookieSession(options))
  return app
}

function FindCookie (name, shouldNot) {
  return function (res) {
    let haveCookie = res.headers['set-cookie']
    haveCookie = haveCookie && haveCookie.some((cookie) => cookie.split('=')[0] === name)
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
    const app = getApp({name: 'hi.session'})
    app.use(function () {
      this.session.message = 'hi'
      this.body = 'toa'
    })

    return request(app.listen())
      .get('/')
      .expect(FindCookie('hi.session'))
      .expect(200)
  })

  tman.it('default options.signed === true', function () {
    const app = getApp()
    app.use(function () {
      this.session.message = 'hi'
      this.body = 'toa'
    })

    return request(app.listen())
      .get('/')
      .expect(FindCookie('toa:sess.sig'))
      .expect(200)
  })

  tman.it('when options.signed = false', function () {
    const app = getApp({name: 'hi.session', signed: false})
    app.use(function () {
      this.session.message = 'hi'
      this.body = 'toa'
    })

    return request(app.listen())
      .get('/')
      .expect(FindCookie('hi.session'))
      .expect(FindCookie('hi.session.sig', false))
      .expect(200)
  })

  tman.it('when options.secure = true and app is not secured', function () {
    const app = getApp({secure: true})
    app.use(function () {
      this.session.message = 'hi'
      this.body = 'toa'
    })

    return request(app.listen())
      .get('/')
      .expect(shouldNotSetCookies())
      .expect(500)
  })

  tman.it('when the session contains a ";"', function * () {
    const app = getApp({name: 'hi.session'})
    app.use(function () {
      if (this.method === 'POST') {
        this.session.string = ';'
        this.status = 204
      } else {
        this.body = this.session.string
      }
    })

    const server = app.listen()
    let res = yield request(server)
      .post('/')
      .expect(FindCookie('hi.session'))
      .expect(204)

    let cookie = res.headers['set-cookie']
    yield request(server)
      .get('/')
      .set('Cookie', cookie.join(';'))
      .expect(';')
  })

  tman.it('when the session is invalid', function () {
    const app = getApp({name: 'hi.session', signed: false})
    app.use(function () {
      assert.strictEqual(this.session.isNew, true)
      this.body = ''
    })

    return request(app.listen())
      .get('/')
      .set('Cookie', 'hi.session=invalid_string')
      .expect(200)
  })

  tman.suite('new session', function () {
    let cookie = ''

    tman.it('should not Set-Cookie when not accessed', function () {
      const app = getApp()
      app.use(function () {
        this.body = 'toa'
      })

      return request(app.listen())
        .get('/')
        .expect(shouldNotSetCookies())
        .expect(200)
    })

    tman.it('should not Set-Cookie when accessed and not change', function () {
      const app = getApp()
      app.use(function () {
        assert.strictEqual(this.session.isNew, true)
        this.body = 'toa'
      })

      return request(app.listen())
        .get('/')
        .expect(shouldNotSetCookies())
        .expect(200)
    })

    tman.it('should Set-Cookie when populated', function * () {
      const app = getApp()
      app.use(function () {
        assert.strictEqual(this.session.isNew, true)
        this.session.message = 'hello'
        this.body = 'toa'
      })

      let res = yield request(app.listen())
        .get('/')
        .expect(FindCookie('toa:sess.sig'))
        .expect(200)
      cookie = res.header['set-cookie'].join(';')
    })

    tman.it('should be the same and not Set-Cookie when accessed and not changed', function () {
      const app = getApp()
      app.use(function () {
        assert.strictEqual(this.session.message, 'hello')
        this.body = 'toa'
      })

      return request(app.listen())
        .get('/')
        .set('Cookie', cookie)
        .expect(shouldNotSetCookies())
        .expect(200)
    })

    tman.it('should Set-Cookie when accessed and changed', function * () {
      const app = getApp()
      app.use(function () {
        assert.strictEqual(this.session.message, 'hello')
        this.session.message = 'Hello'
        this.body = 'toa'
      })

      let res = yield request(app.listen())
        .get('/')
        .set('Cookie', cookie)
        .expect(FindCookie('toa:sess'))
        .expect(200)
      cookie = res.header['set-cookie'].join(';')
    })

    tman.it('should Set-Cookie when set new', function * () {
      const app = getApp()
      app.use(function () {
        assert.strictEqual(this.session.message, 'Hello')
        this.session = {name: 'toa'}
        this.body = 'toa'
      })

      let res = yield request(app.listen())
        .get('/')
        .set('Cookie', cookie)
        .expect(FindCookie('toa:sess'))
        .expect(200)
      cookie = res.header['set-cookie'].join(';')
    })

    tman.it('should expire the session when set null', function () {
      const app = getApp()
      app.use(function () {
        assert.strictEqual(this.session.message, undefined)
        assert.strictEqual(this.session.name, 'toa')
        this.session = null
        this.body = JSON.stringify(this.session)
      })

      return request(app.listen())
        .get('/')
        .set('Cookie', cookie)
        .expect(FindCookie('toa:sess'))
        .expect(200, 'null')
    })

    tman.it('should not Set-Cookie when set {}', function () {
      const app = getApp()
      app.use(function () {
        assert.deepEqual(this.session, {})
        this.session = {}
        this.body = 'toa'
      })

      return request(app.listen())
        .get('/')
        .expect(shouldNotSetCookies())
        .expect(200)
    })

    tman.it('should create a session when set {name: toa}', function () {
      const app = getApp()
      app.use(function () {
        assert.deepEqual(this.session, {})
        this.session = {name: 'toa'}
        this.body = 'toa'
      })

      return request(app.listen())
        .get('/')
        .expect(FindCookie('toa:sess'))
        .expect(200)
    })

    tman.it('should throw error when set invalid session', function () {
      const app = getApp()
      app.use(function () {
        this.session = 'invalid'
        this.body = 'toa'
      })

      return request(app.listen())
        .get('/')
        .expect(shouldNotSetCookies())
        .expect(500)
    })
  })

  tman.it('should alter the cookie setting', function * () {
    const app = getApp({maxAge: 3600000, name: 'my.session'})
    app.use(function () {
      if (this.url === '/max') {
        this.sessionOptions.maxAge = 6500000
      }
      this.session.message = 'hello!'
      this.body = 'toa'
    })

    const server = app.listen()
    let res = yield request(server)
      .get('/')
      .expect(200)

    let date = new Date(res.headers.date)
    let expires = new Date(res.headers['set-cookie'][0].match(/expires=([^;]+)/)[1])
    assert.ok(expires - date <= 3600000)

    res = yield request(server)
      .get('/max')
      .expect(200)
    date = new Date(res.headers.date)
    expires = new Date(res.headers['set-cookie'][0].match(/expires=([^;]+)/)[1])
    assert.ok(expires - date > 5000000)
  })
})
