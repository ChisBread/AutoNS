"nodejs";
const $java = $autojs.java;
require('rhino').install();
const { showToast } = require('toast');
const usbserial = require('./usbserial');
async function Main() {
    serial = await usbserial.ConnectTo(baudRate = 115200);
    if (!serial) {
        console.log("error connect");
        return;
    }
    usbserial.SerialReadListAsync(serial, (intList) => {
        let buffer = Buffer(intList);
        console.log("received: " + buffer.toString('hex'));
    });
    for (let i = 0; i < 10; i++) {
        usbserial.SerialWriteListAsync(serial, [0xA5, 0xA5, 0x81]);
        await new Promise(r => setTimeout(r, 100));
    }
    serial.close();
}
console.log(process.versions);
showToast('Hello, Auto.js Pro with Node.js!');
Main().catch(console.error);
showToast('Byebye!');
