
class GenericResource {

    get routes() {
        return [
            this.find,
            this.count,
            this.create,
            this.update,
            this.delete
        ];
    }


    get find() {
        return {
            method: 'GET',
            path: `/{id?}`,
            handler: function(request, reply) {
                reply({results: `find a ${request.Model}`});
            }
        };
    }


    get count() {
        return {
            method: 'GET',
            path: `/i/count`,
            handler: function(request, reply) {
                reply.ok(`count of ${request.Model} ${request.pre.arf}`);
            }
        };
    }

    get create() {
        return {
            method: 'POST',
            path: '/',
            handler: function(request, reply) {
                reply({results: `create a ${request.Model}`});
            }
        };
    }

    get update() {
        return {
            method: ['PUT', 'POST', 'PATCH'],
            path: `/{id}`,
            handler: function(request, reply) {
                reply({results: `update a ${request.Model}`});
            }
        };
    }

    get delete() {
        return {
            method: 'DELETE',
            path: `/{id}`,
            handler: function(request, reply) {
                reply({results: `delete a ${request.Model}`});
            }
        };
    }
}

export default new GenericResource();