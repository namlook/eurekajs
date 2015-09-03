
import nodemailerStubTransport from 'nodemailer-stub-transport';
import requireDir from 'require-dir';

export default {
    port: 5000,
    log: ['warn'],
    auth: true,
    app: {
        secret: 'ssh',
        email: 'contact@project.com',
        clientRootUrl: 'http://www.project.com',
        apiRootPrefix: '/api/1'
    },
    database: {
        // adapter: {
        //     type: 'rdf',
        //     dialect: 'virtuoso',
        //     graphURI: 'http://test.org'
        // },
        // host: '192.168.99.100',
        config: {
            graphUri: 'http://test.org',
            // host: '192.168.99.100',
            // port: 8890,
            // endpoint: `http://192.168.99.100:8890/sparql` // virtuoso
            endpoint: `http://192.168.99.100:9999/bigdata/sparql` // blazegraph's bigdata
        },
        schemas: requireDir('./app/schemas')
    },
    resources: requireDir('./app/resources'),
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
    }
};