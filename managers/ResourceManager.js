const fs = require('fs');
const path = require('path');
const Event = require('../structures/Event.js');

function formatBytes(x) {
	const units = ['bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
	let l = 0, n = parseInt(x, 10) || 0;
	while (n >= 1024 && ++l) {
		n = n / 1024;
	}
	return n.toFixed(n < 10 && l > 0 ? 1 : 0) + ' ' + units[l];
}

class ResourceManager {
	constructor(client = null) {
		this.client = client;
		this.prefix = '[RESOURCE]';
		this.totalSize = 0;
	}

	async loadData(dir = '') {
		const _path = path.join(__dirname, dir);
		const files = fs.readdirSync(_path);

		for (const file of files) {
			const fullPath = path.join(_path, file);
			const stat = fs.lstatSync(fullPath);
			this.totalSize += parseFloat(stat.size);

			if (stat.isDirectory()) {
				await this.loadData(path.join(dir, file));
			}

			if (file.endsWith('.js')) {
				let _file = require(fullPath);
				if (_file.prototype instanceof Event) {
					let event = new _file();
					if (!event.name || event.once === undefined) {
						console.log(`${this.prefix} Invalid event : ❌ ${file}`);
						continue;
					}

					if (event.once) {
						this.client.once(event.name, event.execute.bind(event, this.client));
					} else {
						this.client.on(event.name, event.execute.bind(event, this.client));
					}

					console.log(`${this.prefix} Loaded event : ✔️  ${file} (${formatBytes(stat.size)})`);
				}
			}
		}
	}
}

module.exports = ResourceManager;
