
import nodemailerStubTransport from 'nodemailer-stub-transport';
import requireDir from 'require-dir';

export default {
    port: 5000,
    log: ['warn'],
    app: {
        secret: 'ssh',
        email: 'contact@project.com',
        clientRootUrl: 'http://www.project.com',
        apiRootPrefix: '/api/1'
    },
    mailer: {
        transport: nodemailerStubTransport()
        // views: {
        //     engines: {
        //         html: {
        //             module: Handlebars.create(),
        //             path: Path.join(__dirname, 'emails')
        //         }
        //     }
        // }
    },
    database: {
        adapter: {
            type: 'rdf',
            dialect: 'virtuoso',
            graphURI: 'http://test.org'
        },
        host: '192.168.99.100',
        schemas: requireDir('./app/schemas')
    },
    resources: requireDir('./app/resources')
};