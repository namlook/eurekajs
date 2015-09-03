var Babel = require('babel-core');
var _ = require('lodash');

module.exports = [
    {ext: '.js', transform: function (content, filename) {
        // console.log('>', filename);
        // Make sure to only transform your code or the dependencies you want
        // if (filename.indexOf('node_modules') === -1) {
        if (_.startsWith(filename, 'lib') || _.startsWith(filename, 'tests')) {
            console.log('transform', filename);
          var result = Babel.transform(content, { sourceMap: 'inline', filename: filename, sourceFileName: filename });
          return result.code;
        }

        return content;
    }}
];