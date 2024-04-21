class Command {
	constructor(options) {
		this.name = options.name;
        this.description = options.description
		this.cooldown = options.cooldown
	}
}

module.exports = Command;