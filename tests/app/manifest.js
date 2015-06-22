
import requireDir from 'require-dir';

var logs = [];//['warn', 'info'];

export default {
    connections: [
        {port: 5000}
    ],
    server: {
        app: {
            secret: 'ssh'
        }
    },
    plugins: {
        'hapi-auth-basic': null,
        'hapi-auth-jwt': null,
        '../../../lib/plugins/archimedes': {
            log: logs,
            database: {
                adapter: 'rdf',
                config: {
                    store: 'virtuoso',
                    host: '192.168.99.100',
                    graphURI: 'http://test.org'
                }
            },
            schemas: requireDir('./schemas')
        },
        '../../../lib/plugins/eureka': {
            log: logs,
            resources: requireDir('./resources'),
            apiRootPrefix: '/api/1'
        },
        '../../../lib/plugins/policies': null
    }
};