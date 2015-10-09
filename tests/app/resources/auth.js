
import authRoutes from '../../../lib/contrib/auth-routes';

export default function() {
    return {
        auth: false,
        prefix: '/auth',
        routes: authRoutes
    };
}