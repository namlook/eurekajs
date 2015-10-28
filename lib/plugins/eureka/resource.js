'use strict';

var _createClass = require('babel-runtime/helpers/create-class')['default'];

var _classCallCheck = require('babel-runtime/helpers/class-call-check')['default'];

var _Object$assign = require('babel-runtime/core-js/object/assign')['default'];

var _interopRequireDefault = require('babel-runtime/helpers/interop-require-default')['default'];

Object.defineProperty(exports, '__esModule', {
    value: true
});

var _lodash = require('lodash');

var _lodash2 = _interopRequireDefault(_lodash);

var _utils = require('../../utils');

var Resource = (function () {
    function Resource(name, config, serverConfig, db) {
        _classCallCheck(this, Resource);

        this.name = name;

        if (typeof config === 'function') {
            this.config = config(serverConfig);
        } else {
            this.config = config;
        }

        this.serverConfig = serverConfig;
        this.db = db;
    }

    _createClass(Resource, [{
        key: 'prefix',
        get: function get() {
            var prefix = this.name;
            var model = this.db[(0, _utils.pascalCase)(this.name)];
            if (model) {
                prefix = model.meta.names.plural;
            }
            return this.config.prefix || '/' + prefix;
        }
    }, {
        key: 'apiRootPrefix',
        get: function get() {
            return this.serverConfig.app.apiRootPrefix || '';
        }
    }, {
        key: 'methods',
        get: function get() {
            var methods = this.config.methods || [];

            if (typeof methods === 'function') {
                methods = methods(this.serverConfig);
            }

            var results = methods;
            if (methods && _lodash2['default'].isObject(methods)) {
                results = [];
                _lodash2['default'].forOwn(methods, function (methodConfig, methodName) {
                    results.push({
                        name: methodName,
                        method: methodConfig.method,
                        options: methodConfig.options
                    });
                });
            }

            return results;
        }
    }, {
        key: 'routes',
        get: function get() {
            var _this = this;

            var resourceConfig = this.config;
            var serverConfig = this.serverConfig;
            var routes = this.config.routes || [];

            if (typeof routes === 'function') {
                routes = routes(this.serverConfig);
            }

            if (routes && _lodash2['default'].isObject(routes)) {
                routes = _lodash2['default'].values(routes);
            }

            return routes.map(function (route) {
                var path = route.path;
                var method = route.method;
                var handler = route.handler;
                var routeConfig = route.config;

                var config = {};

                /**
                 * set resourceName on the eurekaConfig so we can access it
                 * on middlewares
                 */
                var resourceNamePath = 'plugins.eureka.resourceName';
                if (_lodash2['default'].get(config, resourceNamePath) == null) {
                    _lodash2['default'].set(config, resourceNamePath, _this.name);
                }

                /**
                 * assign route auth
                 */
                var auth;
                if (routeConfig && routeConfig.auth != null) {
                    auth = routeConfig.auth;
                } else if (resourceConfig.auth != null) {
                    auth = resourceConfig.auth;
                } else {
                    auth = serverConfig.auth;
                }

                if (_lodash2['default'].isString(auth)) {
                    auth = { strategy: auth };
                }

                config.auth = auth;

                /**
                 * set the full path of the route
                 */
                if (path === '/') {
                    path = '';
                }
                path = '' + _this.apiRootPrefix + _this.prefix + path;

                config = _Object$assign({}, routeConfig, config);

                return {
                    path: path,
                    method: method,
                    handler: handler,
                    config: config
                };
            });
        }
    }]);

    return Resource;
})();

exports['default'] = Resource;
module.exports = exports['default'];