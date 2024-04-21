const { REST } = require("@discordjs/rest");
const { Routes } = require("discord-api-types/v10");
const fs = require('fs');
const path = require('path');
const Command = require('../structures/Command.js');
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
		const SlashCommands = [];
        const rest = new REST({ version: "10" }).setToken(this.client.token);
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

                if (_file.prototype instanceof Command) {
                    let command = new _file();
                    if (!command.name || !command.description) {
                        console.log(`${this.prefix} Invalid command : ❌ ${file}`);
                        continue;
                    }

                    this.client.commands.set(command.name, command);
                    try {
                        SlashCommands.push(command);
                        await rest.put(Routes.applicationCommands(this.client.user.id), { body: SlashCommands });
                    } catch (err) {
                        console.error(err);
                    }

                    this.client.commands.categories = command => {
                        let cats = command ? '' : [];
                        const dir = '../src/modules/';
                        const _path = path.join(__dirname, dir);
                        const categories = fs.readdirSync(_path);

                        categories.forEach((module, key) => {
                            const cmdDir = `${dir}/${module}`;
                            const cmdPath = path.join(__dirname, cmdDir);
                            command ? cats : (cats[module] = []);
                            const files = fs.readdirSync(cmdPath).filter(g => g.endsWith('js'));

                            for (const file of files) {
                                const Command = require(path.join(cmdPath, file));
                                const cmd = new Command();
                                if (!command) cats[module].push(cmd);
                                if (command && command.name == cmd.name) {
                                    return (cats = module);
                                }
                            }
                        });
                        return cats;
                    };

                    console.log(`${this.prefix} Registered Slash : ✔️  ${command.name} (${formatBytes(stat.size)})`);
                }
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
