module.exports = {
  plugins: [
    require('autoprefixer')({
      overrideBrowserslist: [
        '> 1%',
        'last 2 versions',
        'Firefox ESR',
        'not dead',
        'IE 11'
      ]
    }),
    require('cssnano')({
      preset: ['default', {
        discardComments: {
          removeAll: true,
        },
        normalizeUnicode: false
      }]
    })
  ]
}
