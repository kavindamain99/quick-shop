const Users = require("../models/userModels");
const { OAuth2Client } = require("google-auth-library");
const Joi = require("joi");
const bcrypt = require("bcrypt");
const CustomErrorHandler = require("../services/CustomErrorHandler");
const nodemailer = require("nodemailer");
const UserAgent = require("user-agents");
const geoip = require("geoip-lite");
// Create a transporter object
const transporter = nodemailer.createTransport({
  service: "Gmail", // Use the email service you prefer, e.g., 'Gmail', 'Outlook', 'SMTP', etc.
  auth: {
    user: "quickshopauth@gmail.com",
    pass: "qeya igmh blvq dizq",
  },
});

const {
  generateActiveToken,
  generateAccessToken,
  generateRefreshToken,
} = require("../config/generateToken");
const jwt = require("jsonwebtoken");
const sendEmail = require("../config/sendMail");
const { infoLogger, errLogger, alertLogger } = require("./logger");
const ip = require("ip");

const client = new OAuth2Client(`${process.env.MAIL_CLIENT_ID}`);
const CLIENT_URL = `http://localhost:3000`;
//const CLIENT_URL = `https://mern-quickshop-admin-panel.herokuapp.com`;

const authCtrl = {
  async login(req, res, next) {
    try {
      const { email, password } = req.body;

      const user = await Users.findOne({ email });
      if (!user)
        return next(
          CustomErrorHandler.badRequest("This account does not exits.")
        );

      // if user exists
      loginUser(user, password, res, next, req);
      sendMail(req, user);
    } catch (err) {
      return next(err);
    }
  },
  async logout(req, res, next) {
    if (!req.user)
      return next(CustomErrorHandler.badRequest("Invalid Authentication."));

    try {
      res.clearCookie("refreshtoken", { path: `/api/refresh_token` });

      await Users.findOneAndUpdate(
        { _id: req.user._id },
        {
          rf_token: "",
        }
      );

      return res.json({ message: "Logged out!" });
    } catch (err) {
      return next(err);
    }
  },
  async refreshToken(req, res, next) {
    try {
      const rf_token = req.cookies.refreshtoken;

      if (!rf_token)
        return next(CustomErrorHandler.badRequest("Please login now!"));

      const decoded = jwt.verify(
        rf_token,
        `${process.env.REFRESH_TOKEN_SECRET}`
      );
      if (!decoded.id)
        return next(CustomErrorHandler.badRequest("Please login now!"));

      const user = await Users.findById(decoded.id).select(
        "-password +rf_token"
      );
      if (!user)
        return next(
          CustomErrorHandler.badRequest("This email does not exist.")
        );

      if (rf_token !== user.rf_token)
        return next(CustomErrorHandler.badRequest("Please login now!"));

      const access_token = generateAccessToken({ id: user._id });
      const refresh_token = generateRefreshToken({ id: user._id }, res);

      await Users.findOneAndUpdate(
        { _id: user._id },
        {
          rf_token: refresh_token,
        }
      );

      res.json({ access_token, user });
    } catch (err) {
      return next(err);
    }
  },

  // get all users  admin  routes start here
  async getAllUser(req, res, next) {
    try {
      const users = await Users.find().select("-password");

      res.json(users);
    } catch (err) {
      return next(err);
    }
  },

  // user routes start here
  async updateUser(req, res, next) {
    try {
      const { name, avatar } = req.body;
      await Users.findOneAndUpdate(
        { _id: req.user.id },
        {
          name,
          avatar,
        },
        {
          new: true,
        }
      );
      res.json({ message: "Update Success!" });
    } catch (err) {
      return next(err);
    }
  },
  // onley can admin do
  async updateUsersRole(req, res, next) {
    try {
      const { role } = req.body;

      await Users.findOneAndUpdate(
        {
          _id: req.params.id,
        },
        {
          role,
        },
        {
          new: true,
        }
      );
      res.json({ message: "Update Success!" });
    } catch (err) {
      return next(err);
    }
  },
  // onley can admin do
  async deleteUser(req, res, next) {
    try {
      await Users.findByIdAndDelete(req.params.id);
      res.json({
        message: "Deleted Successful!",
      });
    } catch (err) {
      return next(err);
    }
  },

  async resetPassword(req, res, next) {
    if (!req.user)
      return res.status(400).json({ message: "Invalid Authentication." });

    if (req.user.type !== "register")
      return res.status(400).json({
        message: `Quick login account with ${req.user.type} can't use this function.`,
      });
    try {
      const { password } = req.body;
      if (password < 6) {
        return next(
          CustomErrorHandler.badRequest(
            "Password must be at least 6 charactors long."
          )
        );
      }

      const passwordHash = await bcrypt.hash(password, 12);
      await Users.findOneAndUpdate(
        {
          _id: req.user.id,
        },
        {
          password: passwordHash,
        }
      );
      res.json({ message: "Password successfully changed!" });
    } catch (err) {
      return next(err);
    }
  },

  async forgotPassword(req, res, next) {
    try {
      const { email } = req.body;

      const user = await Users.findOne({ email });
      if (!user)
        return res
          .status(400)
          .json({ message: "This account does not exist." });

      if (user.type !== "register")
        return res.status(400).json({
          message: `Quick login account with ${user.type} can't use this function.`,
        });

      const access_token = generateAccessToken({ id: user._id });

      const url = `${CLIENT_URL}/user/reset/${access_token}`;

      if (validateEmail(email)) {
        sendEmail(email, url, "Forgot password?");
        return res.json({ message: "Success! Please check your email." });
      }
    } catch (err) {
      return next(err);
    }
  },

  async statsUserPerMonth(req, res, next) {
    const date = new Date();
    const lastYear = new Date(date.setFullYear(date.getFullYear() - 1));

    let data;

    try {
      data = await Users.aggregate([
        { $match: { createdAt: { $gte: lastYear } } },
        {
          $project: {
            month: { $month: "$createdAt" },
          },
        },
        {
          $group: {
            _id: "$month",
            total: { $sum: 1 },
          },
        },
      ]);
    } catch (err) {
      return next(err);
    }
    res.json(data);
  },
};

