function protegerRota(req, res, next) {
  if (req.session && req.session.adminAutenticado) {
    next();
  } else {
    res.redirect("/admin/login");
  }
}

module.exports = protegerRota;
