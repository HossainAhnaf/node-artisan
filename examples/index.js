const { NodeArtisan } = require("../lib/NodeArtisan");

NodeArtisan
  .cacheDist("cache/artisan.json")
  .load("examples/commands")
  .parse();
  