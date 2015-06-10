
import findRoute from './routes/find';
import createRoute from './routes/create';
import updateRoute from './routes/update';
import deleteRoute from './routes/delete';
import describeRoute from './routes/describe';
import countRoute from './routes/count';
import streamRoute from './routes/stream';
import groupByRoute from './routes/group-by';

export default {
    middlewares: [],
    pathPrefix: '/',
    routes: {
        count: countRoute,
        create: createRoute,
        delete: deleteRoute,
        describe: describeRoute,
        find: findRoute,
        groupBy: groupByRoute,
        stream: streamRoute,
        update: updateRoute
    }
};