
import passport from 'passport';

import _ from 'lodash';

var checkGroupPermissions = function(userGroups, policyGroups) {
    let groupMatches = _.intersection(userGroups, policyGroups);
    if (groupMatches.length === policyGroups.length) {
        return true;
    }
    return false;
};

var checkUserPermissions = function(user, policy) {
    if (policy === true) {
        return true;
    }
    return false;
};

var definePolicies = function(policies) {

    policies = policies || [];

    /**
     * if no policies are defined, no permission check are needed
     */
    if (!policies.length) {
        return policies;
    }

    /**
     * lock the access
     */
    var middlewares = [passport.authenticate('jwt', { session: false })];

    /**
     * implement permission check middleware
     */
    middlewares.push(function(req, res, next) {

        /**
         * if we have policies defined and no user authenticated
         * we don't need to go further
         */
        if (!req.user) {
            return res.authorized();
        }


        /**
         * For each policy, check if the user has the permission.
         * Stop when a policy is authorized, or when all policies
         * has been checked
         */
        var index = 0;
        var policy = policies[index];
        var authorized = false;
        while (policy && !authorized) {

            var user = req.user;

            /**
             * if the policy is a function, execute it to check the permission
             */
            if (typeof policy === 'function') {

                authorized = policy(user, req);

            } else {
                /**
                 * otherwise, iterate over each policy object and the job
                 */

                var userGroups = user.get('groups');

                if (policy.groups && policy.user) {

                    let groupAuthorisation = checkGroupPermissions(userGroups, policy.groups);
                    let userAuthorisation = checkUserPermissions(req.user, policy.user);
                    authorized = groupAuthorisation && userAuthorisation;

                } else {

                    if (policy.groups) {
                        authorized = checkGroupPermissions(userGroups, policy.groups);
                    }

                    if (policy.user) {
                        authorized = checkUserPermissions(req.user, policy.user);
                    }

                }
            }

            index += 1;
            policy = policies[index];
        }

        if (authorized) {
            next();
        } else {
            res.unauthorized();
        }
    });

    return middlewares;
};

export default {
    pathPrefix: '/auth',
    routes: {
        signin: require('./routes/signin'),
        signup: require('./routes/signup'),

        secret: {
            path: '/secret',
            method: 'GET',
            policies: [{user: true}],
            handler: [
                definePolicies([
                    {user: true}
                ]),
                function(req, res) {
                    res.ok('secret');
                }
            ]
        },
        verySecret: {
            path: '/very-secret',
            method: 'GET',
            policies: [
                {groups: ['in-loop']},
                {groups: ['not-in-loop', 'boss']},
                function(user) { return user.get('email') === 'theboss@company.com'; }
            ],
            handler: [
                definePolicies([
                    {groups: ['in-loop']},
                    {groups: ['not-in-loop', 'boss']},
                    function(user) { return user.get('email') === 'theboss@company.com'; }
                ]),
                function(req, res) {
                    res.ok('secret for people in the loop');
                }
            ]
        }
    }
};