
import _ from 'lodash';


var decoratePlugin = function(plugin) {
    plugin.decorate('reply', 'ok', function (results) {
        return this.response({ status: 200, results: results });
    });

    plugin.decorate('reply', 'notFound', function () {
        return this.response({ status: 404, error: 'notFound' }).code(404);
    });
};

var fillRequest = function(plugin) {
    plugin.ext('onPreHandler', function(request, reply) {
        request.Model = _.get(request, 'route.settings.plugins.eureka.resourceName');
        request.db = request.server.plugins.eureka.database;
        request.pre.arf = 'foo';
        // console.log(request.route);
        // console.log(request.server.table()[0].table[2].settings);
        reply.continue();
    });
};


var eurekaPlugin = function(plugin, options, next) {

    decoratePlugin(plugin);
    fillRequest(plugin);

    plugin.expose('database', plugin.plugins.archimedes.db);

    _.forOwn(options.resources, (resourceConfig, resourceName) => {

        var pathPrefix = resourceConfig.prefix;
        if (pathPrefix) {
            if (resourceConfig.prefix !== '/') {
                pathPrefix = resourceConfig.prefix;
            }
        } else {
            pathPrefix = `/${resourceName}`; // TODO plurialize
        }

        var routes = resourceConfig.routes;

        /*** fill resourceName **/
        routes.forEach(function(route) {
            _.set(route, 'config.plugins.eureka.resourceName', resourceName);

            if (pathPrefix) {
                if (route.path === '/') {
                    route.path = pathPrefix;
                } else {
                    route.path = pathPrefix + route.path;
                }
            }
        });

        plugin.route(routes);
    });

    next();
};

eurekaPlugin.attributes = {
    name: 'eureka'
    // version: '1.0.0'
};

export default eurekaPlugin;
