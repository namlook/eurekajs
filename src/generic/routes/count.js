
import queryParserMdw from '../../middlewares/query-parser';

export default {
    _generic: true,
    path: '/i/count',
    method: 'get',
    beforeHandler: [queryParserMdw],
    handler: function(req, res) {
        var Model = req.Model;
        var {query, options} = req.parsedQuery;

        Model.count(query, options, function(err, data) {
            if (err) {
                return res.serverError(err, {query: query, options: options});
            }

            return res.sendResults(data);
        });
    }
};