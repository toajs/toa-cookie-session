'use strict'
// **Github:** https://github.com/toajs/toa-cookie-session
//
// **License:** MIT
var Toa = require('toa')
var toaCookieSession = require('../index')

var app = Toa(function () {
  console.log(this.session)
  if (!this.session.id) this.session = {id: 'toa'}
  this.body = this.session
})

app.use(toaCookieSession())

app.listen(3000)
