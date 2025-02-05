import { Command } from "./Command";
import { NodeArtisanConfig } from "./interfaces/NodeArtisanConfig";
import { parseArguments, parseDescriptions } from "./utils/parser";
import { join, dirname } from "path";
import { readdirSync, writeFileSync, mkdirSync } from "fs";
import prompts, { Choice } from "prompts";
import { textSync } from "figlet";
import { yellow, green, bgRed } from "chalk";


export class NodeArtisan {
  /**
   * Global options that available on all commands
  */
  static readonly $globalOptions = `
    { --h|help: Show help of a command }
    { --v|verbose: Get verbose output }
  `;
  
  /**
   * Default Config of Node Artisan
  */
  static $config: NodeArtisanConfig = {
    name: "NodeArtisan",
    root: process.cwd(),
    cacheDist: "node-artisan.json",
    load: [],
    commands: []
  };
  
  /**
   * Setup node artisan
  */
  static setup(config: Partial<NodeArtisanConfig>) {
    Object.assign(this.$config, config);
  }
  
  /**
   * Specify cache distination
  */
  static projectName(name: string) {
    this.$config.name = name;
    return this;
  }
  
  /**
   * Specify cache distination
  */
  static cacheDist(path: string) {
    this.$config.cacheDist = path;
    return this;
  }
  
  /**
   * Specify load directories
  */
  static loadFrom(dirs: string[]) {
    this.$config.load = dirs;
    return this;
  }
  
  /**
   * Add load directory
  */
  static load(dir: string) {
    this.$config.load.push(dir);
    return this;
  }
  
  /**
   * Specify commands path
  */
  static commands(paths: string[]) {
    this.$config.commands = paths;
    return this;
  }
  
  /**
   * Add command path
  */
  static add(path: string) {
    this.$config.commands.push(path);
    return this;
  }
  
  
  /**
   * Resolve path to absolute
  */
  static $resolvePath(...paths: string[]) {
    return join(this.$config.root, ...paths);
  }
  
  /**
   * Returns cached commands
  */
  static $getCacheCommands(): string[] {
    try {
      return require(this.$resolvePath(this.$config.cacheDist));
    } catch(err) {
      return [];
    }
  }
  
  /**
   * Get command class from path
  */
  static async $getCommandClass(path: string) {
    const fileData = await import(path);
    const Command = typeof fileData === "function"
      ? fileData
      : fileData.default;
    if(typeof Command !== "function")
      throw new Error(`No command class found from path: "${path}"`);
    return Command;
  }
  
  static $checkCoreCommand(base: string) {
    if(base === "list")
      this.showCommandList();
    else if(base === "cache")
      this.cacheCommands();
  }
 
  /**
   * Get all registered command classes
  */
  static $getCommands() {
    const commandPaths = [ ...this.$config.commands.map(path => this.$resolvePath(path)), ...this.$getCacheCommands() ];
    const importPromises = commandPaths.map(path => this.$getCommandClass(path))
    return Promise.all(importPromises);
  }
  
  /**
   * Suggest similar commands 
  */
  static async $suggestSimilars(base: string, similars: string[]) {
    const choices = similars.sort().reduce((accumulator: Choice[], signature: string) => {
      accumulator.push({ title: signature });
      return accumulator;
    }, []);
  
    const { value } = await prompts({
      type: 'autocomplete',
      name: 'value',
      message: `Command "${base}" is not defined\n Did you mean one of these`,
      choices,
      initial: base
    });
    return value;
  }
  
  /**
   * Execute a command
  */
  static async exec(command: Command, input: string[] = []) {
    if(input.includes("--help") || input.includes("-h")) {
      this.showHelp(command);
    }
    const { args, opts } = parseArguments(this.$globalOptions + command.pattern, input) as any;
    command.setup(args, opts);
    await command.handle();
  }
  
  /**
   * Call a command by base
  */
  static async call(base: string, input: string[] = []) {
    this.$checkCoreCommand(base);
    
    const Commands = await this.$getCommands();
    const similarCommands: Record<string, Command> = {};
    
    for(const Command of Commands) {
      const command = new Command();
      if(command.base === base)
        return await this.exec(command, input);
      else if (command.base.startsWith(base))
        similarCommands[command.base] = command;
    }
    
    const similars = Object.keys(similarCommands);
    
    if (similars.length === 0) {
      console.log(bgRed(`No Command Found`))
      process.exit(1)
    }

    const newBase = await this.$suggestSimilars(base, similars);
    if(newBase) {
      await this.exec(similarCommands[newBase], input);
    }
  }
  
  /**
   * Parse arguments and start cli
  */
  static parse(args = process.argv) {
    const [baseInput, ...argsAndOpts] = args.splice(2);
    if(baseInput) {
      return this.call(baseInput, argsAndOpts)
    }
    console.log(textSync(this.$config.name), "\n\n");
    this.showCommandList();
  }
  
  /**
   * Print all available commands
  */
  static async showCommandList() {
    console.log("Available Commands:\n");
    const Commands = await this.$getCommands();
    Commands.forEach(Command => {
      const command = new Command();
      const padding = ' '.repeat(30 - command.base.length);
      console.log(`  ${green(command.base)}${padding}${command.description}`);
    });
    process.exit(0);
  }
  
  /**
   * Show help of a command
  */
  static showHelp(command: Command) {
    console.log(`${yellow("Description")}:\n  ${command.description}\n`);
    const { args, opts } = parseDescriptions(this.$globalOptions + command.pattern) as any;
    if(args) {
      let argsList = "";
      for(const name in args) {
        const padding = ' '.repeat(20 - name.length);
        argsList += `  ${green(name)}${padding}${args[name]}\n`;
      }
      console.log(`${yellow("Arguments")}:\n${argsList}`);
    }
    
    let optsList = "";
    for(const name in opts) {
      const padding = ' '.repeat(20 - name.length);
      optsList += `  ${green(name)}${padding}${opts[name]}\n`;
    }
    console.log(`${yellow("Options")}:\n${optsList}`);
    process.exit(0);
  }
  
  /**
   * Cache commands path from load dir
  */
  static cacheCommands() {
    const absoluteCacheDist = this.$resolvePath(this.$config.cacheDist);
    const paths: string[] = [];
    this.$config.load.forEach(dir => {
      readdirSync(this.$resolvePath(dir)).filter(fileName => fileName.endsWith(".js")).forEach((fileName: string) => {
        const fullPath = this.$resolvePath(dir, fileName);
        const CommandClass = require(fullPath);
        if(typeof CommandClass === "function" && CommandClass.prototype instanceof Command) {
          if(!new CommandClass().signature)
            throw new Error(`Signature required in command: "${join(dir, fileName)}"`);
          paths.push(fullPath)
        }
      });
    });
    mkdirSync(dirname(absoluteCacheDist), { recursive: true })
    writeFileSync(absoluteCacheDist, JSON.stringify(paths));
    process.exit(0);
  }
}