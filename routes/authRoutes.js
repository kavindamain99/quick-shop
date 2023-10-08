const express = require("express");
const authCtrl = require("../controllers/authController");
const auth = require("../middlewares/auth");
const passport = require("passport");
const router = express.Router();

// login route

router.post("/login", authCtrl.login);

//google auth
router.get("/google", passport.authenticate("google", ["profile", "email"]));
router.get(
  "/google/callback",
  passport.authenticate("google", {
    successRedirect: process.env.CLIENT_URL,
    failureRedirect: "/login/failed",
  })
);

router.get("/logout", (req, res) => {
  req.logout();
  res.redirect(process.env.CLIENT_URL);
});

// logout route must be authenticated

router.get("/logout", auth, authCtrl.logout);

// refresh token route

router.get("/refresh_token", authCtrl.refreshToken);

module.exports = router;
