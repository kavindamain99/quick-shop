const { createLogger, transports, format } = require("winston");
require("winston-mongodb");

const formatConf = format.combine(
  format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
  format.metadata(),
  format.json(),
  format.prettyPrint(),
  format.errors({ stack: true })
);

const mongodbTransport = new transports.MongoDB({
  level: "info", // Adjust the log level as needed
  db: process.env.MONGO_URL,
  options: {
    useUnifiedTopology: true,
  },
  collection: "all_logs", // Specify the collection name
  format: formatConf,
});

const infoLogger = createLogger({
  transports: [mongodbTransport], // Use only the MongoDB transport
  format: formatConf,
  statusLevels: true,
});

const errLogger = createLogger({
  transports: [mongodbTransport], // Use only the MongoDB transport
  format: formatConf,
  statusLevels: true,
});
const alertLogger = createLogger({
  transports: [mongodbTransport], // Use only the MongoDB transport
  format: formatConf,
  statusLevels: true,
});
module.exports = {
  infoLogger,
  errLogger,
  alertLogger,
};

//infoLogger.info("Informational message", { meta: "additional info" });  errLogger.error("An error occurred", { meta: "additional error info" });
