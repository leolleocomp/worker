const {promisify} = require('util');
const EventEmitter = require('events');
const Serialport = require('serialport');
const moment = require('moment');
const Readline = Serialport.parsers.Readline;
const port = new Serialport('/dev/ttyACM0', {
	baudRate: 9600,
	autoOpen: false,
});
const parser = port.pipe(new Readline({delimiter: '\n'}));
const processData = new EventEmitter();
const redis = require('redis');

let client = redis.createClient();

client.on('error', (err) => {
	console.error('Error: ' + err);
});

let numberOfReads = 0;
let sampleSize = 10;
let buffer = {};

let bufferedToAverage = (buffer) => {
	buffer.T /= sampleSize;
	buffer.L /= sampleSize;
	buffer.U /= sampleSize;
};

let eraseBuffer = (buffer) => {
	buffer.T = 0.0;
	buffer.L = 0.0;
	buffer.U = 0.0;
};

processData.on('processed', () => {
	bufferedToAverage(buffer);
	buffer.date = moment().unix().toString();

	let zaddAsync = promisify(client.zadd).bind(client);
	let msg = { name: buffer.date, value: buffer.T };

	zaddAsync('history:temperature', buffer.date, buffer.T)
		.then(data => client.publish('history:temperature', JSON.stringify(msg)))
		.catch(error => console.error(error));

	msg.value = buffer.L;

	zaddAsync('history:luminancy', buffer.date, buffer.L)
		.then(data => client.publish('history:luminosity', JSON.stringify(msg)))
		.catch(error => console.error(error));

	msg.value = buffer.U;

	zaddAsync('history:umidity', buffer.date, buffer.L)
		.then(data => client.publish('history:umidity', JSON.stringify(msg)))
		.catch(error => console.error(error));

	eraseBuffer(buffer);
});

parser.on('data', (data) => {
	let parsedData = JSON.parse(data);

	console.log('received: ', parsedData);

	buffer.T += parsedData.T;
	buffer.U += parsedData.U;
	buffer.L += parsedData.L;

	if (++numberOfReads >= sampleSize) {
		numberOfReads = 0;
		processData.emit("processed");
	}
});

port.open((err) => {
	if (err) {
		return console.error(err);
	}
});

