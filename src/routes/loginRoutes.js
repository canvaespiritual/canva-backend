const express = require("express");
const router = express.Router();
const path = require("path");
const bodyParser = require("body-parser");

router.use(bodyParser.urlencoded({ extended: true }));

// Página de login
router.get("/login", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "..", "admin", "login.html"));
});

// Autenticação
router.post("/login", (req, res) => {
  const { usuario, senha } = req.body;

  const usuarioCorreto = process.env.ADMIN_USER || "admin";
  const senhaCorreta = process.env.ADMIN_PASS || "123456";

  if (usuario === usuarioCorreto && senha === senhaCorreta) {
    req.session.adminAutenticado = true;

    // 🔁 Redireciona corretamente para o painel
    return res.redirect("/admin/admin.html");
  } else {
    return res.redirect("/admin/login?erro=1");
  }
});

// Logout
router.get("/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/admin/login");
  });
});
// Se acessar diretamente /admin sem estar autenticado, redireciona
router.get("/", (req, res) => {
  if (req.session.adminAutenticado) {
    res.redirect("/admin/admin.html"); // Painel principal
  } else {
    res.redirect("/admin/login");
  }
});

module.exports = router;
