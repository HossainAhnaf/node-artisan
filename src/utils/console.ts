import { bgRed, bold } from "chalk";

export function consoleError(message: string) {
  const helpMessage = "(use -h for help)";
  const margin = " ".repeat(message.length + helpMessage.length + 4 );
  console.log("\r")
  console.log(bgRed(margin))
  console.log(bgRed(` ${bold(message)}  ${helpMessage} `))
  console.log(bgRed(margin))
  console.log("\r")
  process.exit(1)
}

