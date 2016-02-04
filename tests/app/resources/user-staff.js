
import genericRoutes from '../../../lib/contrib/generic-routes';

let routes = genericRoutes();

routes.document4Auth = {
    method: 'GET',
    path: '/{id}/only-auth',
    config: {
        auth: 'token'
    },
    handler: routes.fetch.handler
};


routes.document4Me = {
    method: 'GET',
    path: '/{id}/only-for-me',
    config: {
        auth: {
            strategy: 'token',
            access: {
                scope: 'userId:doc._owner._id'
            }
        }
    },
    handler: routes.fetch.handler
};


routes.document4Role = {
    method: 'GET',
    path: '/{id}/only-for-secretkeeper',
    config: {
        auth: {
            strategy: 'token',
            access: {
                scope: 'secret-keeper'
            }
        }
    },
    handler: routes.fetch.handler
};

routes.document4RoleInDoc = {
    method: 'GET',
    path: '/{id}/only-for-my-roles',
    config: {
        auth: {
            strategy: 'token',
            access: {
                scope: 'userScope:doc._scope'
            }
        }
    },
    handler: routes.fetch.handler
};


routes.documentWithBadScope = {
    method: 'GET',
    path: '/{id}/bad-scope',
    config: {
        auth: {
            strategy: 'token',
            access: {
                scope: 'arf:doc_scope'
            }
        }
    },
    handler: routes.fetch.handler
};



routes.collection4Role = {
    method: 'GET',
    path: '/i/only-for-secretkeeper',
    config: {
        auth: {
            strategy: 'token',
            access: {
                scope: ['secret-keeper']
            }
        }
    },
    handler: routes.find.handler
};

routes.collection4MeInDoc = {
    method: 'GET',
    path: '/i/only-my-stuff',
    config: {
        auth: {
            strategy: 'token',
            access: {
                scope: ['userId:doc._owner._id']
            }
        }
    },
    handler: routes.find.handler
 };



routes.collection4MyRoleInDoc = {
    method: 'GET',
    path: '/i/only-secretkeeper-documents',
    config: {
        auth: {
            strategy: 'token',
            access: {
                scope: ['userScope:doc._scope']
            }
        }
    },
    handler: routes.find.handler
};


export default function() {
    return {
        auth: {
            strategy: 'token',
            access: {
                scope: ['user-stuff-access']
            }
        },
        routes: routes
    };
}
