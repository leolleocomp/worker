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
let sampleSize = 1;
let buffer = {};

buffer.T = buffer.L = buffer.U = 0.0;

let bufferedToAverage = (buffer) => {
	buffer.T /= sampleSize;
	buffer.L /= sampleSize;
	buffer.U /= sampleSize;
};

let publishBuffer = (client, channel, buffer, variable) => {
    return client.publish(channel, JSON.stringify({x: buffer.date, y: buffer[variable]}));
};


processData.on('processed', () => {
    console.log('processed...', buffer);

	bufferedToAverage(buffer);
	buffer.date = moment().unix().toString();

	let zaddAsync = promisify(client.zadd).bind(client);
	let msg = { x: buffer.date, y: buffer.T };

    console.log('publishing...', buffer);

    publishBuffer(client, 'history:temperature', buffer, 'T');
    publishBuffer(client, 'history:luminancy', buffer, 'L');
    publishBuffer(client, 'history:umidity', buffer, 'U');

    buffer.T = buffer.L = buffer.U = 0.0;
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

