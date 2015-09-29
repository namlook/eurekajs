
import genericRoutes from '../../../lib/generic-routes';

genericRoutes.document4Auth = {
    method: 'GET',
    path: '/{id}/only-auth',
    config: {
        auth: 'token'
    },
    handler: genericRoutes.fetch.handler
};


genericRoutes.document4Me = {
    method: 'GET',
    path: '/{id}/only-for-me',
    config: {
        auth: {
            strategy: 'token',
            scope: 'userId:doc._owner._id'
        }
    },
    handler: genericRoutes.fetch.handler
};


genericRoutes.document4Role = {
    method: 'GET',
    path: '/{id}/only-for-secretkeeper',
    config: {
        auth: {
            strategy: 'token',
            scope: 'secret-keeper'
        }
    },
    handler: genericRoutes.fetch.handler
};

genericRoutes.document4RoleInDoc = {
    method: 'GET',
    path: '/{id}/only-for-my-roles',
    config: {
        auth: {
            strategy: 'token',
            scope: 'userScope:doc._scope'
        }
    },
    handler: genericRoutes.fetch.handler
};


genericRoutes.documentWithBadScope = {
    method: 'GET',
    path: '/{id}/bad-scope',
    config: {
        auth: {
            strategy: 'token',
            scope: 'arf:doc_scope'
        }
    },
    handler: genericRoutes.fetch.handler
};



genericRoutes.collection4Role = {
    method: 'GET',
    path: '/i/only-for-secretkeeper',
    config: {
        auth: {
            strategy: 'token',
            scope: ['secret-keeper']
        }
    },
    handler: genericRoutes.find.handler
};

genericRoutes.collection4MeInDoc = {
    method: 'GET',
    path: '/i/only-my-stuff',
    config: {
        auth: {
            strategy: 'token',
            scope: ['userId:doc._owner._id']
        }
    },
    handler: genericRoutes.find.handler
 };



genericRoutes.collection4MyRoleInDoc = {
    method: 'GET',
    path: '/i/only-secretkeeper-documents',
    config: {
        auth: {
            strategy: 'token',
            scope: ['userScope:doc._scope']
        }
    },
    handler: genericRoutes.find.handler
};


export default {
    auth: {
        strategy: 'token',
        scope: ['user-stuff-access']
    },
    routes: genericRoutes
};