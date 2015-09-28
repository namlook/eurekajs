
import genericRoutes from '../../../lib/generic-routes';

export default {
    auth: {
        strategy: 'token',
        scope: 'user' // overwrite admin scope
    },
    routes: genericRoutes
};