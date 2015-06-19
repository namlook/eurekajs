
import _ from 'lodash';


var sync = function(request, callback) {
    let {payload, Model, db} = request;

    /**
     * if the payload is a string, try to parse it as a JSON
     */
    if (typeof payload === 'string') {
        try {
            payload = JSON.parse(payload);
        } catch (parseError) {
            return callback({
                type: 'ParseError',
                payload: payload,
                error: parseError
            });
        }
    }

    /**
     * if the payload is an array, performs a batch sync
     */
    if (_.isArray(payload)) {
        var pojos = [];

        /**
         * for each item in payload, validate and convert it
         * into an archimedes' Model object
         */
        for (let index in payload) {
            let item = payload[index];
            let {error, value} = Model.schema.validate(item);
            if (error) {
                return callback({
                    type: 'ValidationError',
                    error: error,
                    infos: {failedDocument: item}
                });
            }

            delete value._type; // TODO remove in the future ?

            try {
                pojos.push(new Model(value).toSerializableObject());
            } catch (createModelError) {
                return callback(createModelError);
            }
        }

        /**
         * process batch syncing
         */
        return db.batchSync(pojos, function(err, data) {
            if (err) {
                return callback(err);
            }

            let savedObj = data.map(function(item) {
                item = item.result; // TODO clean this in archimedes
                item._type = Model.schema.name;
                return new Model(item).toJSONObject({
                    dereference: true
                });
            });

            return callback(null, savedObj);
          });

    /**
     * if the payload is an object, perform a regular save
     */
    } else {
        let {error, value} = Model.schema.validate(payload);

        if (error) {
            return callback({
                type: 'ValidationError',
                error: error,
                infos: {failedDocument: payload}
            });
        }

        try {
            var obj = new Model(value);
        } catch (createModelError2) {
            return callback(createModelError2);
        }

        obj.save(function(err, savedObj) {
            if (err) {
                return callback(err);
            }

            return callback(null, savedObj.toJSONObject({dereference: true}));
        });
    }
};


/**
 * to disable eureka magic on a route,
 * just set `config.plugins.eureka = false`
 */

class GenericResource {

    get routes() {
        return [
            this.find,
            this.fetch,
            this.count,
            this.create,
            this.update,
            this.delete,
            this.groupBy
        ];
    }


    get find() {
        return {
            method: 'GET',
            path: '/',
            handler: function(request, reply) {
                let {queryFilter, queryOptions} = request.pre;
                request.Model.find(queryFilter, queryOptions, function(err, data) {
                    if (err) {
                        return reply.badImplementation(err);
                    }

                    var results = data.map(function(o) {
                        return o.toJSONObject({
                            populate: queryOptions.populate,
                            dereference: true
                        });
                    });

                    return reply.ok(results);
                });
            }
        };
    }


    get fetch() {
        return {
            method: 'GET',
            path: `/{id}`,
            handler: function(request, reply) {
                return reply.ok(request.pre.document.toJSONObject({
                    populate: false,
                    dereference: true
                }));
            }
        };
    }


    get count() {
        return {
            method: 'GET',
            path: `/i/count`,
            handler: function(request, reply) {
                let {queryFilter, queryOptions} = request.pre;
                request.Model.count(queryFilter, queryOptions, function(err, total) {
                    if (err) {
                        return reply.badImplementation();
                    }

                    return reply.ok(total);
                });
            }
        };
    }


    get create() {
        return {
            method: 'POST',
            path: '/',
            handler: function(request, reply) {

                sync(request, function(err, data) {
                    if (err) {
                        if (err.type === 'ParseError') {
                            return reply.badRequest('The payload should be a valid JSON', {payload: err.payload, parseError: err.error});
                        } else if (err.type === 'ValidationError') {
                            return reply.badRequest(err.error, err.infos);
                        } else {
                            return reply.badImplementation(err);
                        }
                    }
                    return reply.created(data);
                });


            }
        };
    }


    get update() {
        return {
            method: ['PUT', 'POST', 'PATCH'],
            path: `/{id}`,
            handler: function(request, reply) {
                sync(request, function(err, data) {
                    if (err) {
                        if (err.type === 'ParseError') {
                            return reply.badRequest('The payload should be a valid JSON', {payload: err.payload, parseError: err.error});
                        } else if (err.type === 'ValidationError') {
                            return reply.badRequest(err.error, err.infos);
                        } else {
                            return reply.badImplementation(err);
                        }
                    }
                    return reply.ok(data);
                });
            }
        };
    }


    get delete() {
        return {
            method: 'DELETE',
            path: `/{id}`,
            handler: function(request, reply) {
                request.pre.document.delete(function(err) {
                    if (err) {
                        return reply.badImplementation(err);
                    }

                    return reply.noContent();
                });
            }
        };
    }


    get groupBy() {
        return {
            method: 'GET',
            path: '/i/group-by/{property}',
            handler: function(request, reply) {
                let {Model} = request;

                /** validate the property param **/
                let property = request.params.property;
                if (!Model.schema.getProperty(property)) {
                    return reply.badRequest(`unknown property "${property}" for model ${Model.schema.name}`);
                }

                let {queryFilter} = request.pre;

                Model.facets(property, queryFilter, function(err, data) {
                    if (err) {
                        return reply.badImplementation(err);
                    }

                    /** TODO put this hack into archimedes **/
                    if (Model.schema.getProperty(property).type === 'boolean') {
                        data = data.map(o => {
                            o.facet = Boolean(_.parseInt(o.facet));
                            return o;
                        });
                    }

                    return reply.ok(data);
                });
            }
        };
    }
}

export default new GenericResource();
