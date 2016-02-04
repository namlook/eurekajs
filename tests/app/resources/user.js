
import genericRoutes from '../../../lib/contrib/generic-routes';

export default function() {
    return {
        auth: {
            strategy: 'token',
            access: {
                scope: 'user' // overwrite admin scope
            }
        },
        routes: genericRoutes
    };
}
