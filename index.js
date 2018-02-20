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

eraseBuffer(buffer);

let bufferedToAverage = (buffer) => {
	buffer.T /= sampleSize;
	buffer.L /= sampleSize;
	buffer.U /= sampleSize;
}

processData.on('processed', () => {
	bufferedToAverage(buffer);
	eraseBuffer(buffer);
	// TODO save data
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

