const { createLogger, transports, format } = require('winston');
const { combine, timestamp, printf } = format;

class MyLogger {
  constructor(nodeEnv) {
    const logLevel = nodeEnv === 'production' ? 'info' : 'debug';
    this.logger = createLogger({
      level: logLevel,
      transports: [new transports.Console()],
      format: combine(
        timestamp(),
        printf(({ level, message, timestamp }) => `${timestamp} ${level}: ${message}`)
      ),
    });
  }

  info(message) {
    this.logger.info(message);
  }

  verbose(message) {
    this.logger.verbose(message);
  }

  warn(message) {
    this.logger.warn(message);
  }

  error(message) {
    this.logger.error(message);
  }
}

module.exports = MyLogger;
