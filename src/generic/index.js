
import findRoute from './routes/find';
import createRoute from './routes/create';
import updateRoute from './routes/update';
import deleteRoute from './routes/delete';
import countRoute from './routes/count';
import streamRoute from './routes/stream';
import groupByRoute from './routes/group-by';

export default {
    middlewares: [],
    pathPrefix: '/',
    routes: {
        find: findRoute,
        create: createRoute,
        update: updateRoute,
        delete: deleteRoute,
        count: countRoute,
        stream: streamRoute,
        groupBy: groupByRoute
    }
};