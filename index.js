const EventEmitter = require('events');
const Serialport = require('serialport');
const Readline = Serialport.parsers.Readline;
const port = new Serialport('/dev/ttyACM0', {
	baudRate: 9600,
	autoOpen: false,
});
const parser = port.pipe(new Readline({delimiter: '\n'}));
const processData = new EventEmitter();

let numberOfReads = 0;
let sampleSize = 10;
let buffer = {};

let eraseBuffer = (buffer) => {
	buffer.T = 0.0;
	buffer.L = 0.0;
	buffer.U = 0.0;
};

processData.on('processed', () => {
	eraseBuffer(buffer);
	// TODO save data
});

parser.on('data', (data) => {
	let parsedData = JSON.parse(data);

	buffer.T += parsedData.T;
	buffer.U += parsedData.U;
	buffer.L += parsedData.L;

	if (numberOfReads++ >= sampleSize) {
		processData.emit("processed");
	}

	console.log(numberOfReads);
});

port.open((err) => {
	if (err) {
		return console.error(err);
	}
});

