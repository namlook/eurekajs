

var checkPermission = function(plugin) {
    plugin.ext('onPreHandler', (request, reply) => {
        let policies = request.route.settings.plugins.policies || [];
        let user = request.auth.credentials;
        let doc = request.pre.document;

        if (policies.length) {
            for(let index in policies) {
                let policy = policies[index];
                if (policy.user) {
                    if (doc.get(policy.user) !== user.email) {
                        return reply.unauthorized("you don't have the authorization to access this document");
                    }
                }
            }
        }

        reply.continue();
    });
};


var policiesPlugin = function(plugin, config, next) {
    checkPermission(plugin);
    next();
};

policiesPlugin.attributes = {
    name: 'policies'
};

export default policiesPlugin;