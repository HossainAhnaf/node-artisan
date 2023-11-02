const { Command } = require("../../lib/Command");

class Test extends Command {
  signature = `test 
        { a: First arg }
        { b: Second arg }
        { c: Third arg }
        { --dog : First opt }`
        
  description = "For testing"
  
  async handle() {
    console.log(this.arguments())
  }
}

module.exports = Test;