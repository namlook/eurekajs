

import requireDir from 'require-dir';
import nodemailerStubTransport from 'nodemailer-stub-transport';
import Path from 'path';
import Handlebars from 'handlebars';

var logs = [];//['warn', 'info'];

export default {
    connections: [
        {port: 5000}
    ],
    server: {
        app: {
            secret: 'ssh',
            email: 'contact@project.com',
            clientRootUrl: 'http://www.project.com'
        }
    },
    plugins: {
        'hapi-mailer': {
            transport: nodemailerStubTransport(),
            views: {
                engines: {
                    html: {
                        module: Handlebars.create(),
                        path: Path.join(__dirname, 'emails')
                    }
                }
            }
        },
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