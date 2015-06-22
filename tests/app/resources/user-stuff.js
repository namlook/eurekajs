
import genericRoutes from '../../../lib/generic-routes';

var showOnly4Auth = {
    method: 'GET',
    path: '/{id}/only-auth',
    handler: function(request, reply) {
        return reply.ok(request.pre.document.toJSONObject());
    },
    config: {
        auth: 'token'
    }
};

var showOnly4Me = {
    method: 'GET',
    path: '/{id}/only-me',
    handler: function(request, reply) {
        return reply.ok(request.pre.document.toJSONObject());
    },
    config: {
        auth: 'token',
        plugins: {
            policies: [{'user': '_owner'}]
        }
    }
};

export default {
    routes: genericRoutes.all.concat([showOnly4Auth, showOnly4Me])
};