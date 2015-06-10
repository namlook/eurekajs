
export default {
    _generic: true,
    path: '/i/describe',
    method: 'get',
    handler: function(req, res) {
        var Model = req.Model;

        res.sendResults(Model.schema._schema);
    }
};