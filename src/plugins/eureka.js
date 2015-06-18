
import _ from 'lodash';
import {pascalCase} from '../utils';
import queryFilterValidator from './queryfilter-validator';
import Boom from 'boom';


import joi from 'joi';

var queryOptionValidator = {
    limit: joi.number().min(1),
    sortBy: joi.string(),
    fields: joi.array(joi.string()),
    populate: [joi.number(), joi.boolean()]
};


/**
 * fill `reply` with Boom helpers
 */
var decoratePlugin = function(plugin) {

    _.forOwn(Boom, (fn, name) => {
        plugin.decorate('reply', name, function(message, data) {
            let boomError = fn(message);
            boomError.output.payload.infos = data;
            return this.response(boomError);
        });
    });

    plugin.decorate('reply', 'ok', function (results) {
        return this.response({ statusCode: 200, results: results });
    });

    plugin.decorate('reply', 'created', function (results) {
        return this.response({ statusCode: 201, results: results }).code(201);
    });

    plugin.decorate('reply', 'noContent', function() {
        return this.response({statusCode: 204}).code(204);
    });

};

var fillRequest = function(plugin) {

    /**
     * Fill the request with helpers:
     *  - request.resourceName
     *  - request.db
     *  - request.Model (if appropriated)
     */
    plugin.ext('onPostAuth', function(request, reply) {
        let db = request.server.plugins.eureka.database;
        let resourceName = _.get(request, 'route.settings.plugins.eureka.resourceName');
        let Model = db[pascalCase(resourceName)];

        if (Model) {
            request.Model = Model;
        }

        request.resourceName = resourceName;
        request.db = db;
        // request.pre.arf = 'foo';
        // console.log(request.route);
        // console.log(request.server.table()[0].table[2].settings);

        return reply.continue();
    });



    /**
     * Prefetch the document
     * If request.params.id and request.Model exist, fetch the document
     * and attach it to request.pre.document
     */
    plugin.ext('onPreHandler', function(request, reply) {
        if (request.Model && request.params.id) {
            request.Model.first({_id: request.params.id}, function(err, document) {
                if (err) {
                    return reply.badImplementation();
                }

                if (!document) {
                    return reply.notFound();
                }

                request.pre.document = document;
                return reply.continue();
            });
        } else {
            return reply.continue();
        }
    });



    /**
     * extract filter from `request.query`, validate it against
     * the model properties and add it as `request.pre.queryFilter`
     */
    plugin.ext('onPostAuth', function(request, reply) {
        let {db, query, Model} = request;

        if (!Model) {
            return reply.continue();
        }

        let queryFilter = query.filter || {};
        let {value, errors} = queryFilterValidator(db, Model.schema, queryFilter);

        if (errors.length) {
            return reply.badRequest(errors[0]);
        }

        request.pre.queryFilter = value;

        // remove filter from query
        request.query = _.omit(request.query, 'filter');

        reply.continue();
    });


    /**
     * extract options from `request.query`, validate them as jsonApi
     * and add them to `request.pre.queryOptions`
     */
    plugin.ext('onPostAuth', function(request, reply) {
        let {query, Model} = request;
        if (!Model) {
            return reply.continue();
        }

        let queryOptions = _.omit(query, 'filter');

        let {value, error} = joi.validate(
            queryOptions, queryOptionValidator, {stripUnknown: true});

        if (error) {
            return reply.badRequest(error);
        }

        /** check if all sortBy properties are specified in model **/
        if (value.sortBy) {
            var sortByProperties = value.sortBy.split(',');
            for (let index in sortByProperties) {
                let propName = sortByProperties[index];
                propName = _.trimLeft(propName, '-');
                if (!Model.schema.getProperty(propName)) {
                    return reply.badRequest(`sortBy: unknown property ${propName} for model ${Model.schema.name}`);
                }
            }
        }


        /** check if all fields properties are specified in model **/
        if (value.fields) {
            for (let index in value.fields) {
                let propName = value.fields[index];
                if (!Model.schema.getProperty(propName)) {
                    return reply.badRequest(`fields: unknown property ${propName} for model ${Model.schema.name}`);
                }
            }
        }

        request.pre.queryOptions = value;

        // remove model specific options from query
        request.query = _.omit(request.query, _.keys(value));

        reply.continue();
    });
};


var eurekaPlugin = function(plugin, options, next) {

    if (options.log) {
        options.log = _.isArray(options.log) && options.log || [options.log];

        plugin.on('log', function(message) {
            if (_.contains(message.tags, 'eureka')) {
                if (_.intersection(message.tags, options.log).length) {
                    console.log(message.tags, message.data);
                }
            }
        });
    }


    decoratePlugin(plugin);
    fillRequest(plugin);

    plugin.expose('database', plugin.plugins.archimedes.db);

    var resources = _.cloneDeep(options.resources);

    _.forOwn(resources, (resourceConfig, resourceName) => {

        var pathPrefix = resourceConfig.prefix;
        if (pathPrefix) {
            if (resourceConfig.prefix !== '/') {
                pathPrefix = resourceConfig.prefix;
            }
        } else {
            pathPrefix = `/${resourceName}`; // TODO plurialize
        }

        pathPrefix = `/api/1${pathPrefix}`; // TODO put this in config

        var routes = resourceConfig.routes;

        /*** fill resourceName **/
        routes.forEach(function(route) {
            if (_.get(route, 'config.plugins.eureka.resourceName') == null) {
                _.set(route, 'config.plugins.eureka.resourceName', resourceName);
            }

            if (pathPrefix) {
                if (route.path === '/') {
                    route.path = pathPrefix;
                } else {
                    route.path = pathPrefix + route.path;
                }
            }
            plugin.log(['debug', 'eureka', 'route'], `attach route: ${route.method} ${route.path} on ${resourceName}`);
        });

        plugin.log(['info', 'eureka'], `mounting ${resourceName} (${routes.length} routes)`);
        plugin.route(routes);
    });

    next();
};

eurekaPlugin.attributes = {
    name: 'eureka'
    // version: '1.0.0'
};

export default eurekaPlugin;
