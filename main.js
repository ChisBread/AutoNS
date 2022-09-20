"nodejs";
const $java = $autojs.java;
require('rhino').install();
const { showToast } = require('toast');
const { select } = require('accessibility');
const usbserial = require('./usbserial');
async function Main() {
    // connect to serial and auto confirm
    let confirm = select({ text: "确定", className: "android.widget.Button" }).atLeast(1).maxRetries(10).timeout(10000).first().then((res) => {
        res.click();
    }).catch((e) => { console.log(e); });
    serial = await usbserial.ConnectTo(baudRate = 115200);
    await confirm;
    if (!serial) {
        console.log("error connect");
        return;
    }
    // serial read callback
    usbserial.SerialReadListAsync(serial, (intList) => {
        let buffer = Buffer(intList);
        console.log("received: " + buffer.toString('hex'));
    });
    // write byte
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
