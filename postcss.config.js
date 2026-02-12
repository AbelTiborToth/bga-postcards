module.exports = {
  plugins: [
    require('autoprefixer')({
      overrideBrowserslist: [
        '> 1%',
        'last 2 versions',
        'last 3 Safari versions',
        'last 3 iOS versions',
        'Firefox ESR',
        'not dead',
        'IE 11'
      ]
    }),
    {
      postcssPlugin: 'postcss-quote-attribute-selectors',
      Once(root) {
        root.walkRules((rule) => {
          rule.selector = rule.selector.replace(/\[([a-zA-Z-]+)=([a-zA-Z_-]+)\]/g, '[$1="$2"]');
        });
      }
    },
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
module.exports.plugins[1].postcssPlugin = 'postcss-quote-attribute-selectors';
