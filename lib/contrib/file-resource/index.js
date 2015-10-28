'use strict';

var _interopRequireDefault = require('babel-runtime/helpers/interop-require-default')['default'];

Object.defineProperty(exports, '__esModule', {
    value: true
});

var _routes = require('./routes');

var _routes2 = _interopRequireDefault(_routes);

var _methods = require('./methods');

exports['default'] = function (options) {
    return {
        methods: { thumbnailize: _methods.thumbnailize },
        routes: (0, _routes2['default'])(options)
    };
};

module.exports = exports['default'];