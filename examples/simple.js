'use strict'
// **Github:** https://github.com/toajs/toa-cookie-session
//
// **License:** MIT
const Toa = require('toa')
const toaCookieSession = require('../index')

const app = new Toa()
app.use(toaCookieSession())
app.use(function () {
  console.log(this.session)
  if (!this.session.id) this.session = {id: 'toa'}
  this.body = this.session
})

app.listen(3000)
