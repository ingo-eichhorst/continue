import { Logger } from './types.js';
import chalk from 'chalk';

export class ConsoleLogger implements Logger {
  private verbose: boolean;

  constructor(verbose: boolean = false) {
    this.verbose = verbose;
  }

  debug(message: string, data?: any): void {
    if (this.verbose) {
      console.log(chalk.gray(`[DEBUG] ${message}`));
      if (data) {
        console.log(chalk.gray(JSON.stringify(data, null, 2)));
      }
    }
  }

  info(message: string, data?: any): void {
    console.log(chalk.blue(`[INFO] ${message}`));
    if (data && this.verbose) {
      console.log(chalk.gray(JSON.stringify(data, null, 2)));
    }
  }

  warn(message: string, data?: any): void {
    console.warn(chalk.yellow(`[WARN] ${message}`));
    if (data && this.verbose) {
      console.warn(chalk.gray(JSON.stringify(data, null, 2)));
    }
  }

  error(message: string, error?: Error | any): void {
    console.error(chalk.red(`[ERROR] ${message}`));
    if (error) {
      if (error instanceof Error) {
        console.error(chalk.red(error.message));
        if (this.verbose && error.stack) {
          console.error(chalk.gray(error.stack));
        }
      } else {
        console.error(chalk.gray(JSON.stringify(error, null, 2)));
      }
    }
  }
}