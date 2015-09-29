
import genericRoutes from '../../../lib/generic-routes';

export default function() {
    return {
        auth: {
            strategy: 'token',
            scope: 'user' // overwrite admin scope
        },
        routes: genericRoutes
    };
}