
import requireDir from 'require-dir';

var logs = [];//['warn', 'info'];

export default {
    connections: [
        {port: 5000}
    ],
    plugins: {
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
            resources: requireDir('./resources')
        }
    }
};