
import authRoutes from '../../../lib/auth-routes';

export default function() {
    return {
        auth: false,
        prefix: '/auth',
        routes: authRoutes
    };
}