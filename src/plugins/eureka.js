
import _ from 'lodash';
import {pascalCase} from '../utils';
import queryFilterValidator from './queryfilter-validator';
import Boom from 'boom';

import Resource from './resource';

import Bcrypt from 'bcrypt';

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
            if (data) {
                boomError.output.payload.infos = data;
            }
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
    plugin.ext('onPostAuth', function(request, reply) {
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


/**
 * set the authentification layer
 */
var setAuthentification = function(plugin) {

    let basicValidation = function(username, password, callback) {
        let db = plugin.plugins.eureka.database;
        // let UserModel = plugin.plugins.eureka.userModel;
        // let usernameField = plugin.plugins.eureka.usernameField;
        // let passwordField = plugin.plugins.eureka.passwordField;

        let UserModel = 'User';
        let usernameField = 'email';
        let passwordField = 'password';

        let query = {[usernameField]: username};

        db[UserModel].first(query, (err, user) => {
            if (err) {
                return callback(err);
            }

            if (!user) {
                return callback(null, false);
            }

            Bcrypt.compare(password, user.get(passwordField), (compareErr, isValid) => {
                return callback(null, isValid, user.toJSONObject());
            });

        });
    };

    plugin.auth.strategy('simple', 'basic', {validateFunc: basicValidation});


    plugin.auth.strategy('token', 'jwt', {
        key: plugin.settings.app.secret,
        validateFunc: function(decodedToken, callback) {
            return callback(null, true, decodedToken);
        }
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

    plugin.expose('database', plugin.plugins.archimedes.db);
    // plugin.expose('userModel', 'User');
    // plugin.expose('usernameField', 'email');
    // plugin.expose('passwordField', 'password');

    setAuthentification(plugin);
    decoratePlugin(plugin);
    fillRequest(plugin);


    _.forOwn(options.resources, (resourceConfig, resourceName) => {
        let resource = new Resource(resourceName, resourceConfig, {apiRootPrefix: options.apiRootPrefix});
        let routes = resource.routes;
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
