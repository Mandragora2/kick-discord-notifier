require('log-timestamp');
require('dotenv').config();
const { Client, Events, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const axios = require('axios');
const http = require('http');
const https = require('https');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

let isLive = false;
let messageSent = false;
let index = 0;
let retries = 0;
const stats = {
	success: 0,
	error: 0,
	total: 0,
};

const livestreamUrl = 'https://kick.com/api/v1/channels/' + process.env.STREAMER_SLUG;

function poll(chan) {
	const headers = {
		'Accept': 'text/html,application/xhtml+xml,application/xml',
		'Accept-Encoding': 'gzip, deflate',
		'User-Agent': 'Firefox/108.0' + index,
		'Cookie': '',
	};

	console.log('Polling kick…');
	index++;

	axios.get(livestreamUrl, {
		headers: headers,
		httpAgent: new http.Agent({ keepAlive: false }),
		httpsAgent: new https.Agent({ keepAlive: false }),
	})
		.then((response) => {
			stats.success++;
			retries = 0;
			const botUser = chan.client.user;
			data = response.data;
			if (data.livestream === null) {
				console.log(isLive ? 'Stream switch to offline.' : 'Streamer is offline.');
				isLive = false;
				messageSent = false;
				botUser.setPresence({ activities: [] });
				return;
			}

			if (messageSent) {
				return;
			}

			console.log('Streamer is live, send message.');

			const date = new Date(data.livestream.created_at);

			console.log(data.livestream);

			const embed = new EmbedBuilder()
				.setTitle(data.livestream.session_title)
				.setURL(`https://kick.com/${data.slug}`)
				.setDescription(`https://kick.com/${data.slug}`)
				.setThumbnail(data.user.profile_pic)
				.setImage(data.livestream.thumbnail.url)
				.setTimestamp(new Date(date.getTime() - (date.getTimezoneOffset() * 60 * 1000)))
				.setFooter({ text: 'Kick' })
        ;

			chan.send({ embeds: [embed], content: `@everyone <:Kick:1101247960320327702> LIVE ON SUR KICK <:Kick:1101247960320327702>\n\n➡️ <https://kick.com/${data.slug}> ⬅️\n\n` });
			messageSent = true;
			isLive = true;
			botUser.setPresence({ activities: [{ name: `${data.user.username} sur Kick`, type: 3, url: `https://kick.com/${data.slug}` }] });
		},
		(err) => {
			stats.error++;
			retries++;
			console.error(`Error: ${err.response.status} / ${err.response.statusText}. Retry: ${retries}`);
		})
		.finally(() => {
			stats.total++;
			const botUser = chan.client.user;
			if (retries > 0) {
				botUser.setPresence({ activities: [{ name: 'Kick API (unstable)', type: 0 }] });
			}
			else if (retries === 0 && !isLive) {
				botUser.setPresence({ activities: [{ name: 'Kick API is ok \\o/', type: 0 }] });
			}
			if (stats.total % 60 === 0) {
				console.log(`Call stats: ${stats.total} calls, ${(stats.success * 100 / stats.total).toFixed(2)}% success, ${(stats.error * 100 / stats.total).toFixed(2)}% error.`);
			}
		});
}

client.once(Events.ClientReady, async c => {
	console.log(`Ready! Logged in as ${c.user.tag}`);

	c.channels.fetch(process.env.CHAN_ID).then(
		(channel) => {
			poll(channel);
			setInterval(() => {
				poll(channel);
			}, 1000 * 60);
		},
		(err) => {
			console.error(err);
		},
	);

	process.on('SIGINT', function() {
		console.log(`Call stats: ${stats.total} calls, ${(stats.success * 100 / stats.total).toFixed(2)}% success, ${(stats.error * 100 / stats.total).toFixed(2)}% error.`);
		c.destroy();
		process.exit();
	});

	process.on('unhandledRejection', (err, p) => {
		console.log('An unhandledRejection occurred');
		console.log(`Rejected Promise: ${p}`);
		console.log('Rejection:');
		console.error(err);
	});
});

client.login(process.env.TOKEN);