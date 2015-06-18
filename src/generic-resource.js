
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
            this.delete
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
                            populate: false, // TODO options
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
                reply.ok({results: `create a ${request.resourceName}`});
            }
        };
    }

    get update() {
        return {
            method: ['PUT', 'POST', 'PATCH'],
            path: `/{id}`,
            handler: function(request, reply) {
                reply.ok({results: `update a ${request.resourceName}`});
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
}

export default new GenericResource();