const loginUser = async (user, password, res, req) => {
  const isMatch = await bcrypt.compare(password, user.password);

  if (!isMatch) {
    let msgError =
      user?.type === "register"
        ? "Password is incorrect."
        : `Password is incorrect. This account login with ${user?.type}`;

    return res.status(400).json({ message: msgError });
  }

  const access_token = generateAccessToken({ id: user._id });
  const refresh_token = generateRefreshToken({ id: user._id }, res);

  await Users.findOneAndUpdate(
    { _id: user._id },
    {
      rf_token: refresh_token,
    }
  );
  alertLogger.info(`${user.name} logged in`, {
    userIP: `${ip.address()}`,
  });

  res.json({
    message: "Login Success!",
    access_token,
    user: { ...user._doc, password: "" },
  });
};

const sendMail = async (req, user) => {
  // Email data
  const userAgent = new UserAgent();
  const gip = req.headers["x-forwarded-for"] || req.connection.remoteAddress;
  const geo = geoip.lookup("203.94.72.111");
  const currentDateTime = new Date().toLocaleString();
  const mailOptions = {
    from: "quickshopauth@gmail.com", // Sender's email address
    to: "kavindanim@gmail.com", // Recipient's email address
    subject: "User Logged In", // Email subject
    text: `${user.name} logged in with,
     IP Address : ${ip.address()},
     User Agent : ${req.headers["user-agent"]},
     location   : ${req.url},     
     language   : ${req.headers["accept-language"]}
     country    : ${geo ? geo.country : "Unknown"}
     Region     : ${geo ? geo.region : "Unknown"}    
     time       : ${currentDateTime}

     `, // Email plain text body
  };
  // Send email
  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      console.error("Error sending email: ", error);
    } else {
      console.log("Email sent: ", info.response);
    }
  });
};

module.exports = authCtrl;

function validateEmail(email) {
  const re =
    /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
  return re.test(String(email).toLowerCase());
}
