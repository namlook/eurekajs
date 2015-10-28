'use strict';

var _interopRequireDefault = require('babel-runtime/helpers/interop-require-default')['default'];

Object.defineProperty(exports, '__esModule', {
    value: true
});

var _gm = require('gm');

var _gm2 = _interopRequireDefault(_gm);

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

var methods = {
    thumbnailize: {
        options: {
            cache: {
                expiresIn: 60 * 60 * 1000,
                staleIn: 10 * 1000,
                staleTimeout: 100,
                generateTimeout: 10000
            }
        },
        method: function method(filepath, width, height, next) {
            var ext = _path2['default'].extname(filepath).slice(1).toUpperCase();

            var resizeValue = width >= height && width || height;

            (0, _gm2['default'])(filepath).gravity('Center').resize(resizeValue, resizeValue)
            // .resize(width, height + '^>')
            .quality(90).crop(width, height).toBuffer(ext, function (err, buffer) {
                if (err) {
                    return next(err);
                }
                return next(null, buffer.toString('binary'));
            });
        }
    }
};

exports['default'] = methods;
module.exports = exports['default'];