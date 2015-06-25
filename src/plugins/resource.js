
import _ from 'lodash';

export default class Resource {
    constructor(name, config, serverConfig) {
        this.name = name;
        this.config = config;
        this.serverConfig = serverConfig;
    }

    get prefix() {
        return this.config.prefix || `/${this.name}`;
    }

    get apiRootPrefix() {
        return this.serverConfig.apiRootPrefix || '';
    }

    get routes() {
        var resourceConfig = this.config;
        var routes = this.config.routes || [];
        return routes.map((route) => {
            let {path, method, handler, config: routeConfig} = route;

            var config = {};
            /**
             * set resourceName on the eurekaConfig so we can access it
             * on middlewares
             */
            let resourceNamePath = 'plugins.eureka.resourceName';
            if (_.get(config, resourceNamePath) == null) {
                _.set(config, resourceNamePath, this.name);
            }

            /**
             * if their is no route auth defined and the resource
             * config.auth is specified, then set the route auth
             */
            if (resourceConfig.auth != null) {
                if (!_.get(config, 'auth')) {
                    _.set(config, 'auth', resourceConfig.auth);
                }
            }

            /**
             * set the full path of the route
             */
            if (path === '/') {
                path = '';
            }
            path = `${this.apiRootPrefix}${this.prefix}${path}`;

            config = Object.assign({}, config, routeConfig);

            return {
                path,
                method,
                handler,
                config
            };
        });
    }
}
