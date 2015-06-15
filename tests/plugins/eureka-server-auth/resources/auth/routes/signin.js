
import passport from 'passport';
import jwt from 'jsonwebtoken';

export default {
    method: 'GET',
    path: '/',
    handler: [
        passport.authenticate('basic', {session: false}),
        function(req, res) {
            let secret = req.server.config.secret;
            let payload = {userId: req.user.get('_id')};
            let token = jwt.sign(payload, secret);
            return res.ok({token: token});
        }
    ]
};