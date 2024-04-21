class Event {
	constructor(options) {
		this.name = options.name;
		this.once = options.once;
	}
}

module.exports = Event;
