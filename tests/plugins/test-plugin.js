
import _ from 'lodash';

var baseMid = function(req, res, next) {
    if(_.endsWith(req.path, '__')) {
        res.ok('secret door found');
    } else {
        next();
    }
};

var mid1 = function(req, res, next) {
    req.middlewaresWalkThrough = ['mid1'];
    next();
};

export default function(server) {

    server.use(baseMid);

    return {
        resources: {
            test: {
                pathPrefix: '/',
                beforeHandlers: [mid1],
                routes: {
                    allResourcesRoute: {
                        path: '/:type/i/plugin',
                        method: 'GET',
                        handler: function(req, res) {
                            return res.ok(`plugin attached to ${req.params.type}`);
                        }
                    },
                    singleRoute: {
                        path: '/plugin',
                        method: 'GET',
                        handler: function(req, res) {
                            return res.ok('plugin registered');
                        }
                    },
                    middlewaresWalkThrough: {
                        path: '/plugin/middlewares',
                        method: 'GET',
                        handler: function(req, res) {
                            return res.ok(req.middlewaresWalkThrough);
                        }
                    }
                }
            }
        },
        schemas: null
    };
}