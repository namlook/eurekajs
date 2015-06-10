
import fetchDocumentMdw from '../../middlewares/fetch-document';
import createRoute from './create';

export default {
    _generic: true,
    path: '/:id',
    method: 'post',
    beforeHandler: [fetchDocumentMdw],
    handler: createRoute.handler
};