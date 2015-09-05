
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
        return this.serverConfig.app.apiRootPrefix || '';
    }

    get routes() {
        var resourceConfig = this.config;
        var serverConfig = this.serverConfig;
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

            if (_.isString(auth)) {
                auth = {strategy: auth};
            }

            config.auth = auth;


            /**
             * set the full path of the route
             */
            if (path === '/') {
                path = '';
            }
            path = `${this.apiRootPrefix}${this.prefix}${path}`;

            config = Object.assign({}, routeConfig, config);


            return {
                path,
                method,
                handler,
                config
            };
        });
    }
}
