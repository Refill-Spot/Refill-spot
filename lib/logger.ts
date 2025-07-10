/**
 * 환경별 로깅 시스템
 * 개발 환경에서는 모든 로그를 출력하고, 배포 환경에서는 중요한 로그만 출력
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  NONE = 4,
}

export interface LoggerConfig {
  level: LogLevel;
  enableConsole: boolean;
  enableTimestamp: boolean;
  enableColors: boolean;
  prefix?: string;
}

class Logger {
  private config: LoggerConfig;

  constructor(config?: Partial<LoggerConfig>) {
    const isDevelopment = process.env.NODE_ENV === "development";
    const isTest = process.env.NODE_ENV === "test";
    
    // 기본 설정
    this.config = {
      level: this.getDefaultLogLevel(),
      enableConsole: isDevelopment || isTest,
      enableTimestamp: isDevelopment,
      enableColors: isDevelopment,
      prefix: process.env.NEXT_PUBLIC_APP_NAME || "RefillSpot",
      ...config,
    };
  }

  private getDefaultLogLevel(): LogLevel {
    const env = process.env.NODE_ENV;
    const customLevel = process.env.NEXT_PUBLIC_LOG_LEVEL;

    // 환경 변수로 로그 레벨 커스터마이징 가능
    if (customLevel) {
      switch (customLevel.toUpperCase()) {
        case "DEBUG": return LogLevel.DEBUG;
        case "INFO": return LogLevel.INFO;
        case "WARN": return LogLevel.WARN;
        case "ERROR": return LogLevel.ERROR;
        case "NONE": return LogLevel.NONE;
      }
    }

    // 환경별 기본 로그 레벨
    switch (env) {
      case "development": return LogLevel.DEBUG;
      case "test": return LogLevel.WARN;
      case "production": return LogLevel.ERROR;
      default: return LogLevel.INFO;
    }
  }

  private shouldLog(level: LogLevel): boolean {
    return this.config.enableConsole && level >= this.config.level;
  }

  private formatMessage(level: string, message: string, category?: string): string {
    const parts: string[] = [];

    if (this.config.enableTimestamp) {
      parts.push(new Date().toISOString());
    }

    if (this.config.prefix) {
      parts.push(`[${this.config.prefix}]`);
    }

    parts.push(`[${level}]`);

    if (category) {
      parts.push(`[${category}]`);
    }

    parts.push(message);

    return parts.join(" ");
  }

  private getColorCode(level: LogLevel): string {
    if (!this.config.enableColors) {
return "";
}
    
    switch (level) {
      case LogLevel.DEBUG: return "\x1b[36m"; // Cyan
      case LogLevel.INFO: return "\x1b[32m";  // Green
      case LogLevel.WARN: return "\x1b[33m";  // Yellow
      case LogLevel.ERROR: return "\x1b[31m"; // Red
      default: return "";
    }
  }

  private getResetCode(): string {
    return this.config.enableColors ? "\x1b[0m" : "";
  }

  /**
   * 디버그 로그 (개발 환경에서만 출력)
   */
  debug(message: string, data?: any, category?: string): void {
    if (!this.shouldLog(LogLevel.DEBUG)) {
return;
}

    const colorCode = this.getColorCode(LogLevel.DEBUG);
    const resetCode = this.getResetCode();
    const formattedMessage = this.formatMessage("DEBUG", message, category);

    if (data !== undefined) {
      console.log(`${colorCode}${formattedMessage}${resetCode}`, data);
    } else {
      console.log(`${colorCode}${formattedMessage}${resetCode}`);
    }
  }

  /**
   * 정보 로그 (일반적인 애플리케이션 흐름)
   */
  info(message: string, data?: any, category?: string): void {
    if (!this.shouldLog(LogLevel.INFO)) {
return;
}

    const colorCode = this.getColorCode(LogLevel.INFO);
    const resetCode = this.getResetCode();
    const formattedMessage = this.formatMessage("INFO", message, category);

    if (data !== undefined) {
      console.info(`${colorCode}${formattedMessage}${resetCode}`, data);
    } else {
      console.info(`${colorCode}${formattedMessage}${resetCode}`);
    }
  }

  /**
   * 경고 로그 (주의가 필요한 상황)
   */
  warn(message: string, data?: any, category?: string): void {
    if (!this.shouldLog(LogLevel.WARN)) {
return;
}

    const colorCode = this.getColorCode(LogLevel.WARN);
    const resetCode = this.getResetCode();
    const formattedMessage = this.formatMessage("WARN", message, category);

    if (data !== undefined) {
      console.warn(`${colorCode}${formattedMessage}${resetCode}`, data);
    } else {
      console.warn(`${colorCode}${formattedMessage}${resetCode}`);
    }
  }

  /**
   * 에러 로그 (오류 상황 - 항상 출력)
   */
  error(message: string, error?: any, category?: string): void {
    if (!this.shouldLog(LogLevel.ERROR)) {
return;
}

    const colorCode = this.getColorCode(LogLevel.ERROR);
    const resetCode = this.getResetCode();
    const formattedMessage = this.formatMessage("ERROR", message, category);

    if (error !== undefined) {
      // Error 객체인 경우 스택 트레이스 포함
      if (error instanceof Error) {
        console.error(`${colorCode}${formattedMessage}${resetCode}`, {
          message: error.message,
          stack: error.stack,
          name: error.name,
        });
      } else {
        console.error(`${colorCode}${formattedMessage}${resetCode}`, error);
      }
    } else {
      console.error(`${colorCode}${formattedMessage}${resetCode}`);
    }
  }

  /**
   * 로그 설정 업데이트
   */
  updateConfig(config: Partial<LoggerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * 현재 로그 설정 반환
   */
  getConfig(): LoggerConfig {
    return { ...this.config };
  }

  /**
   * 특정 카테고리용 로거 생성
   */
  createCategoryLogger(category: string): CategoryLogger {
    return new CategoryLogger(this, category);
  }
}

/**
 * 카테고리별 로거 (특정 모듈이나 기능용)
 */
class CategoryLogger {
  constructor(private logger: Logger, private category: string) {}

  debug(message: string, data?: any): void {
    this.logger.debug(message, data, this.category);
  }

  info(message: string, data?: any): void {
    this.logger.info(message, data, this.category);
  }

  warn(message: string, data?: any): void {
    this.logger.warn(message, data, this.category);
  }

  error(message: string, error?: any): void {
    this.logger.error(message, error, this.category);
  }
}

// 기본 로거 인스턴스 생성 및 내보내기
export const logger = new Logger();

// 카테고리별 로거들
export const mapLogger = logger.createCategoryLogger("MAP");
export const authLogger = logger.createCategoryLogger("AUTH");
export const apiLogger = logger.createCategoryLogger("API");
export const dbLogger = logger.createCategoryLogger("DB");
export const geolocationLogger = logger.createCategoryLogger("GEO");

// 레거시 console 대체용 함수들 (점진적 마이그레이션용)
export const log = {
  debug: (message: string, data?: any) => logger.debug(message, data),
  info: (message: string, data?: any) => logger.info(message, data),
  warn: (message: string, data?: any) => logger.warn(message, data),
  error: (message: string, error?: any) => logger.error(message, error),
};

// 개발자를 위한 전역 로거 (브라우저 console에서 접근 가능)
if (typeof window !== "undefined" && process.env.NODE_ENV === "development") {
  (window as any).logger = logger;
}

export default logger;