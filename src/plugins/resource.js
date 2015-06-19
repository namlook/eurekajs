
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
        var routes = this.config.routes || [];
        return routes.map((route) => {
            let {path, method, handler, config} = route;

            /**
             * set resourceName on the eurekaConfig so we can access it
             * on middlewares
             */
            config = config || {};
            let resourceNamePath = 'plugins.eureka.resourceName';
            if (_.get(config, resourceNamePath) == null) {
                _.set(config, resourceNamePath, this.name);
            }


            /**
             * set the full path of the route
             */
            if (path === '/') {
                path = '';
            }
            path = `${this.apiRootPrefix}${this.prefix}${path}`;

            return {
                path,
                method,
                handler,
                config
            };
        });
    }
}
