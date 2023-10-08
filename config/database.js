const mongoose = require("mongoose");
const URL =
  "mongodb+srv://kavinda:mern@cluster0.px0cl.mongodb.net/ecom?retryWrites=true&w=majority";

const connectDB = async () => {
  try {
    mongoose.connect(URL, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log("Database Connected");
  } catch (error) {
    console.error("Database connection fail");
  }
};

module.exports = connectDB;
