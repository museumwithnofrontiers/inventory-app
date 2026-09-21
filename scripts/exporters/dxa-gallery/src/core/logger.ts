import chalk from 'chalk'

export class Logger {
  private name: string

  constructor(name: string) {
    this.name = name
  }

  info(message: string): void {
    console.log(chalk.cyan(`  [${this.name}] ${message}`))
  }

  success(message: string): void {
    console.log(chalk.green(`  [${this.name}] ✓ ${message}`))
  }

  warning(message: string): void {
    console.log(chalk.yellow(`  [${this.name}] ⚠ ${message}`))
  }

  error(message: string): void {
    console.error(chalk.red(`  [${this.name}] ✗ ${message}`))
  }
}
