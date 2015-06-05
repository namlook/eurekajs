
export default {
    _generic: true,
    path: /^\/api\/1\/_files\/([^\/]+?(?:\/[^\/]+?)*)(?:\/(?=$))?$/i,
    method: 'get',
    policies: [],
    action: function(req, res) {
        return res.sendResults(`redirect file`);
    }
};