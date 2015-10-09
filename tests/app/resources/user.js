
import genericRoutes from '../../../lib/contrib/generic-routes';

export default function() {
    return {
        auth: {
            strategy: 'token',
            scope: 'user' // overwrite admin scope
        },
        routes: genericRoutes
    };
}